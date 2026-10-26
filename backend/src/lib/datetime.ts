import { z } from "zod";

/** Calendar date YYYY-MM-DD (strict, no time component). */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
  .refine((v) => {
    const parts = v.split("-").map(Number);
    const y = parts[0]!;
    const m = parts[1]!;
    const d = parts[2]!;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, "Date is not a valid calendar day.");

/** 24h clock H:MM or HH:MM — stored normalized as HH:MM. */
export const timeStringSchema = z
  .string()
  .trim()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM (24-hour).")
  .transform((t) => normalizeTime(t));

export function normalizeTime(t: string): string {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t.trim());
  if (!m) return t.trim();
  const hour = Number(m[1]);
  if (hour > 23) return t.trim();
  return `${String(hour).padStart(2, "0")}:${m[2]}`;
}

/** Reject booking dates more than N days in the past (UTC date). */
export function assertNotTooFarPast(date: string, maxPastDays = 1) {
  const parts = date.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const target = Date.UTC(y, m - 1, d);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const pastLimit = todayUtc - maxPastDays * 86_400_000;
  if (target < pastLimit) {
    throw Object.assign(new Error("Date is too far in the past."), { status: 400 });
  }
}
