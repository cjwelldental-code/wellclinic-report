import type { ReactNode } from 'react';

/** 폼 필드 묶음. 서버 컴포넌트에서 그대로 쓸 수 있게 상태를 갖지 않는다. */

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const map = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  } as const;
  return <div className={`grid gap-4 ${map[cols]}`}>{children}</div>;
}

export function Text({
  name,
  label,
  type = 'text',
  defaultValue = '',
  placeholder,
  required,
  min,
  max,
  step,
  hint,
}: {
  name: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'url' | 'month' | 'time';
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        className="field tnum"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
      />
      {hint && <p className="mt-1 text-[12px] text-ink-400">{hint}</p>}
    </div>
  );
}

/**
 * 30분 단위 시각 선택.
 *
 * type="time" 을 쓰면 브라우저 기본 시계가 1분 단위로 뜬다. 회의·면접·강의는 30분 단위로만
 * 잡히는데 분을 한 칸씩 굴려 맞추게 되고, 실수로 11:57 같은 값이 들어가기도 했다.
 * 목록으로 바꾸면 고를 수 있는 값 자체가 30분 단위가 된다.
 */
const HALF_HOURS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  const 오후 = h >= 12;
  const 열두시간 = h % 12 === 0 ? 12 : h % 12;
  return {
    value: `${String(h).padStart(2, '0')}:${m}`,
    label: `${오후 ? '오후' : '오전'} ${열두시간}:${m}`,
  };
});

export function TimeSelect({
  name,
  label,
  defaultValue = '',
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  hint?: string;
}) {
  const id = `f-${name}`;
  // 시트나 캘린더에서 30분 단위가 아닌 값이 들어와도 그 값을 잃지 않게 목록에 끼워 넣는다
  const options = HALF_HOURS.some((o) => o.value === defaultValue) || !defaultValue
    ? HALF_HOURS
    : [...HALF_HOURS, { value: defaultValue, label: defaultValue }].sort((a, b) =>
        a.value.localeCompare(b.value),
      );

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} name={name} className="field tnum" defaultValue={defaultValue}>
        <option value="">— 선택 —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-[12px] text-ink-400">{hint}</p>}
    </div>
  );
}

export function Select({
  name,
  label,
  options,
  labels,
  defaultValue = '',
  placeholder,
  required,
}: {
  name: string;
  label: string;
  options: readonly string[];
  /** 화면에 보일 이름. 값과 표시가 다를 때만 쓴다 (예: 캘린더 ID ↔ 캘린더 이름) */
  labels?: readonly string[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <select id={id} name={name} className="field" defaultValue={defaultValue} required={required}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o, i) => (
          <option key={o} value={o}>
            {labels?.[i] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Area({
  name,
  label,
  rows = 4,
  defaultValue = '',
  placeholder,
  required,
  hint,
}: {
  name: string;
  label: string;
  rows?: number;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        className="field"
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
      />
      {hint && <p className="mt-1 text-[12px] text-ink-400">{hint}</p>}
    </div>
  );
}

/** 줄바꿈을 그대로 보여주는 읽기 전용 표시 */
export function Multiline({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return <span className="text-ink-300">—</span>;
  return <p className={`whitespace-pre-wrap ${className}`}>{text}</p>;
}
