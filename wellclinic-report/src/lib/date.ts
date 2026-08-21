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

// ---------------------------------------------------------------------------
// 시각 ('HH:MM' 문자열)
// ---------------------------------------------------------------------------

/** 하루의 마지막 칸. 올림·덧셈이 자정을 넘어가면 여기서 멈춘다. */
const LAST_SLOT = 23 * 60 + 45;

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const toTime = (minutes: number): string => {
  const clamped = Math.max(0, Math.min(LAST_SLOT, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

/** 서울 기준 지금 시각 'HH:MM' */
export function nowTimeKST(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

/**
 * 지금 시각을 step 분 단위의 다음 칸으로 올린다.
 * 4시 26분이면 4시 30분. 이미 딱 맞으면 그대로 둔다.
 * 일정은 앞으로 잡는 것이라 내림하지 않는다.
 */
export function ceilToStep(time: string, step: number): string {
  return toTime(Math.ceil(toMinutes(time) / step) * step);
}

/** 'HH:MM' 에 분을 더한다. 자정을 넘으면 하루의 마지막 칸에서 멈춘다. */
export function addMinutes(time: string, minutes: number): string {
  return toTime(toMinutes(time) + minutes);
}

/** 15분 단위인지. 빈 값은 통과시킨다(종일 일정). */
export function isQuarterHour(time: string): boolean {
  if (!time) return true;
  return /^([01]\d|2[0-3]):(00|15|30|45)$/.test(time);
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
