import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getApiUrl, StoreProvider, useStore } from "@/lib/store";

const response = (status: number, data: unknown) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});
const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (url === "/api/auth/me") return response(401, { ok: false });
    return response(200, { ok: true, data: [] });
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses the same-site API even when an obsolete production API URL is configured", () => {
  vi.stubEnv("VITE_API_URL", "https://retired.example.test");
  expect(getApiUrl("/api/auth/login")).toBe("/api/auth/login");
  expect(getApiUrl("api/auth/me")).toBe("/api/auth/me");
});

it("removes legacy plaintext credentials and does not log in when the API is offline", async () => {
  localStorage.setItem("atl-registered-accounts", JSON.stringify({
    "test@example.com": { password: "browser-password", role: "organizer" },
  }));
  const { result } = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  expect(localStorage.getItem("atl-registered-accounts")).toBeNull();
  fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
  await act(async () => {
    await expect(result.current.login("organizer@baselineatl.com", "organizer123"))
      .rejects.toThrow("Unable to reach sign-in");
  });
  expect(result.current.user).toBeNull();
});

it("preserves a real server credential rejection without creating a browser identity", async () => {
  const { result } = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  fetchMock.mockResolvedValue(response(401, { ok: false, error: "Invalid email or password" }));
  await act(async () => {
    await expect(result.current.login("test@example.com", "wrong-password"))
      .rejects.toThrow("Invalid email or password");
  });
  expect(result.current.user).toBeNull();
});

it("requires a verified server session and profile after login", async () => {
  const { result } = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  const user = { id: "account", playerId: "player", email: "test@example.com", role: "player", name: "Test Player" };
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/auth/login" || url === "/api/auth/me") return response(200, { ok: true, data: user });
    return response(200, { ok: true, data: { id: "player", email: user.email } });
  });
  await act(async () => { await result.current.login(user.email, "server-password"); });
  expect(result.current.user).toEqual(user);
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ credentials: "include" }));
});

it("sends expectedRole with login request when specified", async () => {
  const { result } = renderHook(() => useStore(), { wrapper: StoreProvider });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  const user = { id: "account", playerId: "player", email: "player@example.com", role: "player", name: "Test Player" };
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/auth/login" || url === "/api/auth/me") return response(200, { ok: true, data: user });
    return response(200, { ok: true, data: { id: "player", email: user.email } });
  });
  await act(async () => { await result.current.login(user.email, "server-password", "player"); });
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
    body: JSON.stringify({ email: user.email, password: "server-password", expectedRole: "player" }),
  }));
});
