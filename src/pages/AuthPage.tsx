import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { auth, NetworkError, type User } from '../api.ts';
import { haptic } from '../lib/haptics.ts';

type Mode = 'signin' | 'signup' | 'forgot' | 'sent' | 'reset';

const MIN_PASSWORD = 8;
/** Long enough for the card's exit to read before the app takes over. */
const EXIT_MS = 420;

/** The three Tempo bars, rising in turn and then keeping a slow beat. */
function BrandMark() {
  return (
    <svg className="auth-mark" width="56" height="56" viewBox="0 0 24 24" aria-hidden="true">
      <rect className="bar b1" x="3" y="13" width="4.5" height="8" rx="2.25" />
      <rect className="bar b2" x="9.75" y="8.5" width="4.5" height="12.5" rx="2.25" />
      <rect className="bar b3" x="16.5" y="3" width="4.5" height="18" rx="2.25" />
    </svg>
  );
}

function Field({ label, children, hint }: { label: string; children: (id: string) => ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, autoFocus }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-input">
      <input id={id} type={shown ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} autoFocus={autoFocus} required minLength={autoComplete === 'new-password' ? MIN_PASSWORD : undefined} />
      <button type="button" className="reveal" onClick={() => setShown(!shown)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {!shown && <path className="slash" d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

function LengthHint({ password }: { password: string }) {
  const ok = password.length >= MIN_PASSWORD;
  return (
    <span className={`auth-hint ${ok ? 'ok' : ''}`}>
      <span className="hint-dot" aria-hidden="true">{ok ? '✓' : ''}</span>
      At least {MIN_PASSWORD} characters
    </span>
  );
}

export function AuthPage({ mode: initialMode = 'signin', token, offline, onSignedIn, onLeaveReset }: {
  mode?: Mode;
  token?: string;
  offline?: boolean;
  onSignedIn: (user: User) => void;
  onLeaveReset?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(offline ? 'You’re offline. Connect to sign in.' : null);
  const [shake, setShake] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [delivery, setDelivery] = useState<'email' | 'log'>('email');
  const errorRef = useRef<HTMLParagraphElement>(null);

  const go = (next: Mode) => {
    setError(null);
    setPassword('');
    setMode(next);
  };
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const fail = (err: unknown) => {
    setError(err instanceof NetworkError ? 'You’re offline. Connect and try again.' : err instanceof Error ? err.message : 'Something went wrong');
    setShake(true);
    haptic();
  };

  const enter = (user: User) => {
    haptic('success');
    setLeaving(true);
    setTimeout(() => onSignedIn(user), EXIT_MS);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') enter((await auth.logIn(email, password)).user);
      else if (mode === 'signup') enter((await auth.signUp(email, password)).user);
      else if (mode === 'reset') enter((await auth.reset(token!, password)).user);
      else if (mode === 'forgot') {
        setDelivery((await auth.forgot(email)).delivery);
        setMode('sent');
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const tabs = mode === 'signin' || mode === 'signup';
  const heading = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password', sent: 'Check your email', reset: 'Choose a new password' }[mode];
  const action = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', sent: '', reset: 'Save and sign in' }[mode];
  const expired = mode === 'reset' && error != null && /expired|already used/.test(error);

  return (
    <div className={`auth ${leaving ? 'leaving' : ''}`}>
      <div className="auth-aurora" aria-hidden="true"><span /><span /><span /><span /><span /></div>
      <main className="auth-main">
        <header className="auth-brand">
          <BrandMark />
          <h1>tempo</h1>
          <p>Train in rhythm with your body.</p>
        </header>

        <section className={`auth-card ${shake ? 'shake' : ''}`} onAnimationEnd={(e) => e.animationName === 'shake' && setShake(false)} aria-labelledby="auth-heading">
          {tabs && (
            <div className={`auth-tabs ${mode}`} role="tablist" aria-label="Account">
              <span className="auth-tab-pill" aria-hidden="true" />
              <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => go('signin')}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => go('signup')}>Create account</button>
            </div>
          )}

          <div className="auth-panel" key={mode}>
            <h2 id="auth-heading">{heading}</h2>

            {mode === 'sent' ? (
              <div className="auth-sent">
                <svg className="sent-check" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r="28" />
                  <path d="M20 33l8 8 16-17" />
                </svg>
                {delivery === 'email' ? (
                  <p>If there’s a Tempo account for <strong>{email}</strong>, a reset link is on its way. It works for an hour.</p>
                ) : (
                  <p>Email isn’t set up on this server yet, so the reset link for <strong>{email}</strong> was written to the server log.</p>
                )}
                <button type="button" className="btn ghost block" onClick={() => go('signin')}>Back to sign in</button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                {mode === 'forgot' && <p className="auth-lede">Enter your email and we’ll send you a link to choose a new password.</p>}
                {mode === 'reset' && <p className="auth-lede">Signing in with it will sign you out everywhere else.</p>}

                {mode !== 'reset' && (
                  <Field label="Email">
                    {(id) => (
                      <input id={id} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                        value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={mode !== 'signin' || !email} />
                    )}
                  </Field>
                )}

                {mode !== 'forgot' && (
                  <Field
                    label={mode === 'reset' ? 'New password' : 'Password'}
                    hint={mode === 'signin'
                      ? <button type="button" className="auth-link forgot" onClick={() => go('forgot')}>Forgot password?</button>
                      : <LengthHint password={password} />}
                  >
                    {(id) => (
                      <PasswordInput id={id} value={password} onChange={setPassword}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} autoFocus={mode === 'reset'} />
                    )}
                  </Field>
                )}

                {error && (
                  <p className="auth-error" role="alert" tabIndex={-1} ref={errorRef}>
                    {error}
                    {expired && <> <button type="button" className="auth-link" onClick={() => go('forgot')}>Send a new link</button></>}
                  </p>
                )}

                <button className={`btn primary block auth-submit ${busy ? 'busy' : ''}`} disabled={busy}>
                  <span className="label">{action}</span>
                  {busy && <span className="btn-spinner" aria-label="Working" />}
                </button>

                {mode === 'forgot' && <button type="button" className="auth-link center" onClick={() => go('signin')}>Back to sign in</button>}
                {mode === 'reset' && <button type="button" className="auth-link center" onClick={onLeaveReset}>Cancel</button>}
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
