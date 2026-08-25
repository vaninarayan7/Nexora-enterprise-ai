import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};

(globalThis as any).localStorage = fakeLocalStorage;

const {
  getGoogleCalendarAuthState,
  saveGoogleCalendarAuthState,
  clearGoogleCalendarAuthState,
  hasValidGoogleCalendarConnection,
} = await import("../src/lib/googleCalendarAuth.ts");

test("persisted Google Calendar auth state survives refresh and is considered connected", () => {
  saveGoogleCalendarAuthState({
    accessToken: "fresh-access-token",
    refreshToken: "refresh-token-123",
    expiresAt: Date.now() + 60_000,
    email: "ops@example.com",
  });

  const state = getGoogleCalendarAuthState();
  assert.ok(state);
  assert.equal(state?.email, "ops@example.com");
  assert.equal(state?.accessToken, "fresh-access-token");
  assert.equal(hasValidGoogleCalendarConnection(), true);
});

test("expired Google Calendar OAuth state is not treated as connected", () => {
  saveGoogleCalendarAuthState({
    accessToken: "expired-token",
    refreshToken: "refresh-token-456",
    expiresAt: Date.now() - 10_000,
    email: "ops@example.com",
  });

  assert.equal(hasValidGoogleCalendarConnection(), false);
  clearGoogleCalendarAuthState();
});
