import type { Dispatch, SetStateAction } from "react";
import { HOUR_OPTIONS } from "../utils";
import { SettingsDropdown, UiIcon } from "./Ui";

const SLEEP_OPTIONS = [
    { value: 0, label: "Never" },
    { value: 30, label: "After 30 seconds" },
    { value: 60, label: "After 1 minute" },
    { value: 120, label: "After 2 minutes" },
    { value: 300, label: "After 5 minutes" },
    { value: 600, label: "After 10 minutes" },
    { value: 900, label: "After 15 minutes" }
];

type SettingsModalProps = {
    open: boolean;
    onClose: () => void;
    mode: "light" | "dark";
    setMode: (mode: "light" | "dark") => void;
    brightness: number;
    setBrightness: (value: number) => void;
    canControlBrightness: boolean;
    volume: number;
    setVolume: (value: number) => void;
    canControlVolume: boolean;
    screenSleepSeconds: number;
    screenSleepListOpen: boolean;
    setScreenSleepListOpen: Dispatch<SetStateAction<boolean>>;
    canControlSleep: boolean;
    onScreenSleepChange: (seconds: number) => void;
    nightSleepEnabled: boolean;
    setNightSleepEnabled: Dispatch<SetStateAction<boolean>>;
    nightSleepStart: string;
    setNightSleepStart: (value: string) => void;
    nightSleepEnd: string;
    setNightSleepEnd: (value: string) => void;
    nightHourListOpen: "start" | "end" | null;
    setNightHourListOpen: Dispatch<SetStateAction<"start" | "end" | null>>;
};

