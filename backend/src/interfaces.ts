export interface ILeague {
  name: string;
  /** ESPN's league slug, used as the league identifier in other ESPN endpoints. */
  slug: string;
  /** ESPN Core API league record reference. */
  ref: string;
}

export interface ITeamLogo {
  href: string;
  [key: string]: unknown;
}

export interface ITeam {
  id: string;
  name: string;
  logos: ITeamLogo[];
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

export interface ITeamLink {
  href: string;
  text?: string;
  rel?: string[];
}

