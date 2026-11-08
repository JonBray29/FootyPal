import type { Dispatch, SetStateAction } from "react";
import type { League, TeamOption } from "../types";
import { Badge, UiIcon } from "./Ui";

type TeamPickerModalProps = {
    open: boolean;
    hasTeam: boolean;
    onClose: () => void;
    onSelectTeam: () => void;
    leagues: League[];
    loadingLeagues: boolean;
    draftLeagueSlug: string;
    draftLeague?: League;
    onLeagueChange: (leagueSlug: string) => void;
    leagueListOpen: boolean;
    setLeagueListOpen: Dispatch<SetStateAction<boolean>>;
    teamListOpen: boolean;
    setTeamListOpen: Dispatch<SetStateAction<boolean>>;
    draftTeamId: string;
    draftTeam?: TeamOption;
    loadingTeams: boolean;
    teams: TeamOption[];
    onTeamChange: (teamId: string) => void;
};

export function TeamPickerModal({
    open,
    hasTeam,
    onClose,
    onSelectTeam,
    leagues,
    loadingLeagues,
    draftLeagueSlug,
    draftLeague,
    onLeagueChange,
    leagueListOpen,
    setLeagueListOpen,
    teamListOpen,
    setTeamListOpen,
    draftTeamId,
    draftTeam,
    loadingTeams,
    teams,
    onTeamChange
}: TeamPickerModalProps) {
    if (!open) return null;
    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && hasTeam) onClose();
            }}
        >
            <section className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
                <div className="modal-topline">
                    <div className="brand-mark small-mark">F</div>
                    {hasTeam && (
                        <button className="modal-close" onClick={onClose} aria-label="Close">
                            <UiIcon name="close" size={20} />
                        </button>
                    )}
                </div>
                <div className="eyebrow">PERSONALISE YOUR DASHBOARD</div>
                <h2 id="team-modal-title">Pick your team.</h2>
                <p className="modal-copy">
                    We’ll put your club in the spotlight, with its colours across the whole matchday.
                </p>
                <label className="field-label" htmlFor="league-select">
                    YOUR LEAGUE
                </label>
                <div className="team-picker-field league-picker-field">
                    <button
                        id="league-select"
                        type="button"
                        className={`team-picker-trigger ${leagueListOpen ? "open" : ""}`}
                        role="combobox"
                        aria-expanded={leagueListOpen}
                        aria-controls="league-options"
                        aria-haspopup="listbox"
                        disabled={loadingLeagues || !leagues.length}
                        onClick={() => {
                            setLeagueListOpen((value) => !value);
                            setTeamListOpen(false);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setLeagueListOpen(false);
                        }}
                    >
                        {draftLeague ? (
                            <>
                                <img
                                    className="team-badge picker-badge league-picker-badge"
                                    src={draftLeague.logo}
                                    alt=""
                                />
                                <span className="selected-team-name">{draftLeague.name}</span>
                            </>
                        ) : (
                            <span className="picker-placeholder">
                                {loadingLeagues ? "Loading leagues…" : "Choose a league"}
                            </span>
                        )}
                        <span className="chevron select-chevron" aria-hidden="true" />
                    </button>
                    {leagueListOpen && (
                        <div className="team-options-popover league-options-popover" id="league-options">
                            <div className="team-option-list" role="listbox" aria-label="Leagues">
                                {leagues.map((league) => (
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={draftLeagueSlug === league.slug}
                                        className={`team-option ${draftLeagueSlug === league.slug ? "chosen" : ""}`}
                                        key={league.slug}
                                        onClick={() => {
                                            if (draftLeagueSlug !== league.slug) onLeagueChange(league.slug);
                                            setLeagueListOpen(false);
                                            setTeamListOpen(false);
                                        }}
                                    >
                                        <img
                                            className="team-badge picker-badge league-picker-badge"
                                            src={league.logo}
                                            alt=""
                                        />
                                        <span>{league.name}</span>
                                        {draftLeagueSlug === league.slug && <b>✓</b>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <label className="field-label" htmlFor="team-select">
                    YOUR CLUB
                </label>
                <div className="team-picker-field">
                    <button
                        id="team-select"
                        type="button"
                        className={`team-picker-trigger ${teamListOpen ? "open" : ""}`}
                        role="combobox"
                        aria-expanded={teamListOpen}
                        aria-controls="team-options"
                        aria-haspopup="listbox"
                        disabled={!draftLeagueSlug || loadingTeams}
                        onClick={() => setTeamListOpen((value) => !value)}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setTeamListOpen(false);
                        }}
                    >
                        {draftTeam ? (
                            <>
                                <Badge
                                    src={
                                        draftTeam.logos.find((item) => item.rel?.includes("default"))?.href ??
                                        draftTeam.logos[0]?.href
                                    }
                                    name={draftTeam.name}
                                    className="picker-badge"
                                />
                                <span className="selected-team-name">{draftTeam.name}</span>
                            </>
                        ) : (
                            <span className="picker-placeholder">
                                {loadingTeams ? "Loading clubs…" : "Choose your club"}
                            </span>
                        )}
                        <span className="chevron select-chevron" aria-hidden="true" />
                    </button>
                    {teamListOpen && (
                        <div className="team-options-popover" id="team-options">
                            {loadingTeams ? (
                                <div className="team-options-message">Loading clubs…</div>
                            ) : teams.length ? (
                                <div className="team-option-list" role="listbox" aria-label="Teams">
                                    {teams.map((item) => (
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={draftTeamId === item.id}
                                            className={`team-option ${draftTeamId === item.id ? "chosen" : ""}`}
                                            key={item.id}
                                            onClick={() => onTeamChange(item.id)}
                                        >
                                            <Badge
                                                src={
                                                    item.logos.find((entry) => entry.rel?.includes("default"))?.href ??
                                                    item.logos[0]?.href
                                                }
                                                name={item.name}
                                                className="picker-badge"
                                            />
                                            <span>{item.name}</span>
                                            {draftTeamId === item.id && <b>✓</b>}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="team-options-message">No clubs match that search.</div>
                            )}
                        </div>
                    )}
                </div>
                <button className="primary-button modal-submit" disabled={!draftTeamId} onClick={onSelectTeam}>
                    Make it my team <span className="button-arrow" aria-hidden="true" />
                </button>
                <div className="modal-footnote">
                    <span>✳</span> You can change your team any time.
                </div>
            </section>
        </div>
    );
}
