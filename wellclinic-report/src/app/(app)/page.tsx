import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import {
  activeProjects,
  formatCompactWon,
  getAdSpend,
  getDailyReports,
  getLeads,
  getProjects,
  getRevenue,
  monthSummary,
  reportsInRange,
} from '@/lib/data';
import { listEvents } from '@/lib/calendar';
import {
  addDays,
  currentMonthKST,
  daysUntil,
  formatKorean,
  formatMonth,
  startOfWeek,
  todayKST,
} from '@/lib/date';
import {
  Badge,
  Card,
  ConnectionError,
  Empty,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { Multiline } from '@/components/Field';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireSession();
  const today = todayKST();
  const month = currentMonthKST();
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);

  const [projectsRes, dailyRes, spendRes, revenueRes, leadRes, calendarRes] = await Promise.all([
    getProjects(),
    getDailyReports(),
    getAdSpend(),
    getRevenue(),
    getLeads(),
    listEvents(today, addDays(today, 13)),
  ]);

  const dataError = projectsRes.error ?? dailyRes.error ?? spendRes.error ?? revenueRes.error;

  const running = activeProjects(projectsRes.rows);
  const myWeek = reportsInRange(dailyRes.rows, weekStart, weekEnd).filter(
    (r) => r.작성자 === session.name,
  );
  const writtenToday = myWeek.some((r) => r.날짜 === today);
  const recent = reportsInRange(dailyRes.rows, addDays(today, -14), today).slice(0, 6);
  const summary = monthSummary(spendRes.rows, revenueRes.rows, leadRes.rows, month);

  // 마감이 2주 안으로 남았거나 이미 지난 진행 프로젝트
  const dueSoon = running
    .filter((p) => {
      const d = daysUntil(p.마감일);
      return d !== null && d <= 14;
    })
    .sort((a, b) => a.마감일.localeCompare(b.마감일)) // 급한 순
    .slice(0, 5);

  // 구글 캘린더 일정 + 프로젝트 마감일을 한 줄에 섞어 보여준다
  const upcoming = [
    ...calendarRes.events.map((e) => ({
      key: e.id,
      date: e.start,
      time: e.time,
      label: e.title,
      tag: e.calendar,
      href: e.link,
    })),
    ...running
      .filter((p) => p.마감일 >= today && p.마감일 <= addDays(today, 13))
      .map((p) => ({
        key: `p-${p.id}`,
        date: p.마감일,
        time: '',
        label: `${p.이름} 마감`,
        tag: '프로젝트',
        href: `/projects/${p.id}`,
      })),
  ]
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title={`안녕하세요, ${session.name}님`}
        description={`${formatKorean(today)} · 오늘도 좋은 하루 보내세요`}
        actions={
          <Link href="/daily" className={writtenToday ? 'btn-ghost' : 'btn-primary'}>
            {writtenToday ? '오늘 보고 보기' : '오늘 보고 쓰기'}
          </Link>
        }
      />

      <ConnectionError message={dataError} />

      {!writtenToday && !dataError && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
          <p className="text-[14px] font-semibold text-brand-800">
            오늘 일일보고가 아직 비어 있습니다.
          </p>
          <Link href="/daily" className="btn-primary">
            지금 작성하기
          </Link>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="진행 중 프로젝트" value={running.length} unit="건" />
        <Stat
          label="이번 주 내 보고"
          value={myWeek.length}
          unit="일"
          hint={`${formatKorean(weekStart, false)} ~ ${formatKorean(weekEnd, false)}`}
        />
        <Stat
          label={`${formatMonth(month)} 광고비`}
          value={summary.광고비 ? formatCompactWon(summary.광고비) : '—'}
          unit={summary.광고비 ? '원' : undefined}
          hint={
            summary.기록일 ? `${formatKorean(summary.기록일, false)} 수집 기준` : '수집 자료 없음'
          }
        />
        <Stat
          label="이번 달 ROAS"
          value={summary.roas ? `${summary.roas.toFixed(1)}배` : '—'}
          tone={summary.roas >= 1 ? 'brand' : summary.roas > 0 ? 'red' : 'neutral'}
          hint={
            summary.확정매출
              ? `확정매출 ${formatCompactWon(summary.확정매출)}원`
              : '매출 수집 전'
          }
        />
      </div>

      {summary.coverage.빠진날짜.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-[13px] text-amber-800">
            아침 수집이 {summary.coverage.빠진날짜.length}일치 밀려 있습니다. 한 번 돌리면 채워집니다.
          </p>
          <Link href="/metrics" className="btn-ghost shrink-0">
            자세히
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="진행 중인 프로젝트"
          action={
            <Link href="/projects" className="text-[13px] font-semibold text-brand-600">
              전체 보기
            </Link>
          }
        >
          {running.length === 0 ? (
            <Empty href="/projects" cta="프로젝트 등록하기">
              등록된 진행 프로젝트가 없습니다.
            </Empty>
          ) : (
            <ul className="space-y-4">
              {running.slice(0, 5).map((p) => {
                const d = daysUntil(p.마감일);
                return (
                  <li key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="truncate text-[14px] font-semibold text-ink-800 hover:text-brand-700"
                      >
                        {p.이름}
                      </Link>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <PriorityBadge priority={p.우선순위} />
                        <StatusBadge status={p.상태} />
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={Number(p.진행률) || 0} />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-ink-400 tnum">
                      <span>{p.담당자 || '담당 미정'}</span>
                      {p.마감일 && (
                        <span className={d !== null && d < 3 ? 'font-semibold text-red-500' : ''}>
                          마감 {p.마감일}
                          {d !== null && (d < 0 ? ` (${Math.abs(d)}일 지남)` : ` (${d}일 남음)`)}
                        </span>
                      )}
                      <span>{Number(p.진행률) || 0}%</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="앞으로 2주 일정"
          action={
            <Link href="/calendar" className="text-[13px] font-semibold text-brand-600">
              달력 보기
            </Link>
          }
        >
          {calendarRes.error && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              구글 캘린더를 불러오지 못했습니다. {calendarRes.error}
            </p>
          )}
          {upcoming.length === 0 ? (
            <Empty>다가오는 일정이 없습니다.</Empty>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((e) => (
                <li key={e.key} className="flex items-baseline gap-3">
                  <span className="w-24 shrink-0 text-[12px] font-semibold text-ink-400 tnum">
                    {formatKorean(e.date)}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] text-ink-800">
                    {e.href?.startsWith('/') ? (
                      <Link href={e.href} className="hover:text-brand-700">
                        {e.label}
                      </Link>
                    ) : (
                      e.label
                    )}
                    {e.time && <span className="ml-1.5 text-[12px] text-ink-400 tnum">{e.time}</span>}
                  </span>
                  <Badge tone={e.tag === '프로젝트' ? 'amber' : 'blue'}>{e.tag}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="팀 최근 보고"
          action={
            <Link href="/daily" className="text-[13px] font-semibold text-brand-600">
              전체 보기
            </Link>
          }
          className="lg:col-span-2"
        >
          {recent.length === 0 ? (
            <Empty href="/daily" cta="일일보고 쓰기">
              최근 2주간 작성된 보고가 없습니다.
            </Empty>
          ) : (
            <ul className="divide-y divide-ink-100">
              {recent.map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink-700 tnum">
                      {formatKorean(r.날짜)}
                    </span>
                    <Badge>{r.작성자}</Badge>
                    {r.프로젝트 && <Badge tone="brand">{r.프로젝트}</Badge>}
                  </div>
                  <Multiline text={r.한일} className="mt-1 text-[14px] leading-relaxed text-ink-700" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {dueSoon.length > 0 && (
        <div className="mt-5">
          <Card title="마감 임박 · 지난 프로젝트">
            <ul className="divide-y divide-ink-100">
              {dueSoon.map((p) => {
                const d = daysUntil(p.마감일)!;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link
                      href={`/projects/${p.id}`}
                      className="truncate text-[14px] font-semibold text-ink-800 hover:text-brand-700"
                    >
                      {p.이름}
                    </Link>
                    <span
                      className={`shrink-0 text-[13px] tnum ${
                        d < 0 ? 'font-semibold text-red-600' : 'text-ink-500'
                      }`}
                    >
                      {d < 0 ? `${Math.abs(d)}일 지남` : d === 0 ? '오늘 마감' : `${d}일 남음`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
