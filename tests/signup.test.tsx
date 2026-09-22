import type { ComponentType, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/signup";

const { navigate, refreshSession } = vi.hoisted(() => ({ navigate: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({}) }),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/store", () => ({
  getApiUrl: (path: string) => path,
  useStore: () => ({ refreshSession, leagueById: () => undefined }),
}));

const Signup = Route.options.component as ComponentType;
const fetchMock = vi.fn();
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  refreshSession.mockResolvedValue({ id: "account" });
});
afterEach(() => { vi.unstubAllGlobals(); });

function submitSignup() {
  render(<Signup />);
  for (const [label, value] of [
    [/First name/i, "Test"], [/Last name/i, "Player"], [/Email address/i, "test@example.com"],
    [/Confirm password/i, "test-password"],
  ] as const) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText(/Password/i, { selector: "#password" }), { target: { value: "test-password" } });
  fireEvent.submit(screen.getByRole("button", { name: "Create Account" }).closest("form")!);
}

it("does not create a browser account or navigate when the server rejects signup", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "Signup unavailable" }), { status: 500 }));
  submitSignup();
  await screen.findByText("Signup unavailable");
  expect(refreshSession).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(localStorage.getItem("atl-registered-accounts")).toBeNull();
});

it("only navigates after server signup and session verification, without storing the password", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
  submitSignup();
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
  expect(refreshSession).toHaveBeenCalledOnce();
  expect(localStorage.getItem("atl-registered-accounts")).toBeNull();
});
