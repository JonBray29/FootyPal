import type { ILeague } from './interfaces.js';

const ESPN_SOCCER_LEAGUES_URL = "http://sports.core.api.espn.com/v2/sports/soccer/leagues";

/** Major domestic leagues supported by FootyPal. */
export const SUPPORTED_LEAGUES: ILeague[] = [
    { name: "Premier League", slug: "eng.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/23.png" },
    { name: "EFL Championship", slug: "eng.2", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.2`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/24.png" },
    { name: "EFL League One", slug: "eng.3", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.3`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/25.png" },
    { name: "EFL League Two", slug: "eng.4", ref: `${ESPN_SOCCER_LEAGUES_URL}/eng.4`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/26.png" },
    { name: "La Liga", slug: "esp.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/esp.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/15.png" },
    { name: "Ligue 1", slug: "fra.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/fra.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/9.png" },
    { name: "Bundesliga", slug: "ger.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/ger.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/10.png" },
    { name: "Serie A", slug: "ita.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/ita.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/12.png" },
    { name: "Eredivisie", slug: "ned.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/ned.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/11.png" },
    { name: "Primeira Liga", slug: "por.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/por.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/14.png" },
    { name: "Scottish Premiership", slug: "sco.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/sco.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/45.png" },
    { name: "Major League Soccer", slug: "usa.1", ref: `${ESPN_SOCCER_LEAGUES_URL}/usa.1`, logo: "https://a.espncdn.com/i/leaguelogos/soccer/500/19.png" }
];
