import { resolve } from 'node:path';
import { accounts } from './accounts.ts';
import { openDb } from './db.ts';

/*
 * Admin tasks run on the server itself.
 *
 *   echo 'the password' | node server/cli.ts create-user you@example.com
 *
 * The password is read from stdin so it never appears in the process list. As with
 * signing up in the app, the first account created gets the data from before accounts.
 */

async function readStdin() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw.replace(/\r?\n$/, '');
}

const [command, email] = process.argv.slice(2);
const db = openDb(process.env.DB_PATH ?? resolve('data/fitness.db'));
const users = accounts(db.handle, { onFirstUser: (id) => db.claimUnowned(id) });

if (command === 'create-user' && email) {
  const { user } = await users.signUp(email, await readStdin());
  const { records } = db.state(user.id);
  const total = Object.values(records).reduce((n, list) => n + list.length, 0);
  console.log(`Created ${user.email} with ${total} records`);
} else {
  console.error('Usage: echo PASSWORD | node server/cli.ts create-user EMAIL');
  process.exit(1);
}
