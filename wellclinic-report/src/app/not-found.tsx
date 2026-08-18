import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 text-center">
      <div>
        <h1 className="text-[22px] text-ink-900">찾는 화면이 없습니다</h1>
        <p className="mt-2 text-[14px] text-ink-500">주소가 바뀌었거나 삭제된 항목일 수 있습니다.</p>
        <Link href="/" className="btn-primary mt-5">
          대시보드로 가기
        </Link>
      </div>
    </main>
  );
}
