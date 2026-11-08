import { useLayoutEffect, useRef, useState } from "react";
import type { Fixture, GameDetails, GameStatLine, TodaysGame } from "../types";
import { dateLabel } from "../utils";
import { Badge } from "./Ui";

function FixtureRow({
    fixture,
    result = false,
    live = false,
    previous = false,
    expandable = false,
    isReturnTarget = false,
    highlightedId,
    onOpen
}: {
    fixture: Fixture;
    result?: boolean;
    live?: boolean;
    previous?: boolean;
    expandable?: boolean;
    isReturnTarget?: boolean;
    highlightedId: string;
    onOpen?: (fixture: Fixture) => void;
}) {
    const homeIsFavourite = fixture.homeTeam.id === highlightedId;
    const awayIsFavourite = fixture.awayTeam.id === highlightedId;
    const showScore = result || live;
    const canOpen = (previous || expandable) && !!onOpen;
    return (
        <article
            className={`fixture-row ${live ? "live-fixture" : ""} ${canOpen ? "clickable-fixture" : ""}`}
            role={canOpen ? "button" : undefined}
            tabIndex={canOpen ? 0 : undefined}
            aria-label={
                canOpen ? `View ${fixture.homeTeam.name} versus ${fixture.awayTeam.name} match details` : undefined
            }
            onClick={canOpen ? () => onOpen?.(fixture) : undefined}
            onKeyDown={
                canOpen
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onOpen?.(fixture);
                          }
                      }
                    : undefined
            }
            data-return-target={isReturnTarget ? "true" : undefined}
        >
            <div className="fixture-date">
                {live ? (
                    <span className="fixture-live-label">
                        <i className="live-pulse" />
                        LIVE
                    </span>
                ) : (
                    <span>{dateLabel(fixture.date)}</span>
                )}
                {live ? (
                    <span>
                        {fixture.date
                            ? dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
                            : "IN PLAY"}
                    </span>
                ) : (
                    fixture.date && (
                        <span>{dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>
                    )
                )}
            </div>
            <div className="fixture-match">
                <div className={`fixture-side ${homeIsFavourite ? "is-favourite" : ""}`}>
                    <Badge src={fixture.homeTeam.logo} name={fixture.homeTeam.name} />
                    <span>{fixture.homeTeam.abbreviation ?? fixture.homeTeam.name}</span>
                </div>
                <div className={`fixture-divider ${live ? "is-live" : ""}`}>
                    {showScore ? (
                        <span className="fixture-score-line">
                            <b>{fixture.homeTeamGoals ?? "-"}</b>
                            <i>:</i>
                            <b>{fixture.awayTeamGoals ?? "-"}</b>
                        </span>
                    ) : (
                        <span>VS</span>
                    )}
                </div>
                <div className={`fixture-side ${awayIsFavourite ? "is-favourite" : ""}`}>
                    <span>{fixture.awayTeam.abbreviation ?? fixture.awayTeam.name}</span>
                    <Badge src={fixture.awayTeam.logo} name={fixture.awayTeam.name} />
                </div>
            </div>
        </article>
    );
}

