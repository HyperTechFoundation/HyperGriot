/**
 * Duration parsing for temporary actions (/tban, /tmute).
 * Grammar: a token is a sequence of <integer><unit>, e.g. "1m", "2h30m", "1d12h".
 * Units: s (seconds), m (minutes), h (hours), d (days), w (weeks).
 * See docs/design.md §4.6.
 */

const UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Matches one or more <number><unit> groups, e.g. "2h", "1d12h", "90m". */
const TIME_TOKEN_RE = /^(?:\d+[smhdw])+$/;

const PART_RE = /(\d+)([smhdw])/g;

/** A full duration token must consist of number+unit pairs only. */
export function isTimeToken(token: string): boolean {
  return TIME_TOKEN_RE.test(token);
}

export interface ParsedTime {
  ms: number;
  label: string;
  /** Unix seconds suitable for Telegram's until_date (capped sensibly). */
  untilDate: number;
}

/** Convert a parsed duration into a human label. */
function humanLabel(parts: { value: number; unit: string }[]): string {
  const name: Record<string, string> = {
    s: "second",
    m: "minute",
    h: "hour",
    d: "day",
    w: "week",
  };
  return parts
    .map(({ value, unit }) => {
      const n = name[unit] ?? unit;
      return `${value} ${value === 1 ? n : n + "s"}`;
    })
    .join(" ");
}

/** Parse a duration token like "2h30m" into milliseconds + label + until_date. */
export function parseTime(token: string): ParsedTime | null {
  if (!isTimeToken(token)) return null;

  let ms = 0;
  const parts: { value: number; unit: string }[] = [];
  let m: RegExpExecArray | null;
  PART_RE.lastIndex = 0;
  while ((m = PART_RE.exec(token)) !== null) {
    const valueStr = m[1];
    const unit = m[2];
    if (valueStr === undefined || unit === undefined) continue;
    const mult = UNITS[unit];
    if (!mult) return null;
    const value = Number(valueStr);
    ms += value * mult;
    parts.push({ value, unit });
  }

  if (ms <= 0) return null;

  // Telegram's ban/restrict until_date must be >= now + 30s and <= ~366 days.
  const max = 365 * 86_400_000 + 6 * 3_600_000; // 366 days
  ms = Math.min(ms, max);

  return {
    ms,
    label: humanLabel(parts),
    untilDate: Math.floor((Date.now() + ms) / 1000),
  };
}
