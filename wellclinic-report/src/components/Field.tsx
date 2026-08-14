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
  type?: 'text' | 'date' | 'number' | 'url' | 'month';
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

export function Select({
  name,
  label,
  options,
  defaultValue = '',
  placeholder,
  required,
}: {
  name: string;
  label: string;
  options: readonly string[];
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
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
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
