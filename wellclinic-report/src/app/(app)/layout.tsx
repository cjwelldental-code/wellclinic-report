import { redirect } from 'next/navigation';
import { configuredMembers, getSession } from '@/lib/auth';
import { notificationsFor, unreadCount } from '@/lib/comments';
import { getComments, getDailyReports, getProjects, getReads } from '@/lib/data';
import { MobileNav, Sidebar } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  // 안 읽은 피드백 개수. 시트를 못 읽어도 화면은 그대로 떠야 하므로 0 으로 넘긴다.
  const [comments, reads, daily, projects] = await Promise.all([
    getComments(),
    getReads(),
    getDailyReports(),
    getProjects(),
  ]);

  const unread = unreadCount(
    notificationsFor({
      user: session.name,
      comments: comments.rows,
      reads: reads.rows,
      daily: daily.rows,
      projects: projects.rows,
      everyone: configuredMembers().map((m) => m.name),
    }),
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar name={session.name} role={session.role} unread={unread} />
      <div className="min-w-0 flex-1">
        <MobileNav name={session.name} unread={unread} />
        <main className="mx-auto max-w-6xl px-5 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
