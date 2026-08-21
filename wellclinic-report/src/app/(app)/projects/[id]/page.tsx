import Link from 'next/link';
import { notFound } from 'next/navigation';
import { configuredMembers, requireSession } from '@/lib/auth';
import { deleteProject, saveProject } from '@/app/actions';
import { commentsFor } from '@/lib/comments';
import { Comments } from '@/components/Comments';
import { getComments, getDailyReports, getProjects } from '@/lib/data';
import { daysUntil, formatKorean } from '@/lib/date';
import { CLIENTS, PRIORITIES, PROJECT_STATUSES } from '@/lib/schema';
import {
  Badge,
  Card,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  Stat,
  StatusBadge,
} from '@/components/ui';
import { ActionForm, DeleteButton, Disclosure } from '@/components/ActionForm';
import { Area, Multiline, Row, Select, Text } from '@/components/Field';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [projectRes, dailyRes, commentRes] = await Promise.all([
    getProjects(),
    getDailyReports(),
    getComments(),
  ]);

  const project = projectRes.rows.find((p) => p.id === id);
  if (!project) notFound();

  const members = configuredMembers().map((m) => m.name);
  const logs = dailyRes.rows
    .filter((r) => r.프로젝트 === project.이름)
    .sort((a, b) => b.날짜.localeCompare(a.날짜));

  const totalHours = logs.reduce((sum, r) => sum + (Number(r.소요시간) || 0), 0);
  const contributors = [...new Set(logs.map((r) => r.작성자))];
  const d = daysUntil(project.마감일);
  const progress = Number(project.진행률) || 0;

  return (
    <>
      <PageHeader
        title={project.이름}
        description={project.목표 || project.설명 || '목표가 아직 정해지지 않았습니다.'}
        actions={
          <Link href="/projects" className="btn-ghost">
            목록으로
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <StatusBadge status={project.상태} />
        <PriorityBadge priority={project.우선순위} />
        <Badge tone="neutral">{project.클라이언트 || '웰치과'}</Badge>
        {project.담당자 && <Badge tone="blue">담당 {project.담당자}</Badge>}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="진행률" value={progress} unit="%" />
        <Stat
          label="마감"
          value={project.마감일 || '미정'}
          hint={
            project.마감일 && d !== null && project.상태 !== '완료'
              ? d < 0
                ? `${Math.abs(d)}일 지남`
                : `${d}일 남음`
              : undefined
          }
          tone={d !== null && d < 0 && project.상태 !== '완료' ? 'red' : 'neutral'}
        />
        <Stat label="누적 보고" value={logs.length} unit="건" />
        <Stat label="누적 시간" value={totalHours} unit="시간" hint={contributors.join(', ')} />
      </div>

      <div className="mb-5">
        <ProgressBar value={progress} />
      </div>

      <Card title="코멘트 · 피드백" className="mb-5">
        <Comments
          kind="project"
          targetId={project.id}
          targetTitle={project.이름}
          href={`/projects/${project.id}`}
          comments={commentsFor(commentRes.rows, 'project', project.id)}
          currentUser={session.name}
          compact
        />
        <p className="mt-3 text-[12px] text-ink-400">
          남긴 피드백은 담당자{project.담당자 ? ` (${project.담당자})` : ''}에게 알림으로 갑니다.
        </p>
      </Card>

      {project.설명 && (
        <Card title="설명" className="mb-5">
          <Multiline text={project.설명} className="text-[15px] leading-relaxed text-ink-700" />
          {project.링크 && (
            <a
              href={project.링크}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-block text-[13px] font-semibold text-brand-600 underline"
            >
              관련 링크 열기
            </a>
          )}
        </Card>
      )}

      <Disclosure label="프로젝트 정보 수정" openLabel="프로젝트 정보 수정">
        <ActionForm action={saveProject} submitLabel="수정 저장">
          <input type="hidden" name="id" value={project.id} />
          <Row cols={3}>
            <Text name="이름" label="프로젝트 이름" defaultValue={project.이름} required />
            <Select
              name="클라이언트"
              label="클라이언트"
              options={CLIENTS}
              defaultValue={project.클라이언트}
            />
            <Select
              name="담당자"
              label="담당자"
              options={members}
              defaultValue={project.담당자}
              placeholder="담당 미정"
            />
          </Row>
          <Row cols={4}>
            <Select
              name="상태"
              label="상태"
              options={PROJECT_STATUSES}
              defaultValue={project.상태}
            />
            <Select
              name="우선순위"
              label="우선순위"
              options={PRIORITIES}
              defaultValue={project.우선순위}
            />
            <Text name="시작일" label="시작일" type="date" defaultValue={project.시작일} />
            <Text name="마감일" label="마감일" type="date" defaultValue={project.마감일} />
          </Row>
          <Row cols={2}>
            <Text
              name="진행률"
              label="진행률 (%)"
              type="number"
              min={0}
              max={100}
              step={5}
              defaultValue={project.진행률}
            />
            <Text name="링크" label="관련 링크" type="url" defaultValue={project.링크} />
          </Row>
          <Text name="목표" label="목표" defaultValue={project.목표} />
          <Area name="설명" label="설명" rows={3} defaultValue={project.설명} />
        </ActionForm>

        <div className="mt-5 border-t border-ink-100 pt-4">
          <p className="mb-2 text-[13px] text-ink-500">
            프로젝트를 지워도 이미 작성된 일일보고는 남습니다.
          </p>
          <DeleteButton
            action={deleteProject}
            id={project.id}
            label="프로젝트 삭제"
            confirmText={`'${project.이름}' 프로젝트를 삭제할까요? 되돌릴 수 없습니다.`}
          />
        </div>
      </Disclosure>

      <Card title={`이 프로젝트 업무 기록 ${logs.length}건`} className="mt-5">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-ink-400">
            아직 이 프로젝트로 기록된 일일보고가 없습니다.
            <br />
            일일보고를 쓸 때 프로젝트를 &lsquo;{project.이름}&rsquo;으로 선택하면 여기에 모입니다.
          </p>
        ) : (
          <ol className="relative space-y-5 border-l border-ink-200 pl-5">
            {logs.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[25px] top-2 h-2 w-2 rounded-full bg-brand-400" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink-700 tnum">
                    {formatKorean(r.날짜)}
                  </span>
                  <Badge>{r.작성자}</Badge>
                  {r.소요시간 && <Badge tone="neutral">{r.소요시간}시간</Badge>}
                </div>
                <Multiline text={r.한일} className="mt-1 text-[14px] leading-relaxed text-ink-700" />
                {r.이슈 && (
                  <div className="mt-1.5 rounded-lg bg-amber-50 px-3 py-1.5">
                    <Multiline text={r.이슈} className="text-[13px] text-amber-800" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
