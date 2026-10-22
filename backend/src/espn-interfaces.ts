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

interface IEspnTeam {
  id?: string;
  name?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  nickname?: string;
  slug?: string;
  logos?: ITeamLogo[];
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
