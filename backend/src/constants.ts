import type { ILeague } from './interfaces.js';

const ESPN_SOCCER_LEAGUES_URL = "http://sports.core.api.espn.com/v2/sports/soccer/leagues";

/** Major domestic leagues supported by FootyPal. */
export const SUPPORTED_LEAGUES: ILeague[] = [
    { name: "Premier League", slug: "eng.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.1` },
    { name: "EFL Championship", slug: "eng.2", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.2` },
    { name: "EFL League One", slug: "eng.3", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.3` },
    { name: "EFL League Two", slug: "eng.4", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.4` },
    { name: "La Liga", slug: "esp.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/esp.1` },
    { name: "Ligue 1", slug: "fra.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/fra.1` },
    { name: "Bundesliga", slug: "ger.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/ger.1` },
    { name: "Serie A", slug: "ita.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/ita.1` },
    { name: "Eredivisie", slug: "ned.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/ned.1` },
    { name: "Primeira Liga", slug: "por.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/por.1` },
    { name: "Scottish Premiership", slug: "sco.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/sco.1` },
    { name: "Major League Soccer", slug: "usa.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/usa.1` }
];
