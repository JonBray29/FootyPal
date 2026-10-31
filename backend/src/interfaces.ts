export interface IHealthResponse {
  status: 'ok' | 'degraded';
  checks: {
    api: 'ok';
    espnCore: 'ok' | 'unavailable';
    espnSite: 'ok' | 'unavailable';
  };
}

export interface ILeague {
  name: string;
  /** ESPN's league slug, used as the league identifier in other ESPN endpoints. */
  slug: string;
  /** ESPN Core API league record reference. */
  ref: string;
}

export interface ITeamLogo {
  href: string;
  rel?: string[];
  [key: string]: unknown;
}

export interface ITeam {
  id: string;
  name: string;
  abbreviation: string | null;
  logos: ITeamLogo[];
}

export interface ITeamSimple {
  id: string;
  name: string;
  abbreviation: string | null;
  logo: string | null;
}

export enum LeaguePositionType {
  NONE = "NONE",
  CHAMPIONS_LEAGUE = "CHAMPIONS_LEAGUE",
  EUROPA_LEAGUE = "EUROPA_LEAGUE",
  CONFERENCE_LEAGUE = "CONFERENCE_LEAGUE",
  PROMOTION = "PROMOTION",
  PLAYOFF = "PLAYOFF",
  RELEGATION = "RELEGATION",
  OTHER = "OTHER",
}

export interface ILeagueStanding {
  position: number;
  positionType: LeaguePositionType;
  teamName: string;
  gamesPlayed: number;
  won: number;
  drew: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface ITeamFixture {
  eventId: string;
  date: string | null;
  homeTeam: ITeamSimple;
  awayTeam: ITeamSimple;
  homeTeamGoals?: number;
  awayTeamGoals?: number;
}

export interface ITeamLink {
  href: string;
  text?: string;
  rel?: string[];
}

export enum GameStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  FINISHED = 'FINISHED',
  POSTPONED = 'POSTPONED',
  CANCELLED = 'CANCELLED',
  ABANDONED = 'ABANDONED',
  SUSPENDED = 'SUSPENDED',
  UNKNOWN = 'UNKNOWN',
}

export enum GameEventType {
  GOAL = 'GOAL',
  YELLOW_CARD = 'YELLOW_CARD',
  RED_CARD = 'RED_CARD',
  SECOND_YELLOW_CARD = 'SECOND_YELLOW_CARD',
}

export interface IGameStatistics {
  possession: number | null;
  shots: number | null;
  shotsOnTarget: number | null;
  corners: number | null;
  fouls: number | null;
  offsides: number | null;
  saves: number | null;
  yellowCards: number | null;
  redCards: number | null;
}

export interface IGameTimelineEvent {
  id: string | null;
  type: GameEventType;
  minute: string | null;
  teamId: string | null;
  players: { id: string | null; name: string | null }[];
  description: string | null;
  isOwnGoal: boolean;
  isPenalty: boolean;
}

export interface IGame {
  eventId: string;
  date: string | null;
  competition: { name: string | null; slug: string | null; season: string | null };
  status: { type: GameStatus; description: string | null; clock: string | null; period: number | null };
  homeTeam: ITeamSimple;
  awayTeam: ITeamSimple;
  homeTeamGoals: number | null;
  awayTeamGoals: number | null;
  venue: { name: string | null; city: string | null; country: string | null } | null;
  statistics: { homeTeam: IGameStatistics; awayTeam: IGameStatistics };
  timeline: IGameTimelineEvent[];
}

