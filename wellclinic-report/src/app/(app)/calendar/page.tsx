import Link from 'next/link';
import { calendarSources, listEvents } from '@/lib/calendar';
import { activeProjects, getProjects } from '@/lib/data';
import { addCalendarEvent } from '@/app/actions';
import { ActionForm, Disclosure } from '@/components/ActionForm';
import { Area, Row, Select, Text } from '@/components/Field';
import {
  WEEKDAYS,
  calendarGrid,
  currentMonthKST,
  formatKorean,
  formatMonth,
  monthRange,
  shiftMonth,
  todayKST,
} from '@/lib/date';
import { Badge, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface DayItem {
  key: string;
  label: string;
  time: string;
  kind: 'event' | 'deadline' | 'start' | 'holiday';
  href?: string;
  calendar?: string;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? '') ? (m as string) : currentMonthKST();
  const { start, end } = monthRange(month);
  const today = todayKST();

  const [calendarRes, projectRes] = await Promise.all([listEvents(start, end), getProjects()]);
  const sources = calendarSources();

  // 날짜별 항목 모으기
  const byDay = new Map<string, DayItem[]>();
  const push = (date: string, item: DayItem) => {
    if (!date) return;
    byDay.set(date, [...(byDay.get(date) ?? []), item]);
  };

  for (const e of calendarRes.events) {
    // 여러 날에 걸친 일정은 각 날짜에 표시한다
    let cursor = e.start;
    let guard = 0;
    while (cursor <= e.end && guard < 60) {
      push(cursor, {
        key: `${e.id}-${cursor}`,
        label: e.title,
        time: cursor === e.start ? e.time : '',
        kind: e.holiday ? 'holiday' : 'event',
        calendar: e.calendar,
      });
      const [y, mo, d] = cursor.split('-').map(Number);
      const next = new Date(Date.UTC(y, mo - 1, d + 1));
      cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
      guard += 1;
    }
  }

  const projects = activeProjects(projectRes.rows);
  for (const p of projects) {
    if (p.마감일 >= start && p.마감일 <= end) {
      push(p.마감일, {
        key: `d-${p.id}`,
        label: `${p.이름} 마감`,
        time: '',
        kind: 'deadline',
        href: `/projects/${p.id}`,
      });
    }
    if (p.시작일 >= start && p.시작일 <= end) {
      push(p.시작일, {
        key: `s-${p.id}`,
        label: `${p.이름} 시작`,
        time: '',
        kind: 'start',
        href: `/projects/${p.id}`,
      });
    }
  }

  const 휴일 = new Set(
    [...byDay.entries()]
      .filter(([, items]) => items.some((i) => i.kind === 'holiday'))
      .map(([date]) => date),
  );

  const grid = calendarGrid(month);
  const listView = [...byDay.entries()]
    .filter(([date]) => date >= start && date <= end)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        title="일정"
        description="구글 캘린더 일정과 프로젝트 시작·마감을 한 화면에서 봅니다."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/calendar?m=${shiftMonth(month, -1)}`} className="btn-ghost px-3">
              ←
            </Link>
            <span className="min-w-28 text-center font-heading text-[15px]">
              {formatMonth(month)}
            </span>
            <Link href={`/calendar?m=${shiftMonth(month, 1)}`} className="btn-ghost px-3">
              →
            </Link>
            <Link href="/calendar" className="btn-ghost">
              이번 달
            </Link>
          </div>
        }
      />

      {calendarRes.error && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          <p className="font-semibold">구글 캘린더를 불러오지 못했습니다.</p>
          <p className="mt-0.5 break-all opacity-80">{calendarRes.error}</p>
          <Link href="/setup" className="mt-1 inline-block font-semibold underline">
            캘린더 연결 방법 보기
          </Link>
        </div>
      )}

      <Disclosure label="일정 추가" openLabel="일정 추가">
        <ActionForm action={addCalendarEvent} submitLabel="캘린더에 넣기" resetOnSuccess>
          <Row cols={2}>
            <Text
              name="제목"
              label="일정 이름"
              required
              placeholder="예: 서원노인복지관 임플란트 강의 프로그램"
            />
            <Select
              name="캘린더"
              label="넣을 캘린더"
              options={sources.map((s) => s.id)}
              labels={sources.map((s) => s.label)}
              defaultValue={sources[0]?.id}
            />
          </Row>

          <Row cols={4}>
            <Text name="날짜" label="날짜" type="date" defaultValue={today} required />
            <Text name="종료일" label="종료일" type="date" hint="하루짜리면 비워 두세요" />
            <Text name="시작시각" label="시작" type="time" />
            <Text name="종료시각" label="종료" type="time" />
          </Row>

          <Row cols={2}>
            <Text name="장소" label="장소" placeholder="예: 서원노인복지관" />
            <Text
              name="참석자"
              label="참석자"
              placeholder="예: 김진형 원장, 김가영 위생사, 이하늘 대리"
            />
          </Row>

          <Area name="메모" label="메모" rows={2} placeholder="준비물, 이동 계획 등" />
        </ActionForm>

        <p className="mt-4 border-t border-ink-100 pt-3 text-[12px] leading-relaxed text-ink-400">
          시각을 비워 두면 종일 일정으로 들어갑니다. 참석자는 캘린더 설명에 적히고 실제 초대장은
          가지 않습니다. 등록한 일정은 팀원 각자의 구글 캘린더에도 그대로 보입니다.
        </p>
      </Disclosure>

      <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-sky-400" /> 구글 캘린더
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-red-400" /> 프로젝트 마감
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-brand-400" /> 프로젝트 시작
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-red-500" /> 공휴일
        </span>
      </div>

      {/* 데스크톱: 달력 격자 */}
      <div className="hidden overflow-hidden rounded-xl border border-ink-200 bg-white md:block">
        <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-2 text-center text-[12px] font-semibold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-sky-600' : 'text-ink-500'
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((date, i) => {
            const inMonth = date.slice(0, 7) === month;
            const items = byDay.get(date) ?? [];
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`min-h-28 border-b border-r border-ink-100 p-1.5 ${
                  i % 7 === 6 ? 'border-r-0' : ''
                } ${inMonth ? '' : 'bg-ink-50/60'}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[12px] font-semibold tnum ${
                      isToday
                        ? 'bg-brand-600 text-white'
                        : !inMonth
                          ? 'text-ink-300'
                          : 휴일.has(date) || i % 7 === 0
                            ? 'text-red-500'
                            : 'text-ink-600'
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                </div>

                <ul className="space-y-0.5">
                  {items.slice(0, 4).map((item) => {
                    const tone =
                      item.kind === 'holiday'
                        ? 'bg-red-500 text-white'
                        : item.kind === 'deadline'
                          ? 'bg-red-50 text-red-700'
                          : item.kind === 'start'
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-sky-50 text-sky-700';
                    const body = (
                      <span className="block truncate rounded px-1 py-0.5 text-[11px] leading-snug">
                        {item.time && <span className="mr-1 tnum opacity-70">{item.time}</span>}
                        {item.label}
                      </span>
                    );
                    return (
                      <li key={item.key} className={`${tone} rounded`}>
                        {item.href ? <Link href={item.href}>{body}</Link> : body}
                      </li>
                    );
                  })}
                  {items.length > 4 && (
                    <li className="px-1 text-[11px] text-ink-400">+{items.length - 4}건 더</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* 모바일: 목록 */}
      <div className="space-y-3 md:hidden">
        {listView.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-[14px] text-ink-400">
              {formatMonth(month)}에 등록된 일정이 없습니다.
            </p>
          </Card>
        ) : (
          listView.map(([date, items]) => (
            <div key={date} className={`card p-4 ${date === today ? 'border-brand-300' : ''}`}>
              <p className="mb-2 text-[13px] font-semibold text-ink-700 tnum">
                {formatKorean(date)}
                {date === today && <span className="ml-2 text-brand-600">오늘</span>}
              </p>
              <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <Badge
                      tone={
                        item.kind === 'holiday' || item.kind === 'deadline'
                          ? 'red'
                          : item.kind === 'start'
                            ? 'brand'
                            : 'blue'
                      }
                    >
                      {item.kind === 'holiday'
                        ? '휴일'
                        : item.kind === 'deadline'
                          ? '마감'
                          : item.kind === 'start'
                            ? '시작'
                            : (item.calendar ?? '일정')}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink-800">
                      {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
                    </span>
                    {item.time && <span className="text-[12px] text-ink-400 tnum">{item.time}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </>
  );
}
