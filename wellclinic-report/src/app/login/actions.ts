'use server';

import { redirect } from 'next/navigation';
import { checkPassword, configuredMembers, createSession } from '@/lib/auth';

export interface LoginState {
  error: string | null;
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const name = String(form.get('name') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');

  const members = configuredMembers();
  if (members.length === 0) {
    return { error: 'TEAM_MEMBERS 환경변수가 비어 있습니다. SETUP.md를 확인하세요.' };
  }

  const member = members.find((m) => m.name === name);
  if (!member) return { error: '팀원을 선택해 주세요.' };

  if (!checkPassword(password)) {
    return { error: '비밀번호가 맞지 않습니다.' };
  }

  await createSession(member.name, member.role);

  // 외부 주소로 튕기지 않도록 내부 경로만 허용한다.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}
