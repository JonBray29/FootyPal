import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type League = { name: string; slug: string; ref: string; logo: string };
type TeamOption = { id: string; name: string; abbreviation: string | null; logos: { href: string; rel?: string[] }[] };
type FavoriteTeam = { id: string; name: string; leagueSlug: string; logo: string | null };
type TeamSimple = { id: string; name: string; abbreviation: string | null; logo: string | null };
type Fixture = { eventId: string; date: string | null; homeTeam: TeamSimple; awayTeam: TeamSimple; homeTeamGoals?: number; awayTeamGoals?: number };
type GameStatLine = { possession: number | null; shots: number | null; shotsOnTarget: number | null; corners: number | null; fouls: number | null; offsides: number | null; saves: number | null };
type GameDetails = {
  status: { type: string; clock: string | null };
  homeTeamGoals: number | null;
  awayTeamGoals: number | null;
  statistics: { homeTeam: GameStatLine; awayTeam: GameStatLine };
  timeline: { id: string | null; type: string; minute: string | null; teamId: string | null; players: { name: string | null }[]; description: string | null }[];
};
type TodaysGame = { fixture: Fixture; status: "LIVE" | "SCHEDULED" | "FINISHED" };
type Standing = { position: number; positionType: string; teamName: string; gamesPlayed: number; won: number; drew: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number };
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, "0"), label: `${String(hour).padStart(2, "0")}:00` }));
const savedHour = (key: string, fallback: string) => {
  const value = getSaved(key, fallback);
  return HOUR_OPTIONS.some((option) => option.value === value) ? value : fallback;
};
type Team = {
  id: string; name: string; shortName: string | null; abbreviation: string | null; nickname: string | null;
  logos: { href: string; rel?: string[] }[]; colors: { primary: string | null; secondary: string | null };
  form: string | null; venue: { name: string | null; city: string | null } | null;
  standings: Standing[]; liveGame: Fixture | null; previousMatches: Fixture[]; upcomingFixtures: Fixture[];
};

declare global {
  interface Window {
    FootyPalDevice?: {
      getBrightness: () => number;
      setBrightness: (percent: number) => void;
      getVolume: () => number;
      setVolume: (percent: number) => void;
      getScreenSleepSeconds: () => number;
      setScreenSleepSeconds: (seconds: number) => boolean;
      setScreenBlanked: (blanked: boolean) => void;
    };
  }
}

