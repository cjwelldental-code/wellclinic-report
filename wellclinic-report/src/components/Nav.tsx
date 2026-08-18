'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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

export function Sidebar({ name, role }: { name: string; role: string }) {
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
        <p className="text-[14px] font-semibold text-ink-800">{name}</p>
        <p className="text-[12px] text-ink-400">{role}</p>
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

export function MobileNav({ name }: { name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="no-print sticky top-0 z-30 border-b border-ink-200 bg-white lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="font-heading text-[14px] leading-tight text-ink-900">청주웰치과 마케팅팀</p>
          <p className="text-[12px] text-ink-400">{name}</p>
        </div>
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

      {open && (
        <nav className="grid grid-cols-2 gap-1 border-t border-ink-100 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2 text-[14px] font-semibold ${
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
