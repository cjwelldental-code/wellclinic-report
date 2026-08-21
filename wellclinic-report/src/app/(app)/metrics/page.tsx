import Link from 'next/link';
import { Fragment } from 'react';
import {
  buildSeries,
  dailySpend,
  formatNumber,
  formatWon,
  getAdSpend,
  getBalances,
  getLeads,
  getRevenue,
  latestBalances,
  leadTotal,
  leadsInMonth,
  monthSummary,
  num,
  revenueSnapshot,
  spendSnapshot,
  sumLeads,
  type Bucket,
} from '@/lib/data';
import { currentMonthKST, formatKorean, formatMonth, shiftMonth } from '@/lib/date';
import { LEAD_SOURCES } from '@/lib/schema';
import { Badge, Card, ConnectionError, Empty, PageHeader, Stat } from '@/components/ui';
import { PrintButton } from '@/components/PrintButton';
import { TrendChart } from '@/components/Chart';

export const dynamic = 'force-dynamic';

const BUCKETS = [
  { key: 'day', label: '일별' },
  { key: 'week', label: '주별' },
  { key: 'month', label: '월별' },
] as const;

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; v?: string }>;
}) {
  const { m, v } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? '') ? (m as string) : currentMonthKST();
  const prev = shiftMonth(month, -1);
  const bucket: Bucket = v === 'week' || v === 'month' ? v : 'day';

  const [spendRes, revenueRes, leadRes, balanceRes] = await Promise.all([
    getAdSpend(),
    getRevenue(),
    getLeads(),
    getBalances(),
  ]);

  const error = spendRes.error ?? revenueRes.error ?? leadRes.error ?? balanceRes.error;

  const summary = monthSummary(spendRes.rows, revenueRes.rows, leadRes.rows, month);
  const prevSummary = monthSummary(spendRes.rows, revenueRes.rows, leadRes.rows, prev);
  const spend = spendSnapshot(spendRes.rows, month);
  const revenue = revenueSnapshot(revenueRes.rows, month);
  const leads = leadsInMonth(leadRes.rows, month);
  const leadTotals = sumLeads(leads);
  const daily = dailySpend(spendRes.rows, month);
  const balances = latestBalances(balanceRes.rows);

  const hasData = summary.광고비 > 0 || summary.확정매출 > 0 || leads.length > 0;

  const series = buildSeries(bucket, spendRes.rows, revenueRes.rows, leadRes.rows, month);
  const bucketName = BUCKETS.find((b) => b.key === bucket)!.label;
  const isMonthly = bucket === 'month';

  const cov = summary.coverage;
  // 빠진 날이 많으면 다 나열하지 않고 앞쪽만 보여 준다
  const missingLabel =
    cov.빠진날짜.length > 10
      ? `${cov.빠진날짜.slice(0, 8).map((d) => formatKorean(d, false)).join(', ')} 외 ${cov.빠진날짜.length - 8}일`
      : cov.빠진날짜.map((d) => formatKorean(d, false)).join(', ');

  const delta = (now: number, before: number) => {
    if (!before) return undefined;
    const pct = ((now - before) / before) * 100;
    return `전월 대비 ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
  };

  return (
    <>
      <PageHeader
        title="광고 성과"
        description="매일 아침 자동 수집된 광고비 · 매출 · 신규 DB를 모아 봅니다."
        actions={
          <div className="no-print flex items-center gap-2">
            <Link href={`/metrics?m=${shiftMonth(month, -1)}`} className="btn-ghost px-3">
              ←
            </Link>
            <span className="min-w-24 text-center font-heading text-[15px]">
              {formatMonth(month)}
            </span>
            <Link href={`/metrics?m=${shiftMonth(month, 1)}`} className="btn-ghost px-3">
              →
            </Link>
            <PrintButton />
          </div>
        }
      />

      <ConnectionError message={error} />

      {!error && !hasData && (
        <Card className="mb-5">
          <Empty href="/setup" cta="연동 방법 보기">
            {formatMonth(month)} 자료가 아직 없습니다. 매일 아침 자동 수집이 한 번 돌면 채워집니다.
          </Empty>
        </Card>
      )}

      <div className="mb-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="이번 달 광고비"
          value={formatNumber(summary.광고비)}
          unit="원"
          hint={delta(summary.광고비, prevSummary.광고비)}
        />
        <Stat
          label="확정매출"
          value={formatNumber(summary.확정매출)}
          unit="원"
          hint={delta(summary.확정매출, prevSummary.확정매출)}
        />
        <Stat
          label="ROAS"
          value={summary.roas ? `${summary.roas.toFixed(1)}배` : '—'}
          tone={summary.roas >= 1 ? 'brand' : summary.roas > 0 ? 'red' : 'neutral'}
          hint={prevSummary.roas ? `전월 ${prevSummary.roas.toFixed(1)}배` : '전월 자료 없음'}
        />
        <Stat
          label="신규 DB"
          value={formatNumber(summary.신규DB)}
          unit="건"
          tone={cov.빠진날짜.length > 0 ? 'red' : 'neutral'}
          hint={
            cov.시작
              ? `${formatKorean(cov.시작, false)}~${formatKorean(cov.끝!, false)} · ${cov.수집일수}일치`
              : '수집 자료 없음'
          }
        />
        <Stat
          label="DB 단가"
          value={summary.dbCost !== null ? formatNumber(summary.dbCost) : '—'}
          unit={summary.dbCost !== null ? '원' : undefined}
          hint={
            summary.dbCost === null && summary.신규DB > 0
              ? '수집 누락으로 계산 보류'
              : summary.결과
                ? `광고 결과 ${formatNumber(summary.결과)}건`
                : undefined
          }
        />
      </div>

      {summary.기록일 && (
        <p className="mb-4 text-[12px] text-ink-400 tnum">
          최종 수집 {formatKorean(summary.기록일)} 기준
        </p>
      )}

      {cov.빠진날짜.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
          신규 DB가 {cov.기대일수}일 중 {cov.수집일수}일치만 들어와 있어 이 달 합계는 실제보다
          적습니다. 아침 수집을 한 번 돌리면 채워집니다.
          <span className="ml-1 tnum opacity-80">(빠진 날 {missingLabel})</span>
        </div>
      )}

      <Card
        title={`${isMonthly ? '월별' : `${formatMonth(month)} ${bucketName}`} 추이`}
        className="mb-5"
        action={
          <div className="no-print flex gap-1">
            {BUCKETS.map((b) => (
              <Link
                key={b.key}
                href={`/metrics?m=${month}&v=${b.key}`}
                className={`rounded-md px-2.5 py-1 text-[13px] font-semibold ${
                  bucket === b.key
                    ? 'bg-brand-600 text-white'
                    : 'border border-ink-200 bg-white text-ink-600'
                }`}
              >
                {b.label}
              </Link>
            ))}
          </div>
        }
      >
        <TrendChart
          points={series}
          lineKey={isMonthly ? '확정매출' : '광고비'}
          lineLabel={isMonthly ? '확정매출' : '광고비'}
        />

        {series.length > 0 && (
          <div className="-mx-5 mt-4 overflow-x-auto px-5">
            <table className="w-full min-w-[560px] text-[14px]">
              <thead>
                <tr className="border-b border-ink-200 text-left text-[12px] text-ink-400">
                  <th className="pb-2 font-semibold">{isMonthly ? '월' : '기간'}</th>
                  <th className="pb-2 text-right font-semibold">신규 DB</th>
                  <th className="pb-2 text-right font-semibold">광고비</th>
                  <th className="pb-2 text-right font-semibold">DB 단가</th>
                  {isMonthly && <th className="pb-2 text-right font-semibold">확정매출</th>}
                  {isMonthly && <th className="pb-2 text-right font-semibold">ROAS</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tnum">
                {[...series].reverse().map((p) => (
                  <tr key={p.key}>
                    <td className="py-2.5 font-semibold text-ink-700">{p.label}</td>
                    <td className="py-2.5 text-right">{p.신규DB || '·'}</td>
                    <td className="py-2.5 text-right text-ink-600">
                      {p.광고비 !== null ? formatNumber(p.광고비) : '—'}
                    </td>
                    <td className="py-2.5 text-right text-ink-500">
                      {p.dbCost !== null ? formatNumber(p.dbCost) : '—'}
                    </td>
                    {isMonthly && (
                      <td className="py-2.5 text-right font-semibold text-brand-700">
                        {p.확정매출 !== null ? formatNumber(p.확정매출) : '—'}
                      </td>
                    )}
                    {isMonthly && (
                      <td className="py-2.5 text-right">
                        {p.roas !== null ? `${p.roas.toFixed(1)}배` : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isMonthly && (
              <p className="mt-3 text-[12px] text-ink-400">
                광고비는 아침에 기록된 누적액의 차이로 계산합니다. 수집이 연달아 없는 구간은 —로
                둡니다. 확정매출은 달 단위로만 집계되어 월별 보기에서 확인하실 수 있습니다.
              </p>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-5">
        {/* ---------------- 광고비 ---------------- */}
        <Card title="광고비 상세">
          {spend.byMedium.length === 0 ? (
            <Empty>수집된 광고비 자료가 없습니다.</Empty>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[560px] text-[14px]">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-[12px] text-ink-400">
                    <th className="pb-2 font-semibold">매체 · 캠페인</th>
                    <th className="pb-2 text-right font-semibold">지출</th>
                    <th className="pb-2 text-right font-semibold">결과</th>
                    <th className="pb-2 text-right font-semibold">결과당 비용</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {spend.byMedium.map((medium) => (
                    <Fragment key={medium.매체}>
                      {medium.lines.map((line) => (
                        <tr key={`${medium.매체}-${line.캠페인}`} className="border-b border-ink-50">
                          <td className="py-2 pl-3 text-ink-600">
                            <span className="mr-2 text-[11px] text-ink-300">
                              {medium.매체}
                            </span>
                            {line.캠페인}
                          </td>
                          <td className="py-2 text-right">{formatNumber(line.지출)}</td>
                          <td className="py-2 text-right">{formatNumber(line.결과)}</td>
                          <td className="py-2 text-right">
                            {line.결과 ? formatNumber(line.cpa) : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b border-ink-200 bg-ink-50/60 font-semibold">
                        <td className="py-2 pl-3">{medium.매체} 소계</td>
                        <td className="py-2 text-right">{formatNumber(medium.지출)}</td>
                        <td className="py-2 text-right">{formatNumber(medium.결과)}</td>
                        <td className="py-2 text-right">
                          {medium.결과 ? formatNumber(medium.cpa) : '—'}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink-300 font-semibold tnum">
                    <td className="pt-2.5">전체 합계</td>
                    <td className="pt-2.5 text-right">{formatNumber(spend.지출)}</td>
                    <td className="pt-2.5 text-right">{formatNumber(spend.결과)}</td>
                    <td className="pt-2.5 text-right">
                      {spend.결과 ? formatNumber(spend.cpa) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="mt-3 text-[12px] text-ink-400">
                구글 소계는 일시중지 캠페인까지 포함한 계정 전체 합계라 위 캠페인 합과 다를 수
                있습니다.
              </p>
            </div>
          )}
        </Card>

        {/* ---------------- 매출 ---------------- */}
        <Card title="확정매출 현황">
          {revenue.lines.length === 0 ? (
            <Empty>수집된 매출 자료가 없습니다.</Empty>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[760px] text-[14px]">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-[12px] text-ink-400">
                    <th className="pb-2 font-semibold">채널</th>
                    <th className="pb-2 text-right font-semibold">예약</th>
                    <th className="pb-2 text-right font-semibold">취소</th>
                    <th className="pb-2 text-right font-semibold">내원</th>
                    <th className="pb-2 text-right font-semibold">내원율</th>
                    <th className="pb-2 text-right font-semibold">수술동의</th>
                    <th className="pb-2 text-right font-semibold">동의율</th>
                    <th className="pb-2 text-right font-semibold">견적</th>
                    <th className="pb-2 text-right font-semibold">확정매출</th>
                    <th className="pb-2 text-right font-semibold">수납</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 tnum">
                  {revenue.lines.map((l) => (
                    <tr key={l.채널}>
                      <td className="py-2.5 font-semibold text-ink-800">{l.채널}</td>
                      <td className="py-2.5 text-right">{l.예약}</td>
                      <td className="py-2.5 text-right text-ink-400">{l.예약취소}</td>
                      <td className="py-2.5 text-right">{l.내원}</td>
                      <td className="py-2.5 text-right text-ink-500">
                        {l.내원율 ? `${l.내원율.toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right">{l.수술동의}</td>
                      <td className="py-2.5 text-right text-ink-500">
                        {l.동의율 ? `${l.동의율.toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-ink-500">
                        {formatNumber(l.견적금액)}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-brand-700">
                        {formatNumber(l.확정매출)}
                      </td>
                      <td className="py-2.5 text-right">{formatNumber(l.수납금액)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-ink-300 font-semibold tnum">
                    <td className="pt-2.5">합계</td>
                    <td className="pt-2.5 text-right">{revenue.합계.예약}</td>
                    <td className="pt-2.5 text-right">{revenue.합계.예약취소}</td>
                    <td className="pt-2.5 text-right">{revenue.합계.내원}</td>
                    <td className="pt-2.5 text-right">
                      {revenue.합계.내원율 ? `${revenue.합계.내원율.toFixed(0)}%` : '—'}
                    </td>
                    <td className="pt-2.5 text-right">{revenue.합계.수술동의}</td>
                    <td className="pt-2.5 text-right">
                      {revenue.합계.동의율 ? `${revenue.합계.동의율.toFixed(0)}%` : '—'}
                    </td>
                    <td className="pt-2.5 text-right">{formatNumber(revenue.합계.견적금액)}</td>
                    <td className="pt-2.5 text-right text-brand-700">
                      {formatNumber(revenue.합계.확정매출)}
                    </td>
                    <td className="pt-2.5 text-right">{formatNumber(revenue.합계.수납금액)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        {/* ---------------- 신규 DB ---------------- */}
        <Card title={`신규 DB · ${formatMonth(month)}`}>
          {leads.length === 0 ? (
            <Empty>수집된 신규 DB 자료가 없습니다.</Empty>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {LEAD_SOURCES.map((s) => (
                  <Badge key={s} tone={leadTotals.bySource[s] > 0 ? 'brand' : 'neutral'}>
                    {s} {leadTotals.bySource[s]}건
                  </Badge>
                ))}
              </div>

              <details className="group">
                <summary className="mb-3 cursor-pointer list-none text-[13px] font-semibold text-brand-600">
                  <span className="group-open:hidden">날짜별로 자세히 보기 ({leads.length}일)</span>
                  <span className="hidden group-open:inline">접기</span>
                </summary>

                <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[560px] text-[14px]">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-[12px] text-ink-400">
                      <th className="pb-2 font-semibold">날짜</th>
                      {LEAD_SOURCES.map((s) => (
                        <th key={s} className="pb-2 text-right font-semibold">
                          {s}
                        </th>
                      ))}
                      <th className="pb-2 text-right font-semibold">합계</th>
                      <th className="pb-2 text-right font-semibold">광고비</th>
                      <th className="pb-2 text-right font-semibold">DB 단가</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 tnum">
                    {leads.map((r) => {
                      const total = leadTotal(r);
                      const spent = daily.get(r.날짜) ?? null;
                      return (
                        <tr key={r.id}>
                          <td className="py-2.5 font-semibold text-ink-700">
                            {formatKorean(r.날짜)}
                          </td>
                          {LEAD_SOURCES.map((s) => (
                            <td key={s} className="py-2.5 text-right text-ink-600">
                              {num(r[s]) || '·'}
                            </td>
                          ))}
                          <td className="py-2.5 text-right font-semibold">{total}</td>
                          <td className="py-2.5 text-right text-ink-500">
                            {spent !== null ? formatNumber(spent) : '—'}
                          </td>
                          <td className="py-2.5 text-right text-ink-500">
                            {spent !== null && total > 0 ? formatNumber(spent / total) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink-300 font-semibold tnum">
                      <td className="pt-2.5">합계</td>
                      {LEAD_SOURCES.map((s) => (
                        <td key={s} className="pt-2.5 text-right">
                          {leadTotals.bySource[s]}
                        </td>
                      ))}
                      <td className="pt-2.5 text-right">{leadTotals.total}</td>
                      <td className="pt-2.5 text-right">{formatNumber(summary.광고비)}</td>
                      <td className="pt-2.5 text-right">
                        {summary.dbCost ? formatNumber(summary.dbCost) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="mt-3 text-[12px] text-ink-400">
                  하루 광고비는 아침에 기록된 누적액의 차이로 계산합니다. 그날 수집이 없으면 —로
                  표시됩니다.
                </p>
                </div>
              </details>
            </>
          )}
        </Card>

        {/* ---------------- 청구 잔액 ---------------- */}
        <Card title="광고 계정 청구 잔액">
          {balances.length === 0 ? (
            <Empty>수집된 잔액 자료가 없습니다.</Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {balances.map((b) => (
                <div key={b.매체} className="rounded-lg border border-ink-200 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] font-semibold text-ink-800">{b.매체}</span>
                    <span className="font-heading text-[20px] text-ink-900 tnum">
                      {formatWon(num(b.잔액))}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-0.5 text-[13px] text-ink-500">
                    {num(b.예상세금) > 0 && (
                      <div className="flex justify-between">
                        <dt>예상 세금</dt>
                        <dd className="tnum">{formatWon(num(b.예상세금))}</dd>
                      </div>
                    )}
                    {b.결제수단 && (
                      <div className="flex justify-between gap-3">
                        <dt>결제수단</dt>
                        <dd className="truncate text-right">{b.결제수단}</dd>
                      </div>
                    )}
                    {b.다음결제 && (
                      <div className="flex justify-between gap-3">
                        <dt>다음 결제</dt>
                        <dd className="truncate text-right">{b.다음결제}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt>수집일</dt>
                      <dd className="tnum">{b.기록일}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

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
