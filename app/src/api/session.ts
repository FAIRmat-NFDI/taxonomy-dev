import type { Session, SessionInfo } from './types';

/**
 * The current session (with tokens) lives here — in memory and in browser
 * storage, never in Redux. sessionStorage = this tab only (default);
 * localStorage = "Remember me on this device".
 */
const STORAGE_KEY = 'tp.session';

let current: Session | null = null;
let remembered = false;

function storages(): Storage[] {
  try {
    return [sessionStorage, localStorage];
  } catch {
    return [];
  }
}

function persist(): void {
  for (const s of storages()) s.removeItem(STORAGE_KEY);
  if (!current) return;
  try {
    (remembered ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable (private mode) — session stays in memory only */
  }
}

export const getSession = (): Session | null => current;

export function setSession(session: Session, remember: boolean): void {
  current = session;
  remembered = remember;
  persist();
}

/** Updates tokens (e.g. after a refresh) without changing where the session is stored. */
export function updateSession(patch: Partial<Session>): void {
  if (!current) return;
  current = { ...current, ...patch };
  persist();
}

export function clearSession(): void {
  current = null;
  persist();
}

/** Loads a stored session into memory (does not validate it). */
export function loadStoredSession(): Session | null {
  for (const [index, s] of storages().entries()) {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) continue;
    try {
      current = JSON.parse(raw) as Session;
      remembered = index === 1;
      return current;
    } catch {
      s.removeItem(STORAGE_KEY);
    }
  }
  return null;
}

export const toSessionInfo = ({ mode, provider, providerLabel, user }: Session): SessionInfo => ({
  mode,
  provider,
  providerLabel,
  user,
});
