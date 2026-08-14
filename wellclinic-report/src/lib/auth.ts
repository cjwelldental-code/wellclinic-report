import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

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

/** TEAM_MEMBERS="이하늘:팀장,홍길동:디자이너" 형식 */
export function configuredMembers(): { name: string; role: string }[] {
  const raw = process.env.TEAM_MEMBERS ?? '';
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, role] = entry.split(':').map((s) => s.trim());
      return { name, role: role || '팀원' };
    });
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