export function TodayGamePanel({
    game,
    details,
    highlightedId,
    title = "Today’s game",
    loading = false,
    showHeading = true,
    onExpand,
    scoreTimeLabel,
    scoreTimeIsLive = false
}: {
    game: TodaysGame;
    details: GameDetails | null;
    highlightedId: string;
    title?: string;
    loading?: boolean;
    showHeading?: boolean;
    onExpand?: () => void;
    scoreTimeLabel?: string;
    scoreTimeIsLive?: boolean;
}) {
    const { fixture } = game;
    const status = details?.status.type ?? game.status;
    const isLive = status === "LIVE";
    const timeLabel =
        status === "FINISHED"
            ? "FT"
            : isLive
              ? (details?.status.clock ?? "LIVE")
              : fixture.date
                ? dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
                : "Time TBC";
    const displayScoreTime = scoreTimeLabel ?? (showHeading ? timeLabel : undefined);
    const displayScoreTimeIsLive = scoreTimeLabel ? scoreTimeIsLive : showHeading && isLive;
    const homeScore = details?.homeTeamGoals ?? fixture.homeTeamGoals;
    const awayScore = details?.awayTeamGoals ?? fixture.awayTeamGoals;
    const showScore = status === "LIVE" || status === "FINISHED" || homeScore !== undefined;
    const statDefinitions: { key: keyof GameStatLine; label: string; suffix?: string }[] = [
        { key: "possession", label: "Possession", suffix: "%" },
        { key: "shots", label: "Shots" },
        { key: "shotsOnTarget", label: "On target" },
        { key: "corners", label: "Corners" },
        { key: "fouls", label: "Fouls" },
        { key: "offsides", label: "Offsides" }
    ];
    const stats = statDefinitions.map(({ key, label, suffix }) => ({
        key,
        label,
        suffix,
        home: details?.statistics.homeTeam[key] ?? 0,
        away: details?.statistics.awayTeam[key] ?? 0
    }));
    const scorers = details?.timeline.filter((event) => event.type === "GOAL") ?? [];
    const scorerRows = (teamId: string) => {
        const scorerMinutes = new Map<string, string[]>();
        scorers
            .filter((scorer) => scorer.teamId === teamId)
            .forEach((scorer) => {
                const scorerName = scorer.players[0]?.name || scorer.description || "Goal";
                const minutes = scorerMinutes.get(scorerName) ?? [];
                if (scorer.minute) minutes.push(scorer.minute);
                scorerMinutes.set(scorerName, minutes);
            });
        return Array.from(scorerMinutes, ([scorerName, minutes]) => (
            <div className="today-team-scorer" key={`${teamId}-${scorerName}`}>
                <span>{scorerName}</span>
                {minutes.length > 0 && <small>{minutes.join(", ")}</small>}
            </div>
        ));
    };

    return (
        <section
            className={`panel today-game-panel ${onExpand ? "expandable-game-panel" : ""}`}
            role={onExpand ? "button" : undefined}
            tabIndex={onExpand ? 0 : undefined}
            aria-label={onExpand ? "Open match details" : undefined}
            onClick={onExpand}
            onKeyDown={
                onExpand
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onExpand();
                          }
                      }
                    : undefined
            }
        >
            {showHeading && (
                <div className="today-game-heading">
                    <h2>{title}</h2>
                </div>
            )}
            <div className={`today-scoreboard ${displayScoreTime ? "has-score-time" : ""}`}>
                <div className="today-game-team home">
                    <div className="today-team-identity">
                        <Badge src={fixture.homeTeam.logo} name={fixture.homeTeam.name} />
                        <span>{fixture.homeTeam.name}</span>
                    </div>
                    <div className="today-team-scorers">{scorerRows(fixture.homeTeam.id)}</div>
                </div>
                <div className={`today-score-center ${displayScoreTime ? "has-score-time" : ""}`}>
                    {displayScoreTime && (
                        <span className={`today-game-time ${displayScoreTimeIsLive ? "is-live" : ""}`}>
                            {displayScoreTimeIsLive && <i className="live-pulse" />}
                            {displayScoreTime}
                        </span>
                    )}
                    {showScore ? (
                        <div className="today-game-score">
                            <strong>{homeScore ?? "–"}</strong>
                            <i>:</i>
                            <strong>{awayScore ?? "–"}</strong>
                        </div>
                    ) : (
                        <div className="today-game-score scheduled">VS</div>
                    )}
                </div>
                <div className="today-game-team away">
                    <div className="today-team-identity">
                        <span>{fixture.awayTeam.name}</span>
                        <Badge src={fixture.awayTeam.logo} name={fixture.awayTeam.name} />
                    </div>
                    <div className="today-team-scorers">{scorerRows(fixture.awayTeam.id)}</div>
                </div>
            </div>
            <div className="today-game-details">
                <section className="game-stats">
                    {loading && !details ? (
                        <p className="game-detail-empty">Loading match details…</p>
                    ) : stats.length ? (
                        stats.map(({ key, label, suffix, home, away }) => {
                            const total = home + away;
                            const homeShare = total > 0 ? (home / total) * 100 : 0;
                            const awayShare = total > 0 ? (away / total) * 100 : 0;
                            return (
                                <div className={`game-stat ${key === "possession" ? "is-possession" : ""}`} key={key}>
                                    <div className="game-stat-labels">
                                        <strong>
                                            {home}
                                            {suffix ?? ""}
                                        </strong>
                                        <span>{label}</span>
                                        <strong>
                                            {away}
                                            {suffix ?? ""}
                                        </strong>
                                    </div>
                                    {key === "possession" ? (
                                        <div className="game-stat-bar">
                                            <span
                                                className={fixture.homeTeam.id === highlightedId ? "is-favourite" : ""}
                                                style={{ width: `${homeShare}%` }}
                                            />
                                            <span
                                                className={fixture.awayTeam.id === highlightedId ? "is-favourite" : ""}
                                                style={{ width: `${awayShare}%` }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="game-stat-team-bars">
                                            <div className="game-stat-team-track is-home">
                                                <span
                                                    className={
                                                        fixture.homeTeam.id === highlightedId ? "is-favourite" : ""
                                                    }
                                                    style={{ width: `${homeShare}%` }}
                                                />
                                            </div>
                                            <div className="game-stat-team-track">
                                                <span
                                                    className={
                                                        fixture.awayTeam.id === highlightedId ? "is-favourite" : ""
                                                    }
                                                    style={{ width: `${awayShare}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <p className="game-detail-empty">
                            {status === "SCHEDULED" ? "Stats available at kickoff." : "Stats unavailable."}
                        </p>
                    )}
                </section>
            </div>
        </section>
    );
}

export function FixturePanel({
    fixtures,
    highlightedId,
    teamId,
    emptyMessage,
    targetEventId,
    returnLabel,
    expandEventId,
    onFixtureSelect
}: {
    fixtures: { fixture: Fixture; live: boolean; previous?: boolean }[];
    highlightedId: string;
    teamId: string;
    emptyMessage: string;
    targetEventId?: string;
    returnLabel: string;
    expandEventId?: string;
    onFixtureSelect: (fixture: Fixture) => void;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const [showReturn, setShowReturn] = useState(false);
    const targetScrollTop = () => {
        const list = listRef.current;
        const target = list?.querySelector<HTMLElement>("[data-return-target='true']");
        if (!list || !target) return 0;
        const targetTop = target.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
        return Math.max(
            0,
            Math.min(list.scrollHeight - list.clientHeight, targetTop + target.offsetHeight / 2 - list.clientHeight / 2)
        );
    };
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list) return;
        list.scrollTop = targetScrollTop();
        setShowReturn(false);
    }, [teamId, targetEventId, fixtures.length]);
    const onScroll = () => {
        const list = listRef.current;
        if (list) setShowReturn(Math.abs(list.scrollTop - targetScrollTop()) > 28);
    };
    const returnToStart = () => listRef.current?.scrollTo({ top: targetScrollTop(), behavior: "smooth" });
    return (
        <section className="panel fixture-panel">
            <div className="panel-heading">
                <h2>Fixtures</h2>
                {showReturn && (
                    <button className="fixture-return" onClick={returnToStart}>
                        {returnLabel}
                    </button>
                )}
            </div>
            <div className="fixture-list" ref={listRef} onScroll={onScroll}>
                {fixtures.length ? (
                    fixtures.map(({ fixture, live, previous }) => (
                        <FixtureRow
                            key={fixture.eventId}
                            fixture={fixture}
                            result={previous || (!live && fixture.homeTeamGoals !== undefined)}
                            live={live}
                            previous={previous}
                            expandable={fixture.eventId === expandEventId}
                            isReturnTarget={fixture.eventId === targetEventId}
                            highlightedId={highlightedId}
                            onOpen={onFixtureSelect}
                        />
                    ))
                ) : (
                    <div className="empty-state compact">{emptyMessage}</div>
                )}
            </div>
        </section>
    );
}
