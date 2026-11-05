import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { ValidationError } from './validate.ts';

/*
 * Accounts, login sessions and password resets.
 *
 * Passwords are hashed with scrypt; the parameters are stored with each hash so they
 * can be raised later without breaking existing logins. Session and reset tokens are
 * random, handed to the browser once, and only their SHA-256 is stored, so a copy of
 * the database (or a backup) can't be used to sign in.
 */

export interface User {
  id: string;
  email: string;
}

const SCRYPT = { N: 2 ** 16, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const KEY_LENGTH = 64;
export const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;
export const SESSION_DAYS = 90;
/** Sessions used with less than this left are extended, so active people stay signed in. */
const RENEW_DAYS = 60;
const RESET_MINUTES = 60;
const DAY = 86_400_000;

const scrypt = (password: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(password, salt, KEY_LENGTH, opts, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Checked against when the email is unknown, so a miss takes as long as a wrong password. */
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

const newToken = () => randomBytes(32).toString('base64url');
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function normaliseEmail(raw: unknown): string {
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/.test(email)) {
    throw new ValidationError('Enter a valid email address');
  }
  return email;
}

export function checkPassword(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < MIN_PASSWORD) throw new ValidationError(`Use at least ${MIN_PASSWORD} characters`);
  if (raw.length > MAX_PASSWORD) throw new ValidationError('That password is too long');
  return raw;
}

export class AuthError extends Error {}

export function accounts(db: DatabaseSync, { onFirstUser }: { onFirstUser: (userId: string) => void }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS password_resets (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  const byEmail = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?');
  const iso = (ms: number) => new Date(ms).toISOString();

  function startSession(userId: string, now = Date.now()) {
    const token = newToken();
    const expires = now + SESSION_DAYS * DAY;
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(digest(token), userId, iso(now), iso(expires));
    return { token, expires };
  }

  return {
    async signUp(rawEmail: unknown, rawPassword: unknown) {
      const email = normaliseEmail(rawEmail);
      const passwordHash = await hashPassword(checkPassword(rawPassword));
      if (byEmail.get(email)) throw new ValidationError('An account with that email already exists — sign in instead');
      const id = randomUUID();
      const first = !(db.prepare('SELECT 1 FROM users LIMIT 1').get());
      db.exec('BEGIN');
      try {
        db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(id, email, passwordHash, iso(Date.now()));
        // Data from before accounts existed belongs to whoever signs up first.
        if (first) onFirstUser(id);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        if (err instanceof Error && /UNIQUE/.test(err.message)) throw new ValidationError('An account with that email already exists — sign in instead');
        throw err;
      }
      return { user: { id, email }, session: startSession(id) };
    },

    async logIn(rawEmail: unknown, rawPassword: unknown) {
      const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
      const password = typeof rawPassword === 'string' ? rawPassword : '';
      const row = byEmail.get(email) as { id: string; email: string; password_hash: string } | undefined;
      const ok = await verifyPassword(password, row?.password_hash ?? (await DUMMY_HASH));
      if (!row || !ok) throw new AuthError('That email and password don’t match');
      return { user: { id: row.id, email: row.email }, session: startSession(row.id) };
    },

    /** The signed-in user for a session token, extending the session if it's getting old. */
    session(token: string | undefined, now = Date.now()): { user: User; renewed?: { token: string; expires: number } } | null {
      if (!token) return null;
      const row = db.prepare(`
        SELECT u.id, u.email, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?
      `).get(digest(token)) as { id: string; email: string; expires_at: string } | undefined;
      if (!row) return null;
      const expires = Date.parse(row.expires_at);
      if (expires <= now) {
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
        return null;
      }
      const user = { id: row.id, email: row.email };
      if (expires - now > RENEW_DAYS * DAY) return { user };
      const next = now + SESSION_DAYS * DAY;
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(iso(next), digest(token));
      return { user, renewed: { token, expires: next } };
    },

    logOut(token: string | undefined) {
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    },

    /** A one-hour, single-use reset token for the account, or null if there's no such account. */
    requestReset(rawEmail: unknown, now = Date.now()): { email: string; token: string } | null {
      const email = normaliseEmail(rawEmail);
      const row = byEmail.get(email) as { id: string; email: string } | undefined;
      if (!row) return null;
      const token = newToken();
      // Only the newest link works.
      db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.id);
      db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(digest(token), row.id, iso(now + RESET_MINUTES * 60_000));
      return { email: row.email, token };
    },

    /** Sets a new password from a reset link, signs out every device, and signs this one in. */
    async resetPassword(token: unknown, rawPassword: unknown, now = Date.now()) {
      const password = checkPassword(rawPassword);
      const hash = typeof token === 'string' ? digest(token) : '';
      const row = db.prepare(`
        SELECT r.user_id, r.expires_at, u.email FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token_hash = ?
      `).get(hash) as { user_id: string; expires_at: string; email: string } | undefined;
      if (!row || Date.parse(row.expires_at) <= now) {
        throw new AuthError('This reset link has expired or was already used. Ask for a new one.');
      }
      const passwordHash = await hashPassword(password);
      db.exec('BEGIN');
      try {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, row.user_id);
        db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { user: { id: row.user_id, email: row.email }, session: startSession(row.user_id, now) };
    },
  };
}

/**
 * Counts attempts per key in a sliding window, to slow down password guessing and
 * stop the reset form being used to flood someone's inbox.
 */
export function limiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** True if this attempt is allowed; records it either way. */
    allow(key: string, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 10_000) for (const [k, v] of hits) if (now - v[v.length - 1] >= windowMs) hits.delete(k);
      return recent.length <= max;
    },
    clear(key: string) {
      hits.delete(key);
    },
  };
}
