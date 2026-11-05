import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { auth, NetworkError, setSignedOutHandler, type User } from './api.ts';
import { App } from './App.tsx';
import { Brand } from './components/Brand.tsx';
import { store } from './lib/store.ts';
import { AuthPage } from './pages/AuthPage.tsx';

/** Who was last signed in here, so the app can open straight away (and offline). */
const USER_KEY = 'tempo-user';

const readUser = (): User | null => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
};
const resetToken = () => /^#\/reset\/([\w-]+)/.exec(location.hash)?.[1] ?? null;

type Status = { kind: 'checking' } | { kind: 'signed-out'; offline?: boolean } | { kind: 'signed-in'; user: User };

interface Account {
  user: User;
  signOut: () => Promise<void>;
}
const AccountCtx = createContext<Account | null>(null);

export function useAccount(): Account {
  const value = useContext(AccountCtx);
  if (!value) throw new Error('useAccount must be used while signed in');
  return value;
}

/** Log out, first warning if changes made on this device haven't reached the server. */
export function useLogOut() {
  const { signOut } = useAccount();
  const { pending } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [busy, setBusy] = useState(false);
  const logOut = async () => {
    // Unsynced changes live only on this device and are cleared when signing out.
    if (pending > 0 && !confirm(`${pending} change${pending === 1 ? '' : 's'} haven’t synced yet and will be lost if you log out now. Log out anyway?`)) return;
    setBusy(true);
    await signOut();
  };
  return { logOut, busy };
}

export function Root() {
  const [status, setStatus] = useState<Status>(() => {
    const user = readUser();
    return user ? { kind: 'signed-in', user } : { kind: 'checking' };
  });
  const [reset, setReset] = useState(resetToken);

  const forget = useCallback(() => {
    store.stop();
    try {
      localStorage.removeItem(USER_KEY);
    } catch {}
    setStatus({ kind: 'signed-out' });
  }, []);

  const signIn = useCallback((user: User) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {}
    setStatus({ kind: 'signed-in', user });
  }, []);

  const signOut = useCallback(async () => {
    await auth.logOut().catch(() => {});
    forget();
  }, [forget]);

  useEffect(() => setSignedOutHandler(forget), [forget]);

  useEffect(() => {
    const onHash = () => setReset(resetToken());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // No one remembered on this device: ask the server whether the cookie is still good.
  useEffect(() => {
    if (status.kind !== 'checking') return;
    auth.me().then(({ user }) => signIn(user), (err) => setStatus({ kind: 'signed-out', offline: err instanceof NetworkError }));
  }, [status.kind, signIn]);

  const userId = status.kind === 'signed-in' ? status.user.id : null;
  useEffect(() => {
    if (userId) store.start(userId);
  }, [userId]);

  if (reset) {
    return (
      <AuthPage
        key={`reset-${reset}`}
        mode="reset"
        token={reset}
        onSignedIn={(user) => {
          history.replaceState(null, '', location.pathname);
          setReset(null);
          signIn(user);
        }}
        onLeaveReset={() => {
          history.replaceState(null, '', location.pathname);
          setReset(null);
        }}
      />
    );
  }
  if (status.kind === 'checking') {
    return (
      <div className="auth-splash" aria-busy="true" aria-label="Loading">
        <Brand />
      </div>
    );
  }
  if (status.kind === 'signed-out') return <AuthPage key="signin" offline={status.offline} onSignedIn={signIn} />;
  return (
    <AccountCtx.Provider value={{ user: status.user, signOut }}>
      <App key={status.user.id} />
    </AccountCtx.Provider>
  );
}
