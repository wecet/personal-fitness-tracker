import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { backup, type DatabaseSync } from 'node:sqlite';

/*
 * Daily copies of the database, kept outside the Docker volume (see compose.yaml).
 * SQLite's online backup API takes a consistent snapshot while the app keeps
 * running; each copy is written to a temp file and renamed into place, so a
 * half-written backup never replaces a good one. One file per day, newest
 * KEEP kept.
 */

const FILE = /^fitness-(\d{4}-\d{2}-\d{2})\.db$/;
const CHECK_EVERY_MS = 60 * 60 * 1000;

export interface BackupStatus {
  /** Newest backup, if any. */
  latest: { file: string; at: string; bytes: number } | null;
  count: number;
  keep: number;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function backups(db: DatabaseSync, dir: string, { keep = 30, now = () => new Date() } = {}) {
  mkdirSync(dir, { recursive: true });
  const list = () => readdirSync(dir).filter((f) => FILE.test(f)).sort();
  let running: Promise<string> | null = null;

  /** Back up now (replacing today's copy) and prune old ones. */
  function run(): Promise<string> {
    running ??= (async () => {
      const file = `fitness-${dayKey(now())}.db`;
      const tmp = join(dir, `.${file}.tmp`);
      try {
        await backup(db, tmp);
        renameSync(tmp, join(dir, file));
      } finally {
        rmSync(tmp, { force: true });
      }
      for (const old of list().slice(0, -keep)) rmSync(join(dir, old));
      return file;
    })().finally(() => (running = null));
    return running;
  }

  /** Back up if today's copy is missing. */
  async function tick() {
    if (!list().includes(`fitness-${dayKey(now())}.db`)) await run();
  }

  function status(): BackupStatus {
    const files = list();
    const newest = files.at(-1);
    const info = newest ? statSync(join(dir, newest)) : null;
    return {
      latest: newest && info ? { file: newest, at: info.mtime.toISOString(), bytes: info.size } : null,
      count: files.length,
      keep,
    };
  }

  /** Check once now and then hourly, so a copy is made each day the server is up. */
  function schedule(onError: (err: unknown) => void) {
    const check = () => tick().catch(onError);
    check();
    return setInterval(check, CHECK_EVERY_MS);
  }

  return { run, tick, status, list, schedule };
}
