import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { openDb } from './db.ts';
import { isMuscleId } from '../shared/muscles.ts';
import { EXERCISE_METRICS, type ExerciseMetric, type NewEntry, type NewExercise, type WorkoutSet } from '../shared/types.ts';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? resolve('data/fitness.db');
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist');

const db = openDb(DB_PATH);

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
    if (raw.length > 100_000) throw new HttpError(413, 'Body too large');
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  throw new HttpError(400, 'Invalid JSON');
}

function parseSets(value: unknown, metric: ExerciseMetric): WorkoutSet[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new HttpError(400, 'sets must be a non-empty array');
  return value.map((s) => {
    const weight = Number(s?.weight ?? 0);
    if (!Number.isFinite(weight) || weight < 0 || weight > 2000) throw new HttpError(400, 'weight must be 0–2000 kg');
    const rounded = Math.round(weight * 100) / 100;
    if (metric === 'time') {
      const seconds = Number(s?.seconds);
      if (!Number.isInteger(seconds) || seconds < 1 || seconds > 36_000) throw new HttpError(400, 'seconds must be a positive integer');
      return { reps: 0, weight: rounded, seconds };
    }
    const reps = Number(s?.reps);
    if (!Number.isInteger(reps) || reps < 1 || reps > 1000) throw new HttpError(400, 'reps must be a positive integer');
    return { reps, weight: rounded };
  });
}

function parseEntry(body: Record<string, unknown>): NewEntry {
  const exerciseId = Number(body.exerciseId);
  const exercise = db.getExercise(exerciseId);
  if (!exercise) throw new HttpError(400, 'Unknown exercise');
  const performedAt = String(body.performedAt ?? '');
  if (Number.isNaN(Date.parse(performedAt))) throw new HttpError(400, 'performedAt must be an ISO date');
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  return { exerciseId, performedAt: new Date(performedAt).toISOString(), sets: parseSets(body.sets, exercise.metric), note };
}

function parseExercise(body: Record<string, unknown>): NewExercise {
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name) throw new HttpError(400, 'name is required');
  if (!isMuscleId(body.muscle)) throw new HttpError(400, 'Unknown muscle');
  const secondary = Array.isArray(body.secondary) ? body.secondary.filter(isMuscleId) : [];
  const metric = EXERCISE_METRICS.find((m) => m === body.metric) ?? 'weight';
  return { name, muscle: body.muscle, secondary, metric };
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });

  if (method === 'GET' && path === '/api/state') return send(res, 200, db.state());

  if (method === 'GET' && path === '/api/export') {
    res.setHeader('content-disposition', `attachment; filename="fitness-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    return send(res, 200, db.state());
  }

  if (method === 'POST' && path === '/api/entries') return send(res, 201, db.addEntry(parseEntry(await readJson(req))));

  if (method === 'POST' && path === '/api/exercises') {
    try {
      return send(res, 201, db.addExercise(parseExercise(await readJson(req))));
    } catch (err) {
      if (err instanceof Error && /UNIQUE/.test(err.message)) throw new HttpError(409, 'An exercise with that name already exists');
      throw err;
    }
  }

  const entryMatch = path.match(/^\/api\/entries\/(\d+)$/);
  if (method === 'DELETE' && entryMatch) {
    if (!db.deleteEntry(Number(entryMatch[1]))) throw new HttpError(404, 'Entry not found');
    res.writeHead(204).end();
    return;
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
    console.error(err);
    send(res, 500, { error: 'Internal error' });
  }
}).listen(PORT, () => console.log(`Fitness tracker listening on :${PORT} (db: ${DB_PATH})`));
