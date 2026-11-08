export type League = { name: string; slug: string; ref: string; logo: string };
export type TeamOption = { id: string; name: string; abbreviation: string | null; logos: { href: string; rel?: string[] }[] };
export type FavoriteTeam = { id: string; name: string; leagueSlug: string; logo: string | null };
export type TeamSimple = { id: string; name: string; abbreviation: string | null; logo: string | null };
export type Fixture = { eventId: string; date: string | null; homeTeam: TeamSimple; awayTeam: TeamSimple; homeTeamGoals?: number; awayTeamGoals?: number };
export type GameStatLine = { possession: number | null; shots: number | null; shotsOnTarget: number | null; corners: number | null; fouls: number | null; offsides: number | null; saves: number | null };
export type GameDetails = {
  status: { type: string; clock: string | null };
  homeTeamGoals: number | null;
  awayTeamGoals: number | null;
  statistics: { homeTeam: GameStatLine; awayTeam: GameStatLine };
  timeline: { id: string | null; type: string; minute: string | null; teamId: string | null; players: { name: string | null }[]; description: string | null }[];
};
export type TodaysGame = { fixture: Fixture; status: "LIVE" | "SCHEDULED" | "FINISHED" };
export type Standing = { position: number; positionType: string; teamName: string; gamesPlayed: number; won: number; drew: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number };
export type Team = {
  id: string; name: string; shortName: string | null; abbreviation: string | null; nickname: string | null;
  logos: { href: string; rel?: string[] }[]; colors: { primary: string | null; secondary: string | null };
  form: string | null; venue: { name: string | null; city: string | null } | null;
  standings: Standing[]; liveGame: Fixture | null; previousMatches: Fixture[]; upcomingFixtures: Fixture[];
};

declare global {
  interface Window {
    FootyPalDevice?: {
      getBrightness: () => number;
      setBrightness: (percent: number) => void;
      getVolume: () => number;
      setVolume: (percent: number) => void;
      getScreenSleepSeconds: () => number;
      setScreenSleepSeconds: (seconds: number) => boolean;
      setScreenBlanked: (blanked: boolean) => void;
    };
  }
}
