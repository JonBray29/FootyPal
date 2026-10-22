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

export interface ITeamLink {
  href: string;
  text?: string;
  rel?: string[];
}

