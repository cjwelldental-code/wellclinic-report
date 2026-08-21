'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Comments } from './Comments';
import { Multiline } from './Field';
import type { CommentRow } from '@/lib/schema';

/**
 * 달력 격자와 일정 상세 팝업.
 *
 * 칸 안에서는 제목 한 줄밖에 못 보여 준다. 참석자·장소·메모는 구글 캘린더를 따로 열어야
 * 확인할 수 있었는데, 눌렀을 때 그 자리에서 뜨는 카드로 바꿨다.
 * 서버 컴포넌트에서 만들 수 없는 화면이라 이 파일만 클라이언트로 둔다.
 */

export interface GridItem {
  key: string;
  /** 코멘트를 달 수 있는 대상이면 구글 캘린더 일정 id */
  eventId?: string;
  label: string;
  time: string;
  endTime: string;
  kind: 'event' | 'deadline' | 'start' | 'holiday';
  href?: string;
  calendar?: string;
  location?: string;
  description?: string;
  link?: string;
  /** 일정에 지정된 색 (hex). 없으면 '' */
  color?: string;
  /** 여러 날 일정이면 실제 시작·종료일 */
  start: string;
  end: string;
  allDay: boolean;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function 날짜표시(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  // 시차로 하루가 밀리지 않게 UTC 로 만들고 UTC 로 읽는다 (lib/date.ts 와 같은 방식)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${WEEKDAYS[dow]})`;
}

/** 구글 캘린더 팝업처럼 '8월 25일 (화요일) · 오전 11:00 ~ 11:30' 한 줄로 */
function 기간표시(item: GridItem): string {
  const 시작 = 날짜표시(item.start);
  const 여러날 = item.end && item.end !== item.start;
  const 날짜 = 여러날 ? `${시작} ~ ${날짜표시(item.end)}` : 시작;

  if (item.allDay || !item.time) return `${날짜} · 종일`;
  if (!item.endTime) return `${날짜} · ${시각표시(item.time)}`;

  // 오전·오후가 같으면 끝 시각에는 다시 붙이지 않는다 ('오후 2:00 ~ 2:30')
  const 같은나절 = 오전인가(item.time) === 오전인가(item.endTime);
  const 끝 = 같은나절 ? 시각표시(item.endTime, false) : 시각표시(item.endTime);

  return `${날짜} · ${시각표시(item.time)} ~ ${끝}`;
}

const 오전인가 = (hhmm: string) => Number(hhmm.split(':')[0]) < 12;

function 시각표시(hhmm: string, 나절표시 = true): string {
  const [h, m] = hhmm.split(':').map(Number);
  const 열두시간 = h % 12 === 0 ? 12 : h % 12;
  const 시분 = `${열두시간}:${String(m).padStart(2, '0')}`;
  return 나절표시 ? `${h >= 12 ? '오후' : '오전'} ${시분}` : 시분;
}

const TONE: Record<GridItem['kind'], string> = {
  holiday: 'bg-red-500 text-white',
  deadline: 'bg-red-50 text-red-700',
  start: 'bg-brand-50 text-brand-700',
  event: 'bg-sky-50 text-sky-700',
};

function DetailPopup({
  item,
  comments,
  currentUser,
  onClose,
}: {
  item: GridItem;
  comments: CommentRow[];
  currentUser: string;
  onClose: () => void;
}) {
  // Esc 로 닫힌다. 팝업이 열려 있는 동안만 듣는다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const 점색 =
    item.kind === 'holiday'
      ? 'bg-red-500'
      : item.kind === 'deadline'
        ? 'bg-red-400'
        : item.kind === 'start'
          ? 'bg-brand-500'
          : 'bg-sky-400';

  // 일정에 색을 지정했으면 그 색을 쓴다
  const 점스타일 = item.color ? { backgroundColor: item.color } : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/25 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item.label}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-sm ${item.color ? '' : 점색}`}
              style={점스타일}
            />
            <div className="min-w-0">
              <h3 className="text-[18px] leading-snug text-ink-900">{item.label}</h3>
              <p className="mt-1 text-[13px] text-ink-500 tnum">{기간표시(item)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-full px-2 py-1 text-[16px] leading-none text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            ✕
          </button>
        </div>

        <dl className="space-y-2 border-t border-ink-100 pt-3 text-[14px]">
          {item.location && (
            <div className="flex gap-2.5">
              <dt className="w-12 shrink-0 text-[13px] text-ink-400">장소</dt>
              <dd className="min-w-0 text-ink-700">{item.location}</dd>
            </div>
          )}
          {item.description && (
            <div className="flex gap-2.5">
              <dt className="w-12 shrink-0 text-[13px] text-ink-400">내용</dt>
              <dd className="min-w-0">
                <Multiline text={item.description} className="text-ink-700" />
              </dd>
            </div>
          )}
          {item.calendar && (
            <div className="flex gap-2.5">
              <dt className="w-12 shrink-0 text-[13px] text-ink-400">캘린더</dt>
              <dd className="min-w-0 text-ink-700">{item.calendar}</dd>
            </div>
          )}
          {!item.location && !item.description && item.kind === 'event' && (
            <p className="text-[13px] text-ink-400">장소와 메모가 비어 있는 일정입니다.</p>
          )}
        </dl>

        {(item.href || item.link) && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
            {item.href && (
              <Link href={item.href} className="btn-ghost px-3 py-1.5 text-[13px]">
                프로젝트 열기
              </Link>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-ghost px-3 py-1.5 text-[13px]"
              >
                구글 캘린더에서 보기
              </a>
            )}
          </div>
        )}

        {/* 공휴일은 우리가 만든 일정이 아니라 코멘트를 받지 않는다 */}
        {item.eventId && item.kind === 'event' && (
          <div className="mt-3 border-t border-ink-100 pt-3">
            <p className="mb-2 text-[12px] font-semibold text-ink-400">코멘트 · 피드백</p>
            <Comments
              kind="event"
              targetId={item.eventId}
              targetTitle={item.label}
              href="/calendar"
              comments={comments}
              currentUser={currentUser}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarGrid({
  grid,
  month,
  today,
  byDay,
  holidays,
  commentsByEvent,
  currentUser,
}: {
  grid: string[];
  month: string;
  today: string;
  byDay: Record<string, GridItem[]>;
  holidays: string[];
  commentsByEvent: Record<string, CommentRow[]>;
  currentUser: string;
}) {
  const [picked, setPicked] = useState<GridItem | null>(null);
  const 휴일 = new Set(holidays);

  return (
    <>
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
            const items = byDay[date] ?? [];
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
                    const n = item.eventId ? (commentsByEvent[item.eventId]?.length ?? 0) : 0;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => setPicked(item)}
                          className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-snug transition hover:brightness-95 ${TONE[item.kind]}`}
                          title={item.label}
                        >
                          {item.color && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          )}
                          {item.time && <span className="shrink-0 tnum opacity-70">{item.time}</span>}
                          <span className="min-w-0 truncate">{item.label}</span>
                          {n > 0 && <span className="shrink-0 font-semibold opacity-80">💬{n}</span>}
                        </button>
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

      {picked && (
        <DetailPopup
          item={picked}
          comments={picked.eventId ? (commentsByEvent[picked.eventId] ?? []) : []}
          currentUser={currentUser}
          onClose={() => setPicked(null)}
        />
      )}
    </>
  );
}

