import * as React from "react";
import {
  FALLBACK_MOCK_LEAGUES,
  FALLBACK_MOCK_PLAYERS,
  FALLBACK_MOCK_REGISTRATIONS,
  FALLBACK_MOCK_SEASONS,
  type AuthUser,
  type League,
  type Player,
  type Registration,
  type Season,
} from "./tennis";

interface DataState {
  seasons: Season[];
  leagues: League[];
  players: Player[];
  registrations: Registration[];
  user: AuthUser | null;
  dbConnected: boolean;
  fallbackActive: boolean;
}

interface StoreValue extends DataState {
  hydrated: boolean;
  refreshFromDb: () => Promise<void>;
  login: (role: "player" | "organizer", email: string) => AuthUser;
  logout: () => void;
  createSeason: (input: Omit<Season, "id">) => Season;
  createLeague: (input: Omit<League, "id">) => League;
  toggleRegistration: (leagueId: string) => void;
  registerPlayer: (input: {
    leagueId: string;
    player: Omit<Player, "id">;
    partnerId?: string;
  }) => { registration: Registration; player: Player };
  updatePlayer: (playerId: string, patch: Partial<Omit<Player, "id">>) => void;
  upsertPlayer: (player: Player) => void;
  leagueById: (id: string) => League | undefined;
  seasonById: (id: string) => Season | undefined;
  registrationsForLeague: (leagueId: string) => Registration[];
  spotsLeft: (leagueId: string) => number;
}

const STORAGE_KEY = "atl-tennis-league-state-v4";

const initial: DataState = {
  seasons: FALLBACK_MOCK_SEASONS,
  leagues: FALLBACK_MOCK_LEAGUES,
  players: FALLBACK_MOCK_PLAYERS,
  registrations: FALLBACK_MOCK_REGISTRATIONS,
  user: null,
  dbConnected: false,
  fallbackActive: false,
};

const StoreContext = React.createContext<StoreValue | null>(null);

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const getApiUrl = (path: string) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return `http://localhost:3001${cleanPath}`;
  }
  // In production, use the dedicated backend API URL
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
    fetch(getApiUrl(`/api/registrations?email=${encodeURIComponent(email)}`))
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok || !Array.isArray(json.data)) return;
        if (!disposed) setState((prev) => ({ ...prev, registrations: json.data
          .filter((r: Registration & { status: string }) => r.status === "registered")
          .map((r: Registration) => ({ ...r, playerId: prev.user?.playerId || r.playerId })) }));
      }).catch(() => {});
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

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DataState>;
        // Do not persist connection flags across reloads
        delete parsed.dbConnected;
        delete parsed.fallbackActive;
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
    fetchDbData();
  }, [fetchDbData]);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          seasons: state.seasons,
          leagues: state.leagues,
          players: state.players,
          registrations: state.registrations,
          user: state.user,
        }),
      );
    } catch {
      /* storage full or unavailable */
    }
  }, [state, hydrated]);

  const value = React.useMemo<StoreValue>(() => {
    return {
      ...state,
      hydrated,
      refreshFromDb: fetchDbData,
      login: (role, email) => {
        const normalized = email.trim().toLowerCase();
        let existingPlayer = state.players.find((p) => p.email.toLowerCase() === normalized);
        
        let playerId = existingPlayer?.id;
        if (role === "player" && !existingPlayer) {
          const newPlayer: Player = {
            id: uid("p"),
            firstName: email.split("@")[0] || "Player",
            lastName: "",
            email: normalized,
            phone: "",
            ntrp: "3.5",
            city: "Atlanta",
          };
          playerId = newPlayer.id;
          existingPlayer = newPlayer;
          setState((s) => ({ ...s, players: [...s.players, newPlayer] }));
        }

        const user: AuthUser = {
          id: uid("u"),
          role,
          email: normalized,
          name:
            role === "organizer"
              ? "Dana Whitfield"
              : existingPlayer && (existingPlayer.firstName || existingPlayer.lastName)
                ? `${existingPlayer.firstName} ${existingPlayer.lastName}`.trim()
                : (email.split("@")[0] ?? email),
          playerId: role === "player" ? playerId : undefined,
        };
        setState((s) => ({ ...s, user }));
        return user;
      },
      logout: () => setState((s) => ({ ...s, user: null })),
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
      registerPlayer: ({ leagueId, player, partnerId }) => {
        const league = state.leagues.find((l) => l.id === leagueId)!;
        const existing = state.players.find((p) => p.email === player.email);
        const saved: Player = existing ? { ...existing, ...player } : { ...player, id: uid("p") };
        const registration: Registration & { partnerId?: string } = {
          id: uid("r"),
          leagueId,
          playerId: saved.id,
          createdAt: new Date().toISOString().slice(0, 10),
          paymentStatus: "paid",
          amountCents: league ? league.feeCents : 3500,
          ...(partnerId ? { partnerId } : {}),
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
      spotsLeft: (leagueId) => {
        const league = state.leagues.find((l) => l.id === leagueId);
        if (!league) return 0;
        // If live spotsRemaining exists from DB, use it directly
        if (typeof (league as any).spotsRemaining === "number") {
          return (league as any).spotsRemaining;
        }
        return Math.max(0, league.playerLimit - state.registrations.filter((r) => r.leagueId === leagueId).length);
      },
    };
  }, [state, hydrated, fetchDbData]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