export function SettingsModal(props: SettingsModalProps) {
    const {
        open,
        onClose,
        mode,
        setMode,
        brightness,
        setBrightness,
        canControlBrightness,
        volume,
        setVolume,
        canControlVolume,
        screenSleepSeconds,
        screenSleepListOpen,
        setScreenSleepListOpen,
        canControlSleep,
        onScreenSleepChange,
        nightSleepEnabled,
        setNightSleepEnabled,
        nightSleepStart,
        setNightSleepStart,
        nightSleepEnd,
        setNightSleepEnd,
        nightHourListOpen,
        setNightHourListOpen
    } = props;
    if (!open) return null;
    return (
        <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Display settings">
                <div className="modal-topline">
                    <div className="eyebrow">DISPLAY SETTINGS</div>
                    <button className="modal-close" onClick={onClose} aria-label="Close">
                        <UiIcon name="close" size={20} />
                    </button>
                </div>
                <div className="setting-group">
                    <div className="setting-heading">
                        <span>Appearance</span>
                        <span className="setting-value">{mode === "dark" ? "Dark" : "Light"}</span>
                    </div>
                    <div className="mode-switch">
                        <button className={mode === "light" ? "active" : ""} onClick={() => setMode("light")}>
                            <UiIcon name="sun-high" size={16} /> Light
                        </button>
                        <button className={mode === "dark" ? "active" : ""} onClick={() => setMode("dark")}>
                            <UiIcon name="moon" size={16} /> Dark
                        </button>
                    </div>
                </div>
                <div className="setting-group">
                    <div className="setting-heading">
                        <label htmlFor="brightness">Screen brightness</label>
                        <span className="setting-value">{brightness}%</span>
                    </div>
                    <div className="range-row">
                        <UiIcon name="sun-low" size={16} />
                        <input
                            id="brightness"
                            type="range"
                            min="10"
                            max="100"
                            value={brightness}
                            disabled={!canControlBrightness}
                            style={{ "--range-progress": `${((brightness - 10) / 90) * 100}%` } as React.CSSProperties}
                            onChange={(event) => {
                                const value = Number(event.target.value);
                                setBrightness(value);
                                if (canControlBrightness) window.FootyPalDevice?.setBrightness(value);
                            }}
                        />
                        <UiIcon name="sun-high" size={20} />
                    </div>
                </div>
                <div className="setting-group">
                    <div className="setting-heading">
                        <label htmlFor="volume">Media volume</label>
                        <span className="setting-value">{volume}%</span>
                    </div>
                    <div className="range-row">
                        <UiIcon name="volume-low" size={18} />
                        <input
                            id="volume"
                            type="range"
                            min="0"
                            max="100"
                            value={volume}
                            disabled={!canControlVolume}
                            style={{ "--range-progress": `${volume}%` } as React.CSSProperties}
                            onChange={(event) => {
                                const value = Number(event.target.value);
                                setVolume(value);
                                if (canControlVolume) window.FootyPalDevice?.setVolume(value);
                            }}
                        />
                        <UiIcon name="volume-high" size={20} />
                    </div>
                </div>
                <div className="setting-group">
                    <div className="setting-heading">
                        <span>Screen sleep</span>
                        <span className="setting-value">
                            {screenSleepSeconds === 0
                                ? "Never"
                                : screenSleepSeconds < 60
                                  ? `${screenSleepSeconds} sec`
                                  : `${screenSleepSeconds / 60} min`}
                        </span>
                    </div>
                    <div className="team-picker-field sleep-picker-field">
                        <button
                            id="screen-sleep"
                            type="button"
                            className={`team-picker-trigger ${screenSleepListOpen ? "open" : ""}`}
                            role="combobox"
                            aria-expanded={screenSleepListOpen}
                            aria-controls="screen-sleep-options"
                            aria-haspopup="listbox"
                            disabled={!canControlSleep}
                            onClick={() => {
                                setNightHourListOpen(null);
                                setScreenSleepListOpen((value) => !value);
                            }}
                        >
                            <span>
                                {screenSleepSeconds === 0
                                    ? "Never"
                                    : screenSleepSeconds < 60
                                      ? `After ${screenSleepSeconds} seconds`
                                      : `After ${screenSleepSeconds / 60} minute${screenSleepSeconds === 60 ? "" : "s"}`}
                            </span>
                            <span className="chevron select-chevron" aria-hidden="true" />
                        </button>
                        {screenSleepListOpen && (
                            <div id="screen-sleep-options" className="team-options-popover">
                                <div className="team-option-list" role="listbox">
                                    {SLEEP_OPTIONS.map((option) => (
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={screenSleepSeconds === option.value}
                                            className={`team-option ${screenSleepSeconds === option.value ? "chosen" : ""}`}
                                            key={option.value}
                                            onClick={() => onScreenSleepChange(option.value)}
                                        >
                                            <span>{option.label}</span>
                                            {screenSleepSeconds === option.value && <b>✓</b>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="setting-group">
                    <div className="setting-heading">
                        <span>Night sleep schedule</span>
                        <button
                            type="button"
                            className={`sleep-schedule-toggle ${nightSleepEnabled ? "active" : ""}`}
                            aria-pressed={nightSleepEnabled}
                            onClick={() => {
                                setNightHourListOpen(null);
                                setScreenSleepListOpen(false);
                                setNightSleepEnabled((enabled) => !enabled);
                            }}
                        >
                            {nightSleepEnabled ? "On" : "Off"}
                        </button>
                    </div>
                    {nightSleepEnabled && (
                        <>
                            <div className="sleep-hour-options">
                                <div className="sleep-hour-field">
                                    <span>From</span>
                                    <SettingsDropdown
                                        id="night-sleep-start"
                                        value={nightSleepStart}
                                        options={HOUR_OPTIONS}
                                        open={nightHourListOpen === "start"}
                                        onToggle={() => {
                                            setScreenSleepListOpen(false);
                                            setNightHourListOpen((openValue) =>
                                                openValue === "start" ? null : "start"
                                            );
                                        }}
                                        onSelect={(value) => {
                                            setNightSleepStart(value);
                                            setNightHourListOpen(null);
                                        }}
                                    />
                                </div>
                                <div className="sleep-hour-field">
                                    <span>Until</span>
                                    <SettingsDropdown
                                        id="night-sleep-end"
                                        value={nightSleepEnd}
                                        options={HOUR_OPTIONS}
                                        open={nightHourListOpen === "end"}
                                        onToggle={() => {
                                            setScreenSleepListOpen(false);
                                            setNightHourListOpen((openValue) => (openValue === "end" ? null : "end"));
                                        }}
                                        onSelect={(value) => {
                                            setNightSleepEnd(value);
                                            setNightHourListOpen(null);
                                        }}
                                    />
                                </div>
                            </div>
                            <p className="settings-device-note">
                                During this daily window, the screen blanks after 30 seconds without a tap, even if
                                Screen sleep is set to Never.
                            </p>
                        </>
                    )}
                </div>
                <p className="settings-device-note">
                    {canControlBrightness && canControlVolume
                        ? "Brightness and volume control this tablet."
                        : "Device controls are unavailable in this kiosk build."}
                </p>
                <p className="settings-device-note">
                    {!canControlSleep
                        ? "Screen sleep is available in the Android frame app."
                        : "After inactivity, the display goes black. Tap anywhere to wake it."}
                </p>
            </section>
        </div>
    );
}
