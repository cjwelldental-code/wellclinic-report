/**
 * 날짜는 전부 'YYYY-MM-DD' 문자열로 다룬다.
 * 문자열 계산은 UTC 기준으로 하고(시차 오차가 생기지 않는다),
 * "오늘"을 구할 때만 Asia/Seoul 을 적용한다.
 */

const TZ = 'Asia/Seoul';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 서울 기준 오늘 날짜 */
export function todayKST(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식으로 출력한다
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function currentMonthKST(): string {
  return todayKST().slice(0, 7);
}

function parse(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(parse(dateStr).getTime());
}

export function addDays(dateStr: string, days: number): string {
  const d = parse(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

export function dayOfWeek(dateStr: string): number {
  return parse(dateStr).getUTCDay();
}

/** 해당 날짜가 속한 주의 월요일 */
export function startOfWeek(dateStr: string): string {
  const dow = dayOfWeek(dateStr);
  return addDays(dateStr, dow === 0 ? -6 : 1 - dow);
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** 오늘부터 며칠 뒤인지. 음수면 이미 지났다. */
export function daysUntil(dateStr: string): number | null {
  if (!isValidDate(dateStr)) return null;
  return Math.round((parse(dateStr).getTime() - parse(todayKST()).getTime()) / 86_400_000);
}

export function formatKorean(dateStr: string, withWeekday = true): string {
  if (!isValidDate(dateStr)) return dateStr ?? '';
  const [, m, d] = dateStr.split('-');
  const base = `${Number(m)}월 ${Number(d)}일`;
  return withWeekday ? `${base} (${WEEKDAYS[dayOfWeek(dateStr)]})` : base;
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 달력 그리드용 — 해당 월을 감싸는 6주(42칸) 날짜 배열 */
export function calendarGrid(month: string): string[] {
  const { start } = monthRange(month);
  const gridStart = addDays(start, -dayOfWeek(start));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export { WEEKDAYS };
