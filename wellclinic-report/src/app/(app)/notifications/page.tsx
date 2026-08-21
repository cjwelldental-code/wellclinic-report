import Link from 'next/link';
import { configuredMembers, requireSession } from '@/lib/auth';
import { lastReadAt, notificationsFor } from '@/lib/comments';
import { getComments, getDailyReports, getProjects, getReads } from '@/lib/data';
import { markNotificationsRead } from '@/app/actions';
import { ActionForm } from '@/components/ActionForm';
import { Multiline } from '@/components/Field';
import { Badge, Card, ConnectionError, Empty, PageHeader } from '@/components/ui';
import { TARGET_LABEL, type CommentTarget } from '@/lib/schema';

export const dynamic = 'force-dynamic';

function 시각(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export default async function NotificationsPage() {
  const session = await requireSession();

  const [commentRes, readRes, dailyRes, projectRes] = await Promise.all([
    getComments(),
    getReads(),
    getDailyReports(),
    getProjects(),
  ]);

  const list = notificationsFor({
    user: session.name,
    comments: commentRes.rows,
    reads: readRes.rows,
    daily: dailyRes.rows,
    projects: projectRes.rows,
    everyone: configuredMembers().map((m) => m.name),
  });

  const 새것 = list.filter((n) => n.unread);
  const 지난것 = list.filter((n) => !n.unread);
  const 확인시각 = lastReadAt(readRes.rows, session.name);

  return (
    <>
      <PageHeader
        title="알림"
        description="내 보고와 내 프로젝트에 달린 피드백을 모아 봅니다."
        actions={
          새것.length > 0 ? (
            <ActionForm action={markNotificationsRead} submitLabel="모두 확인" pendingLabel="처리 중…">
              <span className="sr-only">모든 알림을 확인 처리합니다</span>
            </ActionForm>
          ) : undefined
        }
      />

      <ConnectionError message={commentRes.error} />

      {list.length === 0 ? (
        <Card>
          <Empty href="/daily" cta="일일보고 보기">
            아직 받은 피드백이 없습니다.
          </Empty>
        </Card>
      ) : (
        <div className="space-y-6">
          {새것.length > 0 && (
            <section>
              <h2 className="mb-2 text-[14px] text-ink-500">
                새 피드백 <span className="font-semibold text-brand-700 tnum">{새것.length}</span>건
              </h2>
              <ul className="space-y-3">
                {새것.map((n) => (
                  <NotificationCard key={n.comment.id} n={n.comment} unread />
                ))}
              </ul>
            </section>
          )}

          {지난것.length > 0 && (
            <section>
              <h2 className="mb-2 text-[14px] text-ink-500">
                확인한 피드백
                {확인시각 && (
                  <span className="ml-2 text-[12px] text-ink-400 tnum">
                    {시각(확인시각)} 확인
                  </span>
                )}
              </h2>
              <ul className="space-y-3">
                {지난것.map((n) => (
                  <NotificationCard key={n.comment.id} n={n.comment} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-ink-400">
        일일보고에 달린 피드백은 그 보고를 쓴 사람에게, 프로젝트 피드백은 담당자에게 갑니다. 일정
        피드백은 모두에게 보입니다. 같은 글에 이미 코멘트를 남긴 사람에게도 이어지는 이야기가
        전달됩니다. 최근 30일치만 모읍니다.
      </p>
    </>
  );
}

function NotificationCard({
  n,
  unread = false,
}: {
  n: {
    id: string;
    대상종류: string;
    대상제목: string;
    링크: string;
    작성자: string;
    역할: string;
    내용: string;
    생성일시: string;
  };
  unread?: boolean;
}) {
  const 종류 = TARGET_LABEL[n.대상종류 as CommentTarget] ?? '기록';
  const 원장 = n.역할 === '원장';

  return (
    <li className={`card p-4 ${unread ? 'border-brand-300 bg-brand-50/40' : ''}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {unread && <Badge tone="brand">새 피드백</Badge>}
        <Badge tone="neutral">{종류}</Badge>
        <span className="min-w-0 truncate text-[14px] font-semibold text-ink-800">
          {n.대상제목 || '(제목 없음)'}
        </span>
        <span className="ml-auto text-[12px] text-ink-400 tnum">{시각(n.생성일시)}</span>
      </div>

      <Multiline text={n.내용} className="text-[15px] leading-relaxed text-ink-800" />

      <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-ink-100 pt-2.5">
        <p className="text-[13px] text-ink-500">
          <span className={`font-semibold ${원장 ? 'text-brand-700' : 'text-ink-700'}`}>
            {n.작성자}
          </span>
          {n.역할 && <span className="ml-1 text-ink-400">{n.역할}</span>}
        </p>
        {n.링크 && (
          <Link href={n.링크} className="text-[13px] font-semibold text-brand-600 hover:text-brand-800">
            원본 보기 →
          </Link>
        )}
      </div>
    </li>
  );
}
