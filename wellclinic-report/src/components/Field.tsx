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
 * 15분 단위 시각 선택. 구글 캘린더와 같은 간격이다.
 *
 * 96칸이라 목록이 길지만, 화면을 여는 시점의 값이 이미 "지금 다음 칸" 으로 잡혀 있어서
 * 목록을 펴면 브라우저가 그 자리로 스크롤해 준다. 자정부터 굴려 내려올 일이 없다.
 */
const QUARTERS: { value: string; label: string }[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const 오후 = h >= 12;
  const 열두시간 = h % 12 === 0 ? 12 : h % 12;
  return {
    value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    label: `${오후 ? '오후' : '오전'} ${열두시간}:${String(m).padStart(2, '0')}`,
  };
});

export function TimeSelect({
  name,
  label,
  defaultValue = '',
  emptyLabel = '— 없음 —',
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  /** 빈 값을 골랐을 때의 뜻을 적는다 (시작 시각을 비우면 종일 일정) */
  emptyLabel?: string;
  hint?: string;
}) {
  const id = `f-${name}`;
  // 캘린더에 15분에서 어긋난 일정이 이미 있으면 그 값도 목록에 끼워 넣어 잃지 않게 한다
  const options =
    !defaultValue || QUARTERS.some((o) => o.value === defaultValue)
      ? QUARTERS
      : [...QUARTERS, { value: defaultValue, label: defaultValue }].sort((a, b) =>
          a.value.localeCompare(b.value),
        );

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} name={name} className="field tnum" defaultValue={defaultValue}>
        <option value="">{emptyLabel}</option>
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

/**
 * 일정 색깔. 구글 캘린더가 쓰는 11가지를 그대로 쓴다.
 *
 * 값은 구글의 colorId 라서 여기서 고른 색이 팀원 각자의 구글 캘린더에도 똑같이 보인다.
 * 라디오 버튼이라 자바스크립트 없이 동작하고, 이 화면은 서버 컴포넌트로 남는다.
 */
export const EVENT_COLORS: { id: string; name: string; hex: string }[] = [
  { id: '7', name: '공작', hex: '#039be5' },
  { id: '9', name: '블루베리', hex: '#3f51b5' },
  { id: '1', name: '라벤더', hex: '#7986cb' },
  { id: '3', name: '포도', hex: '#8e24aa' },
  { id: '11', name: '토마토', hex: '#d50000' },
  { id: '4', name: '플라밍고', hex: '#e67c73' },
  { id: '6', name: '귤', hex: '#f4511e' },
  { id: '5', name: '바나나', hex: '#f6bf26' },
  { id: '2', name: '세이지', hex: '#33b679' },
  { id: '10', name: '바질', hex: '#0b8043' },
  { id: '8', name: '그래파이트', hex: '#616161' },
];

export function ColorPicker({
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
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5 py-1">
        <label className="cursor-pointer" title="캘린더 기본 색">
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={!defaultValue}
            className="peer sr-only"
          />
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-ink-300 text-[11px] text-ink-400 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 peer-checked:border-solid peer-checked:border-ink-500 peer-checked:text-ink-700"
            aria-hidden="true"
          >
            기본
          </span>
          <span className="sr-only">캘린더 기본 색</span>
        </label>

        {EVENT_COLORS.map((c) => (
          <label key={c.id} className="cursor-pointer" title={c.name}>
            <input
              type="radio"
              name={name}
              value={c.id}
              defaultChecked={defaultValue === c.id}
              className="peer sr-only"
            />
            <span
              className="block h-7 w-7 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 peer-checked:ring-2 peer-checked:ring-ink-700 peer-checked:ring-offset-2"
              style={{ backgroundColor: c.hex }}
              aria-hidden="true"
            />
            <span className="sr-only">{c.name}</span>
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-[12px] text-ink-400">{hint}</p>}
    </fieldset>
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

/**
 * 글 속의 주소를 눌러서 열 수 있게 바꾼다.
 *
 * 보고에 인스타 게시물이나 스크립트 주소를 그냥 붙여넣는 일이 잦은데, 지금까지는 글자로만 보여서
 * 복사해다 주소창에 붙여야 했다.
 *
 * 주소를 HTML 로 만들어 넣지 않고 React 요소로 쪼개 넣는다. 남이 쓴 글이 화면에서 코드로
 * 실행될 여지를 두지 않기 위해서다. 열어 주는 것도 http/https 뿐이다.
 */
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"'()[\]{}]+)/i;

/** 문장 끝에 붙은 마침표·괄호까지 주소로 삼키지 않게 떼어 낸다 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>"']+$/;

function Linkify({ text }: { text: string }) {
  // 캡처 그룹이 하나라 홀수 자리가 주소, 짝수 자리가 평범한 글자다
  const parts = text.split(URL_PATTERN);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0 || !part) return part;

        const 꼬리 = TRAILING_PUNCTUATION.exec(part)?.[0] ?? '';
        const 주소 = 꼬리 ? part.slice(0, -꼬리.length) : part;
        const href = 주소.startsWith('www.') ? `https://${주소}` : 주소;

        return (
          <span key={i}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-brand-600 underline underline-offset-2 hover:text-brand-800"
            >
              {주소}
            </a>
            {꼬리}
          </span>
        );
      })}
    </>
  );
}

/** 줄바꿈을 그대로 보여주는 읽기 전용 표시. 주소는 눌러서 열 수 있다. */
export function Multiline({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return <span className="text-ink-300">—</span>;
  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      <Linkify text={text} />
    </p>
  );
}
