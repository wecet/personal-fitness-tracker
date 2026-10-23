import type { AppState, Exercise, NewExercise, SyncOp, SyncResult } from '../shared/types.ts';

/** Thrown when the server could not be reached at all (as opposed to rejecting the request). */
export class NetworkError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } });
  } catch {
    throw new NetworkError('You’re offline');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  state: () => request<AppState>('/api/state'),
  sync: (ops: SyncOp[]) => request<SyncResult>('/api/sync', { method: 'POST', body: JSON.stringify({ ops }) }),
  addExercise: (exercise: NewExercise) =>
    request<Exercise>('/api/exercises', { method: 'POST', body: JSON.stringify(exercise) }),
};
