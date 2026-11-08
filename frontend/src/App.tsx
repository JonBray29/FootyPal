import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FavoriteTeam, Fixture, GameDetails, League, Team, TeamOption, TodaysGame } from "./types";
import { Badge, UiIcon } from "./components/Ui";
import { FixturePanel, TodayGamePanel } from "./components/MatchPanels";
import { MatchDetailsModal } from "./components/MatchDetailsModal";
import { SettingsModal } from "./components/SettingsModal";
import { StandingsPanel } from "./components/StandingsPanel";
import { TeamPickerModal } from "./components/TeamPickerModal";
import { dateLabel, HOUR_OPTIONS } from "./utils";
const savedHour = (key: string, fallback: string) => {
    const value = getSaved(key, fallback);
    return HOUR_OPTIONS.some((option) => option.value === value) ? value : fallback;
};
const API = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");
const getSaved = (key: string, fallback: string) => {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
};
const getSavedFavoriteTeams = (): FavoriteTeam[] => {
    try {
        const value: unknown = JSON.parse(getSaved("footypal.favorites", "[]"));
        return Array.isArray(value)
            ? value
                  .filter(
                      (item): item is FavoriteTeam =>
                          item &&
                          typeof item.id === "string" &&
                          typeof item.name === "string" &&
                          typeof item.leagueSlug === "string" &&
                          (typeof item.logo === "string" || item.logo === null)
                  )
                  .slice(0, 4)
            : [];
    } catch {
        return [];
    }
};
const api = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(`${API}${path}`, { signal, cache: "no-store" });
    if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
            message = (await response.json()).error ?? message;
        } catch {
            /* use status */
        }
        throw new Error(message);
    }
    return response.json() as Promise<T>;
};

function isToday(value: string | null, today = new Date()) {
    return !!value && new Date(value).toDateString() === today.toDateString();
}

function isInDailyHourWindow(now: Date, startHour: number, endHour: number) {
    if (startHour === endHour) return false;
    const hour = now.getHours();
    return startHour < endHour ? hour >= startHour && hour < endHour : hour >= startHour || hour < endHour;
}

