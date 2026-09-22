import * as React from "react";
import {
  FALLBACK_MOCK_LEAGUES,
  FALLBACK_MOCK_MATCHES,
  FALLBACK_MOCK_RESULTS,
  FALLBACK_MOCK_SEASONS,
  type AuthUser,
  type League,
  type Match,
  type MatchResult,
  type Player,
  type PlayerStats,
  type Registration,
  type Season,
} from "./tennis";

interface DataState {
  seasons: Season[];
  leagues: League[];
  players: Player[];
  registrations: Registration[];
  matches: Match[];
  results: MatchResult[];
  user: AuthUser | null;
  dbConnected: boolean;
  fallbackActive: boolean;
}

interface StoreValue extends DataState {
  hydrated: boolean;
  refreshFromDb: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthUser>;
  refreshSession: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  createSeason: (input: Omit<Season, "id">) => Season;
  createLeague: (input: Omit<League, "id">) => League;
  toggleRegistration: (leagueId: string) => void;
  registerPlayer: (input: {
    leagueId: string;
    player: Player | Omit<Player, "id">;
    partnerId?: string | undefined;
    preferredCourt?: string | undefined;
  }) => { registration: Registration; player: Player };
  updatePlayer: (playerId: string, patch: Partial<Omit<Player, "id">>) => void;
  upsertPlayer: (player: Player) => void;
  leagueById: (id: string) => League | undefined;
  seasonById: (id: string) => Season | undefined;
  registrationsForLeague: (leagueId: string) => Registration[];
  registrationsForPlayer: (playerId: string) => Registration[];
  spotsLeft: (leagueId: string) => number;
  matchesForPlayer: (playerId: string) => Match[];
  statsForPlayer: (playerId: string) => PlayerStats;
  resultsForPlayer: (playerId: string) => MatchResult[];
  submitMatchScore: (input: {
    matchId: string;
    submittedBy: string;
    scoreData: string;
    winnerId: string;
    role?: "player" | "organizer";
  }) => void;
  confirmMatchResult: (resultId: string) => void;
  disputeMatchResult: (resultId: string, reason: string) => void;
  searchPartners: (query: string, excludePlayerId?: string) => Player[];
}

const STORAGE_KEY = "atl-tennis-league-state-v6";

const initial: DataState = {
  seasons: FALLBACK_MOCK_SEASONS,
  leagues: FALLBACK_MOCK_LEAGUES,
  players: [],
  registrations: [],
  matches: FALLBACK_MOCK_MATCHES,
  results: FALLBACK_MOCK_RESULTS,
  user: null,
  dbConnected: false,
  fallbackActive: false,
};

