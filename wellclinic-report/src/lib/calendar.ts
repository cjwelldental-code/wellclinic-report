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
  holiday: boolean;   // 공휴일이면 true
}

interface CalendarSource {
  id: string;
  label: string;
}

/**
 * 구글이 공개로 운영하는 대한민국 공휴일 캘린더.
 * 공개 캘린더라 따로 공유받지 않아도 읽힌다. 환경변수로 뺄 이유가 없어 여기 고정한다.
 */
const HOLIDAY_CALENDAR = {
  id: 'ko.south_korea#holiday@group.v.calendar.google.com',
  label: '휴일',
};

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

/**
 * 구글 캘린더에 일정을 새로 만든다.
 *
 * 서비스 계정으로 넣기 때문에 캘린더 공유 권한이 "일정 변경" 이상이어야 한다.
 * 열람 권한만 있으면 403이 나므로, 그때는 무엇을 바꿔야 하는지 알려 준다.
 *
 * 참석자는 실제 초대 대상이 아니라 설명에 적는다. 서비스 계정은 도메인 위임 설정 없이
 * 남을 초대할 수 없기 때문이다.
 */
export async function createEvent(input: {
  calendarId: string;
  제목: string;
  날짜: string;
  종료일?: string;
  시작시각?: string;
  종료시각?: string;
  장소?: string;
  참석자?: string;
  메모?: string;
  작성자?: string;
}): Promise<{ id: string; link: string }> {
  const calendar = google.calendar({ version: 'v3', auth: getAuth() });

  const 종료일 = input.종료일 && input.종료일 >= input.날짜 ? input.종료일 : input.날짜;
  const 시각있음 = Boolean(input.시작시각);

  // 종일 일정의 end.date 는 다음 날을 넣어야 그날까지 표시된다
  const [y, m, d] = 종료일.split('-').map(Number);
  const 다음날 = new Date(Date.UTC(y, m - 1, d + 1));
  const endExclusive = `${다음날.getUTCFullYear()}-${String(다음날.getUTCMonth() + 1).padStart(2, '0')}-${String(다음날.getUTCDate()).padStart(2, '0')}`;

  const description = [
    input.참석자 ? `참석: ${input.참석자}` : '',
    input.메모 ?? '',
    input.작성자 ? `\n(업무 보고 시스템 · ${input.작성자} 등록)` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();

  const res = await calendar.events.insert({
    calendarId: input.calendarId,
    requestBody: {
      summary: input.제목,
      location: input.장소 || undefined,
      description: description || undefined,
      start: 시각있음
        ? { dateTime: `${input.날짜}T${input.시작시각}:00`, timeZone: 'Asia/Seoul' }
        : { date: input.날짜 },
      end: 시각있음
        ? {
            dateTime: `${종료일}T${(input.종료시각 || input.시작시각)!}:00`,
            timeZone: 'Asia/Seoul',
          }
        : { date: endExclusive },
    },
  });

  return { id: res.data.id ?? '', link: res.data.htmlLink ?? '' };
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
  const configured = calendarSources();
  if (configured.length === 0) {
    return { events: [], error: 'GOOGLE_CALENDAR_IDS 가 설정되지 않았습니다.' };
  }
  // 공휴일 캘린더를 함께 읽는다. 공개 캘린더라 실패해도 나머지에 영향이 없다.
  const sources = [...configured, HOLIDAY_CALENDAR];

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
            holiday: source.id === HOLIDAY_CALENDAR.id,
          });
        }
      } catch (e) {
        const raw = (e as Error).message;
        // 구글은 캘린더 ID가 틀렸을 때도, 공유가 안 됐을 때도 똑같이 Not Found 를 준다
        const hint = raw.includes('Not Found')
          ? '캘린더 ID가 틀렸거나 서비스 계정에 공유되지 않았습니다. 캘린더 설정의 캘린더 통합 항목에서 캘린더 ID를 다시 확인해 주세요.'
          : raw;
        // 공휴일은 부가 정보라, 못 읽어도 화면 상단에 오류를 띄우지 않는다
        if (source.id !== HOLIDAY_CALENDAR.id) errors.push(`${source.label}: ${hint}`);
      }
    }),
  );

  events.sort((a, b) => (a.start + a.time).localeCompare(b.start + b.time));
  return { events, error: errors.length ? errors.join(' / ') : null };
}
