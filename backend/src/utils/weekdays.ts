const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function saoPauloWeekday(date = new Date()) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(date);
  const index = SHORT.indexOf(short);
  return index >= 0 ? index : 0;
}

export function normalizeWeekdays(input?: number[] | string | null) {
  if (input == null || input === '') return null;
  const raw = Array.isArray(input) ? input : String(input).split(',');
  const days = [...new Set(
    raw
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6),
  )].sort((a, b) => a - b);
  return days.length ? days.join(',') : null;
}

export function weekdayLabels(weekdays?: string | null) {
  if (!weekdays) return '';
  return weekdays
    .split(',')
    .map((value) => LABELS[Number(value)] || '')
    .filter(Boolean)
    .join(', ');
}

export function matchesWeekday(weekdays: string | null | undefined, date = new Date()) {
  if (!weekdays) return true;
  return weekdays.split(',').includes(String(saoPauloWeekday(date)));
}