const StoreContext = React.createContext<StoreValue | null>(null);

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const getApiUrl = (path: string) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // In production, VITE_API_URL is baked in at build time via .env.production
  // Locally, we use a relative path so Vite's proxy (vite.config.ts) forwards to :3001
  const apiBase = (import.meta.env['VITE_API_URL'] || "").replace(/\/$/, "");
  return `${apiBase}${cleanPath}`;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DataState>(initial);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!state.user?.email || !state.dbConnected) return;
    let disposed = false;
    const email = state.user.email;
    fetch(getApiUrl(`/api/registrations?email=${encodeURIComponent(email)}`), { credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok || !Array.isArray(json.data)) return;
        if (!disposed) setState((prev) => ({
          ...prev, registrations: json.data
            .filter((r: Registration & { status: string }) => r.status === "registered")
            .map((r: Registration) => ({ ...r, playerId: prev.user?.playerId || r.playerId }))
        }));
      }).catch(() => { });
    return () => { disposed = true; };
  }, [state.user?.email, state.dbConnected, state.leagues]);

  // DB-first initialization with explicit fallback
  const fetchDbData = React.useCallback(async () => {
    try {
      const url = getApiUrl("/api/leagues");
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.data)) throw new Error("Invalid API response format");

      const dbLeagues: League[] = json.data.map((l: any) => ({
        id: l.id || l.slug,
        seasonId: l.seasonId || l.seasonSlug,
        name: l.name,
        format: l.format,
        skillLevel: l.skillLevel,
        offeredSkillLevels: l.offeredSkillLevels || (l.slug === "l-1" || l.id === "l-1" ? ["2.5", "3.0", "3.5", "4.0"] : l.skillLevel ? [l.skillLevel] : ["3.0", "3.5"]),
        geographicGroup: l.geographicGroup || (l.venue?.toLowerCase().includes("piedmont") ? "Midtown" : "Midtown"),
        feeCents: l.feeCents,
        scheduleDay: l.scheduleDay,
        scheduleTime: l.scheduleTime,
        venue: l.venue,
        playerLimit: l.playerLimit,
        spotsRemaining: l.spotsRemaining,
        registrationOpen: l.registrationOpen,
        description: l.description,
        startDate: l.startDate,
        endDate: l.endDate,
      }));

      console.info("🎾 [DB_CONNECTED] Successfully loaded live leagues from MongoDB backend.");

      setState((prev) => ({
        ...prev,
        leagues: dbLeagues,
        dbConnected: true,
        fallbackActive: false,
      }));
    } catch (err) {
      console.warn(
        "⚠️ [FALLBACK_TRIGGERED] Failed to reach backend API. Using local mock fallback data.",
        err,
      );
      setState((prev) => ({
        ...prev,
        dbConnected: false,
        fallbackActive: true,
      }));
    }
  }, []);

  const refreshSession = React.useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/auth/me"), { credentials: "include" });
      const json = await res.json();
      if (res.status === 401) {
        setState(s => ({ ...s, user: null, players: [], registrations: [] }));
        return null;
      }
      if (!res.ok || !json.ok) throw new Error("Unable to verify your session");
      const user = json.data as AuthUser;
      const profileRes = await fetch(getApiUrl(`/api/players/${encodeURIComponent(user.email)}`), { credentials: "include" });
      const profile = await profileRes.json();
      if (!profileRes.ok || !profile.ok) throw new Error("Unable to load your profile");
      setState(s => ({ ...s, user, players: [profile.data], registrations: [] }));
      return user;
    } catch (err: any) {
      // If it's a network error (backend offline), don't wipe the current session
      const isNetworkError = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError") || err?.message?.includes("ERR_CONNECTION_REFUSED");
      if (isNetworkError) {
        // Backend offline — leave existing in-memory user state intact
        return null;
      }
      throw err;
    }
  }, []);

  React.useEffect(() => {
    // Remove the prototype's plaintext passwords and untrusted persisted identity.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* Storage may be disabled. */ }
    void refreshSession().catch(() => setState(s => ({ ...s, user: null, players: [], registrations: [] }))).finally(() => setHydrated(true));
    void fetchDbData();
  }, [fetchDbData, refreshSession]);

  const value = React.useMemo<StoreValue>(() => {
    return {
      ...state,
      hydrated,
      refreshFromDb: fetchDbData,
      refreshSession,
      login: async (email, password) => {
        try {
          const res = await fetch(getApiUrl("/api/auth/login"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) throw new Error(json.error || "Invalid email or password");
          const user = await refreshSession();
          if (!user) throw new Error("Unable to establish your session");
          return user;
        } catch (apiErr: any) {
          // If the backend API returned an explicit auth error, propagate it
          if (apiErr.message && !apiErr.message.includes("Failed to fetch") && !apiErr.message.includes("NetworkError")) {
            throw apiErr;
          }
          // Backend server is offline (e.g. port 3001 not running). Fall back to offline credentials!
          console.warn("⚠️ Backend auth server offline, using local offline authentication:", apiErr);
          const normalizedEmail = email.trim().toLowerCase();
          const isPlayerDemo = normalizedEmail === "player@baselineatl.com";
          const isOrganizerDemo = normalizedEmail === "organizer@baselineatl.com";

          let registeredAccount: any = null;
          try {
            const accounts = JSON.parse(localStorage.getItem("atl-registered-accounts") || "{}");
            registeredAccount = accounts[normalizedEmail];
          } catch { }

          if (!isPlayerDemo && !isOrganizerDemo && !registeredAccount) {
            throw new Error("No account found with this email. Please create an account to get started.");
          }

          if (isPlayerDemo) {
            if (password !== "password123") throw new Error("Incorrect password. Please try again.");
          } else if (isOrganizerDemo) {
            if (password !== "organizer123") throw new Error("Incorrect password. Please try again.");
          } else if (registeredAccount) {
            if (password !== registeredAccount.password) throw new Error("Incorrect password. Please try again.");
          }

          const role = isOrganizerDemo || registeredAccount?.role === "organizer" ? "organizer" : "player";
          const existingPlayer = state.players.find((p) => p.email.toLowerCase() === normalizedEmail);
          const user: AuthUser = {
            id: uid("u"),
            email: normalizedEmail,
            role,
            name: isOrganizerDemo
              ? "Organizer"
              : registeredAccount?.name || (existingPlayer ? `${existingPlayer.firstName} ${existingPlayer.lastName}` : normalizedEmail.split("@")[0] || normalizedEmail),
            playerId: role === "player" ? (registeredAccount?.playerId || existingPlayer?.id || "p-1") : undefined,
          };

          setState((s) => ({
            ...s,
            user,
            players: existingPlayer
              ? s.players
              : [
                ...s.players,
                {
                  id: user.playerId || "p-1",
                  firstName: user.name.split(" ")[0] || "Demo",
                  lastName: user.name.split(" ")[1] || "Player",
                  email: user.email,
                  ntrp: "3.0",
                  city: "Midtown",
                },
              ],
          }));
          return user;
        }
      },
      logout: async () => {
        try {
          await fetch(getApiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
        } catch { }
        setState((s) => ({ ...s, user: null, players: [], registrations: [] }));
        sessionStorage.clear();
      },
      createSeason: (input) => {
        const season: Season = { ...input, id: uid("s") };
        setState((s) => ({ ...s, seasons: [season, ...s.seasons] }));
        return season;
      },
      createLeague: (input) => {
        const league: League = { ...input, id: uid("l") };
        setState((s) => ({ ...s, leagues: [league, ...s.leagues] }));
        return league;
      },
      toggleRegistration: (leagueId) =>
        setState((s) => ({
          ...s,
          leagues: s.leagues.map((l) =>
            l.id === leagueId ? { ...l, registrationOpen: !l.registrationOpen } : l,
          ),
        })),
      registerPlayer: ({ leagueId, player, partnerId, preferredCourt }) => {
        const league = state.leagues.find((l) => l.id === leagueId)!;
        const existing = state.players.find((p) => p.email.toLowerCase() === player.email.toLowerCase());
        const court = preferredCourt || player.preferredCourt || existing?.preferredCourt || "Piedmont Park Courts";
        const saved: Player = existing
          ? { ...existing, ...player, preferredCourt: court }
          : { ...player, id: uid("p"), preferredCourt: court };
        const registration: Registration = {
          id: uid("r"),
          leagueId,
          playerId: saved.id,
          createdAt: new Date().toISOString().slice(0, 10),
          registrationStatus: "confirmed",
          paymentStatus: "paid",
          amountCents: league ? league.feeCents : 3500,
          skillLevelSnapshot: saved.ntrp,
          doublesPartnerId: partnerId || undefined,
          partnerStatus: partnerId ? "requested" : undefined,
          preferredCourt: court,
        };
        setState((s) => ({
          ...s,
          players: existing ? s.players.map((p) => (p.id === saved.id ? saved : p)) : [...s.players, saved],
          registrations: [...s.registrations, registration],
          user: s.user ? { ...s.user, playerId: s.user.role === "player" ? saved.id : s.user.playerId } : s.user,
        }));
        return { registration, player: saved };
      },
      updatePlayer: (playerId, patch) =>
        setState((s) => ({
          ...s,
          players: s.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
        })),
      upsertPlayer: (player) =>
        setState((s) => {
          const exists = s.players.some((p) => p.id === player.id || p.email.toLowerCase() === player.email.toLowerCase());
          const newPlayers = exists
            ? s.players.map((p) => (p.id === player.id || p.email.toLowerCase() === player.email.toLowerCase() ? player : p))
            : [...s.players, player];
          return {
            ...s,
            players: newPlayers,
            user: s.user && s.user.email.toLowerCase() === player.email.toLowerCase()
              ? { ...s.user, playerId: player.id, name: `${player.firstName} ${player.lastName}` }
              : s.user,
          };
        }),
      leagueById: (id) => state.leagues.find((l) => l.id === id),
      seasonById: (id) => state.seasons.find((s) => s.id === id),
      registrationsForLeague: (leagueId) => state.registrations.filter((r) => r.leagueId === leagueId),
      registrationsForPlayer: (playerId) => state.registrations.filter((r) => r.playerId === playerId),
      spotsLeft: (leagueId) => {
        const league = state.leagues.find((l) => l.id === leagueId);
        if (!league) return 0;
        // If live spotsRemaining exists from DB, use it directly
        if (typeof (league as any).spotsRemaining === "number") {
          return (league as any).spotsRemaining;
        }
        return Math.max(0, league.playerLimit - state.registrations.filter((r) => r.leagueId === leagueId).length);
      },
      matchesForPlayer: (playerId) => {
        // Return only real, explicitly created/assigned fixtures. No fake auto-generation!
        return state.matches.filter((m) => m.playerId === playerId || m.opponentId === playerId);
      },
      statsForPlayer: (playerId) => {
        // Only accepted match results contribute to official stats
        const acceptedForPlayer = state.results.filter(
          (r) => r.status === "accepted" && (r.submittedBy === playerId || r.winnerId === playerId),
        );
        const matchesPlayed = acceptedForPlayer.length;
        const wins = acceptedForPlayer.filter((r) => r.winnerId === playerId).length;
        const losses = matchesPlayed - wins;
        const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0;
        return { matchesPlayed, wins, losses, winRate };
      },
      resultsForPlayer: (playerId) => {
        return state.results.filter((r) => {
          const match = state.matches.find((m) => m.id === r.matchId);
          return (
            r.submittedBy === playerId ||
            r.winnerId === playerId ||
            match?.playerId === playerId ||
            match?.opponentId === playerId
          );
        });
      },
      submitMatchScore: ({ matchId, submittedBy, scoreData, winnerId, role = "player" }) => {
        const isOrganizer = role === "organizer";
        const now = new Date().toISOString();
        const newResult: MatchResult = {
          resultId: uid("res"),
          matchId,
          submittedBy,
          scoreData,
          winnerId,
          status: isOrganizer ? "accepted" : "awaiting-confirmation",
          submittedAt: now,
          ...(isOrganizer ? { confirmedAt: now, confirmedBy: "organizer" } : {}),
        };
        setState((s) => ({
          ...s,
          results: [newResult, ...s.results.filter((r) => r.matchId !== matchId)],
          matches: s.matches.map((m) =>
            m.id === matchId ? { ...m, matchStatus: isOrganizer ? "completed" : "scheduled" } : m,
          ),
        }));
      },
      confirmMatchResult: (resultId) => {
        setState((s) => {
          const target = s.results.find((r) => r.resultId === resultId);
          if (!target) return s;
          const updatedResult: MatchResult = {
            ...target,
            status: "accepted",
            confirmedAt: new Date().toISOString(),
            confirmedBy: "organizer",
          };
          return {
            ...s,
            results: s.results.map((r) => (r.resultId === resultId ? updatedResult : r)),
            matches: s.matches.map((m) =>
              m.id === target.matchId ? { ...m, matchStatus: "completed" } : m,
            ),
          };
        });
      },
      disputeMatchResult: (resultId, reason) => {
        setState((s) => {
          const target = s.results.find((r) => r.resultId === resultId);
          if (!target) return s;
          const updatedResult: MatchResult = {
            ...target,
            status: "disputed",
            disputeReason: reason || "Dispute raised by league organizer or player review.",
            confirmedAt: new Date().toISOString(),
            confirmedBy: "organizer",
          };
          return {
            ...s,
            results: s.results.map((r) => (r.resultId === resultId ? updatedResult : r)),
            matches: s.matches.map((m) =>
              m.id === target.matchId ? { ...m, matchStatus: "scheduled" } : m,
            ),
          };
        });
      },
      searchPartners: (query, excludePlayerId) => {
        const q = query.trim().toLowerCase();
        if (!q) return state.players.filter((p) => p.id !== excludePlayerId).slice(0, 5);
        return state.players
          .filter((p) => p.id !== excludePlayerId)
          .filter(
            (p) =>
              p.firstName.toLowerCase().includes(q) ||
              p.lastName.toLowerCase().includes(q) ||
              p.id.toLowerCase().includes(q) ||
              `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
          );
      },
    };
  }, [state, hydrated, fetchDbData, refreshSession]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
