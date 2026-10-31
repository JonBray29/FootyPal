import type { ITeamLogo, ITeamLink } from './interfaces.js';

export interface IEspnTeamResponse {
  sports?: IEspnSport[];
}

interface IEspnSport {
  leagues?: IEspnLeague[];
}

interface IEspnLeague {
  teams?: IEspnTeamEntry[];
}

interface IEspnTeamEntry {
  team?: IEspnTeam;
}

export interface IEspnTeamDetailResponse extends IEspnTeam {}

export interface IEspnScheduleResponse {
  events?: IEspnScheduleEvent[];
}

export interface IEspnScheduleEvent {
  id: string;
  date?: string;
  competitions?: IEspnScheduleCompetition[];
}

export interface IEspnScheduleCompetition {
  status?: { type?: { completed?: boolean; state?: string } };
  competitors?: IEspnScheduleCompetitor[];
}

export interface IEspnScheduleCompetitor {
  id?: string;
  homeAway?: string;
  score?: string | number | { value?: number };
}

export interface IEspnTeamEventsResponse {
  items?: { $ref: string }[];
}

export interface IEspnCoreEventResponse {
  id: string;
  date?: string;
  competitions?: { competitors?: { id?: string; homeAway?: string }[] }[];
}

export interface IEspnStandingsResponse {
  children?: IEspnStandingsGroup[];
  standings?: IEspnStandingsTable;
}

interface IEspnStandingsGroup {
  children?: IEspnStandingsGroup[];
  standings?: IEspnStandingsTable;
}

interface IEspnStandingsTable {
  entries?: IEspnStandingEntry[];
}

interface IEspnStandingEntry {
  team?: { displayName?: string; name?: string };
  note?: { description?: string; rank?: number };
  stats?: { name?: string; value?: number }[];
}

export interface IEspnTeam {
  id?: string;
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  nickname?: string;
  slug?: string;
  logos?: ITeamLogo[];
  logo?: string;
  color?: string;
  alternateColor?: string;
  links?: ITeamLink[];
  location?: string;
  isActive?: boolean;
  venue?: IEspnVenue;
  form?: string;
  defaultLeague?: { $ref?: string };
  record?: { $ref?: string };
  events?: { $ref?: string };
  nextEvent?: IEspnScheduleEvent[];
}

interface IEspnVenue {
  id?: string;
  fullName?: string;
  address?: { city?: string; country?: string };
}

export interface IEspnGameStatus {
  displayClock?: string;
  period?: number;
  type?: { name?: string; state?: string; completed?: boolean; description?: string; shortDetail?: string };
}

export interface IEspnGameCompetitor {
  id?: string;
  homeAway?: string;
  team?: IEspnTeam;
  score?: string | number;
}

export interface IEspnGameCompetition {
  date?: string;
  status?: IEspnGameStatus;
  competitors?: IEspnGameCompetitor[];
}

export interface IEspnGameSummaryResponse {
  header?: {
    id?: string;
    league?: { name?: string; slug?: string };
    season?: { name?: string; year?: number };
    competitions?: IEspnGameCompetition[];
  };
  gameInfo?: { venue?: IEspnVenue };
  boxscore?: { teams?: IEspnGameTeamStatistics[] };
  keyEvents?: IEspnGameKeyEvent[];
}

export interface IEspnGameTeamStatistics {
  team?: { id?: string };
  statistics?: { name?: string; displayValue?: string }[];
}

export interface IEspnGameKeyEvent {
  id?: string;
  type?: { type?: string; text?: string };
  clock?: { displayValue?: string };
  team?: { id?: string };
  participants?: { athlete?: { id?: string; displayName?: string } }[];
  text?: string;
  shortText?: string;
  ownGoal?: boolean;
  penaltyKick?: boolean;
}

export interface IEspnScoreboardResponse {
  events?: {
    id?: string;
    status?: IEspnGameStatus;
    competitions?: IEspnGameCompetition[];
  }[];
}
