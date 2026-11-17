import { WarehouseReminder } from '../types';

const STORAGE_KEY_RECENT_OPS = 'saggin_warehouse_operators_v1';
const STORAGE_KEY_LAST_OP = 'saggin_last_warehouse_operator_v1';
const STORAGE_KEY_OFFICE_CREATORS = 'saggin_office_operators_v1';
const STORAGE_KEY_LAST_OFFICE_CREATOR = 'saggin_last_office_operator_v1';

/**
 * Returns local calendar date key 'YYYY-MM-DD' without UTC midnight drift.
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + deltaDays);
    return getLocalDateKey(fallback);
  }
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setDate(d.getDate() + deltaDays);
  return getLocalDateKey(d);
}

export function parseDateKey(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatReminderDayLabel(dateKey: string, todayKey: string = getLocalDateKey()): string {
  if (dateKey === todayKey) return 'Oggi';
  if (dateKey === addDaysToDateKey(todayKey, 1)) return 'Domani';
  if (dateKey === addDaysToDateKey(todayKey, -1)) return 'Ieri';
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return parsed.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function formatFullItalianDate(dateKey: string = getLocalDateKey()): string {
  const parsed = parseDateKey(dateKey) || new Date();
  const formatted = parsed.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatReminderTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const today = getLocalDateKey();
  const dKey = getLocalDateKey(date);
  const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  if (dKey === today) {
    return `Oggi alle ${timeStr}`;
  }
  if (dKey === addDaysToDateKey(today, -1)) {
    return `Ieri alle ${timeStr}`;
  }
  const dateStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  return `${dateStr} alle ${timeStr}`;
}

export function isReminderOverdue(
  reminder: WarehouseReminder,
  todayKey: string = getLocalDateKey()
): boolean {
  return reminder.status === 'DA_FARE' && reminder.due_date < todayKey;
}

export function isReminderDueTodayOrOverdue(
  reminder: WarehouseReminder,
  todayKey: string = getLocalDateKey()
): boolean {
  return reminder.status === 'DA_FARE' && reminder.due_date <= todayKey;
}

export function sortReminders(list: WarehouseReminder[]): WarehouseReminder[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'DA_FARE' ? -1 : 1;
    }
    if (a.status === 'DA_FARE') {
      if (a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.priority !== b.priority) {
        return a.priority === 'URGENTE' ? -1 : 1;
      }
      const aTime = a.due_time || '99:99';
      const bTime = b.due_time || '99:99';
      if (aTime !== bTime) {
        return aTime.localeCompare(bTime);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    const aDone = new Date(a.completed_at || a.updated_at).getTime();
    const bDone = new Date(b.completed_at || b.updated_at).getTime();
    return bDone - aDone;
  });
}

export function loadRecentReminderOperators(mode: 'magazzino' | 'ufficio' = 'magazzino'): string[] {
  const key = mode === 'ufficio' ? STORAGE_KEY_OFFICE_CREATORS : STORAGE_KEY_RECENT_OPS;
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function loadLastReminderOperator(mode: 'magazzino' | 'ufficio' = 'magazzino'): string {
  const key = mode === 'ufficio' ? STORAGE_KEY_LAST_OFFICE_CREATOR : STORAGE_KEY_LAST_OP;
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function saveReminderOperatorChoice(
  name: string,
  mode: 'magazzino' | 'ufficio' = 'magazzino'
): string[] {
  const trimmed = name.trim();
  if (!trimmed) return loadRecentReminderOperators(mode);
  const listKey = mode === 'ufficio' ? STORAGE_KEY_OFFICE_CREATORS : STORAGE_KEY_RECENT_OPS;
  const lastKey = mode === 'ufficio' ? STORAGE_KEY_LAST_OFFICE_CREATOR : STORAGE_KEY_LAST_OP;
  const existing = loadRecentReminderOperators(mode);
  const next = [
    trimmed,
    ...existing.filter((n) => n.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, 10);
  try {
    localStorage.setItem(listKey, JSON.stringify(next));
    localStorage.setItem(lastKey, trimmed);
  } catch {
    // Ignore storage quota errors
  }
  return next;
}