const API = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");
const getSaved = (key: string, fallback: string) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const getSavedFavoriteTeams = (): FavoriteTeam[] => {
  try {
    const value: unknown = JSON.parse(getSaved("footypal.favorites", "[]"));
    return Array.isArray(value) ? value.filter((item): item is FavoriteTeam => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.leagueSlug === "string" && (typeof item.logo === "string" || item.logo === null)).slice(0, 4) : [];
  } catch { return []; }
};
const api = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${API}${path}`, { signal, cache: "no-store" });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error ?? message; } catch { /* use status */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

function dateLabel(value: string | null, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  if (!value) return "Date TBC";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date TBC" : new Intl.DateTimeFormat(undefined, options).format(date);
}

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

function Badge({ src, name, className = "" }: { src?: string | null; name: string; className?: string }) {
  return src ? <img className={`team-badge ${className}`} src={src} alt={`${name} crest`} /> :
    <span className={`team-badge badge-fallback ${className}`} aria-label={name}>{name.slice(0, 2).toUpperCase()}</span>;
}

function SettingsDropdown({ id, value, options, open, onToggle, onSelect }: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value);
  return <div className="team-picker-field sleep-picker-field">
    <button id={id} type="button" className={`team-picker-trigger ${open ? "open" : ""}`} role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-haspopup="listbox" onClick={onToggle} onKeyDown={(event) => { if (event.key === "Escape") onSelect(value); }}>
      <span>{selected?.label ?? value}</span><span className="chevron select-chevron" aria-hidden="true" />
    </button>
    {open && <div id={`${id}-options`} className="team-options-popover"><div className="team-option-list" role="listbox">{options.map((option) => <button type="button" role="option" aria-selected={value === option.value} className={`team-option ${value === option.value ? "chosen" : ""}`} key={option.value} onClick={() => onSelect(option.value)}><span>{option.label}</span>{value === option.value && <b>✓</b>}</button>)}</div></div>}
  </div>;
}

type UiIconName = "settings" | "close" | "sun-low" | "sun-high" | "moon" | "volume-low" | "volume-high";
function UiIcon({ name, size = 20 }: { name: UiIconName; size?: number }) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === "settings" && <><path d="M9.7 3h4.6l.6 2.2a7.8 7.8 0 0 1 1.6.9l2.2-.7 2.3 4-1.6 1.6a7.4 7.4 0 0 1 0 1.9l1.6 1.6-2.3 4-2.2-.7a7.8 7.8 0 0 1-1.6.9l-.6 2.2H9.7l-.6-2.2a7.8 7.8 0 0 1-1.6-.9l-2.2.7-2.3-4 1.6-1.6a7.4 7.4 0 0 1 0-1.9L3 9.4l2.3-4 2.2.7a7.8 7.8 0 0 1 1.6-.9L9.7 3Z" /><circle cx="12" cy="12" r="3" /></>}
    {name === "close" && <path d="m18 6-12 12M6 6l12 12" />}
    {(name === "sun-low" || name === "sun-high") && <><circle cx="12" cy="12" r={name === "sun-low" ? 3.5 : 4.5} /><path d={name === "sun-low" ? "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" : "M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42"} /></>}
    {name === "moon" && <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />}
    {(name === "volume-low" || name === "volume-high") && <><path d="M4 10v4h3l5 4V6l-5 4H4Z" />{name === "volume-low" ? <path d="M15 9.5a4 4 0 0 1 0 5" /> : <><path d="M15 9a4.5 4.5 0 0 1 0 6" /><path d="M18 6a9 9 0 0 1 0 12" /></>}</>}
  </svg>;
}

function FixtureRow({ fixture, result = false, live = false, previous = false, expandable = false, isReturnTarget = false, highlightedId, onOpen }: { fixture: Fixture; result?: boolean; live?: boolean; previous?: boolean; expandable?: boolean; isReturnTarget?: boolean; highlightedId: string; onOpen?: (fixture: Fixture) => void }) {
  const homeIsFavourite = fixture.homeTeam.id === highlightedId;
  const awayIsFavourite = fixture.awayTeam.id === highlightedId;
  const showScore = result || live;
  const canOpen = (previous || expandable) && !!onOpen;
  return <article className={`fixture-row ${live ? "live-fixture" : ""} ${canOpen ? "clickable-fixture" : ""}`} role={canOpen ? "button" : undefined} tabIndex={canOpen ? 0 : undefined} aria-label={canOpen ? `View ${fixture.homeTeam.name} versus ${fixture.awayTeam.name} match details` : undefined} onClick={canOpen ? () => onOpen?.(fixture) : undefined} onKeyDown={canOpen ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen?.(fixture); } } : undefined} data-return-target={isReturnTarget ? "true" : undefined}>
    <div className="fixture-date">{live ? <span className="fixture-live-label"><i className="live-pulse" />LIVE</span> : <span>{dateLabel(fixture.date)}</span>}{live ? <span>{fixture.date ? dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "IN PLAY"}</span> : fixture.date && <span>{dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>}</div>
    <div className="fixture-match">
      <div className={`fixture-side ${homeIsFavourite ? "is-favourite" : ""}`}>
        <Badge src={fixture.homeTeam.logo} name={fixture.homeTeam.name} />
        <span>{fixture.homeTeam.abbreviation ?? fixture.homeTeam.name}</span>
      </div>
      <div className={`fixture-divider ${live ? "is-live" : ""}`}>
        {showScore ? <span className="fixture-score-line"><b>{fixture.homeTeamGoals ?? "-"}</b><i>:</i><b>{fixture.awayTeamGoals ?? "-"}</b></span> : <span>VS</span>}
      </div>
      <div className={`fixture-side ${awayIsFavourite ? "is-favourite" : ""}`}>
        <span>{fixture.awayTeam.abbreviation ?? fixture.awayTeam.name}</span>
        <Badge src={fixture.awayTeam.logo} name={fixture.awayTeam.name} />
      </div>
    </div>
  </article>;
}

function TodayGamePanel({ game, details, highlightedId, title = "Today’s game", loading = false, showHeading = true, onExpand, scoreTimeLabel, scoreTimeIsLive = false }: { game: TodaysGame; details: GameDetails | null; highlightedId: string; title?: string; loading?: boolean; showHeading?: boolean; onExpand?: () => void; scoreTimeLabel?: string; scoreTimeIsLive?: boolean }) {
  const { fixture } = game;
  const status = details?.status.type ?? game.status;
  const isLive = status === "LIVE";
  const timeLabel = status === "FINISHED"
    ? "FT"
    : isLive
      ? details?.status.clock ?? "LIVE"
      : fixture.date ? dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "Time TBC";
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
    { key: "offsides", label: "Offsides" },
  ];
  const stats = statDefinitions.map(({ key, label, suffix }) => ({
    key,
    label,
    suffix,
    home: details?.statistics.homeTeam[key] ?? 0,
    away: details?.statistics.awayTeam[key] ?? 0,
  }));
  const scorers = details?.timeline.filter((event) => event.type === "GOAL") ?? [];
  const scorerRows = (teamId: string) => {
    const scorerMinutes = new Map<string, string[]>();
    scorers.filter((scorer) => scorer.teamId === teamId).forEach((scorer) => {
      const scorerName = scorer.players[0]?.name || scorer.description || "Goal";
      const minutes = scorerMinutes.get(scorerName) ?? [];
      if (scorer.minute) minutes.push(scorer.minute);
      scorerMinutes.set(scorerName, minutes);
    });
    return Array.from(scorerMinutes, ([scorerName, minutes]) => <div className="today-team-scorer" key={`${teamId}-${scorerName}`}><span>{scorerName}</span>{minutes.length > 0 && <small>{minutes.join(", ")}</small>}</div>);
  };

  return <section className={`panel today-game-panel ${onExpand ? "expandable-game-panel" : ""}`} role={onExpand ? "button" : undefined} tabIndex={onExpand ? 0 : undefined} aria-label={onExpand ? "Open match details" : undefined} onClick={onExpand} onKeyDown={onExpand ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onExpand(); } } : undefined}>
    {showHeading && <div className="today-game-heading"><h2>{title}</h2></div>}
    <div className={`today-scoreboard ${displayScoreTime ? "has-score-time" : ""}`}>
      <div className="today-game-team home"><div className="today-team-identity"><Badge src={fixture.homeTeam.logo} name={fixture.homeTeam.name} /><span>{fixture.homeTeam.name}</span></div><div className="today-team-scorers">{scorerRows(fixture.homeTeam.id)}</div></div>
      <div className={`today-score-center ${displayScoreTime ? "has-score-time" : ""}`}>{displayScoreTime && <span className={`today-game-time ${displayScoreTimeIsLive ? "is-live" : ""}`}>{displayScoreTimeIsLive && <i className="live-pulse" />}{displayScoreTime}</span>}{showScore ? <div className="today-game-score"><strong>{homeScore ?? "–"}</strong><i>:</i><strong>{awayScore ?? "–"}</strong></div> : <div className="today-game-score scheduled">VS</div>}</div>
      <div className="today-game-team away"><div className="today-team-identity"><span>{fixture.awayTeam.name}</span><Badge src={fixture.awayTeam.logo} name={fixture.awayTeam.name} /></div><div className="today-team-scorers">{scorerRows(fixture.awayTeam.id)}</div></div>
    </div>
    <div className="today-game-details">
      <section className="game-stats">
        {loading && !details ? <p className="game-detail-empty">Loading match details…</p> : stats.length ? stats.map(({ key, label, suffix, home, away }) => {
          const total = home + away;
          const homeShare = total > 0 ? (home / total) * 100 : 0;
          const awayShare = total > 0 ? (away / total) * 100 : 0;
          return <div className={`game-stat ${key === "possession" ? "is-possession" : ""}`} key={key}>
            <div className="game-stat-labels"><strong>{home}{suffix ?? ""}</strong><span>{label}</span><strong>{away}{suffix ?? ""}</strong></div>
            {key === "possession" ? <div className="game-stat-bar"><span className={fixture.homeTeam.id === highlightedId ? "is-favourite" : ""} style={{ width: `${homeShare}%` }} /><span className={fixture.awayTeam.id === highlightedId ? "is-favourite" : ""} style={{ width: `${awayShare}%` }} /></div> : <div className="game-stat-team-bars">
              <div className="game-stat-team-track is-home"><span className={fixture.homeTeam.id === highlightedId ? "is-favourite" : ""} style={{ width: `${homeShare}%` }} /></div>
              <div className="game-stat-team-track"><span className={fixture.awayTeam.id === highlightedId ? "is-favourite" : ""} style={{ width: `${awayShare}%` }} /></div>
            </div>}
          </div>;
        }) : <p className="game-detail-empty">{status === "SCHEDULED" ? "Stats available at kickoff." : "Stats unavailable."}</p>}
      </section>
    </div>
  </section>;
}
function FixturePanel({ fixtures, highlightedId, teamId, emptyMessage, targetEventId, returnLabel, expandEventId, onFixtureSelect }: {
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
    return Math.max(0, Math.min(list.scrollHeight - list.clientHeight, targetTop + target.offsetHeight / 2 - list.clientHeight / 2));
  };

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = targetScrollTop();
    setShowReturn(false);
  }, [teamId, targetEventId, fixtures.length]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    setShowReturn(Math.abs(list.scrollTop - targetScrollTop()) > 28);
  };

  const returnToStart = () => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: targetScrollTop(), behavior: "smooth" });
  };

  return <section className="panel fixture-panel">
    <div className="panel-heading">
      <h2>Fixtures</h2>
      {showReturn && <button className="fixture-return" onClick={returnToStart}>{returnLabel}</button>}
    </div>
    <div className="fixture-list" ref={listRef} onScroll={onScroll}>
      {fixtures.length ? fixtures.map(({ fixture, live, previous }) => <FixtureRow key={fixture.eventId} fixture={fixture} result={previous || (!live && fixture.homeTeamGoals !== undefined)} live={live} previous={previous} expandable={fixture.eventId === expandEventId} isReturnTarget={fixture.eventId === targetEventId} highlightedId={highlightedId} onOpen={onFixtureSelect} />) : <div className="empty-state compact">{emptyMessage}</div>}
    </div>
  </section>;
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
  const [nightSleepEnabled, setNightSleepEnabled] = useState(() => getSaved("footypal.sleep.schedule.enabled", "false") === "true");
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
  const canControlSleep = typeof window.FootyPalDevice?.getScreenSleepSeconds === "function" && typeof window.FootyPalDevice?.setScreenSleepSeconds === "function" && typeof window.FootyPalDevice?.setScreenBlanked === "function";

  useEffect(() => {
    const controller = new AbortController();
    api<League[]>("/api/leagues", controller.signal).then((items) => {
      setLeagues(items);
      setLeagueSlug((current) => current || items[0]?.slug || "");
      setDraftLeagueSlug((current) => current || items[0]?.slug || "");
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load leagues");
    }).finally(() => { if (!controller.signal.aborted) setLoadingLeagues(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!draftLeagueSlug) return;
    const controller = new AbortController();
    setLoadingTeams(true);
    api<TeamOption[]>(`/api/leagues/${encodeURIComponent(draftLeagueSlug)}/teams`, controller.signal).then(setTeams)
      .catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load teams"); })
      .finally(() => { if (!controller.signal.aborted) setLoadingTeams(false); });
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
    } finally { if (!signal?.aborted && showLoading) setLoadingTeam(false); }
  }, []);

  useEffect(() => {
    if (!teamId) return;
    const controller = new AbortController();
    let active = true;
    const refresh = () => { if (active) void loadTeam(teamId, controller.signal); };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
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
    try { localStorage.setItem("footypal.favorites", JSON.stringify(favoriteTeams)); } catch { /* Keep favorites for this session if storage is unavailable. */ }
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
      const inNightWindow = nightSleepEnabled && isInDailyHourWindow(new Date(), Number(nightSleepStart), Number(nightSleepEnd));
      const timeoutSeconds = inNightWindow ? 30 : screenSleepSeconds;
      const shouldBlank = timeoutSeconds > 0 && Date.now() - lastScreenActivityRef.current >= timeoutSeconds * 1000;
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
  const accentInk = (accentRgb[0] * 299 + accentRgb[1] * 587 + accentRgb[2] * 114) / 1000 > 145 ? "#171a15" : "#ffffff";
  const canControlBrightness = typeof window.FootyPalDevice?.getBrightness === "function" && typeof window.FootyPalDevice?.setBrightness === "function";
  const canControlVolume = typeof window.FootyPalDevice?.getVolume === "function" && typeof window.FootyPalDevice?.setVolume === "function";
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
    setFavoriteTeams((items) => items.length >= 4 || items.some((item) => item.id === team.id && item.leagueSlug === leagueSlug)
      ? items
      : [...items, { id: team.id, name: team.name, leagueSlug, logo: logo ?? null }]);
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
        .catch(() => { /* Keep the selected game visible if details are temporarily unavailable. */ });
    };
    refreshGame();
    const interval = selectedGame.status === "LIVE" ? window.setInterval(refreshGame, 30_000) : undefined;
    return () => { controller.abort(); if (interval) window.clearInterval(interval); };
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
          if (!controller.signal.aborted) setMatchDetailsError(err instanceof Error ? err.message : "Could not load match details");
        })
        .finally(() => { if (!controller.signal.aborted) setLoadingMatchDetails(false); });
    };
    refreshMatch();
    const shouldPoll = selectedMatch.status === "LIVE" || (selectedMatch.status === "SCHEDULED" && isToday(selectedMatch.fixture.date));
    if (shouldPoll) interval = window.setInterval(refreshMatch, 30_000);
    return () => { controller.abort(); if (interval) window.clearInterval(interval); };
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
    ...upcomingFixtures.map((fixture) => ({ fixture, live: false, previous: false })),
  ];
  const targetFixture = live ?? upcomingFixtures[0] ?? previousFixtures[previousFixtures.length - 1];
  const returnLabel = live ? "Return to live game" : upcomingFixtures.length ? "Return to next game" : "Return to latest fixture";
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
      ? gameDetailsEventId === selectedMatch.fixture.eventId ? gameDetails : null
      : matchDetailsEventId === selectedMatch.fixture.eventId ? matchDetails : null
    : null;
  const modalMatchLoading = selectedMatch
    ? modalUsesTodayGameDetails
      ? gameDetailsEventId !== selectedMatch.fixture.eventId
      : loadingMatchDetails || (matchDetailsEventId !== selectedMatch.fixture.eventId && !matchDetailsError)
    : false;
  const selectedMatchStatus = selectedMatch
    ? modalMatchDetails?.status.type ?? selectedMatch.status
    : undefined;
  const selectedMatchDate = selectedMatch?.fixture.date ?? null;
  const selectedMatchIsToday = isToday(selectedMatchDate);
  const selectedMatchTitle = selectedMatchIsToday ? "Today’s game" : "Previous result";
  const selectedMatchTime = selectedMatchIsToday
    ? selectedMatchStatus === "FINISHED"
      ? "FT"
      : selectedMatchStatus === "LIVE"
        ? modalMatchDetails?.status.clock ?? "LIVE"
        : selectedMatchDate ? dateLabel(selectedMatchDate, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "Time TBC"
    : dateLabel(selectedMatchDate, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return <main className={`app-shell ${mode}`} style={{
    "--team-accent": accent,
    "--team-accent-ink": accentInk,
    "--accent-soft": `rgba(${accentRgbCss}, 0.13)`,
    "--team-accent-glow": `rgba(${accentRgbCss}, 0.12)`,
    "--team-accent-border": `rgba(${accentRgbCss}, 0.42)`,
  } as React.CSSProperties}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">F</span><span>FOOTYPAL</span></div>
      <div className="topbar-context">
        {team ? <button className="topbar-club" onClick={() => { setDraftLeagueSlug(leagueSlug); setDraftTeamId(teamId); setTeamPicker(true); }}>
          <Badge src={logo} name={team.name} className="topbar-crest" />
          <span className="topbar-club-copy"><strong>{team.name}</strong><small>{leagueName}</small></span>
        </button> : <span>{leagueName}</span>}
      </div>
      <div className="topbar-actions">
        {visibleFavoriteTeams.map((favoriteTeam) => <button type="button" className="favorite-chip" key={`${favoriteTeam.leagueSlug}-${favoriteTeam.id}`} aria-label={`Switch to ${favoriteTeam.name}`} title={favoriteTeam.name} onClick={() => selectFavoriteTeam(favoriteTeam)}>
          <Badge src={favoriteTeam.logo} name={favoriteTeam.name} />
        </button>)}
        <button type="button" className={`favorite-star ${currentTeamIsFavorite ? "is-favorite" : ""}`} aria-label={!team ? "Choose a team before adding favourites" : currentTeamIsFavorite ? `Remove ${team.name} from favourites` : favoriteTeams.length >= 4 ? "Four favourite teams are already saved" : `Add ${team.name} to favourites`} aria-pressed={currentTeamIsFavorite} disabled={!team || (!currentTeamIsFavorite && favoriteTeams.length >= 4)} title={!team ? "Choose a team before adding favourites" : currentTeamIsFavorite ? "Remove from favourites" : favoriteTeams.length >= 4 ? "Remove a favourite before adding another" : "Add to favourites"} onClick={toggleCurrentFavorite}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" /></svg>
        </button>
        <button className="icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><UiIcon name="settings" size={23} /></button>
      </div>
    </header>

    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => teamId ? void loadTeam(teamId) : setTeamPicker(true)}>Try again</button><button className="dismiss" onClick={() => setError("")} aria-label="Dismiss">×</button></div>}

    {!team && !loadingTeam && <section className="welcome-panel">
      <div className="welcome-kicker">YOUR MATCHDAY, AT A GLANCE</div>
      <div className="welcome-ball">◉</div>
      <h1>Make it your club.</h1>
      <p>Choose your side and we’ll bring the table, fixtures and live updates together in one place.</p>
      <button className="primary-button" onClick={() => setTeamPicker(true)}>Choose your team <span>→</span></button>
    </section>}

    {loadingTeam && <div className="loading-screen"><span className="loader" />Getting the latest from {favorite?.name ?? "your team"}…</div>}

    {team && <>
      <section className="dashboard-grid">
        <div className="panel standings-panel">
          <div className="panel-heading"><div><h2>League table</h2></div><div className="standings-form"><span className="table-season">FORM</span><div className="form-pills">{(team.form ?? "").slice(-5).split("").map((value, index) => <span key={`${value}${index}`} className={`form-pill form-${value.toLowerCase()}`}>{value}</span>)}{!team.form && <span className="summary-note">—</span>}</div></div></div>
          {team.standings.length ? <div className="table-wrap" ref={standingsWrapRef}><table><thead><tr><th className="pos-col">POS</th><th className="club-col">CLUB</th><th className="stat-col">PL</th><th className="stat-col">W</th><th className="stat-col">D</th><th className="stat-col">L</th><th className="wide-stat">GD</th><th className="pts-col">PTS</th></tr></thead><tbody>{team.standings.map((row, index) => {
            const selected = row.teamName.toLowerCase() === team.name.toLowerCase();
            const startsNewPositionType = index > 0 && row.positionType !== team.standings[index - 1].positionType;
            const endsPositionType = index < team.standings.length - 1 && row.positionType !== team.standings[index + 1].positionType;
            const rowTeam = teams.find((item) => item.name.toLowerCase() === row.teamName.toLowerCase());
            const crest = rowTeam?.logos?.find((item) => item.rel?.includes("default"))?.href ?? rowTeam?.logos?.[0]?.href;
            return <Fragment key={`${row.position}-${row.teamName}`}>{startsNewPositionType && <tr className="position-separator" aria-hidden="true"><td colSpan={8}><span /></td></tr>}<tr className={`${selected ? "selected-row" : ""} ${endsPositionType ? "position-group-end" : ""}`} data-selected-team={selected ? "true" : undefined}><td className="position-cell"><span>{String(row.position).padStart(2, "0")}</span></td><td className="club-cell"><span className="club-info">{crest ? <img src={crest} alt="" /> : <span className="mini-crest">{row.teamName.slice(0, 1)}</span>}<strong>{row.teamName}</strong></span></td><td className="stat-col">{row.gamesPlayed}</td><td className="stat-col">{row.won}</td><td className="stat-col">{row.drew}</td><td className="stat-col">{row.lost}</td><td className="wide-stat">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td className="points-cell">{row.points}</td></tr></Fragment>;
          })}</tbody></table></div> : <div className="empty-state">Standings aren’t available right now.</div>}
        </div>

        <div className="fixtures-column">

          {todayGame && <TodayGamePanel game={todayGame} details={gameDetailsEventId === todayGame.fixture.eventId ? gameDetails : null} highlightedId={team.id} onExpand={() => openMatchDetails(todayGame)} />}
          <FixturePanel fixtures={timelineFixtures} highlightedId={team.id} teamId={team.id} emptyMessage="No fixtures to show." targetEventId={targetFixture?.eventId} returnLabel={returnLabel} expandEventId={todayGame?.fixture.eventId} onFixtureSelect={openFixtureDetails} />
        </div>
      </section>
    </>}

    {teamPicker && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && team) setTeamPicker(false); }}><section className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
      <div className="modal-topline"><div className="brand-mark small-mark">F</div>{team && <button className="modal-close" onClick={() => setTeamPicker(false)} aria-label="Close"><UiIcon name="close" size={20} /></button>}</div>
      <div className="eyebrow">PERSONALISE YOUR DASHBOARD</div><h2 id="team-modal-title">Pick your team.</h2><p className="modal-copy">We’ll put your club in the spotlight, with its colours across the whole matchday.</p>
      <label className="field-label" htmlFor="league-select">YOUR LEAGUE</label>
      <div className="team-picker-field league-picker-field">
        <button id="league-select" type="button" className={`team-picker-trigger ${leagueListOpen ? "open" : ""}`} role="combobox" aria-expanded={leagueListOpen} aria-controls="league-options" aria-haspopup="listbox" disabled={loadingLeagues || !leagues.length} onClick={() => { setLeagueListOpen((open) => !open); setTeamListOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setLeagueListOpen(false); }}>
          {draftLeague ? <><img className="team-badge picker-badge league-picker-badge" src={draftLeague.logo} alt="" /><span className="selected-team-name">{draftLeague.name}</span></> : <span className="picker-placeholder">{loadingLeagues ? "Loading leagues…" : "Choose a league"}</span>}
          <span className="chevron select-chevron" aria-hidden="true" />
        </button>
        {leagueListOpen && <div className="team-options-popover league-options-popover" id="league-options"><div className="team-option-list" role="listbox" aria-label="Leagues">
          {leagues.map((league) => <button type="button" role="option" aria-selected={draftLeagueSlug === league.slug} className={`team-option ${draftLeagueSlug === league.slug ? "chosen" : ""}`} key={league.slug} onClick={() => { if (draftLeagueSlug !== league.slug) { setDraftLeagueSlug(league.slug); setDraftTeamId(""); } setLeagueListOpen(false); setTeamListOpen(false); }}>
            <img className="team-badge picker-badge league-picker-badge" src={league.logo} alt="" /><span>{league.name}</span>{draftLeagueSlug === league.slug && <b>✓</b>}
          </button>)}
        </div></div>}
      </div>
      <label className="field-label" htmlFor="team-select">YOUR CLUB</label>
      <div className="team-picker-field">
        <button id="team-select" type="button" className={`team-picker-trigger ${teamListOpen ? "open" : ""}`} role="combobox" aria-expanded={teamListOpen} aria-controls="team-options" aria-haspopup="listbox" disabled={!draftLeagueSlug || loadingTeams} onClick={() => { setTeamListOpen((open) => !open); }} onKeyDown={(event) => { if (event.key === "Escape") setTeamListOpen(false); }}>
          {draftTeam ? <><Badge src={draftTeam.logos.find((item) => item.rel?.includes("default"))?.href ?? draftTeam.logos[0]?.href} name={draftTeam.name} className="picker-badge" /><span className="selected-team-name">{draftTeam.name}</span></> : <span className="picker-placeholder">{loadingTeams ? "Loading clubs…" : "Choose your club"}</span>}
          <span className="chevron select-chevron" aria-hidden="true" />
        </button>
        {teamListOpen && <div className="team-options-popover" id="team-options">
          {loadingTeams ? <div className="team-options-message">Loading clubs…</div> : visibleTeams.length ? <div className="team-option-list" role="listbox" aria-label="Teams">
            {visibleTeams.map((item) => <button type="button" role="option" aria-selected={draftTeamId === item.id} className={`team-option ${draftTeamId === item.id ? "chosen" : ""}`} key={item.id} onClick={() => { setDraftTeamId(item.id); setTeamListOpen(false); }}>
              <Badge src={item.logos.find((entry) => entry.rel?.includes("default"))?.href ?? item.logos[0]?.href} name={item.name} className="picker-badge" /><span>{item.name}</span>{draftTeamId === item.id && <b>✓</b>}
            </button>)}
          </div> : <div className="team-options-message">No clubs match that search.</div>}
        </div>}
      </div>
      <button className="primary-button modal-submit" disabled={!draftTeamId} onClick={onSelectTeam}>Make it my team <span className="button-arrow" aria-hidden="true" /></button>
      <div className="modal-footnote"><span>✳</span> You can change your team any time.</div>
    </section></div>}

    {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Display settings">
      <div className="modal-topline"><div className="eyebrow">DISPLAY SETTINGS</div><button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close"><UiIcon name="close" size={20} /></button></div>
      <div className="setting-group"><div className="setting-heading"><span>Appearance</span><span className="setting-value">{mode === "dark" ? "Dark" : "Light"}</span></div><div className="mode-switch"><button className={mode === "light" ? "active" : ""} onClick={() => setMode("light")}><UiIcon name="sun-high" size={16} /> Light</button><button className={mode === "dark" ? "active" : ""} onClick={() => setMode("dark")}><UiIcon name="moon" size={16} /> Dark</button></div></div>
      <div className="setting-group"><div className="setting-heading"><label htmlFor="brightness">Screen brightness</label><span className="setting-value">{brightness}%</span></div><div className="range-row"><UiIcon name="sun-low" size={16} /><input id="brightness" type="range" min="10" max="100" value={brightness} disabled={!canControlBrightness} style={{ "--range-progress": `${((brightness - 10) / 90) * 100}%` } as React.CSSProperties} onChange={(event) => { const value = Number(event.target.value); setBrightness(value); if (canControlBrightness) window.FootyPalDevice?.setBrightness(value); }} /><UiIcon name="sun-high" size={20} /></div></div>
      <div className="setting-group"><div className="setting-heading"><label htmlFor="volume">Media volume</label><span className="setting-value">{volume}%</span></div><div className="range-row"><UiIcon name="volume-low" size={18} /><input id="volume" type="range" min="0" max="100" value={volume} disabled={!canControlVolume} style={{ "--range-progress": `${volume}%` } as React.CSSProperties} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (canControlVolume) window.FootyPalDevice?.setVolume(value); }} /><UiIcon name="volume-high" size={20} /></div></div>
      <div className="setting-group"><div className="setting-heading"><span>Screen sleep</span><span className="setting-value">{screenSleepSeconds === 0 ? "Never" : screenSleepSeconds < 60 ? `${screenSleepSeconds} sec` : `${screenSleepSeconds / 60} min`}</span></div><div className="team-picker-field sleep-picker-field">
        <button id="screen-sleep" type="button" className={`team-picker-trigger ${screenSleepListOpen ? "open" : ""}`} role="combobox" aria-expanded={screenSleepListOpen} aria-controls="screen-sleep-options" aria-haspopup="listbox" disabled={!canControlSleep} onClick={() => { setNightHourListOpen(null); setScreenSleepListOpen((open) => !open); }}>
          <span>{screenSleepSeconds === 0 ? "Never" : screenSleepSeconds < 60 ? `After ${screenSleepSeconds} seconds` : `After ${screenSleepSeconds / 60} minute${screenSleepSeconds === 60 ? "" : "s"}`}</span><span className="chevron select-chevron" aria-hidden="true" />
        </button>
        {screenSleepListOpen && <div id="screen-sleep-options" className="team-options-popover"><div className="team-option-list" role="listbox">{[{ value: 0, label: "Never" }, { value: 30, label: "After 30 seconds" }, { value: 60, label: "After 1 minute" }, { value: 120, label: "After 2 minutes" }, { value: 300, label: "After 5 minutes" }, { value: 600, label: "After 10 minutes" }, { value: 900, label: "After 15 minutes" }].map((option) => <button type="button" role="option" aria-selected={screenSleepSeconds === option.value} className={`team-option ${screenSleepSeconds === option.value ? "chosen" : ""}`} key={option.value} onClick={() => { setScreenSleepSeconds(option.value); setScreenSleepListOpen(false); setNightHourListOpen(null); window.FootyPalDevice?.setScreenSleepSeconds(option.value); }}><span>{option.label}</span>{screenSleepSeconds === option.value && <b>✓</b>}</button>)}</div></div>}
      </div></div>
      <div className="setting-group"><div className="setting-heading"><span>Night sleep schedule</span><button type="button" className={`sleep-schedule-toggle ${nightSleepEnabled ? "active" : ""}`} aria-pressed={nightSleepEnabled} onClick={() => { setNightHourListOpen(null); setScreenSleepListOpen(false); setNightSleepEnabled((enabled) => !enabled); }}>{nightSleepEnabled ? "On" : "Off"}</button></div>
        {nightSleepEnabled && <><div className="sleep-hour-options"><div className="sleep-hour-field"><span>From</span><SettingsDropdown id="night-sleep-start" value={nightSleepStart} options={HOUR_OPTIONS} open={nightHourListOpen === "start"} onToggle={() => { setScreenSleepListOpen(false); setNightHourListOpen((open) => open === "start" ? null : "start"); }} onSelect={(value) => { setNightSleepStart(value); setNightHourListOpen(null); }} /></div><div className="sleep-hour-field"><span>Until</span><SettingsDropdown id="night-sleep-end" value={nightSleepEnd} options={HOUR_OPTIONS} open={nightHourListOpen === "end"} onToggle={() => { setScreenSleepListOpen(false); setNightHourListOpen((open) => open === "end" ? null : "end"); }} onSelect={(value) => { setNightSleepEnd(value); setNightHourListOpen(null); }} /></div></div><p className="settings-device-note">During this daily window, the screen blanks after 30 seconds without a tap, even if Screen sleep is set to Never.</p></>}
      </div>
      <p className="settings-device-note">{canControlBrightness && canControlVolume ? "Brightness and volume control this tablet." : "Device controls are unavailable in this kiosk build."}</p>
      <p className="settings-device-note">{!canControlSleep ? "Screen sleep is available in the Android frame app." : "After inactivity, the display goes black. Tap anywhere to wake it."}</p>
    </section></div>}
    {selectedMatch && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMatch(null); }}><section className="modal game-details-modal" role="dialog" aria-modal="true" aria-label={selectedMatchTitle}>
      <div className="modal-topline"><div className="eyebrow">{selectedMatchTitle}</div><button className="modal-close" onClick={() => setSelectedMatch(null)} aria-label="Close"><UiIcon name="close" size={20} /></button></div>
      {!modalUsesTodayGameDetails && matchDetailsError && <div className="error-banner" role="alert"><span>{matchDetailsError}</span></div>}
      <TodayGamePanel game={selectedMatch} details={modalMatchDetails} highlightedId={team?.id ?? ""} loading={modalMatchLoading} showHeading={false} scoreTimeLabel={selectedMatchTime} scoreTimeIsLive={selectedMatchIsToday && selectedMatchStatus === "LIVE"} />
    </section></div>}
    {screenBlanked && <button type="button" className="screen-sleep-overlay" aria-label="Tap to wake display" />}
  </main>;
}