function colorForMode(hex: string | null, mode: "light" | "dark", fallback: string) {
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return fallback;
    const rgb = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const luminance = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    if (luminance < 28 || luminance > 230) return mode === "dark" ? "#f4f2ee" : "#202421";
    const target = mode === "dark" ? 255 : 0;
    const factor = mode === "dark" ? 0.08 : 0.12;
    const adjusted = rgb.map((value) => Math.round(value + (target - value) * factor));
    return `#${adjusted.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export default function App() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [leagueSlug, setLeagueSlug] = useState(() => getSaved("footypal.league", ""));
    const [draftLeagueSlug, setDraftLeagueSlug] = useState(() => getSaved("footypal.league", ""));
    const [teamId, setTeamId] = useState(() => getSaved("footypal.team", ""));
    const [draftTeamId, setDraftTeamId] = useState(() => getSaved("footypal.team", ""));
    const [favoriteTeams, setFavoriteTeams] = useState<FavoriteTeam[]>(getSavedFavoriteTeams);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [team, setTeam] = useState<Team | null>(null);
    const [mode, setMode] = useState<"light" | "dark">(() => getSaved("footypal.mode", "dark") as "light" | "dark");
    const [teamPicker, setTeamPicker] = useState(!getSaved("footypal.team", ""));
    const [leagueListOpen, setLeagueListOpen] = useState(false);
    const [teamListOpen, setTeamListOpen] = useState(false);
    const [screenSleepListOpen, setScreenSleepListOpen] = useState(false);
    const [nightSleepEnabled, setNightSleepEnabled] = useState(
        () => getSaved("footypal.sleep.schedule.enabled", "false") === "true"
    );
    const [nightSleepStart, setNightSleepStart] = useState(() => savedHour("footypal.sleep.schedule.start", "22"));
    const [nightSleepEnd, setNightSleepEnd] = useState(() => savedHour("footypal.sleep.schedule.end", "07"));
    const [nightHourListOpen, setNightHourListOpen] = useState<"start" | "end" | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [loadingLeagues, setLoadingLeagues] = useState(true);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [loadingTeam, setLoadingTeam] = useState(false);
    const [error, setError] = useState("");
    const [brightness, setBrightness] = useState(75);
    const [volume, setVolume] = useState(45);
    const [screenSleepSeconds, setScreenSleepSeconds] = useState(0);
    const [screenBlanked, setScreenBlanked] = useState(false);
    const [gameDetails, setGameDetails] = useState<GameDetails | null>(null);
    const [gameDetailsEventId, setGameDetailsEventId] = useState<string | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<TodaysGame | null>(null);
    const [matchDetails, setMatchDetails] = useState<GameDetails | null>(null);
    const [matchDetailsEventId, setMatchDetailsEventId] = useState<string | null>(null);
    const [loadingMatchDetails, setLoadingMatchDetails] = useState(false);
    const [matchDetailsError, setMatchDetailsError] = useState("");
    const hasLoadedTeam = useRef(false);
    const standingsWrapRef = useRef<HTMLDivElement>(null);
    const lastScreenActivityRef = useRef(Date.now());
    const screenBlankedRef = useRef(false);
    const canControlSleep =
        typeof window.FootyPalDevice?.getScreenSleepSeconds === "function" &&
        typeof window.FootyPalDevice?.setScreenSleepSeconds === "function" &&
        typeof window.FootyPalDevice?.setScreenBlanked === "function";

    useEffect(() => {
        const controller = new AbortController();
        api<League[]>("/api/leagues", controller.signal)
            .then((items) => {
                setLeagues(items);
                setLeagueSlug((current) => current || items[0]?.slug || "");
                setDraftLeagueSlug((current) => current || items[0]?.slug || "");
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load leagues");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingLeagues(false);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!draftLeagueSlug) return;
        const controller = new AbortController();
        setLoadingTeams(true);
        api<TeamOption[]>(`/api/leagues/${encodeURIComponent(draftLeagueSlug)}/teams`, controller.signal)
            .then(setTeams)
            .catch((err: unknown) => {
                if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load teams");
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingTeams(false);
            });
        return () => controller.abort();
    }, [draftLeagueSlug]);

    const loadTeam = useCallback(async (id: string, signal?: AbortSignal) => {
        const showLoading = !hasLoadedTeam.current;
        if (showLoading) setLoadingTeam(true);
        try {
            const profile = await api<Team>(`/api/teams/${encodeURIComponent(id)}`, signal);
            hasLoadedTeam.current = true;
            setTeam(profile);
            setError("");
        } catch (err) {
            if (!signal?.aborted) setError(err instanceof Error ? err.message : "Could not load team data");
        } finally {
            if (!signal?.aborted && showLoading) setLoadingTeam(false);
        }
    }, []);

    useEffect(() => {
        if (!teamId) return;
        const controller = new AbortController();
        let active = true;
        const refresh = () => {
            if (active) void loadTeam(teamId, controller.signal);
        };
        refresh();
        const interval = window.setInterval(refresh, 30_000);
        return () => {
            active = false;
            controller.abort();
            window.clearInterval(interval);
        };
    }, [teamId, loadTeam]);

    useEffect(() => {
        document.documentElement.dataset.mode = mode;
        localStorage.setItem("footypal.mode", mode);
    }, [mode]);

    useEffect(() => {
        localStorage.setItem("footypal.sleep.schedule.enabled", String(nightSleepEnabled));
        localStorage.setItem("footypal.sleep.schedule.start", nightSleepStart);
        localStorage.setItem("footypal.sleep.schedule.end", nightSleepEnd);
    }, [nightSleepEnabled, nightSleepStart, nightSleepEnd]);

    useEffect(() => {
        try {
            localStorage.setItem("footypal.favorites", JSON.stringify(favoriteTeams));
        } catch {
            /* Keep favorites for this session if storage is unavailable. */
        }
    }, [favoriteTeams]);

    useEffect(() => {
        const device = window.FootyPalDevice;
        if (typeof device?.getBrightness === "function") setBrightness(device.getBrightness());
        if (typeof device?.getVolume === "function") setVolume(device.getVolume());
        if (typeof device?.getScreenSleepSeconds === "function") setScreenSleepSeconds(device.getScreenSleepSeconds());
    }, [settingsOpen]);

    useEffect(() => {
        const device = window.FootyPalDevice;
        if (!canControlSleep || typeof device?.setScreenBlanked !== "function") {
            device?.setScreenBlanked?.(false);
            screenBlankedRef.current = false;
            setScreenBlanked(false);
            return;
        }
        const setBlanked = (blanked: boolean) => {
            if (screenBlankedRef.current === blanked) return;
            screenBlankedRef.current = blanked;
            setScreenBlanked(blanked);
            device.setScreenBlanked(blanked);
        };
        const evaluateSleep = () => {
            const inNightWindow =
                nightSleepEnabled && isInDailyHourWindow(new Date(), Number(nightSleepStart), Number(nightSleepEnd));
            const timeoutSeconds = inNightWindow ? 30 : screenSleepSeconds;
            const shouldBlank =
                timeoutSeconds > 0 && Date.now() - lastScreenActivityRef.current >= timeoutSeconds * 1000;
            setBlanked(shouldBlank);
        };
        const recordActivity = () => {
            lastScreenActivityRef.current = Date.now();
            setBlanked(false);
        };
        evaluateSleep();
        const interval = window.setInterval(evaluateSleep, 1_000);
        window.addEventListener("pointerdown", recordActivity);
        window.addEventListener("keydown", recordActivity);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener("pointerdown", recordActivity);
            window.removeEventListener("keydown", recordActivity);
            screenBlankedRef.current = false;
            setScreenBlanked(false);
            device.setScreenBlanked(false);
        };
    }, [screenSleepSeconds, nightSleepEnabled, nightSleepStart, nightSleepEnd, canControlSleep]);

    const favorite = useMemo(() => teams.find((candidate) => candidate.id === teamId), [teamId, teams]);
    const accent = colorForMode(team?.colors.primary ?? null, mode, mode === "dark" ? "#c7ef55" : "#52720f");
    const accentRgb = [1, 3, 5].map((index) => parseInt(accent.slice(index, index + 2), 16));
    const accentRgbCss = accentRgb.join(", ");
    const accentInk =
        (accentRgb[0] * 299 + accentRgb[1] * 587 + accentRgb[2] * 114) / 1000 > 145 ? "#171a15" : "#ffffff";
    const canControlBrightness =
        typeof window.FootyPalDevice?.getBrightness === "function" &&
        typeof window.FootyPalDevice?.setBrightness === "function";
    const canControlVolume =
        typeof window.FootyPalDevice?.getVolume === "function" &&
        typeof window.FootyPalDevice?.setVolume === "function";
    const visibleTeams = teams;
    const draftTeam = teams.find((item) => item.id === draftTeamId);
    const draftLeague = leagues.find((item) => item.slug === draftLeagueSlug);
    const logo = team?.logos?.find((item) => item.rel?.includes("default"))?.href ?? team?.logos?.[0]?.href;
    const leagueName = leagues.find((league) => league.slug === leagueSlug)?.name ?? "Football";
    const currentTeamIsFavorite = favoriteTeams.some((item) => item.id === teamId && item.leagueSlug === leagueSlug);
    const visibleFavoriteTeams = favoriteTeams.filter((item) => item.id !== teamId || item.leagueSlug !== leagueSlug);
    const toggleCurrentFavorite = () => {
        if (!team) return;
        if (currentTeamIsFavorite) {
            setFavoriteTeams((items) => items.filter((item) => item.id !== teamId || item.leagueSlug !== leagueSlug));
            return;
        }
        setFavoriteTeams((items) =>
            items.length >= 4 || items.some((item) => item.id === team.id && item.leagueSlug === leagueSlug)
                ? items
                : [...items, { id: team.id, name: team.name, leagueSlug, logo: logo ?? null }]
        );
    };
    const selectFavoriteTeam = (favoriteTeam: FavoriteTeam) => {
        localStorage.setItem("footypal.team", favoriteTeam.id);
        localStorage.setItem("footypal.league", favoriteTeam.leagueSlug);
        setLeagueSlug(favoriteTeam.leagueSlug);
        setDraftLeagueSlug(favoriteTeam.leagueSlug);
        setDraftTeamId(favoriteTeam.id);
        if (favoriteTeam.id !== teamId || favoriteTeam.leagueSlug !== leagueSlug) {
            hasLoadedTeam.current = false;
            setTeamId(favoriteTeam.id);
            setTeam(null);
            setError("");
        }
    };
    useLayoutEffect(() => {
        const wrap = standingsWrapRef.current;
        const selectedRow = wrap?.querySelector<HTMLElement>("[data-selected-team='true']");
        if (!wrap || !selectedRow) return;
        const rowTop = selectedRow.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop;
        const centeredTop = rowTop + selectedRow.offsetHeight / 2 - wrap.clientHeight / 2;
        wrap.scrollTop = Math.max(0, Math.min(wrap.scrollHeight - wrap.clientHeight, centeredTop));
    }, [teamId, team?.standings.length]);
    const onSelectTeam = () => {
        if (!draftTeamId) return;
        localStorage.setItem("footypal.team", draftTeamId);
        localStorage.setItem("footypal.league", draftLeagueSlug);
        if (draftTeamId === teamId) {
            setLeagueSlug(draftLeagueSlug);
            setTeamPicker(false);
            return;
        }
        hasLoadedTeam.current = false;
        setLeagueSlug(draftLeagueSlug);
        setTeamId(draftTeamId);
        setTeam(null);
        setError("");
        setTeamPicker(false);
    };

    const live = team?.liveGame;
    const previousFixtures = team ? [...team.previousMatches].reverse() : [];
    const upcomingFixtures = team?.upcomingFixtures ?? [];
    const upcomingToday = upcomingFixtures.find((fixture) => isToday(fixture.date));
    const finishedToday = [...previousFixtures].reverse().find((fixture) => isToday(fixture.date));
    const todayGame: TodaysGame | null = live
        ? { fixture: live, status: "LIVE" }
        : upcomingToday
          ? { fixture: upcomingToday, status: "SCHEDULED" }
          : finishedToday
            ? { fixture: finishedToday, status: "FINISHED" }
            : null;
    useEffect(() => {
        const selectedGame = todayGame;
        const eventId = selectedGame?.fixture.eventId;
        if (!selectedGame || !eventId) {
            setGameDetails(null);
            setGameDetailsEventId(null);
            return;
        }
        setGameDetails(null);
        setGameDetailsEventId(null);
        const controller = new AbortController();
        const refreshGame = () => {
            api<GameDetails>(`/api/game/${encodeURIComponent(eventId)}`, controller.signal)
                .then((details) => {
                    if (!controller.signal.aborted) {
                        setGameDetails(details);
                        setGameDetailsEventId(eventId);
                    }
                })
                .catch(() => {
                    /* Keep the selected game visible if details are temporarily unavailable. */
                });
        };
        refreshGame();
        const interval = selectedGame.status === "LIVE" ? window.setInterval(refreshGame, 30_000) : undefined;
        return () => {
            controller.abort();
            if (interval) window.clearInterval(interval);
        };
    }, [todayGame?.fixture.eventId, todayGame?.status]);

    useEffect(() => {
        if (!selectedMatch) {
            setMatchDetails(null);
            setMatchDetailsEventId(null);
            setLoadingMatchDetails(false);
            setMatchDetailsError("");
            return;
        }
        if (todayGame?.fixture.eventId === selectedMatch.fixture.eventId) {
            setMatchDetails(null);
            setMatchDetailsEventId(null);
            setLoadingMatchDetails(false);
            setMatchDetailsError("");
            return;
        }
        const controller = new AbortController();
        setMatchDetails(null);
        setMatchDetailsEventId(null);
        setLoadingMatchDetails(true);
        setMatchDetailsError("");
        let interval: number | undefined;
        const refreshMatch = () => {
            api<GameDetails>(`/api/game/${encodeURIComponent(selectedMatch.fixture.eventId)}`, controller.signal)
                .then((details) => {
                    if (!controller.signal.aborted) {
                        setMatchDetails(details);
                        setMatchDetailsEventId(selectedMatch.fixture.eventId);
                        if (details.status.type === "FINISHED" && interval) {
                            window.clearInterval(interval);
                            interval = undefined;
                        }
                    }
                })
                .catch((err: unknown) => {
                    if (!controller.signal.aborted)
                        setMatchDetailsError(err instanceof Error ? err.message : "Could not load match details");
                })
                .finally(() => {
                    if (!controller.signal.aborted) setLoadingMatchDetails(false);
                });
        };
        refreshMatch();
        const shouldPoll =
            selectedMatch.status === "LIVE" ||
            (selectedMatch.status === "SCHEDULED" && isToday(selectedMatch.fixture.date));
        if (shouldPoll) interval = window.setInterval(refreshMatch, 30_000);
        return () => {
            controller.abort();
            if (interval) window.clearInterval(interval);
        };
    }, [selectedMatch?.fixture.eventId, todayGame?.fixture.eventId]);

    useEffect(() => {
        if (!selectedMatch) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setSelectedMatch(null);
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [selectedMatch]);
    const timelineFixtures = [
        ...previousFixtures.map((fixture) => ({ fixture, live: false, previous: true })),
        ...(live ? [{ fixture: live, live: true, previous: false }] : []),
        ...upcomingFixtures.map((fixture) => ({ fixture, live: false, previous: false }))
    ];
    const targetFixture = live ?? upcomingFixtures[0] ?? previousFixtures[previousFixtures.length - 1];
    const returnLabel = live
        ? "Return to live game"
        : upcomingFixtures.length
          ? "Return to next game"
          : "Return to latest fixture";
    const openMatchDetails = (game: TodaysGame) => {
        setMatchDetails(null);
        setMatchDetailsEventId(null);
        setLoadingMatchDetails(true);
        setMatchDetailsError("");
        setSelectedMatch(game);
    };
    const openFixtureDetails = (fixture: Fixture) => {
        if (todayGame?.fixture.eventId === fixture.eventId) {
            openMatchDetails(todayGame);
            return;
        }
        openMatchDetails({ fixture, status: "FINISHED" });
    };
    const modalUsesTodayGameDetails = !!selectedMatch && todayGame?.fixture.eventId === selectedMatch.fixture.eventId;
    const modalMatchDetails = selectedMatch
        ? modalUsesTodayGameDetails
            ? gameDetailsEventId === selectedMatch.fixture.eventId
                ? gameDetails
                : null
            : matchDetailsEventId === selectedMatch.fixture.eventId
              ? matchDetails
              : null
        : null;
    const modalMatchLoading = selectedMatch
        ? modalUsesTodayGameDetails
            ? gameDetailsEventId !== selectedMatch.fixture.eventId
            : loadingMatchDetails || (matchDetailsEventId !== selectedMatch.fixture.eventId && !matchDetailsError)
        : false;
    const selectedMatchStatus = selectedMatch ? (modalMatchDetails?.status.type ?? selectedMatch.status) : undefined;
    const selectedMatchDate = selectedMatch?.fixture.date ?? null;
    const selectedMatchIsToday = isToday(selectedMatchDate);
    const selectedMatchTitle = selectedMatchIsToday ? "Today’s game" : "Previous result";
    const selectedMatchTime = selectedMatchIsToday
        ? selectedMatchStatus === "FINISHED"
            ? "FT"
            : selectedMatchStatus === "LIVE"
              ? (modalMatchDetails?.status.clock ?? "LIVE")
              : selectedMatchDate
                ? dateLabel(selectedMatchDate, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
                : "Time TBC"
        : dateLabel(selectedMatchDate, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23"
          });

    return (
        <main
            className={`app-shell ${mode}`}
            style={
                {
                    "--team-accent": accent,
                    "--team-accent-ink": accentInk,
                    "--accent-soft": `rgba(${accentRgbCss}, 0.13)`,
                    "--team-accent-glow": `rgba(${accentRgbCss}, 0.12)`,
                    "--team-accent-border": `rgba(${accentRgbCss}, 0.42)`
                } as React.CSSProperties
            }
        >
            <header className="topbar">
                <div className="brand">
                    <span className="brand-mark">F</span>
                    <span>FOOTYPAL</span>
                </div>
                <div className="topbar-context">
                    {team ? (
                        <button
                            className="topbar-club"
                            onClick={() => {
                                setDraftLeagueSlug(leagueSlug);
                                setDraftTeamId(teamId);
                                setTeamPicker(true);
                            }}
                        >
                            <Badge src={logo} name={team.name} className="topbar-crest" />
                            <span className="topbar-club-copy">
                                <strong>{team.name}</strong>
                                <small>{leagueName}</small>
                            </span>
                        </button>
                    ) : (
                        <span>{leagueName}</span>
                    )}
                </div>
                <div className="topbar-actions">
                    {visibleFavoriteTeams.map((favoriteTeam) => (
                        <button
                            type="button"
                            className="favorite-chip"
                            key={`${favoriteTeam.leagueSlug}-${favoriteTeam.id}`}
                            aria-label={`Switch to ${favoriteTeam.name}`}
                            title={favoriteTeam.name}
                            onClick={() => selectFavoriteTeam(favoriteTeam)}
                        >
                            <Badge src={favoriteTeam.logo} name={favoriteTeam.name} />
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`favorite-star ${currentTeamIsFavorite ? "is-favorite" : ""}`}
                        aria-label={
                            !team
                                ? "Choose a team before adding favourites"
                                : currentTeamIsFavorite
                                  ? `Remove ${team.name} from favourites`
                                  : favoriteTeams.length >= 4
                                    ? "Four favourite teams are already saved"
                                    : `Add ${team.name} to favourites`
                        }
                        aria-pressed={currentTeamIsFavorite}
                        disabled={!team || (!currentTeamIsFavorite && favoriteTeams.length >= 4)}
                        title={
                            !team
                                ? "Choose a team before adding favourites"
                                : currentTeamIsFavorite
                                  ? "Remove from favourites"
                                  : favoriteTeams.length >= 4
                                    ? "Remove a favourite before adding another"
                                    : "Add to favourites"
                        }
                        onClick={toggleCurrentFavorite}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" />
                        </svg>
                    </button>
                    <button className="icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}>
                        <UiIcon name="settings" size={23} />
                    </button>
                </div>
            </header>

            {error && (
                <div className="error-banner" role="alert">
                    <span>{error}</span>
                    <button onClick={() => (teamId ? void loadTeam(teamId) : setTeamPicker(true))}>Try again</button>
                    <button className="dismiss" onClick={() => setError("")} aria-label="Dismiss">
                        ×
                    </button>
                </div>
            )}

            {!team && !loadingTeam && (
                <section className="welcome-panel">
                    <div className="welcome-kicker">YOUR MATCHDAY, AT A GLANCE</div>
                    <div className="welcome-ball">◉</div>
                    <h1>Make it your club.</h1>
                    <p>Choose your side and we’ll bring the table, fixtures and live updates together in one place.</p>
                    <button className="primary-button" onClick={() => setTeamPicker(true)}>
                        Choose your team <span>→</span>
                    </button>
                </section>
            )}

            {loadingTeam && (
                <div className="loading-screen">
                    <span className="loader" />
                    Getting the latest from {favorite?.name ?? "your team"}…
                </div>
            )}

            {team && (
                <>
                    <section className="dashboard-grid">
                        <StandingsPanel team={team} teams={teams} tableWrapRef={standingsWrapRef} />

                        <div className="fixtures-column">
                            {todayGame && (
                                <TodayGamePanel
                                    game={todayGame}
                                    details={gameDetailsEventId === todayGame.fixture.eventId ? gameDetails : null}
                                    highlightedId={team.id}
                                    onExpand={() => openMatchDetails(todayGame)}
                                />
                            )}
                            <FixturePanel
                                fixtures={timelineFixtures}
                                highlightedId={team.id}
                                teamId={team.id}
                                emptyMessage="No fixtures to show."
                                targetEventId={targetFixture?.eventId}
                                returnLabel={returnLabel}
                                expandEventId={todayGame?.fixture.eventId}
                                onFixtureSelect={openFixtureDetails}
                            />
                        </div>
                    </section>
                </>
            )}

            <TeamPickerModal
                open={teamPicker}
                hasTeam={!!team}
                onClose={() => setTeamPicker(false)}
                onSelectTeam={onSelectTeam}
                leagues={leagues}
                loadingLeagues={loadingLeagues}
                draftLeagueSlug={draftLeagueSlug}
                draftLeague={draftLeague}
                onLeagueChange={(slug) => {
                    setDraftLeagueSlug(slug);
                    setDraftTeamId("");
                }}
                leagueListOpen={leagueListOpen}
                setLeagueListOpen={setLeagueListOpen}
                teamListOpen={teamListOpen}
                setTeamListOpen={setTeamListOpen}
                draftTeamId={draftTeamId}
                draftTeam={draftTeam}
                loadingTeams={loadingTeams}
                teams={visibleTeams}
                onTeamChange={(id) => {
                    setDraftTeamId(id);
                    setTeamListOpen(false);
                }}
            />
            <SettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                mode={mode}
                setMode={setMode}
                brightness={brightness}
                setBrightness={setBrightness}
                canControlBrightness={canControlBrightness}
                volume={volume}
                setVolume={setVolume}
                canControlVolume={canControlVolume}
                screenSleepSeconds={screenSleepSeconds}
                screenSleepListOpen={screenSleepListOpen}
                setScreenSleepListOpen={setScreenSleepListOpen}
                canControlSleep={canControlSleep}
                onScreenSleepChange={(seconds) => {
                    setScreenSleepSeconds(seconds);
                    setScreenSleepListOpen(false);
                    setNightHourListOpen(null);
                    window.FootyPalDevice?.setScreenSleepSeconds(seconds);
                }}
                nightSleepEnabled={nightSleepEnabled}
                setNightSleepEnabled={setNightSleepEnabled}
                nightSleepStart={nightSleepStart}
                setNightSleepStart={setNightSleepStart}
                nightSleepEnd={nightSleepEnd}
                setNightSleepEnd={setNightSleepEnd}
                nightHourListOpen={nightHourListOpen}
                setNightHourListOpen={setNightHourListOpen}
            />
            <MatchDetailsModal
                game={selectedMatch}
                title={selectedMatchTitle}
                details={modalMatchDetails}
                highlightedId={team?.id ?? ""}
                loading={modalMatchLoading}
                error={modalUsesTodayGameDetails ? undefined : matchDetailsError}
                isToday={selectedMatchIsToday}
                isLive={selectedMatchStatus === "LIVE"}
                timeLabel={selectedMatchTime}
                onClose={() => setSelectedMatch(null)}
            />
            {screenBlanked && (
                <button type="button" className="screen-sleep-overlay" aria-label="Tap to wake display" />
            )}
        </main>
    );
}
