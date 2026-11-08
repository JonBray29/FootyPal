export function Badge({ src, name, className = "" }: { src?: string | null; name: string; className?: string }) {
    return src ? (
        <img className={`team-badge ${className}`} src={src} alt={`${name} crest`} />
    ) : (
        <span className={`team-badge badge-fallback ${className}`} aria-label={name}>
            {name.slice(0, 2).toUpperCase()}
        </span>
    );
}

export type UiIconName = "settings" | "close" | "sun-low" | "sun-high" | "moon" | "volume-low" | "volume-high";
export function UiIcon({ name, size = 20 }: { name: UiIconName; size?: number }) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {name === "settings" && (
                <>
                    <path d="M9.7 3h4.6l.6 2.2a7.8 7.8 0 0 1 1.6.9l2.2-.7 2.3 4-1.6 1.6a7.4 7.4 0 0 1 0 1.9l1.6 1.6-2.3 4-2.2-.7a7.8 7.8 0 0 1-1.6.9l-.6 2.2H9.7l-.6-2.2a7.8 7.8 0 0 1-1.6-.9l-2.2.7-2.3-4 1.6-1.6a7.4 7.4 0 0 1 0-1.9L3 9.4l2.3-4 2.2.7a7.8 7.8 0 0 1 1.6-.9L9.7 3Z" />
                    <circle cx="12" cy="12" r="3" />
                </>
            )}
            {name === "close" && <path d="m18 6-12 12M6 6l12 12" />}
            {(name === "sun-low" || name === "sun-high") && (
                <>
                    <circle cx="12" cy="12" r={name === "sun-low" ? 3.5 : 4.5} />
                    <path
                        d={
                            name === "sun-low"
                                ? "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2"
                                : "M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42m0-14.14-1.42 1.42m-11.3 11.3-1.42 1.42"
                        }
                    />
                </>
            )}
            {name === "moon" && <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />}
            {(name === "volume-low" || name === "volume-high") && (
                <>
                    <path d="M4 10v4h3l5 4V6l-5 4H4Z" />
                    {name === "volume-low" ? (
                        <path d="M15 9.5a4 4 0 0 1 0 5" />
                    ) : (
                        <>
                            <path d="M15 9a4.5 4.5 0 0 1 0 6" />
                            <path d="M18 6a9 9 0 0 1 0 12" />
                        </>
                    )}
                </>
            )}
        </svg>
    );
}

export function SettingsDropdown({
    id,
    value,
    options,
    open,
    onToggle,
    onSelect
}: {
    id: string;
    value: string;
    options: { value: string; label: string }[];
    open: boolean;
    onToggle: () => void;
    onSelect: (value: string) => void;
}) {
    const selected = options.find((option) => option.value === value);
    return (
        <div className="team-picker-field sleep-picker-field">
            <button
                id={id}
                type="button"
                className={`team-picker-trigger ${open ? "open" : ""}`}
                role="combobox"
                aria-expanded={open}
                aria-controls={`${id}-options`}
                aria-haspopup="listbox"
                onClick={onToggle}
                onKeyDown={(event) => {
                    if (event.key === "Escape") onSelect(value);
                }}
            >
                <span>{selected?.label ?? value}</span>
                <span className="chevron select-chevron" aria-hidden="true" />
            </button>
            {open && (
                <div id={`${id}-options`} className="team-options-popover">
                    <div className="team-option-list" role="listbox">
                        {options.map((option) => (
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === option.value}
                                className={`team-option ${value === option.value ? "chosen" : ""}`}
                                key={option.value}
                                onClick={() => onSelect(option.value)}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <b>✓</b>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
