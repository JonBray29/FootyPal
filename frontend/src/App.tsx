import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type League = { name: string; slug: string; ref: string; logo: string };
type TeamOption = { id: string; name: string; abbreviation: string | null; logos: { href: string; rel?: string[] }[] };
type TeamSimple = { id: string; name: string; abbreviation: string | null; logo: string | null };
type Fixture = { eventId: string; date: string | null; homeTeam: TeamSimple; awayTeam: TeamSimple; homeTeamGoals?: number; awayTeamGoals?: number };
type Standing = { position: number; positionType: string; teamName: string; gamesPlayed: number; won: number; drew: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number };
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
    };
  }
}

const API = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");
const getSaved = (key: string, fallback: string) => {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};
const api = async <T,>(path: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(`${API}${path}`, { signal });
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

function FixtureRow({ fixture, result = false, live = false, liveClock, isReturnTarget = false, highlightedId }: { fixture: Fixture; result?: boolean; live?: boolean; liveClock?: string | null; isReturnTarget?: boolean; highlightedId: string }) {
  const homeIsFavourite = fixture.homeTeam.id === highlightedId;
  const awayIsFavourite = fixture.awayTeam.id === highlightedId;
  return <article className={`fixture-row ${live ? "live-fixture" : ""}`} data-return-target={isReturnTarget ? "true" : undefined}>
    <div className="fixture-date">{live ? <span className="fixture-live-label"><i className="live-pulse" />LIVE</span> : <span>{dateLabel(fixture.date)}</span>}{live ? <span>{fixture.date ? dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "IN PLAY"}</span> : fixture.date && <span>{dateLabel(fixture.date, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</span>}</div>
    <div className="fixture-match">
      <div className={`fixture-side ${homeIsFavourite ? "is-favourite" : ""}`}>
        <Badge src={fixture.homeTeam.logo} name={fixture.homeTeam.name} />
        <span>{fixture.homeTeam.abbreviation ?? fixture.homeTeam.name}</span>
        {(result || live) && <b>{fixture.homeTeamGoals ?? "–"}</b>}
      </div>
      <div className={`fixture-divider ${live ? "has-live-clock" : ""}`}>{live && <span className="fixture-minute">{liveClock ?? ""}</span>}<span>{result || live ? ":" : "VS"}</span></div>
      <div className={`fixture-side ${awayIsFavourite ? "is-favourite" : ""}`}>
        {(result || live) && <b>{fixture.awayTeamGoals ?? "–"}</b>}
        <Badge src={fixture.awayTeam.logo} name={fixture.awayTeam.name} />
        <span>{fixture.awayTeam.abbreviation ?? fixture.awayTeam.name}</span>
      </div>
    </div>
  </article>;
}

function FixturePanel({ fixtures, highlightedId, teamId, emptyMessage, targetEventId, returnLabel, liveClock }: {
  fixtures: { fixture: Fixture; live: boolean }[];
  highlightedId: string;
  teamId: string;
  emptyMessage: string;
  targetEventId?: string;
  returnLabel: string;
  liveClock?: string | null;
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
      {fixtures.length ? fixtures.map(({ fixture, live }) => <FixtureRow key={fixture.eventId} fixture={fixture} result={!live && fixture.homeTeamGoals !== undefined} live={live} liveClock={live ? liveClock : undefined} isReturnTarget={fixture.eventId === targetEventId} highlightedId={highlightedId} />) : <div className="empty-state compact">{emptyMessage}</div>}
    </div>
  </section>;
}

export default function App() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueSlug, setLeagueSlug] = useState(() => getSaved("footypal.league", ""));
  const [draftLeagueSlug, setDraftLeagueSlug] = useState(() => getSaved("footypal.league", ""));
  const [teamId, setTeamId] = useState(() => getSaved("footypal.team", ""));
  const [draftTeamId, setDraftTeamId] = useState(() => getSaved("footypal.team", ""));
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [mode, setMode] = useState<"light" | "dark">(() => getSaved("footypal.mode", "dark") as "light" | "dark");
  const [teamPicker, setTeamPicker] = useState(!getSaved("footypal.team", ""));
  const [leagueListOpen, setLeagueListOpen] = useState(false);
  const [teamListOpen, setTeamListOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [error, setError] = useState("");
  const [brightness, setBrightness] = useState(75);
  const [volume, setVolume] = useState(45);
  const [liveClock, setLiveClock] = useState<string | null>(null);
  const hasLoadedTeam = useRef(false);

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
    const interval = window.setInterval(refresh, 60_000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [teamId, loadTeam]);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    localStorage.setItem("footypal.mode", mode);
  }, [mode]);

  useEffect(() => {
    const device = window.FootyPalDevice;
    if (typeof device?.getBrightness === "function") setBrightness(device.getBrightness());
    if (typeof device?.getVolume === "function") setVolume(device.getVolume());
  }, [settingsOpen]);

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
  const leaguePosition = team?.standings.find((row) => row.teamName.toLowerCase() === team.name.toLowerCase());
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
  useEffect(() => {
    if (!live?.eventId) {
      setLiveClock(null);
      return;
    }
    setLiveClock(null);
    const controller = new AbortController();
    const refreshClock = () => {
      api<{ status?: { clock?: string | null } }>(`/api/game/${encodeURIComponent(live.eventId)}`, controller.signal)
        .then((game) => setLiveClock(game.status?.clock ?? null))
        .catch(() => { /* Keep the live fixture visible if its clock endpoint is unavailable. */ });
    };
    refreshClock();
    const interval = window.setInterval(refreshClock, 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [live?.eventId]);
  const previousFixtures = team ? [...team.previousMatches].reverse() : [];
  const upcomingFixtures = team?.upcomingFixtures ?? [];
  const timelineFixtures = [
    ...previousFixtures.map((fixture) => ({ fixture, live: false })),
    ...(live ? [{ fixture: live, live: true }] : []),
    ...upcomingFixtures.map((fixture) => ({ fixture, live: false })),
  ];
  const targetFixture = live ?? upcomingFixtures[0] ?? previousFixtures[previousFixtures.length - 1];
  const returnLabel = live ? "Return to live game" : upcomingFixtures.length ? "Return to next game" : "Return to latest fixture";

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
        <button className="icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><span className="settings-glyph">⚙</span></button>
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
          <div className="panel-heading"><div><h2>League table</h2></div><span className="table-season">{team.standings.length ? `${team.standings.length} CLUBS` : "STANDINGS"}</span></div>
          {team.standings.length ? <div className="table-wrap"><table><thead><tr><th className="pos-col">POS</th><th className="club-col">CLUB</th><th className="stat-col">PL</th><th className="stat-col">W</th><th className="stat-col">D</th><th className="stat-col">L</th><th className="wide-stat">GD</th><th className="pts-col">PTS</th></tr></thead><tbody>{team.standings.map((row, index) => {
            const selected = row.teamName.toLowerCase() === team.name.toLowerCase();
            const startsNewPositionType = index > 0 && row.positionType !== team.standings[index - 1].positionType;
            const endsPositionType = index < team.standings.length - 1 && row.positionType !== team.standings[index + 1].positionType;
            const rowTeam = teams.find((item) => item.name.toLowerCase() === row.teamName.toLowerCase());
            const crest = rowTeam?.logos?.find((item) => item.rel?.includes("default"))?.href ?? rowTeam?.logos?.[0]?.href;
            return <Fragment key={`${row.position}-${row.teamName}`}>{startsNewPositionType && <tr className="position-separator" aria-hidden="true"><td colSpan={8}><span /></td></tr>}<tr className={`${selected ? "selected-row" : ""} ${endsPositionType ? "position-group-end" : ""}`}><td className="position-cell"><span>{String(row.position).padStart(2, "0")}</span></td><td className="club-cell"><span className="club-info">{crest ? <img src={crest} alt="" /> : <span className="mini-crest">{row.teamName.slice(0, 1)}</span>}<strong>{row.teamName}</strong></span></td><td className="stat-col">{row.gamesPlayed}</td><td className="stat-col">{row.won}</td><td className="stat-col">{row.drew}</td><td className="stat-col">{row.lost}</td><td className="wide-stat">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td><td className="points-cell">{row.points}</td></tr></Fragment>;
          })}</tbody></table></div> : <div className="empty-state">Standings aren’t available right now.</div>}
          <div className="table-footer"><span>Updated just now</span></div>
        </div>

        <div className="fixtures-column">
          <section className="panel summary-panel">
            <div className="summary-block"><span className="eyebrow">LEAGUE POSITION</span><strong>{leaguePosition?.position ?? "—"}<small>{team.standings.length ? ` / ${team.standings.length}` : ""}</small></strong></div>
            <div className="summary-divider" />
            <div className="summary-block form-block"><span className="eyebrow">RECENT FORM</span><div className="form-pills">{(team.form ?? "").slice(-5).split("").map((value, index) => <span key={`${value}${index}`} className={`form-pill form-${value.toLowerCase()}`}>{value}</span>)}{!team.form && <span className="summary-note">—</span>}</div></div>
          </section>
          <FixturePanel fixtures={timelineFixtures} highlightedId={team.id} teamId={team.id} emptyMessage="No fixtures to show." targetEventId={targetFixture?.eventId} returnLabel={returnLabel} liveClock={liveClock} />
        </div>
      </section>
      <footer className="page-footer"><span>DATA UPDATES EVERY MINUTE</span></footer>
    </>}

    {teamPicker && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && team) setTeamPicker(false); }}><section className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
      <div className="modal-topline"><div className="brand-mark small-mark">F</div>{team && <button className="modal-close" onClick={() => setTeamPicker(false)} aria-label="Close">×</button>}</div>
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

    {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal-topline"><div className="eyebrow">DISPLAY SETTINGS</div><button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close">×</button></div><h2 id="settings-title">Display settings</h2><p className="modal-copy">Brightness, volume and appearance.</p>
      <div className="setting-group"><div className="setting-heading"><span>Appearance</span><span className="setting-value">{mode === "dark" ? "Dark" : "Light"}</span></div><div className="mode-switch"><button className={mode === "light" ? "active" : ""} onClick={() => setMode("light")}><span>☼</span> Light</button><button className={mode === "dark" ? "active" : ""} onClick={() => setMode("dark")}><span>☾</span> Dark</button></div></div>
      <div className="setting-group"><div className="setting-heading"><label htmlFor="brightness">Screen brightness</label><span className="setting-value">{brightness}%</span></div><div className="range-row"><span>☼</span><input id="brightness" type="range" min="10" max="100" value={brightness} disabled={!canControlBrightness} style={{ "--range-progress": `${((brightness - 10) / 90) * 100}%` } as React.CSSProperties} onChange={(event) => { const value = Number(event.target.value); setBrightness(value); if (canControlBrightness) window.FootyPalDevice?.setBrightness(value); }} /><span className="sun-large">☼</span></div></div>
      <div className="setting-group"><div className="setting-heading"><label htmlFor="volume">Media volume</label><span className="setting-value">{volume}%</span></div><div className="range-row"><span>◖</span><input id="volume" type="range" min="0" max="100" value={volume} disabled={!canControlVolume} style={{ "--range-progress": `${volume}%` } as React.CSSProperties} onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (canControlVolume) window.FootyPalDevice?.setVolume(value); }} /><span className="volume-high">◖</span></div></div>
      <p className="settings-device-note">{canControlBrightness && canControlVolume ? "Brightness and volume control this tablet." : "Device controls are unavailable in this kiosk build."}</p>
      <button className="primary-button settings-done" onClick={() => setSettingsOpen(false)}>All set <span>✓</span></button>
    </section></div>}
  </main>;
}
