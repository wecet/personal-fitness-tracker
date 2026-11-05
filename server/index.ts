import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { accounts, AuthError, limiter, SESSION_DAYS, type User } from './accounts.ts';
import { backups } from './backup.ts';
import { openDb } from './db.ts';
import { resetEmail } from './emails.ts';
import { mailConfigFromEnv, sendMail } from './mail.ts';
import { newExercise, ValidationError } from './validate.ts';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? resolve('data/fitness.db');
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');
const BACKUP_DIR = resolve(process.env.BACKUP_DIR ?? join(dirname(DB_PATH), 'backups'));

/** Where reset links point. Set it so links never depend on the Host header a request claims. */
const APP_URL = process.env.APP_URL?.replace(/\/$/, '') || undefined;

const db = openDb(DB_PATH);
const users = accounts(db.handle, { onFirstUser: (id) => db.claimUnowned(id) });
const backup = backups(db.handle, BACKUP_DIR);
backup.schedule((err) => console.error('Backup failed:', err));
const mail = mailConfigFromEnv();
if (!mail) console.warn('SMTP_USER / SMTP_PASS not set: password reset links will be written to this log instead of emailed.');

// Slow down password guessing and stop the reset form flooding an inbox.
const LIMITS = {
  loginEmail: limiter(5, 15 * 60_000),
  loginIp: limiter(30, 15 * 60_000),
  signupIp: limiter(10, 60 * 60_000),
  resetEmail: limiter(3, 60 * 60_000),
  resetIp: limiter(10, 60 * 60_000),
};
const COOKIE = 'tempo_session';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 5_000_000) throw new HttpError(413, 'Body too large');
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  throw new HttpError(400, 'Invalid JSON');
}

const clientIp = (req: IncomingMessage) => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
const isLocal = (req: IncomingMessage) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '');

function readCookie(req: IncomingMessage, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** HttpOnly so page scripts can't read it; Secure except on plain-http localhost during development. */
function setSession(req: IncomingMessage, res: ServerResponse, token: string, maxAgeSeconds: number) {
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (!isLocal(req)) parts.push('Secure');
  res.setHeader('set-cookie', parts.join('; '));
}

function signedIn(req: IncomingMessage, res: ServerResponse, { user, session }: { user: User; session: { token: string } }) {
  setSession(req, res, session.token, SESSION_DAYS * 86_400);
  send(res, 200, { user });
}

function resetLink(req: IncomingMessage, token: string) {
  const base = APP_URL ?? `${isLocal(req) ? 'http' : 'https'}://${req.headers.host}`;
  // In the fragment, so the token never reaches a server log or a Referer header.
  return `${base}/#/reset/${token}`;
}

async function handleAuth(req: IncomingMessage, res: ServerResponse, path: string, method: string) {
  const ip = clientIp(req);

  if (method === 'GET' && path === '/api/auth/me') {
    const current = users.session(readCookie(req, COOKIE));
    if (!current) throw new HttpError(401, 'Not signed in');
    return send(res, 200, { user: current.user });
  }

  if (method === 'POST' && path === '/api/auth/signup') {
    if (!LIMITS.signupIp.allow(ip)) throw new HttpError(429, 'Too many new accounts from here. Try again later.');
    const body = await readJson(req);
    return signedIn(req, res, await users.signUp(body.email, body.password));
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await readJson(req);
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!LIMITS.loginEmail.allow(email) || !LIMITS.loginIp.allow(ip)) {
      throw new HttpError(429, 'Too many attempts. Wait a few minutes, or reset your password.');
    }
    const result = await users.logIn(email, body.password);
    LIMITS.loginEmail.clear(email);
    return signedIn(req, res, result);
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    users.logOut(readCookie(req, COOKIE));
    setSession(req, res, '', 0);
    return send(res, 200, { ok: true });
  }

  if (method === 'POST' && path === '/api/auth/forgot') {
    const body = await readJson(req);
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!LIMITS.resetIp.allow(ip)) throw new HttpError(429, 'Too many reset requests. Try again later.');
    // The same answer whether or not the account exists, so the form can't be used to
    // find out who has one. Sending happens in the background for the same reason.
    const reset = LIMITS.resetEmail.allow(email) ? users.requestReset(email) : null;
    if (reset) {
      const link = resetLink(req, reset.token);
      if (mail) {
        sendMail(mail, { to: reset.email, ...resetEmail(link) }).catch((err) => console.error('Reset email failed:', err.message));
      } else {
        console.log(`Password reset for ${reset.email}: ${link}`);
      }
    }
    return send(res, 200, { delivery: mail ? 'email' : 'log' });
  }

  if (method === 'POST' && path === '/api/auth/reset') {
    const body = await readJson(req);
    return signedIn(req, res, await users.resetPassword(body.token, body.password));
  }

  throw new HttpError(404, 'Not found');
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });

  // Writes must be JSON: a cross-site form can't send that without the browser asking first.
  if (method !== 'GET' && !String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new HttpError(415, 'Send JSON');
  }

  if (path.startsWith('/api/auth/')) return handleAuth(req, res, path, method);

  const current = users.session(readCookie(req, COOKIE));
  if (!current) throw new HttpError(401, 'Not signed in');
  if (current.renewed) setSession(req, res, current.renewed.token, SESSION_DAYS * 86_400);
  const { user } = current;

  if (method === 'GET' && path === '/api/state') return send(res, 200, db.state(user.id));

  if (method === 'GET' && path === '/api/backups') return send(res, 200, backup.status());
  if (method === 'POST' && path === '/api/backups') {
    await backup.run();
    return send(res, 200, backup.status());
  }

  if (method === 'GET' && path === '/api/export') {
    res.setHeader('content-disposition', `attachment; filename="fitness-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return send(res, 200, db.state(user.id));
  }

  if (method === 'POST' && path === '/api/sync') {
    const { ops } = await readJson(req);
    if (!Array.isArray(ops)) throw new HttpError(400, 'ops must be an array');
    return send(res, 200, db.sync(user.id, ops));
  }

  if (method === 'POST' && path === '/api/exercises') {
    try {
      return send(res, 201, db.addExercise(user.id, newExercise(await readJson(req))));
    } catch (err) {
      if (err instanceof Error && /UNIQUE/.test(err.message)) throw new HttpError(409, 'An exercise with that name already exists');
      throw err;
    }
  }

  throw new HttpError(404, 'Not found');
}

async function serveStatic(res: ServerResponse, path: string) {
  const file = normalize(join(STATIC_DIR, decodeURIComponent(path)));
  const target = file.startsWith(STATIC_DIR) && (await stat(file).catch(() => null))?.isFile() ? file : join(STATIC_DIR, 'index.html');
  try {
    const body = await readFile(target);
    const immutable = target.includes(`${STATIC_DIR}/assets/`);
    res.writeHead(200, {
      'content-type': MIME[extname(target)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found — run `npm run build` first');
  }
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  try {
    if (path.startsWith('/api/')) await handleApi(req, res, path);
    else await serveStatic(res, path);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    if (err instanceof AuthError) return send(res, 401, { error: err.message });
    if (err instanceof ValidationError) return send(res, 400, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'Internal error' });
  }
}).listen(PORT, () => console.log(`Fitness tracker listening on :${PORT} (db: ${DB_PATH}, backups: ${BACKUP_DIR})`));
