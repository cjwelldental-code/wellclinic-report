import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl text-ink-900">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          {title && <h2 className="text-[15px] text-ink-800">{title}</h2>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES = {
  neutral: 'bg-ink-100 text-ink-600',
  brand: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-sky-50 text-sky-700',
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  기획: 'blue',
  진행중: 'brand',
  검수: 'amber',
  완료: 'green',
  보류: 'neutral',
  심의중: 'amber',
  승인: 'green',
  반려: 'red',
  만료: 'red',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status || '미정'}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (!priority || priority === '보통') return null;
  return <Badge tone={priority === '높음' ? 'red' : 'neutral'}>{priority}</Badge>;
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: Tone;
}) {
  const accent =
    tone === 'red' ? 'text-red-600' : tone === 'brand' ? 'text-brand-700' : 'text-ink-900';
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[13px] font-semibold text-ink-500">{label}</p>
      <p className={`mt-1 font-heading text-[22px] leading-tight tnum ${accent}`}>
        {value}
        {unit && <span className="ml-0.5 text-[14px] font-semibold text-ink-400">{unit}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[12px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function Empty({ children, href, cta }: { children: ReactNode; href?: string; cta?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-[14px] text-ink-400">{children}</p>
      {href && cta && (
        <Link href={href} className="btn-ghost mt-3">
          {cta}
        </Link>
      )}
    </div>
  );
}

/** 시트/캘린더 연결이 안 됐을 때 화면을 죽이지 않고 상황을 알린다. */
export function ConnectionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
      <p className="font-semibold">데이터를 불러오지 못했습니다.</p>
      <p className="mt-0.5 break-all opacity-80">{message}</p>
      <Link href="/setup" className="mt-2 inline-block font-semibold underline">
        연결 설정 확인하기
      </Link>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
