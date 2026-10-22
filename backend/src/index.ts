import express from "express";
import { SUPPORTED_LEAGUES } from "./constants.js";
import { LeaguePositionType, type ILeagueStanding, type ITeam } from "./interfaces.js";
import type { IEspnTeamResponse, IEspnTeamDetailResponse, IEspnStandingsResponse } from "./espn-interfaces.js";

export const app = express();

app.use(express.json());

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
                                team?.id && team.name ? [{ id: team.id, name: team.name, logos: team.logos ?? [] }] : []
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
            return [{
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
            }];
        });
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

app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

