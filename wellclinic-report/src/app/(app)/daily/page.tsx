import Link from 'next/link';
import { requireSession, configuredMembers } from '@/lib/auth';
import { deleteDailyReport, saveDailyReport } from '@/app/actions';
import { activeProjects, getDailyReports, getProjects, reportsInRange } from '@/lib/data';
import { addDays, formatKorean, todayKST } from '@/lib/date';
import { Badge, Card, ConnectionError, Empty, PageHeader } from '@/components/ui';
import { ActionForm, DeleteButton, Disclosure } from '@/components/ActionForm';
import { Area, Multiline, Row, Select, Text } from '@/components/Field';

export const dynamic = 'force-dynamic';

interface Params {
  작성자?: string;
  프로젝트?: string;
  from?: string;
  to?: string;
  edit?: string;
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const today = todayKST();

  const from = params.from || addDays(today, -30);
  const to = params.to || today;

  const [dailyRes, projectRes] = await Promise.all([getDailyReports(), getProjects()]);

  const projectNames = activeProjects(projectRes.rows).map((p) => p.이름);
  const allProjectNames = [...new Set([...projectNames, ...projectRes.rows.map((p) => p.이름)])];
  const memberNames = configuredMembers().map((m) => m.name);

  let rows = reportsInRange(dailyRes.rows, from, to);
  if (params.작성자) rows = rows.filter((r) => r.작성자 === params.작성자);
  if (params.프로젝트) rows = rows.filter((r) => r.프로젝트 === params.프로젝트);

  const editing = params.edit ? dailyRes.rows.find((r) => r.id === params.edit) : undefined;

  // 날짜별로 묶어서 보여준다
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.날짜, [...(byDate.get(r.날짜) ?? []), r]);

  const myTotalHours = rows
    .filter((r) => r.작성자 === session.name)
    .reduce((sum, r) => sum + (Number(r.소요시간) || 0), 0);

  return (
    <>
      <PageHeader
        title="일일보고"
        description="하루 한 번, 오늘 한 일과 내일 계획을 남깁니다."
      />

      <ConnectionError message={dailyRes.error} />

      {editing ? (
        <Card title={`${formatKorean(editing.날짜)} 보고 수정`} className="mb-5">
          <ActionForm action={saveDailyReport} submitLabel="수정 저장">
            <input type="hidden" name="id" value={editing.id} />
            <Row cols={3}>
              <Text name="날짜" label="날짜" type="date" defaultValue={editing.날짜} required />
              <Select
                name="프로젝트"
                label="프로젝트"
                options={allProjectNames}
                defaultValue={editing.프로젝트}
                placeholder="선택 안 함"
              />
              <Text
                name="소요시간"
                label="소요시간 (시간)"
                type="number"
                step="0.5"
                min={0}
                defaultValue={editing.소요시간}
              />
            </Row>
            <Area name="한일" label="오늘 한 일" rows={5} defaultValue={editing.한일} required />
            <Area name="내일계획" label="내일 계획" rows={3} defaultValue={editing.내일계획} />
            <Area name="이슈" label="이슈 · 공유 사항" rows={2} defaultValue={editing.이슈} />
          </ActionForm>
          <div className="mt-4 border-t border-ink-100 pt-4">
            <Link href="/daily" className="btn-ghost">
              수정 취소
            </Link>
          </div>
        </Card>
      ) : (
        <Disclosure label="오늘 보고 작성하기" openLabel="오늘 보고 작성" defaultOpen>
          <ActionForm action={saveDailyReport} submitLabel="보고 저장" resetOnSuccess>
            <Row cols={3}>
              <Text name="날짜" label="날짜" type="date" defaultValue={today} required />
              <Select
                name="프로젝트"
                label="프로젝트"
                options={allProjectNames}
                placeholder="선택 안 함"
              />
              <Text
                name="소요시간"
                label="소요시간 (시간)"
                type="number"
                step="0.5"
                min={0}
                placeholder="예: 3.5"
              />
            </Row>
            <Area
              name="한일"
              label="오늘 한 일"
              rows={5}
              required
              placeholder={'- 외국인 타깃 광고 소재 3종 시안 작업\n- 모두닥 CPV 캠페인 입찰가 조정'}
              hint="한 줄에 하나씩 적으면 월간보고에서 그대로 모입니다."
            />
            <Area name="내일계획" label="내일 계획" rows={3} placeholder="내일 우선으로 처리할 일" />
            <Area
              name="이슈"
              label="이슈 · 공유 사항"
              rows={2}
              placeholder="막힌 부분, 원장님 요청, 결정이 필요한 사항"
            />
          </ActionForm>
        </Disclosure>
      )}

      <Card className="mb-5">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div>
            <label className="label" htmlFor="q-writer">
              작성자
            </label>
            <select id="q-writer" name="작성자" className="field" defaultValue={params.작성자 ?? ''}>
              <option value="">전체</option>
              {memberNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q-project">
              프로젝트
            </label>
            <select
              id="q-project"
              name="프로젝트"
              className="field"
              defaultValue={params.프로젝트 ?? ''}
            >
              <option value="">전체</option>
              {allProjectNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q-from">
              시작일
            </label>
            <input id="q-from" name="from" type="date" className="field tnum" defaultValue={from} />
          </div>
          <div>
            <label className="label" htmlFor="q-to">
              종료일
            </label>
            <input id="q-to" name="to" type="date" className="field tnum" defaultValue={to} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              조회
            </button>
            <Link href="/daily" className="btn-ghost">
              초기화
            </Link>
          </div>
        </form>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
        <span>
          보고 <span className="font-semibold text-ink-800 tnum">{rows.length}</span>건
        </span>
        <span>
          내 소요시간 합계{' '}
          <span className="font-semibold text-ink-800 tnum">{myTotalHours}</span>시간
        </span>
      </div>

      {rows.length === 0 ? (
        <Card>
          <Empty>조건에 맞는 보고가 없습니다.</Empty>
        </Card>
      ) : (
        <div className="space-y-5">
          {[...byDate.entries()].map(([date, list]) => (
            <section key={date}>
              <h2 className="mb-2 text-[14px] text-ink-500 tnum">{formatKorean(date)}</h2>
              <div className="space-y-3">
                {list.map((r) => (
                  <article key={r.id} className="card p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge>{r.작성자}</Badge>
                      {r.프로젝트 && <Badge tone="brand">{r.프로젝트}</Badge>}
                      {r.소요시간 && <Badge tone="neutral">{r.소요시간}시간</Badge>}
                    </div>

                    <Multiline text={r.한일} className="text-[15px] leading-relaxed text-ink-800" />

                    {r.내일계획 && (
                      <div className="mt-3 border-t border-ink-100 pt-3">
                        <p className="text-[12px] font-semibold text-ink-400">내일 계획</p>
                        <Multiline text={r.내일계획} className="text-[14px] text-ink-600" />
                      </div>
                    )}

                    {r.이슈 && (
                      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
                        <p className="text-[12px] font-semibold text-amber-700">이슈 · 공유</p>
                        <Multiline text={r.이슈} className="text-[14px] text-amber-800" />
                      </div>
                    )}

                    {r.작성자 === session.name && (
                      <div className="no-print mt-4 flex items-center gap-2 border-t border-ink-100 pt-3">
                        <Link href={`/daily?edit=${r.id}`} className="btn-ghost px-3 py-1.5 text-[13px]">
                          수정
                        </Link>
                        <DeleteButton action={deleteDailyReport} id={r.id} />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
