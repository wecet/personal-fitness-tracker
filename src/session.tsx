import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useData, useUi } from './data.tsx';
import { newId } from './lib/store.ts';

interface Rest {
  endsAt: number;
  total: number;
}

interface SessionActions {
  rest: Rest | null;
  startRest(seconds?: number): void;
  adjustRest(deltaSeconds: number): void;
  skipRest(): void;
  startWorkout(): void;
}

const REST_KEY = 'ember-rest';
const Ctx = createContext<SessionActions | null>(null);

export function useSession(): SessionActions {
  const value = useContext(Ctx);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

let audio: AudioContext | null = null;

/** Must first run inside a tap so iOS lets the page make sound later. */
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {}
}

function chime() {
  if (!audio) return;
  const t = audio.currentTime;
  [0, 0.18, 0.36].forEach((offset, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.16);
    osc.connect(gain).connect(audio!.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.17);
  });
}

function loadRest(): Rest | null {
  try {
    const r = JSON.parse(localStorage.getItem(REST_KEY) ?? 'null');
    return r && r.endsAt > Date.now() ? r : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { settings, put, activeSession } = useData();
  const { notify } = useUi();
  const [rest, setRestState] = useState<Rest | null>(loadRest);

  const setRest = useCallback((r: Rest | null) => {
    setRestState(r);
    try {
      if (r) localStorage.setItem(REST_KEY, JSON.stringify(r));
      else localStorage.removeItem(REST_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    if (!rest) return;
    const id = setTimeout(() => {
      setRest(null);
      chime();
      navigator.vibrate?.([200, 100, 200]);
      notify('Rest over — next set 💪');
    }, Math.max(0, rest.endsAt - Date.now()));
    return () => clearTimeout(id);
  }, [rest, setRest, notify]);

  useEffect(() => {
    if (!activeSession && rest) setRest(null);
  }, [activeSession, rest, setRest]);

  const value = useMemo<SessionActions>(
    () => ({
      rest,
      startRest(seconds = settings.restSeconds) {
        unlockAudio();
        setRest({ endsAt: Date.now() + seconds * 1000, total: seconds });
      },
      adjustRest(delta) {
        if (!rest) return;
        const endsAt = Math.max(Date.now() + 1000, rest.endsAt + delta * 1000);
        setRest({ endsAt, total: Math.max(rest.total + delta, 1) });
      },
      skipRest: () => setRest(null),
      startWorkout() {
        unlockAudio();
        put('session', { id: newId(), startedAt: new Date().toISOString(), endedAt: null, rpe: null, note: null });
      },
    }),
    [rest, settings.restSeconds, setRest, put],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
