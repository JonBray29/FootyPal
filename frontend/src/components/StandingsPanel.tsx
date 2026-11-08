import { Fragment } from "react";
import type { RefObject } from "react";
import type { Standing, Team, TeamOption } from "../types";

export function StandingsPanel({
    team,
    teams,
    tableWrapRef
}: {
    team: Team;
    teams: TeamOption[];
    tableWrapRef: RefObject<HTMLDivElement | null>;
}) {
    const recentForm = (team.form ?? "").slice(0, 5).split("").reverse();
    return (
        <div className="panel standings-panel">
            <div className="panel-heading">
                <div>
                    <h2>League table</h2>
                </div>
                <div className="standings-form">
                    <span className="table-season">FORM</span>
                    <div className="form-pills">
                        {recentForm.map((value, index) => (
                            <span key={`${value}${index}`} className={`form-pill form-${value.toLowerCase()}`}>
                                {value}
                            </span>
                        ))}
                        {!team.form && <span className="summary-note">—</span>}
                    </div>
                </div>
            </div>
            {team.standings.length ? (
                <div className="table-wrap" ref={tableWrapRef}>
                    <table>
                        <thead>
                            <tr>
                                <th className="pos-col">POS</th>
                                <th className="club-col">CLUB</th>
                                <th className="stat-col">PL</th>
                                <th className="stat-col">W</th>
                                <th className="stat-col">D</th>
                                <th className="stat-col">L</th>
                                <th className="wide-stat">GD</th>
                                <th className="pts-col">PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {team.standings.map((row: Standing, index) => {
                                const selected = row.teamName.toLowerCase() === team.name.toLowerCase();
                                const nextRow = team.standings[index + 1];
                                const startsNewPositionType = !!nextRow && row.positionType !== nextRow.positionType;
                                const rowTeam = teams.find(
                                    (item) => item.name.toLowerCase() === row.teamName.toLowerCase()
                                );
                                const crest =
                                    rowTeam?.logos?.find((item) => item.rel?.includes("default"))?.href ??
                                    rowTeam?.logos?.[0]?.href;
                                return (
                                    <Fragment key={`${row.position}-${row.teamName}`}>
                                        <tr
                                            className={selected ? "selected-row" : ""}
                                            data-selected-team={selected ? "true" : undefined}
                                        >
                                            <td className="position-cell">
                                                <span>{String(row.position).padStart(2, "0")}</span>
                                            </td>
                                            <td className="club-cell">
                                                <span className="club-info">
                                                    {crest ? (
                                                        <img src={crest} alt="" />
                                                    ) : (
                                                        <span className="mini-crest">{row.teamName.slice(0, 1)}</span>
                                                    )}
                                                    <strong>{row.teamName}</strong>
                                                </span>
                                            </td>
                                            <td className="stat-col">{row.gamesPlayed}</td>
                                            <td className="stat-col">{row.won}</td>
                                            <td className="stat-col">{row.drew}</td>
                                            <td className="stat-col">{row.lost}</td>
                                            <td className="wide-stat">
                                                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                                            </td>
                                            <td className="points-cell">{row.points}</td>
                                        </tr>
                                        {nextRow && (
                                            <tr className={`team-divider${startsNewPositionType ? " position-separator" : ""}`} aria-hidden="true">
                                                <td colSpan={8}>
                                                    <span
                                                        className="team-divider-line"
                                                        style={{
                                                            background: startsNewPositionType
                                                                ? "repeating-linear-gradient(to right, var(--table-position-divider, var(--line)) 0 4px, transparent 4px 8px)"
                                                                : "var(--table-divider, var(--line))"
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">Standings aren’t available right now.</div>
            )}
        </div>
    );
}
