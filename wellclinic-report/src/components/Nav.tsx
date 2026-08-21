'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * 알림은 이 목록에 넣지 않는다. 매일 드나드는 화면이 아니라 "왔는지 아닌지"만 알면 되는 것이라,
 * 메뉴 한 칸을 차지하는 대신 이름 옆 종 모양으로 뺐다. (아래 BellLink)
 */
const NAV = [
  { href: '/', label: '대시보드', icon: '▦' },
  { href: '/daily', label: '일일보고', icon: '✎' },
  { href: '/projects', label: '프로젝트', icon: '◈' },
  { href: '/calendar', label: '일정', icon: '▤' },
  { href: '/monthly', label: '월간보고', icon: '▣' },
  { href: '/metrics', label: '광고 성과', icon: '◔' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * 알림으로 가는 종 아이콘.
 * 안 읽은 것이 있으면 종 위에 빨간 점을 찍는다. 개수까지 적으면 좁은 자리에서 시끄러워서
 * "왔다" 만 점으로 알리고, 몇 건인지는 눌러서 들어간 화면에서 본다.
 */
function BellLink({ unread, onClick }: { unread: number; onClick?: () => void }) {
  const 왔음 = unread > 0;

  return (
    <Link
      href="/notifications"
      onClick={onClick}
      aria-label={왔음 ? `알림 ${unread}건` : '알림'}
      title={왔음 ? `확인하지 않은 피드백 ${unread}건` : '알림'}
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
        왔음 ? 'text-red-600 hover:bg-red-50' : 'text-ink-400 hover:bg-ink-50 hover:text-ink-700'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>

      {왔음 && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
      )}
    </Link>
  );
}

export function Sidebar({
  name,
  role,
  unread = 0,
}: {
  name: string;
  role: string;
  unread?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
      <div className="px-5 py-5">
        <p className="font-heading text-[15px] leading-tight text-ink-900">청주웰치과</p>
        <p className="text-[13px] text-ink-400">마케팅팀 업무 보고</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] font-semibold transition ${
              isActive(pathname, item.href)
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <span className="w-4 text-center text-[13px] opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-ink-100 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink-800">{name}</p>
            <p className="text-[12px] text-ink-400">{role}</p>
          </div>
          <BellLink unread={unread} />
        </div>
        <div className="mt-2 flex gap-3 text-[12px] text-ink-400">
          <Link href="/setup" className="hover:text-ink-700">
            설정
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="hover:text-ink-700">
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav({ name, unread = 0 }: { name: string; unread?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="no-print sticky top-0 z-30 border-b border-ink-200 bg-white lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="font-heading text-[14px] leading-tight text-ink-900">청주웰치과 마케팅팀</p>
          <p className="text-[12px] text-ink-400">{name}</p>
        </div>
        <div className="flex items-center gap-1">
          <BellLink unread={unread} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost px-3 py-1.5"
            aria-expanded={open}
            aria-label="메뉴 열기"
          >
            {open ? '닫기' : '메뉴'}
          </button>
        </div>
      </div>

      {open && (
        <nav className="grid grid-cols-2 gap-1 border-t border-ink-100 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center rounded-lg px-3 py-2 text-[14px] font-semibold ${
                isActive(pathname, item.href)
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/setup"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 text-[14px] font-semibold text-ink-500"
          >
            설정
          </Link>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-[14px] font-semibold text-ink-500"
            >
              로그아웃
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
