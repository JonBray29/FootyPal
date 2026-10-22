import express from "express";
import { healthRouter } from "./health.js";
import { GameNotFoundError, getGame, getLiveGame } from "./game.js";
import { SUPPORTED_LEAGUES } from "./constants.js";
import {
    LeaguePositionType,
    type ILeagueStanding,
    type ITeam,
    type ITeamFixture,
    type ITeamSimple
} from "./interfaces.js";
import type {
    IEspnTeamResponse,
    IEspnTeamDetailResponse,
    IEspnStandingsResponse,
    IEspnScheduleResponse,
    IEspnTeamEventsResponse,
    IEspnCoreEventResponse
} from "./espn-interfaces.js";

export const app = express();

app.use(express.json());
app.use("/health", healthRouter);

app.get("/api/leagues", (_req, res) => {
    res.json(SUPPORTED_LEAGUES);
});

app.get("/api/leagues/:slug/teams", async (req, res) => {
    const league = SUPPORTED_LEAGUES.find(({ slug }) => slug === req.params.slug);

    if (!league) {
        res.status(404).json({ error: "League not found" });
        return;
    }

    try {
        const response = await fetch(
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(league.slug)}/teams`
        );

        if (!response.ok) {
            res.status(502).json({ error: "Unable to retrieve teams from ESPN" });
            return;
        }

        const data: IEspnTeamResponse = await response.json();

        const teams: ITeam[] =
            data.sports?.flatMap(
                (sport) =>
                    sport.leagues?.flatMap(
                        (entry) =>
                            entry.teams?.flatMap(({ team }) =>
                                team?.id && team.name
                                    ? [
                                          {
                                              id: team.id,
                                              name: team.name,
                                              abbreviation: team.abbreviation ?? null,
                                              logos: team.logos ?? []
                                          }
                                      ]
                                    : []
                            ) ?? []
                    ) ?? []
            ) ?? [];

        res.json(teams);
    } catch {
        res.status(502).json({ error: "Unable to retrieve teams from ESPN" });
    }
});

app.get("/api/teams/:teamId", async (req, res) => {
    if (!/^\d+$/.test(req.params.teamId)) {
        res.status(400).json({ error: "Team ID must be numeric" });
        return;
    }

    try {
        const response = await fetch(
            `http://sports.core.api.espn.com/v2/sports/soccer/teams/${encodeURIComponent(req.params.teamId)}`,
            { signal: AbortSignal.timeout(10000) }
        );

        if (response.status === 404) {
            res.status(404).json({ error: "Team not found" });
            return;
        }
        if (!response.ok) throw new Error("ESPN team details failed");
        const data: IEspnTeamDetailResponse = await response.json();
        const team = data;
        if (!team?.id) throw new Error("Invalid ESPN team details");
        const color = (value?: string) => (value && /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : null);

        const leagueSlug = team.defaultLeague?.$ref?.match(/\/leagues\/([^/?]+)/)?.[1];
        const liveGame = await getLiveGame(team.id);
        let standings: ILeagueStanding[] = [];
        if (leagueSlug) {
            const standingsResponse = await fetch(
                `https://site.api.espn.com/apis/v2/sports/soccer/${encodeURIComponent(leagueSlug)}/standings`,
                { signal: AbortSignal.timeout(10000) }
            );
            if (!standingsResponse.ok) throw new Error("ESPN league standings failed");
            const standingsData: IEspnStandingsResponse = await standingsResponse.json();
            const groups = standingsData.children?.flatMap((group) => [group, ...(group.children ?? [])]) ?? [];
            const entries = [
                ...(standingsData.standings?.entries ?? []),
                ...groups.flatMap((group) => group.standings?.entries ?? [])
            ];
            const positionType = (description?: string): LeaguePositionType => {
                if (!description) return LeaguePositionType.NONE;
                const text = description.toLowerCase();
                if (text.includes("relegat")) return LeaguePositionType.RELEGATION;
                if (text.includes("champions league")) return LeaguePositionType.CHAMPIONS_LEAGUE;
                if (text.includes("europa league")) return LeaguePositionType.EUROPA_LEAGUE;
                if (text.includes("conference league")) return LeaguePositionType.CONFERENCE_LEAGUE;
                if (text.includes("playoff") || text.includes("play-off")) return LeaguePositionType.PLAYOFF;
                if (text.includes("promotion")) return LeaguePositionType.PROMOTION;
                return LeaguePositionType.OTHER;
            };
            const statValue = (entry: (typeof entries)[number], name: string) =>
                entry.stats?.find((stat) => stat.name === name)?.value ?? 0;
            standings = entries.flatMap((entry) => {
                const teamName = entry.team?.displayName ?? entry.team?.name;
                const position = entry.note?.rank ?? statValue(entry, "rank");
                if (!teamName || !position) return [];
                return [
                    {
                        position,
                        positionType: positionType(entry.note?.description),
                        teamName,
                        gamesPlayed: statValue(entry, "gamesPlayed"),
                        won: statValue(entry, "wins"),
                        drew: statValue(entry, "ties"),
                        lost: statValue(entry, "losses"),
                        goalsFor: statValue(entry, "pointsFor"),
                        goalsAgainst: statValue(entry, "pointsAgainst"),
                        goalDifference: statValue(entry, "pointDifferential"),
                        points: statValue(entry, "points")
                    }
                ];
            });
        }

        const previousMatches: ITeamFixture[] = [];
        const upcomingFixtures: ITeamFixture[] = [];
        if (leagueSlug) {
            const teamsResponse = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueSlug)}/teams`,
                { signal: AbortSignal.timeout(10000) }
            );
            if (!teamsResponse.ok) throw new Error("ESPN team list failed");
            const teamsData: IEspnTeamResponse = await teamsResponse.json();
            const teamsById = new Map<string, ITeamSimple>();
            for (const sport of teamsData.sports ?? []) {
                for (const league of sport.leagues ?? []) {
                    for (const entry of league.teams ?? []) {
                        const item = entry.team;
                        if (item?.id && item.name)
                            teamsById.set(item.id, {
                                id: item.id,
                                name: item.name,
                                abbreviation: item.abbreviation ?? null,
                                logo:
                                    item.logos?.find((logo) => logo.rel?.includes("default"))?.href ??
                                    item.logos?.[0]?.href ??
                                    null
                            });
                    }
                }
            }

            const scheduleResponse = await fetch(
                `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(leagueSlug)}/teams/${encodeURIComponent(team.id)}/schedule?season=${new Date().getUTCFullYear()}&seasontype=1`,
                { signal: AbortSignal.timeout(10000) }
            );
            if (!scheduleResponse.ok) throw new Error("ESPN team schedule failed");
            const schedule: IEspnScheduleResponse = await scheduleResponse.json();
            for (const event of schedule.events ?? []) {
                if (event.id === liveGame?.eventId) continue;
                const competition = event.competitions?.[0];
                const home = competition?.competitors?.find((competitor) => competitor.homeAway === "home");
                const away = competition?.competitors?.find((competitor) => competitor.homeAway === "away");
                if (!home?.id || !away?.id) continue;
                const homeTeam = teamsById.get(home.id);
                const awayTeam = teamsById.get(away.id);
                if (!homeTeam || !awayTeam) continue;
                const fixture: ITeamFixture = { eventId: event.id, date: event.date ?? null, homeTeam, awayTeam };
                const completed =
                    competition?.status?.type?.completed ??
                    (event.date ? new Date(event.date).getTime() < Date.now() : false);
                if (completed) {
                    fixture.homeTeamGoals = typeof home.score === "object" ? home.score.value : Number(home.score ?? 0);
                    fixture.awayTeamGoals = typeof away.score === "object" ? away.score.value : Number(away.score ?? 0);
                    previousMatches.push(fixture);
                }
            }

            const eventRefsResponse = await fetch(`${team.events?.$ref}&limit=100`, {
                signal: AbortSignal.timeout(10000)
            });
            if (!eventRefsResponse.ok) throw new Error("ESPN team event list failed");
            const eventRefs: IEspnTeamEventsResponse = await eventRefsResponse.json();
            const refs = eventRefs.items ?? [];
            for (let index = 0; index < refs.length; index += 8) {
                const events = await Promise.all(
                    refs.slice(index, index + 8).map(async ({ $ref }) => {
                        const response = await fetch($ref, { signal: AbortSignal.timeout(10000) });
                        if (!response.ok) throw new Error("ESPN event fetch failed");
                        return (await response.json()) as IEspnCoreEventResponse;
                    })
                );
                for (const event of events) {
                    if (event.id === liveGame?.eventId) continue;
                    if (!event.date || new Date(event.date).getTime() <= Date.now()) continue;
                    const competitors = event.competitions?.[0]?.competitors ?? [];
                    const home = competitors.find((competitor) => competitor.homeAway === "home");
                    const away = competitors.find((competitor) => competitor.homeAway === "away");
                    const homeTeam = home?.id ? teamsById.get(home.id) : undefined;
                    const awayTeam = away?.id ? teamsById.get(away.id) : undefined;
                    if (homeTeam && awayTeam)
                        upcomingFixtures.push({ eventId: event.id, date: event.date, homeTeam, awayTeam });
                }
            }
        }

        res.json({
            id: team.id,
            name: team.displayName ?? team.name ?? null,
            shortName: team.shortDisplayName ?? null,
            abbreviation: team.abbreviation ?? null,
            nickname: team.nickname ?? null,
            location: team.location ?? null,
            logos: team.logos ?? [],
            colors: { primary: color(team.color), secondary: color(team.alternateColor) },
            isActive: team.isActive ?? null,
            form: team.form ?? null,
            venue: team.venue
                ? {
                      id: team.venue.id ?? null,
                      name: team.venue.fullName ?? null,
                      city: team.venue.address?.city ?? null,
                      country: team.venue.address?.country ?? null
                  }
                : null,
            leagueRef: team.defaultLeague?.$ref ?? null,
            recordRef: team.record?.$ref ?? null,
            eventsRef: team.events?.$ref ?? null,
            standings,
            liveGame,
            previousMatches: previousMatches.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
            upcomingFixtures: upcomingFixtures.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
            links:
                team.links
                    ?.filter(
                        (link) =>
                            link.href.startsWith("https://") &&
                            link.rel?.some((rel) => ["clubhouse", "schedule", "stats"].includes(rel))
                    )
                    .map(({ href, text }) => ({ href, text: text ?? null })) ?? []
        });
    } catch {
        res.status(502).json({ error: "Unable to retrieve team details from ESPN" });
    }
});

app.get("/api/game/:eventId", async (req, res) => {
    if (!/^[0-9]+$/.test(req.params.eventId)) {
        res.status(400).json({ error: "Event ID must be numeric" });
        return;
    }
    try {
        res.json(await getGame(req.params.eventId));
    } catch (error) {
        if (error instanceof GameNotFoundError) {
            res.status(404).json({ error: "Game not found" });
        } else {
            res.status(502).json({ error: "Unable to retrieve game details from ESPN" });
        }
    }
});

