import Link from 'next/link';
import { configuredMembers } from '@/lib/auth';
import { saveProject } from '@/app/actions';
import { getDailyReports, getProjects } from '@/lib/data';
import { daysUntil, todayKST } from '@/lib/date';
import { CLIENTS, PRIORITIES, PROJECT_STATUSES } from '@/lib/schema';
import {
  Card,
  ConnectionError,
  Empty,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
} from '@/components/ui';
import { ActionForm, Disclosure } from '@/components/ActionForm';
import { Area, Row, Select, Text } from '@/components/Field';

export const dynamic = 'force-dynamic';

const ORDER: Record<string, number> = { 진행중: 0, 검수: 1, 기획: 2, 보류: 3, 완료: 4 };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ 상태?: string }>;
}) {
  const { 상태: statusFilter } = await searchParams;
  const [projectRes, dailyRes] = await Promise.all([getProjects(), getDailyReports()]);

  const members = configuredMembers().map((m) => m.name);
  const today = todayKST();

  const reportCount = new Map<string, number>();
  for (const r of dailyRes.rows) {
    if (!r.프로젝트) continue;
    reportCount.set(r.프로젝트, (reportCount.get(r.프로젝트) ?? 0) + 1);
  }

  const projects = [...projectRes.rows]
    .filter((p) => !statusFilter || p.상태 === statusFilter)
    .sort((a, b) => {
      const oa = ORDER[a.상태] ?? 9;
      const ob = ORDER[b.상태] ?? 9;
      if (oa !== ob) return oa - ob;
      return (a.마감일 || '9999').localeCompare(b.마감일 || '9999');
    });

  const counts = PROJECT_STATUSES.map((s) => ({
    status: s,
    n: projectRes.rows.filter((p) => p.상태 === s).length,
  }));

  return (
    <>
      <PageHeader
        title="프로젝트"
        description="진행 중인 일과 담당, 마감을 한자리에서 봅니다."
      />

      <ConnectionError message={projectRes.error} />

      <Disclosure label="새 프로젝트 등록" openLabel="새 프로젝트 등록">
        <ActionForm action={saveProject} submitLabel="프로젝트 등록" resetOnSuccess>
          <Row cols={3}>
            <Text name="이름" label="프로젝트 이름" required placeholder="예: 외국인 타깃 광고" />
            <Select name="클라이언트" label="클라이언트" options={CLIENTS} defaultValue="웰치과" />
            <Select
              name="담당자"
              label="담당자"
              options={members}
              placeholder="담당 미정"
            />
          </Row>
          <Row cols={4}>
            <Select name="상태" label="상태" options={PROJECT_STATUSES} defaultValue="기획" />
            <Select name="우선순위" label="우선순위" options={PRIORITIES} defaultValue="보통" />
            <Text name="시작일" label="시작일" type="date" defaultValue={today} />
            <Text name="마감일" label="마감일" type="date" />
          </Row>
          <Row cols={2}>
            <Text
              name="진행률"
              label="진행률 (%)"
              type="number"
              min={0}
              max={100}
              step={5}
              defaultValue="0"
            />
            <Text name="링크" label="관련 링크" type="url" placeholder="드라이브·시안 주소" />
          </Row>
          <Text
            name="목표"
            label="목표"
            placeholder="예: 9월까지 외국인 신환 문의 월 15건"
            hint="숫자로 적으면 월간보고에서 판단하기 쉬워집니다."
          />
          <Area name="설명" label="설명" rows={3} placeholder="배경, 범위, 주의할 점" />
        </ActionForm>
      </Disclosure>

      <div className="no-print mb-5 flex flex-wrap gap-2">
        <Link
          href="/projects"
          className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
            !statusFilter ? 'bg-brand-600 text-white' : 'border border-ink-200 bg-white text-ink-600'
          }`}
        >
          전체 {projectRes.rows.length}
        </Link>
        {counts.map(({ status, n }) => (
          <Link
            key={status}
            href={`/projects?상태=${encodeURIComponent(status)}`}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${
              statusFilter === status
                ? 'bg-brand-600 text-white'
                : 'border border-ink-200 bg-white text-ink-600'
            }`}
          >
            {status} {n}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card>
          <Empty>등록된 프로젝트가 없습니다. 위에서 새로 등록해 주세요.</Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const d = daysUntil(p.마감일);
            const progress = Number(p.진행률) || 0;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5 transition hover:border-brand-300">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[16px] text-ink-900">{p.이름}</h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PriorityBadge priority={p.우선순위} />
                    <StatusBadge status={p.상태} />
                  </div>
                </div>

                {p.목표 && <p className="mt-1 text-[13px] text-ink-500">{p.목표}</p>}

                <div className="mt-3">
                  <ProgressBar value={progress} />
                </div>

                <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-400 tnum">
                  <div>
                    <dt className="inline">담당 </dt>
                    <dd className="inline font-semibold text-ink-600">{p.담당자 || '미정'}</dd>
                  </div>
                  <div>
                    <dt className="inline">진행 </dt>
                    <dd className="inline font-semibold text-ink-600">{progress}%</dd>
                  </div>
                  {p.마감일 && (
                    <div>
                      <dt className="inline">마감 </dt>
                      <dd
                        className={`inline font-semibold ${
                          d !== null && d < 3 && p.상태 !== '완료' ? 'text-red-600' : 'text-ink-600'
                        }`}
                      >
                        {p.마감일}
                        {d !== null &&
                          p.상태 !== '완료' &&
                          (d < 0 ? ` (${Math.abs(d)}일 지남)` : ` (${d}일 남음)`)}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline">보고 </dt>
                    <dd className="inline font-semibold text-ink-600">
                      {reportCount.get(p.이름) ?? 0}건
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