/** 모바일 목록에서도 같은 팝업을 쓴다 */
export function CalendarList({
  listView,
  today,
  commentsByEvent,
  currentUser,
}: {
  listView: [string, GridItem[]][];
  today: string;
  commentsByEvent: Record<string, CommentRow[]>;
  currentUser: string;
}) {
  const [picked, setPicked] = useState<GridItem | null>(null);

  return (
    <>
      <div className="space-y-3 md:hidden">
        {listView.map(([date, items]) => (
          <div key={date} className={`card p-4 ${date === today ? 'border-brand-300' : ''}`}>
            <p className="mb-2 text-[13px] font-semibold text-ink-700 tnum">
              {날짜표시(date)}
              {date === today && <span className="ml-2 text-brand-600">오늘</span>}
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => {
                const n = item.eventId ? (commentsByEvent[item.eventId]?.length ?? 0) : 0;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => setPicked(item)}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      <span
                        className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[12px] font-semibold ${TONE[item.kind]}`}
                      >
                        {item.kind === 'holiday'
                          ? '휴일'
                          : item.kind === 'deadline'
                            ? '마감'
                            : item.kind === 'start'
                              ? '시작'
                              : (item.calendar ?? '일정')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink-800">
                        {item.label}
                        {n > 0 && <span className="ml-1 text-[12px] text-ink-400">💬{n}</span>}
                      </span>
                      {item.time && (
                        <span className="shrink-0 text-[12px] text-ink-400 tnum">{item.time}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {picked && (
        <DetailPopup
          item={picked}
          comments={picked.eventId ? (commentsByEvent[picked.eventId] ?? []) : []}
          currentUser={currentUser}
          onClose={() => setPicked(null)}
        />
      )}
    </>
  );
}
