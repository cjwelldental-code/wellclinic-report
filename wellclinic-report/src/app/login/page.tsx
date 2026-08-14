import { configuredMembers, getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getSession()) redirect('/');

  const { next } = await searchParams;
  const members = configuredMembers();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ink-50 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[22px] text-ink-900">청주웰치과 마케팅팀</h1>
          <p className="mt-1 text-[14px] text-ink-500">업무 보고 시스템</p>
        </div>

        <div className="card p-6">
          {members.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-ink-500">
              팀원 목록이 설정되지 않았습니다. Vercel 환경변수에 TEAM_MEMBERS 를 추가한 뒤 다시
              배포해 주세요.
            </p>
          ) : (
            <LoginForm members={members} next={next ?? '/'} />
          )}
        </div>

        <p className="mt-5 text-center text-[12px] text-ink-400">
          내부 전용 시스템입니다. 외부에 주소와 비밀번호를 공유하지 마세요.
        </p>
      </div>
    </main>
  );
}
