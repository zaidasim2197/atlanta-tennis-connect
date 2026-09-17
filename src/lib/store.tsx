import * as React from "react";
import {
  SEED_LEAGUES,
  SEED_PLAYERS,
  SEED_REGISTRATIONS,
  SEED_SEASONS,
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
}

interface StoreValue extends DataState {
  hydrated: boolean;
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
  leagueById: (id: string) => League | undefined;
  seasonById: (id: string) => Season | undefined;
  registrationsForLeague: (leagueId: string) => Registration[];
  spotsLeft: (leagueId: string) => number;
}

const STORAGE_KEY = "atl-tennis-league-state-v4";

const initial: DataState = {
  seasons: SEED_SEASONS,
  leagues: SEED_LEAGUES,
  players: SEED_PLAYERS,
  registrations: SEED_REGISTRATIONS,
  user: null,
};

const StoreContext = React.createContext<StoreValue | null>(null);

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DataState>(initial);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initial, ...(JSON.parse(raw) as DataState) });
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable */
    }
  }, [state, hydrated]);

  const value = React.useMemo<StoreValue>(() => {
    return {
      ...state,
      hydrated,
      login: (role, email) => {
        const existingPlayer = state.players.find((p) => p.email === email);
        const user: AuthUser = {
          id: uid("u"),
          role,
          email,
          name:
            role === "organizer"
              ? "Dana Whitfield"
              : existingPlayer
                ? `${existingPlayer.firstName} ${existingPlayer.lastName}`
                : (email.split("@")[0] ?? email),
          playerId: role === "player" ? (existingPlayer?.id ?? state.players[0]?.id) : undefined,
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
          amountCents: league.feeCents,
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
      leagueById: (id) => state.leagues.find((l) => l.id === id),
      seasonById: (id) => state.seasons.find((s) => s.id === id),
      registrationsForLeague: (leagueId) => state.registrations.filter((r) => r.leagueId === leagueId),
      spotsLeft: (leagueId) => {
        const league = state.leagues.find((l) => l.id === leagueId);
        if (!league) return 0;
        return Math.max(0, league.playerLimit - state.registrations.filter((r) => r.leagueId === leagueId).length);
      },
    };
  }, [state, hydrated]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
