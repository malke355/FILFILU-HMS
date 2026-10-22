import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export function toISODate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd')
}

export function formatDisplayDate(date: string): string {
  return format(parseISO(date), 'EEE, MMM d, yyyy')
}

export function formatShortDate(date: string): string {
  return format(parseISO(date), 'MMM d')
}

export function weekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const end = endOfWeek(anchor, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

export function monthDays(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

/** Inclusive range covering overnight shifts that start on `date`. */
export function shiftWindow(
  date: string,
  startTime: string,
  endTime: string,
  overnight: boolean,
): { start: Date; end: Date } {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  const start = startOfDay(parseISO(date))
  start.setHours(sh, sm, 0, 0)
  const end = startOfDay(parseISO(date))
  end.setHours(eh, em, 0, 0)
  if (overnight || end <= start) {
    return { start, end: addDays(end, 1) }
  }
  return { start, end }
}

export function rangesOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start < b.end && b.start < a.end
}

export function isToday(date: string): boolean {
  return isSameDay(parseISO(date), new Date())
}

export function isInNextDays(date: string, days: number): boolean {
  const start = startOfDay(new Date())
  const end = addDays(start, days)
  const target = parseISO(date)
  return isWithinInterval(target, { start, end })
}

export { addDays, format, parseISO, startOfDay, startOfMonth, startOfWeek }
