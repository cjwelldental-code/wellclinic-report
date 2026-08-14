import 'server-only';
import { google } from 'googleapis';
import { getAuth } from './sheets';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;      // YYYY-MM-DD
  end: string;        // YYYY-MM-DD (종료일 포함)
  time: string;       // 'HH:MM' 또는 '' (종일)
  allDay: boolean;
  location: string;
  link: string;
  calendar: string;   // 표시용 캘린더 이름
}

interface CalendarSource {
  id: string;
  label: string;
}

/** GOOGLE_CALENDAR_IDS="웰치과=xxx@group.calendar.google.com,개인=yyy@gmail.com" */
export function calendarSources(): CalendarSource[] {
  const raw = process.env.GOOGLE_CALENDAR_IDS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const eq = entry.indexOf('=');
      if (eq === -1) return { id: entry, label: '캘린더' };
      return { id: entry.slice(eq + 1).trim(), label: entry.slice(0, eq).trim() };
    });
}

function toDateOnly(value?: string | null): string {
  if (!value) return '';
  if (value.length === 10) return value;              // 종일 일정
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function toTime(value?: string | null): string {
  if (!value || value.length === 10) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

/** 종일 일정의 end는 다음날로 오므로 하루 당겨 '포함 종료일'로 맞춘다. */
function inclusiveEnd(endDate: string, allDay: boolean): string {
  if (!allDay || !endDate) return endDate;
  const [y, m, d] = endDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 지정 기간의 일정을 모든 연결 캘린더에서 가져온다.
 * 캘린더가 설정되지 않았거나 권한이 없으면 빈 배열을 돌려주고 앱은 계속 동작한다.
 */
export async function listEvents(
  timeMin: string,
  timeMax: string,
): Promise<{ events: CalendarEvent[]; error: string | null }> {
  const sources = calendarSources();
  if (sources.length === 0) {
    return { events: [], error: 'GOOGLE_CALENDAR_IDS 가 설정되지 않았습니다.' };
  }

  const calendar = google.calendar({ version: 'v3', auth: getAuth() });
  const events: CalendarEvent[] = [];
  const errors: string[] = [];

  await Promise.all(
    sources.map(async (source) => {
      try {
        const res = await calendar.events.list({
          calendarId: source.id,
          timeMin: `${timeMin}T00:00:00+09:00`,
          timeMax: `${timeMax}T23:59:59+09:00`,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 250,
          timeZone: 'Asia/Seoul',
        });

        for (const item of res.data.items ?? []) {
          const allDay = Boolean(item.start?.date);
          const start = toDateOnly(item.start?.date ?? item.start?.dateTime);
          const rawEnd = toDateOnly(item.end?.date ?? item.end?.dateTime) || start;
          events.push({
            id: item.id ?? crypto.randomUUID(),
            title: item.summary ?? '(제목 없음)',
            start,
            end: inclusiveEnd(rawEnd, allDay) || start,
            time: toTime(item.start?.dateTime),
            allDay,
            location: item.location ?? '',
            link: item.htmlLink ?? '',
            calendar: source.label,
          });
        }
      } catch (e) {
        errors.push(`${source.label}: ${(e as Error).message}`);
      }
    }),
  );

  events.sort((a, b) => (a.start + a.time).localeCompare(b.start + b.time));
  return { events, error: errors.length ? errors.join(' / ') : null };
}
