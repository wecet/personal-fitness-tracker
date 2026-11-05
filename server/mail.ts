import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

/*
 * Just enough SMTP to send a password-reset email through Gmail (or any server that
 * takes AUTH PLAIN over implicit TLS on port 465), without adding a dependency.
 */

export interface MailConfig {
  host: string;
  port: number;
  /** Implicit TLS from the first byte (port 465). Off only for tests against a local fake. */
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface Message {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Reads from env: SMTP_USER and SMTP_PASS are required; the rest default to Gmail. */
export function mailConfigFromEnv(env = process.env): MailConfig | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  return {
    host: env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(env.SMTP_PORT ?? 465),
    secure: env.SMTP_SECURE !== 'false',
    user: env.SMTP_USER,
    // Google shows app passwords in groups of four; the spaces aren't part of it.
    pass: env.SMTP_PASS.replace(/\s+/g, ''),
    from: env.MAIL_FROM ?? `Tempo <${env.SMTP_USER}>`,
  };
}

/** Collects server replies; a reply is complete at a line like "250 OK" (no dash after the code). */
function replies(socket: Socket) {
  let buffer = '';
  const queue: string[] = [];
  let waiting: ((reply: string) => void) | null = null;
  let failed: Error | null = null;
  let rejectWaiting: ((err: Error) => void) | null = null;

  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let end: RegExpExecArray | null;
    while ((end = /^\d{3} [^\r\n]*\r?\n/m.exec(buffer))) {
      const reply = buffer.slice(0, end.index + end[0].length);
      buffer = buffer.slice(reply.length);
      if (waiting) {
        const w = waiting;
        waiting = rejectWaiting = null;
        w(reply);
      } else queue.push(reply);
    }
  });
  const fail = (err: Error) => {
    failed = err;
    rejectWaiting?.(err);
  };
  socket.on('error', fail);
  socket.on('close', () => fail(new Error('Mail server closed the connection')));

  return (expected: number) =>
    new Promise<string>((resolve, reject) => {
      const check = (reply: string) => {
        if (reply.startsWith(String(expected))) resolve(reply);
        // Keep only the status line; the reply never contains the password.
        else reject(new Error(`Mail server said: ${reply.trim().split(/\r?\n/).pop()}`));
      };
      if (queue.length) return check(queue.shift()!);
      if (failed) return reject(failed);
      waiting = check;
      rejectWaiting = reject;
    });
}

const address = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from;
const noBreaks = (s: string) => {
  if (/[\r\n]/.test(s)) throw new Error('Header values cannot contain line breaks');
  return s;
};

/** CRLF line endings, and a leading dot doubled so it can't end the message early. */
const smtpBody = (s: string) => s.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');

export function buildMessage(from: string, msg: Message, now = new Date()): string {
  const boundary = `tempo-${now.getTime().toString(36)}`;
  return [
    `From: ${noBreaks(from)}`,
    `To: ${noBreaks(msg.to)}`,
    `Subject: ${noBreaks(msg.subject)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${now.getTime().toString(36)}.${Math.random().toString(36).slice(2)}@tempo>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    msg.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    msg.html,
    `--${boundary}--`,
    '',
  ].join('\n');
}

export async function sendMail(config: MailConfig, msg: Message, { timeoutMs = 20_000 } = {}): Promise<void> {
  const socket = config.secure
    ? tlsConnect({ host: config.host, port: config.port, servername: config.host })
    : netConnect({ host: config.host, port: config.port });
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('Mail server timed out')));
  const reply = replies(socket);
  const send = (line: string) => socket.write(`${line}\r\n`);

  try {
    await reply(220);
    send('EHLO tempo');
    await reply(250);
    send(`AUTH PLAIN ${Buffer.from(`\0${config.user}\0${config.pass}`).toString('base64')}`);
    await reply(235);
    send(`MAIL FROM:<${noBreaks(address(config.from))}>`);
    await reply(250);
    send(`RCPT TO:<${noBreaks(msg.to)}>`);
    await reply(250);
    send('DATA');
    await reply(354);
    socket.write(`${smtpBody(buildMessage(config.from, msg))}\r\n.\r\n`);
    await reply(250);
    send('QUIT');
  } finally {
    socket.end();
  }
}
