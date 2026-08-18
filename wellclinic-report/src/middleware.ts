import { NextResponse, type NextRequest } from 'next/server';

/**
 * 세션 쿠키가 없으면 로그인 화면으로 보낸다.
 * 토큰 검증은 서버 컴포넌트(getSession)에서 하고, 여기서는 존재 여부만 본다.
 * (미들웨어는 Edge 런타임이라 무거운 검증을 두지 않는다)
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('wc_session');
  const { pathname, search } = request.nextUrl;

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 아래를 제외한 모든 경로를 보호한다:
     * login, api/auth, api/ingest(토큰으로 따로 인증), _next 정적 자산, favicon
     */
    '/((?!login|api/auth|api/ingest|_next/static|_next/image|favicon.ico).*)',
  ],
};
