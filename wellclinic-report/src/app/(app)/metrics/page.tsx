import Link from 'next/link';
import { deleteMetric, saveMetric } from '@/app/actions';
import {
  formatNumber,
  formatWon,
  getMetrics,
  getProjects,
  groupMetricsByChannel,
  metricsInMonth,
  sumMetrics,
} from '@/lib/data';
import { currentMonthKST, formatMonth, shiftMonth, todayKST } from '@/lib/date';
import { CHANNELS } from '@/lib/schema';
import { Card, ConnectionError, Empty, PageHeader, Stat } from '@/components/ui';
import { ActionForm, DeleteButton, Disclosure } from '@/components/ActionForm';
import { Area, Row, Select, Text } from '@/components/Field';

export const dynamic = 'force-dynamic';

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? '') ? (m as string) : currentMonthKST();
  const prev = shiftMonth(month, -1);

  const [metricRes, projectRes] = await Promise.all([getMetrics(), getProjects()]);

  const rows = metricsInMonth(metricRes.rows, month).sort((a, b) => b.날짜.localeCompare(a.날짜));
  const totals = sumMetrics(rows);
  const prevTotals = sumMetrics(metricsInMonth(metricRes.rows, prev));
  const byChannel = groupMetricsByChannel(rows);
  const campaignNames = [...new Set(projectRes.rows.map((p) => p.이름))];

  const delta = (now: number, before: number) => {
    if (!before) return undefined;
    const pct = ((now - before) / before) * 100;
    return `전월 대비 ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
  };

  return (
    <>
      <PageHeader
        title="광고 성과"
        description="매체별 집행 결과를 기록하면 월간보고 지표가 자동으로 채워집니다."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/metrics?m=${shiftMonth(month, -1)}`} className="btn-ghost px-3">
              ←
            </Link>
            <span className="min-w-24 text-center font-heading text-[15px]">
              {formatMonth(month)}
            </span>
            <Link href={`/metrics?m=${shiftMonth(month, 1)}`} className="btn-ghost px-3">
              →
            </Link>
          </div>
        }
      />

      <ConnectionError message={metricRes.error} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="광고비" value={formatNumber(totals.비용)} unit="원" hint={delta(totals.비용, prevTotals.비용)} />
        <Stat label="노출" value={formatNumber(totals.노출)} />
        <Stat
          label="클릭"
          value={formatNumber(totals.클릭)}
          hint={totals.노출 ? `CTR ${totals.ctr.toFixed(2)}%` : undefined}
        />
        <Stat
          label="문의"
          value={formatNumber(totals.문의)}
          unit="건"
          tone="brand"
          hint={totals.문의 ? `CPA ${formatWon(totals.cpa)}` : undefined}
        />
        <Stat
          label="예약"
          value={formatNumber(totals.예약)}
          unit="건"
          hint={totals.문의 ? `전환 ${((totals.예약 / totals.문의) * 100).toFixed(0)}%` : undefined}
        />
      </div>

      <Disclosure label="성과 기록 추가" openLabel="성과 기록 추가">
        <ActionForm action={saveMetric} submitLabel="기록 저장" resetOnSuccess>
          <Row cols={3}>
            <Text name="날짜" label="기준일" type="date" defaultValue={todayKST()} required />
            <Select name="매체" label="매체" options={CHANNELS} required placeholder="선택" />
            <Select
              name="캠페인"
              label="캠페인 · 프로젝트"
              options={campaignNames}
              placeholder="직접 입력 안 함"
            />
          </Row>
          <Row cols={4}>
            <Text name="노출" label="노출" type="number" min={0} placeholder="0" />
            <Text name="클릭" label="클릭" type="number" min={0} placeholder="0" />
            <Text name="비용" label="비용 (원)" type="number" min={0} placeholder="0" />
            <Text name="문의" label="문의" type="number" min={0} placeholder="0" />
          </Row>
          <Row cols={2}>
            <Text name="예약" label="예약 전환" type="number" min={0} placeholder="0" />
            <div />
          </Row>
          <Area name="메모" label="메모" rows={2} placeholder="소재 교체, 입찰 조정 등 참고 사항" />
        </ActionForm>
      </Disclosure>

      <Card title="매체별 요약" className="mb-5">
        {byChannel.length === 0 ? (
          <Empty>{formatMonth(month)}에 기록된 성과가 없습니다.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="border-b border-ink-200 text-left text-[12px] text-ink-400">
                  <th className="pb-2 font-semibold">매체</th>
                  <th className="pb-2 text-right font-semibold">비용</th>
                  <th className="pb-2 text-right font-semibold">노출</th>
                  <th className="pb-2 text-right font-semibold">클릭</th>
                  <th className="pb-2 text-right font-semibold">CTR</th>
                  <th className="pb-2 text-right font-semibold">문의</th>
                  <th className="pb-2 text-right font-semibold">CPA</th>
                  <th className="pb-2 text-right font-semibold">예약</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 tnum">
                {byChannel.map(({ 매체, totals: t }) => (
                  <tr key={매체}>
                    <td className="py-2.5 font-semibold text-ink-800">{매체}</td>
                    <td className="py-2.5 text-right">{formatNumber(t.비용)}</td>
                    <td className="py-2.5 text-right">{formatNumber(t.노출)}</td>
                    <td className="py-2.5 text-right">{formatNumber(t.클릭)}</td>
                    <td className="py-2.5 text-right">{t.ctr.toFixed(2)}%</td>
                    <td className="py-2.5 text-right font-semibold text-brand-700">
                      {formatNumber(t.문의)}
                    </td>
                    <td className="py-2.5 text-right">{t.문의 ? formatNumber(t.cpa) : '—'}</td>
                    <td className="py-2.5 text-right">{formatNumber(t.예약)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 font-semibold tnum">
                  <td className="pt-2.5">합계</td>
                  <td className="pt-2.5 text-right">{formatNumber(totals.비용)}</td>
                  <td className="pt-2.5 text-right">{formatNumber(totals.노출)}</td>
                  <td className="pt-2.5 text-right">{formatNumber(totals.클릭)}</td>
                  <td className="pt-2.5 text-right">{totals.ctr.toFixed(2)}%</td>
                  <td className="pt-2.5 text-right text-brand-700">{formatNumber(totals.문의)}</td>
                  <td className="pt-2.5 text-right">
                    {totals.문의 ? formatNumber(totals.cpa) : '—'}
                  </td>
                  <td className="pt-2.5 text-right">{formatNumber(totals.예약)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title={`기록 ${rows.length}건`}>
        {rows.length === 0 ? (
          <Empty>기록이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="w-24 shrink-0 text-[13px] font-semibold text-ink-600 tnum">
                  {r.날짜}
                </span>
                <span className="w-16 shrink-0 text-[13px] font-semibold text-ink-800">{r.매체}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-500">
                  {r.캠페인 || '—'}
                  {r.메모 && <span className="ml-2 text-ink-400">{r.메모}</span>}
                </span>
                <span className="text-[13px] text-ink-600 tnum">
                  비용 {formatNumber(Number(r.비용) || 0)} · 문의 {r.문의 || 0}
                </span>
                <DeleteButton action={deleteMetric} id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
