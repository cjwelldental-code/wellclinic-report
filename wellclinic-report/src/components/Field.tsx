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
 * 30분 단위 시각 입력.
 *
 * 목록으로 48칸을 늘어놓아 봤더니 자정부터 시작해서 오후 2시를 고르려면 한참 굴려야 했다.
 * 그냥 작은 시각칸 하나가 낫다. step 을 1800초로 두면 화살표와 브라우저 시계가 30분씩 움직이고,
 * 어긋난 값은 제출할 때 걸린다. 서버에서도 한 번 더 본다 (actions.ts 의 isHalfHour).
 */
export function TimeField({
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
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="time"
        step={1800}
        className="field tnum"
        defaultValue={defaultValue}
      />
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
