import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { MobileNav, Sidebar } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-dvh">
      <Sidebar name={session.name} role={session.role} />
      <div className="min-w-0 flex-1">
        <MobileNav name={session.name} />
        <main className="mx-auto max-w-6xl px-5 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
