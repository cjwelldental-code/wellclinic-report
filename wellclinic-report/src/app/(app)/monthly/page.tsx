import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { saveMonthlyReport } from '@/app/actions';
import {
  formatNumber,
  formatWon,
  getDailyReports,
  getMetrics,
  getMonthlyReports,
  getProjects,
  metricsInMonth,
  reportsInMonth,
  sumMetrics,
} from '@/lib/data';
import { currentMonthKST, formatMonth, monthRange, shiftMonth } from '@/lib/date';
import { Badge, Card, ConnectionError, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { Area, Multiline } from '@/components/Field';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

/** 저장된 보고가 없을 때, 집계 결과로 초안을 만들어 채워 준다. */
function draftSummary(
  byProject: { name: string; lines: string[] }[],
  done: string[],
): string {
  const parts: string[] = [];
  if (done.length > 0) parts.push(`완료: ${done.join(', ')}`);
  for (const p of byProject.slice(0, 6)) {
    parts.push(`[${p.name}] ${p.lines.slice(0, 3).join(' / ')}`);
  }
  return parts.join('\n');
}

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await requireSession();
  const { m } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? '') ? (m as string) : currentMonthKST();
  const prev = shiftMonth(month, -1);
  const { start, end } = monthRange(month);

  const [dailyRes, projectRes, metricRes, monthlyRes] = await Promise.all([
    getDailyReports(),
    getProjects(),
    getMetrics(),
    getMonthlyReports(),
  ]);

  const dataError = dailyRes.error ?? projectRes.error ?? metricRes.error ?? monthlyRes.error;

  const reports = reportsInMonth(dailyRes.rows, month);
  const totals = sumMetrics(metricsInMonth(metricRes.rows, month));
  const prevTotals = sumMetrics(metricsInMonth(metricRes.rows, prev));

  // 작성자별 보고 일수
  const byWriter = [...new Set(reports.map((r) => r.작성자))].map((name) => ({
    name,
    days: new Set(reports.filter((r) => r.작성자 === name).map((r) => r.날짜)).size,
    hours: reports
      .filter((r) => r.작성자 === name)
      .reduce((s, r) => s + (Number(r.소요시간) || 0), 0),
  }));

  // 프로젝트별 업무 내역 롤업
  const byProject = [...new Set(reports.map((r) => r.프로젝트 || '기타'))]
    .map((name) => ({
      name,
      lines: [
        ...new Set(
          reports
            .filter((r) => (r.프로젝트 || '기타') === name)
            .flatMap((r) => r.한일.split('\n'))
            .map((l) => l.replace(/^[-•·\s]+/, '').trim())
            .filter(Boolean),
        ),
      ],
      hours: reports
        .filter((r) => (r.프로젝트 || '기타') === name)
        .reduce((s, r) => s + (Number(r.소요시간) || 0), 0),
    }))
    .sort((a, b) => b.lines.length - a.lines.length);

  // 이번 달에 마감이 잡혀 있던 프로젝트의 결과
  const monthProjects = projectRes.rows.filter(
    (p) => (p.마감일 >= start && p.마감일 <= end) || (p.시작일 >= start && p.시작일 <= end),
  );
  const completed = projectRes.rows
    .filter((p) => p.상태 === '완료' && p.마감일 >= start && p.마감일 <= end)
    .map((p) => p.이름);

  const issues = reports.filter((r) => r.이슈.trim()).map((r) => `${r.날짜} ${r.이슈}`);

  const saved = monthlyRes.rows.find((r) => r.연월 === month && r.작성자 === session.name);
  const others = monthlyRes.rows.filter((r) => r.연월 === month && r.작성자 !== session.name);

  const delta = (now: number, before: number) => {
    if (!before) return null;
    const pct = ((now - before) / before) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
  };

  const metricDraft = totals.비용
    ? [
        `광고비 ${formatWon(totals.비용)}`,
        `노출 ${formatNumber(totals.노출)}`,
        `클릭 ${formatNumber(totals.클릭)} (CTR ${totals.ctr.toFixed(2)}%)`,
        `문의 ${formatNumber(totals.문의)}건 (CPA ${formatWon(totals.cpa)})`,
        `예약 ${formatNumber(totals.예약)}건`,
      ].join('\n')
    : '';

  return (
    <>
      <PageHeader
        title="월간보고"
        description={`${formatMonth(month)} · 일일보고와 광고 성과가 자동으로 모입니다.`}
        actions={
          <div className="no-print flex items-center gap-2">
            <Link href={`/monthly?m=${shiftMonth(month, -1)}`} className="btn-ghost px-3">
              ←
            </Link>
            <span className="min-w-24 text-center font-heading text-[15px]">
              {formatMonth(month)}
            </span>
            <Link href={`/monthly?m=${shiftMonth(month, 1)}`} className="btn-ghost px-3">
              →
            </Link>
            <PrintButton />
          </div>
        }
      />

      <ConnectionError message={dataError} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="작성된 보고" value={reports.length} unit="건" hint={`${byWriter.length}명 참여`} />
        <Stat
          label="총 투입 시간"
          value={byWriter.reduce((s, w) => s + w.hours, 0)}
          unit="시간"
        />
        <Stat
          label="광고비"
          value={formatNumber(totals.비용)}
          unit="원"
          hint={delta(totals.비용, prevTotals.비용) ? `전월 대비 ${delta(totals.비용, prevTotals.비용)}` : '전월 자료 없음'}
        />
        <Stat
          label="문의"
          value={formatNumber(totals.문의)}
          unit="건"
          tone="brand"
          hint={totals.문의 ? `CPA ${formatWon(totals.cpa)}` : '기록 없음'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="프로젝트별 업무 내역" className="lg:col-span-2 print-plain">
          {byProject.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-ink-400">
              {formatMonth(month)}에 작성된 일일보고가 없습니다.
            </p>
          ) : (
            <div className="space-y-5">
              {byProject.map((p) => (
                <div key={p.name}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] text-ink-900">{p.name}</h3>
                    <Badge tone="neutral">{p.lines.length}건</Badge>
                    {p.hours > 0 && <Badge tone="neutral">{p.hours}시간</Badge>}
                  </div>
                  <ul className="list-disc space-y-0.5 pl-5 text-[14px] leading-relaxed text-ink-700 marker:text-ink-300">
                    {p.lines.map((line, i) => (
                      <li key={`${p.name}-${i}`}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="팀원별 기여">
          {byWriter.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-ink-400">기록 없음</p>
          ) : (
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-ink-100 text-left text-[12px] text-ink-400">
                  <th className="pb-2 font-semibold">팀원</th>
                  <th className="pb-2 text-right font-semibold">보고 일수</th>
                  <th className="pb-2 text-right font-semibold">시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {byWriter.map((w) => (
                  <tr key={w.name}>
                    <td className="py-2 font-semibold text-ink-800">{w.name}</td>
                    <td className="py-2 text-right tnum">{w.days}일</td>
                    <td className="py-2 text-right tnum">{w.hours}시간</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="이번 달 프로젝트">
          {monthProjects.length === 0 ? (
            <p className="py-6 text-center text-[14px] text-ink-400">
              이번 달에 시작·마감인 프로젝트가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {monthProjects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link
                    href={`/projects/${p.id}`}
                    className="truncate text-[14px] font-semibold text-ink-800"
                  >
                    {p.이름}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[12px] text-ink-400 tnum">{p.진행률 || 0}%</span>
                    <StatusBadge status={p.상태} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {issues.length > 0 && (
          <Card title={`한 달간 올라온 이슈 ${issues.length}건`} className="lg:col-span-2">
            <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-ink-700 marker:text-amber-400">
              {issues.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Card title={`${formatMonth(month)} 월간보고 작성`} className="no-print mt-5">
        <ActionForm action={saveMonthlyReport} submitLabel={saved ? '수정 저장' : '월간보고 저장'}>
          <input type="hidden" name="연월" value={month} />
          <Area
            name="성과요약"
            label="이달의 성과 요약"
            rows={6}
            defaultValue={saved?.성과요약 || draftSummary(byProject, completed)}
            hint="비어 있으면 위 집계로 초안을 채워 두었습니다. 다듬어서 저장하세요."
          />
          <Area
            name="주요지표"
            label="주요 지표"
            rows={5}
            defaultValue={saved?.주요지표 || metricDraft}
          />
          <Area
            name="다음달계획"
            label="다음 달 계획"
            rows={5}
            defaultValue={saved?.다음달계획}
            placeholder={'- 외국인 타깃 광고 심의 접수\n- 유튜브 Q&A 2편 촬영'}
          />
          <Area
            name="이슈및제안"
            label="이슈 · 제안"
            rows={4}
            defaultValue={saved?.이슈및제안}
            placeholder="원장님께 결정을 요청할 사항, 예산·인력 관련 건의"
          />
        </ActionForm>
      </Card>

      {saved && (
        <Card title={`제출본 · ${saved.작성자}`} className="mt-5 print-plain">
          <Section title="성과 요약" text={saved.성과요약} />
          <Section title="주요 지표" text={saved.주요지표} />
          <Section title="다음 달 계획" text={saved.다음달계획} />
          <Section title="이슈 · 제안" text={saved.이슈및제안} />
        </Card>
      )}

      {others.map((o) => (
        <Card key={o.id} title={`${o.작성자}의 월간보고`} className="mt-5 print-plain">
          <Section title="성과 요약" text={o.성과요약} />
          <Section title="주요 지표" text={o.주요지표} />
          <Section title="다음 달 계획" text={o.다음달계획} />
          <Section title="이슈 · 제안" text={o.이슈및제안} />
        </Card>
      ))}

      <form method="get" className="no-print mt-5 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label className="label" htmlFor="m">
            다른 달 보기
          </label>
          <input id="m" name="m" type="month" className="field tnum" defaultValue={month} />
        </div>
        <button type="submit" className="btn-ghost">
          이동
        </button>
      </form>
    </>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-1 text-[14px] text-ink-900">{title}</h3>
      <Multiline text={text} className="text-[14px] leading-relaxed text-ink-700" />
    </div>
  );
}
