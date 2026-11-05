import type { AppState, Exercise, NewExercise, SyncOp, SyncResult } from '../shared/types.ts';

/** Thrown when the server could not be reached at all (as opposed to rejecting the request). */
export class NetworkError extends Error {}

/** Thrown when the session has ended (signed out elsewhere, expired, or password reset). */
export class SignedOutError extends Error {}

export interface User {
  id: string;
  email: string;
}

/** Called when a data request finds the session gone, so the app can return to sign-in. */
let onSignedOut: () => void = () => {};
export const setSignedOutHandler = (fn: () => void) => {
  onSignedOut = fn;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' });
  } catch {
    throw new NetworkError('You’re offline');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body.error ?? `Request failed (${res.status})`;
    // A 401 from the sign-in forms is just a wrong password; anywhere else the session is over.
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      onSignedOut();
      throw new SignedOutError(message);
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export interface BackupStatus {
  latest: { file: string; at: string; bytes: number } | null;
  count: number;
  keep: number;
}

export const api = {
  backups: () => request<BackupStatus>('/api/backups'),
  backupNow: () => post<BackupStatus>('/api/backups'),
  state: () => request<AppState>('/api/state'),
  sync: (ops: SyncOp[]) => post<SyncResult>('/api/sync', { ops }),
  addExercise: (exercise: NewExercise) => post<Exercise>('/api/exercises', exercise),
};

export const auth = {
  me: () => request<{ user: User }>('/api/auth/me'),
  logIn: (email: string, password: string) => post<{ user: User }>('/api/auth/login', { email, password }),
  signUp: (email: string, password: string) => post<{ user: User }>('/api/auth/signup', { email, password }),
  logOut: () => post<{ ok: true }>('/api/auth/logout'),
  forgot: (email: string) => post<{ delivery: 'email' | 'log' }>('/api/auth/forgot', { email }),
  reset: (token: string, password: string) => post<{ user: User }>('/api/auth/reset', { token, password }),
};
