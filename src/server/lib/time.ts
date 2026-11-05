const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoFromNow(options: {
  hours?: number;
  minutes?: number;
}): string {
  const ms =
    (options.hours ?? 0) * HOUR_MS + (options.minutes ?? 0) * MINUTE_MS;
  return new Date(Date.now() + ms).toISOString();
}

export function isoBeforeNow(options: {
  hours?: number;
  minutes?: number;
}): string {
  return isoFromNow({
    hours: -(options.hours ?? 0),
    minutes: -(options.minutes ?? 0),
  });
}

export function isExpired(iso: string): boolean {
  return Date.parse(iso) <= Date.now();
}

export function isOlderThan(iso: string, minutes: number): boolean {
  return Date.parse(iso) < Date.now() - minutes * MINUTE_MS;
}

export function isFuture(iso: string): boolean {
  return Date.parse(iso) > Date.now();
}

export function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * HOUR_MS).toISOString();
}

const CRM_TIMEZONE = "Asia/Kolkata";
const CRM_UTC_OFFSET = "+05:30";

/**
 * Returns UTC ISO boundaries for the current calendar day in the CRM display
 * timezone (Asia/Kolkata). Asia/Kolkata has a fixed offset and no DST.
 */
export function getCrmDayBounds(now = new Date()): {
  start: string;
  end: string;
  dateKey: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CRM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "01";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;

  return {
    start: new Date(`${dateKey}T00:00:00${CRM_UTC_OFFSET}`).toISOString(),
    end: new Date(`${dateKey}T23:59:59.999${CRM_UTC_OFFSET}`).toISOString(),
    dateKey,
  };
}

/** Current date in the CRM timezone formatted as YYYYMMDD. */
export function getCrmDateKey(now = new Date()): string {
  return getCrmDayBounds(now).dateKey.replace(/-/g, "");
}

