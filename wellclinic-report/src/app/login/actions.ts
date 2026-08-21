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
    return { error: '이름 목록이 비어 있습니다. src/lib/members.ts 의 ROSTER 를 확인하세요.' };
  }

  const member = members.find((m) => m.name === name);
  if (!member) return { error: '이름을 선택해 주세요.' };

  if (!checkPassword(password)) {
    return { error: '비밀번호가 맞지 않습니다.' };
  }

  await createSession(member.name, member.role);

  // 외부 주소로 튕기지 않도록 내부 경로만 허용한다.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}
