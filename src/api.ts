import type { AppState, Entry, Exercise, NewEntry, NewExercise } from '../shared/types.ts';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  state: () => request<AppState>('/api/state'),
  addEntry: (entry: NewEntry) => request<Entry>('/api/entries', { method: 'POST', body: JSON.stringify(entry) }),
  deleteEntry: (id: number) => request<void>(`/api/entries/${id}`, { method: 'DELETE' }),
  addExercise: (exercise: NewExercise) =>
    request<Exercise>('/api/exercises', { method: 'POST', body: JSON.stringify(exercise) }),
};
