import { configuredMembers } from '@/lib/auth';
import { deleteCompliance, saveCompliance } from '@/app/actions';
import { getCompliance } from '@/lib/data';
import { daysUntil, todayKST } from '@/lib/date';
import { CHANNELS, COMPLIANCE_STATUSES } from '@/lib/schema';
import { Badge, Card, ConnectionError, Empty, PageHeader, Stat, StatusBadge } from '@/components/ui';
import { ActionForm, DeleteButton, Disclosure } from '@/components/ActionForm';
import { Area, Row, Select, Text } from '@/components/Field';

export const dynamic = 'force-dynamic';

/**
 * 의료광고 사전심의(의료법 제56조) 대상 소재를 관리한다.
 * 심의번호와 유효기간을 놓치면 집행 자체가 위험해지므로 만료 임박을 눈에 띄게 둔다.
 */
export default async function CompliancePage() {
  const res = await getCompliance();
  const members = configuredMembers().map((m) => m.name);
  const today = todayKST();

  const items = [...res.rows].sort((a, b) => {
    const rank = (s: string) => (s === '승인' ? 0 : s === '심의중' ? 1 : 2);
    if (rank(a.상태) !== rank(b.상태)) return rank(a.상태) - rank(b.상태);
    return (a.만료일 || '9999').localeCompare(b.만료일 || '9999');
  });

  const expiring = items.filter((c) => {
    const d = daysUntil(c.만료일);
    return c.상태 === '승인' && d !== null && d <= 30;
  });
  const inReview = items.filter((c) => c.상태 === '심의중');
  const approved = items.filter((c) => c.상태 === '승인');

  return (
    <>
      <PageHeader
        title="의료광고 심의 관리"
        description="심의번호와 유효기간을 관리합니다. 만료 30일 전부터 대시보드에 알림이 뜹니다."
      />

      <ConnectionError message={res.error} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="심의 진행 중" value={inReview.length} unit="건" />
        <Stat label="승인 · 집행 가능" value={approved.length} unit="건" tone="brand" />
        <Stat
          label="만료 임박 · 경과"
          value={expiring.length}
          unit="건"
          tone={expiring.length > 0 ? 'red' : 'neutral'}
          hint="30일 이내"
        />
      </div>

      <div className="mb-5 rounded-xl border border-ink-200 bg-white px-5 py-4 text-[13px] leading-relaxed text-ink-600">
        <p className="mb-1 font-heading text-[14px] text-ink-800">기록해 두면 좋은 것</p>
        <ul className="list-disc space-y-0.5 pl-5 marker:text-ink-300">
          <li>임플란트 비심의 크리에이티브는 상태를 &lsquo;승인&rsquo; 대신 비고에 비심의 근거를 남깁니다.</li>
          <li>외국인 대상 인지도 광고는 심의 대상이므로 접수 시점부터 등록합니다.</li>
          <li>심의번호는 소재에 표기해야 하므로 매체별로 따로 관리합니다.</li>
        </ul>
      </div>

      <Disclosure label="심의 건 등록" openLabel="심의 건 등록">
        <ActionForm action={saveCompliance} submitLabel="등록" resetOnSuccess>
          <Row cols={3}>
            <Text name="소재명" label="소재명" required placeholder="예: 외국인 임플란트 인지도 영상 A" />
            <Select name="매체" label="매체" options={CHANNELS} placeholder="선택" />
            <Select name="상태" label="상태" options={COMPLIANCE_STATUSES} defaultValue="심의중" />
          </Row>
          <Row cols={4}>
            <Text name="심의번호" label="심의번호" placeholder="승인 후 입력" />
            <Text name="심의일" label="심의일" type="date" />
            <Text name="만료일" label="만료일" type="date" hint="보통 심의일로부터 1년" />
            <Select name="담당자" label="담당자" options={members} placeholder="선택" />
          </Row>
          <Area name="비고" label="비고" rows={2} placeholder="비심의 근거, 반려 사유, 재심의 계획" />
        </ActionForm>
      </Disclosure>

      {expiring.length > 0 && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-heading text-[15px] text-red-700">
            유효기간을 확인해야 하는 소재 {expiring.length}건
          </p>
          <ul className="mt-2 space-y-1 text-[14px] text-red-700 tnum">
            {expiring.map((c) => {
              const d = daysUntil(c.만료일)!;
              return (
                <li key={c.id}>
                  {c.소재명} · {c.만료일} ·{' '}
                  {d < 0 ? `${Math.abs(d)}일 지남` : d === 0 ? '오늘 만료' : `${d}일 남음`}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Card title={`심의 목록 ${items.length}건`}>
        {items.length === 0 ? (
          <Empty>등록된 심의 건이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((c) => {
              const d = daysUntil(c.만료일);
              const danger = c.상태 === '승인' && d !== null && d <= 30;
              return (
                <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold text-ink-900">{c.소재명}</span>
                    <StatusBadge status={c.상태} />
                    {c.매체 && <Badge tone="blue">{c.매체}</Badge>}
                    {c.담당자 && <Badge>{c.담당자}</Badge>}
                  </div>

                  <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-ink-500 tnum">
                    {c.심의번호 && (
                      <div>
                        <dt className="inline">심의번호 </dt>
                        <dd className="inline font-semibold text-ink-700">{c.심의번호}</dd>
                      </div>
                    )}
                    {c.심의일 && (
                      <div>
                        <dt className="inline">심의일 </dt>
                        <dd className="inline">{c.심의일}</dd>
                      </div>
                    )}
                    {c.만료일 && (
                      <div>
                        <dt className="inline">만료 </dt>
                        <dd className={`inline ${danger ? 'font-semibold text-red-600' : ''}`}>
                          {c.만료일}
                          {d !== null && c.상태 === '승인' &&
                            (d < 0 ? ` (${Math.abs(d)}일 지남)` : ` (${d}일 남음)`)}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {c.비고 && <p className="mt-1.5 text-[13px] text-ink-500">{c.비고}</p>}

                  <details className="no-print mt-3">
                    <summary className="cursor-pointer text-[13px] font-semibold text-ink-500">
                      수정 · 삭제
                    </summary>
                    <div className="mt-3 rounded-lg border border-ink-200 p-4">
                      <ActionForm action={saveCompliance} submitLabel="수정 저장">
                        <input type="hidden" name="id" value={c.id} />
                        <Row cols={3}>
                          <Text name="소재명" label="소재명" defaultValue={c.소재명} required />
                          <Select
                            name="매체"
                            label="매체"
                            options={CHANNELS}
                            defaultValue={c.매체}
                            placeholder="선택"
                          />
                          <Select
                            name="상태"
                            label="상태"
                            options={COMPLIANCE_STATUSES}
                            defaultValue={c.상태}
                          />
                        </Row>
                        <Row cols={4}>
                          <Text name="심의번호" label="심의번호" defaultValue={c.심의번호} />
                          <Text name="심의일" label="심의일" type="date" defaultValue={c.심의일} />
                          <Text name="만료일" label="만료일" type="date" defaultValue={c.만료일} />
                          <Select
                            name="담당자"
                            label="담당자"
                            options={members}
                            defaultValue={c.담당자}
                            placeholder="선택"
                          />
                        </Row>
                        <Area name="비고" label="비고" rows={2} defaultValue={c.비고} />
                      </ActionForm>
                      <div className="mt-4 border-t border-ink-100 pt-3">
                        <DeleteButton action={deleteCompliance} id={c.id} />
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="mt-5 text-[12px] text-ink-400">기준일 {today}</p>
    </>
  );
}
