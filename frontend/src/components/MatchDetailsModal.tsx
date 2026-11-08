import type { GameDetails, TodaysGame } from "../types";
import { TodayGamePanel } from "./MatchPanels";
import { UiIcon } from "./Ui";

export function MatchDetailsModal({
    game,
    title,
    details,
    highlightedId,
    loading,
    error,
    isToday,
    isLive,
    timeLabel,
    onClose
}: {
    game: TodaysGame | null;
    title: string;
    details: GameDetails | null;
    highlightedId: string;
    loading: boolean;
    error?: string;
    isToday: boolean;
    isLive: boolean;
    timeLabel: string;
    onClose: () => void;
}) {
    if (!game) return null;
    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="modal game-details-modal" role="dialog" aria-modal="true" aria-label={title}>
                <div className="modal-topline">
                    <div className="eyebrow">{title}</div>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        <UiIcon name="close" size={20} />
                    </button>
                </div>
                {error && (
                    <div className="error-banner" role="alert">
                        <span>{error}</span>
                    </div>
                )}
                <TodayGamePanel
                    game={game}
                    details={details}
                    highlightedId={highlightedId}
                    loading={loading}
                    showHeading={false}
                    scoreTimeLabel={timeLabel}
                    scoreTimeIsLive={isToday && isLive}
                />
            </section>
        </div>
    );
}
