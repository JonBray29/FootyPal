export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({ value: String(hour).padStart(2, "0"), label: `${String(hour).padStart(2, "0")}:00` }));

export function dateLabel(value: string | null, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  if (!value) return "Date TBC";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date TBC" : new Intl.DateTimeFormat(undefined, options).format(date);
}
