import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { calendarSources, listEvents } from '@/lib/calendar';
import { activeProjects, getComments, getProjects } from '@/lib/data';
import { addCalendarEvent } from '@/app/actions';
import { ActionForm, Disclosure } from '@/components/ActionForm';
import { Area, Row, Select, Text, TimeSelect } from '@/components/Field';
import { CalendarGrid, CalendarList, type GridItem } from '@/components/CalendarGrid';
import {
  calendarGrid,
  currentMonthKST,
  formatMonth,
  monthRange,
  shiftMonth,
  todayKST,
} from '@/lib/date';
import { Card, PageHeader } from '@/components/ui';
import type { CommentRow } from '@/lib/schema';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await requireSession();
  const { m } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? '') ? (m as string) : currentMonthKST();
  const { start, end } = monthRange(month);
  const today = todayKST();

  const [calendarRes, projectRes, commentRes] = await Promise.all([
    listEvents(start, end),
    getProjects(),
    getComments(),
  ]);
  const sources = calendarSources();

  // 일정 id별 코멘트. 팝업이 클라이언트 컴포넌트라 미리 묶어서 넘긴다.
  const commentsByEvent: Record<string, CommentRow[]> = {};
  for (const c of commentRes.rows) {
    if (c.대상종류 !== 'event') continue;
    (commentsByEvent[c.대상id] ??= []).push(c);
  }
  for (const list of Object.values(commentsByEvent)) {
    list.sort((a, b) => a.생성일시.localeCompare(b.생성일시));
  }

  // 날짜별 항목 모으기
  const byDay: Record<string, GridItem[]> = {};
  const push = (date: string, item: GridItem) => {
    if (!date) return;
    (byDay[date] ??= []).push(item);
  };

  for (const e of calendarRes.events) {
    // 여러 날에 걸친 일정은 각 날짜에 표시한다
    let cursor = e.start;
    let guard = 0;
    while (cursor <= e.end && guard < 60) {
      push(cursor, {
        key: `${e.id}-${cursor}`,
        eventId: e.holiday ? undefined : e.id,
        label: e.title,
        time: cursor === e.start ? e.time : '',
        endTime: e.endTime,
        kind: e.holiday ? 'holiday' : 'event',
        calendar: e.calendar,
        location: e.location,
        description: e.description,
        link: e.link,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
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
        endTime: '',
        kind: 'deadline',
        href: `/projects/${p.id}`,
        description: p.목표 || p.설명 || '',
        start: p.마감일,
        end: p.마감일,
        allDay: true,
      });
    }
    if (p.시작일 >= start && p.시작일 <= end) {
      push(p.시작일, {
        key: `s-${p.id}`,
        label: `${p.이름} 시작`,
        time: '',
        endTime: '',
        kind: 'start',
        href: `/projects/${p.id}`,
        description: p.목표 || p.설명 || '',
        start: p.시작일,
        end: p.시작일,
        allDay: true,
      });
    }
  }

  const holidays = Object.entries(byDay)
    .filter(([, items]) => items.some((i) => i.kind === 'holiday'))
    .map(([date]) => date);

  const grid = calendarGrid(month);
  const listView = Object.entries(byDay)
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
            <TimeSelect name="시작시각" label="시작" />
            <TimeSelect name="종료시각" label="종료" />
          </Row>

          <Row cols={2}>
            <Text name="장소" label="장소" placeholder="예: 서원노인복지관" />
            <Text
              name="참석자"
              label="참석자"
              placeholder="예: 빙정호 원장, 김태형 팀장, 이하늘 대리"
            />
          </Row>

          <Area name="메모" label="메모" rows={2} placeholder="준비물, 이동 계획 등" />
        </ActionForm>

        <p className="mt-4 border-t border-ink-100 pt-3 text-[12px] leading-relaxed text-ink-400">
          시각은 30분 단위로 고릅니다. 비워 두면 종일 일정으로 들어갑니다. 참석자는 캘린더 설명에
          적히고 실제 초대장은 가지 않습니다. 등록한 일정은 팀원 각자의 구글 캘린더에도 그대로
          보입니다.
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
        <span className="ml-auto text-ink-400">일정을 누르면 상세 내용이 열립니다.</span>
      </div>

      <CalendarGrid
        grid={grid}
        month={month}
        today={today}
        byDay={byDay}
        holidays={holidays}
        commentsByEvent={commentsByEvent}
        currentUser={session.name}
      />

      {listView.length === 0 ? (
        <div className="md:hidden">
          <Card>
            <p className="py-8 text-center text-[14px] text-ink-400">
              {formatMonth(month)}에 등록된 일정이 없습니다.
            </p>
          </Card>
        </div>
      ) : (
        <CalendarList
          listView={listView}
          today={today}
          commentsByEvent={commentsByEvent}
          currentUser={session.name}
        />
      )}
    </>
  );
}
