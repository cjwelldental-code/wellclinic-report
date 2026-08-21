import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { ROSTER, type Member } from './members';

const COOKIE = 'wc_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30일

export interface Session {
  name: string;
  role: string;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET 환경변수(16자 이상)가 필요합니다. SETUP.md를 확인하세요.');
  }
  return new TextEncoder().encode(s);
}

/**
 * 로그인·작성자 목록. src/lib/members.ts 의 명단을 그대로 쓴다.
 * 예전에 쓰던 TEAM_MEMBERS 환경변수는 더 이상 보지 않는다. (members.ts 주석 참고)
 */
export function configuredMembers(): Member[] {
  return [...ROSTER];
}

export async function createSession(name: string, role: string): Promise<void> {
  const token = await new SignJWT({ name, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { name: String(payload.name), role: String(payload.role) };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  return session;
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.TEAM_PASSWORD;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  // 길이가 같을 때만 상수시간 비교
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
