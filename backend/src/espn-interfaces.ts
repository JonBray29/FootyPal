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
}

interface IEspnVenue {
  id?: string;
  fullName?: string;
  address?: { city?: string; country?: string };
}
