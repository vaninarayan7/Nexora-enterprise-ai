export interface GoogleCalendarAuthState {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
  lastUpdated?: number;
}

const GOOGLE_CALENDAR_AUTH_KEY = "nexora_google_calendar_auth";
const DEFAULT_TOKEN_LIFETIME_MS = 55 * 60 * 1000;

const getStorage = (): Storage | null => {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis && globalThis.localStorage) return globalThis.localStorage;
  return null;
};

const hasStorage = (): boolean => !!getStorage();

export const getGoogleCalendarAuthState = (): GoogleCalendarAuthState | null => {
  const storage = getStorage();
  if (!storage) return null;

  const raw = storage.getItem(GOOGLE_CALENDAR_AUTH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GoogleCalendarAuthState;
    if (!parsed?.accessToken || !parsed?.expiresAt) {
      clearGoogleCalendarAuthState();
      return null;
    }
    return parsed;
  } catch {
    clearGoogleCalendarAuthState();
    return null;
  }
};

export const saveGoogleCalendarAuthState = (state: GoogleCalendarAuthState): void => {
  const storage = getStorage();
  if (!storage) return;

  const normalized: GoogleCalendarAuthState = {
    ...state,
    expiresAt: state.expiresAt || Date.now() + DEFAULT_TOKEN_LIFETIME_MS,
    lastUpdated: Date.now(),
  };

  storage.setItem(GOOGLE_CALENDAR_AUTH_KEY, JSON.stringify(normalized));
};

export const clearGoogleCalendarAuthState = (): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(GOOGLE_CALENDAR_AUTH_KEY);
};

export const hasValidGoogleCalendarConnection = (): boolean => {
  const state = getGoogleCalendarAuthState();
  if (!state?.accessToken) return false;
  return Date.now() < state.expiresAt - 30_000;
};

export const isGoogleCalendarTokenExpired = (): boolean => {
  const state = getGoogleCalendarAuthState();
  if (!state?.expiresAt) return true;
  return Date.now() >= state.expiresAt - 30_000;
};

export const refreshGoogleCalendarAccessToken = async (): Promise<GoogleCalendarAuthState | null> => {
  const current = getGoogleCalendarAuthState();
  if (!current?.refreshToken) return null;

  try {
    const response = await fetch("/api/oauth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken })
    });

    if (!response.ok) {
      clearGoogleCalendarAuthState();
      return null;
    }

    const data = await response.json();
    const accessToken = data?.accessToken as string | undefined;
    if (!accessToken) {
      clearGoogleCalendarAuthState();
      return null;
    }

    const refreshedState: GoogleCalendarAuthState = {
      ...current,
      accessToken,
      expiresAt: Date.now() + DEFAULT_TOKEN_LIFETIME_MS,
      lastUpdated: Date.now(),
    };

    saveGoogleCalendarAuthState(refreshedState);
    return refreshedState;
  } catch (error) {
    console.error("[GoogleCalendarAuth] Failed to refresh Calendar token:", error);
    clearGoogleCalendarAuthState();
    return null;
  }
};
