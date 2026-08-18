'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-md text-center">
        <h1 className="text-[22px] text-ink-900">문제가 생겼습니다</h1>
        <p className="mt-2 break-all text-[14px] text-ink-500">{error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">
            다시 시도
          </button>
          <Link href="/setup" className="btn-ghost">
            연결 설정 확인
          </Link>
        </div>
      </div>
    </main>
  );
}
