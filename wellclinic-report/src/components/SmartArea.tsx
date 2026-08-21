'use client';

import { useRef, useState } from 'react';

/**
 * 일일보고 본문 입력칸.
 *
 * 지금까지 형식을 손으로 맞춰 왔다. 번호를 직접 세고, 딸린 내용은 하이픈을 쳐서 들여썼다.
 * 중간에 한 줄을 끼워 넣으면 그 아래 번호를 전부 고쳐야 했다. 그래서 형식은 입력칸이 만든다.
 *
 *   Enter            다음 번호를 붙인 새 줄 (1. → 2. → 3.)
 *   Tab              그 줄을 딸린 내용으로 (2. →   - )
 *   Shift+Tab        딸린 내용을 다시 번호 줄로
 *   빈 줄에서 Enter   형식을 떼고 빠져나간다
 *
 * 번호는 고칠 때마다 위에서부터 다시 매긴다. 중간에 끼워 넣어도 손댈 것이 없다.
 */

const 번호줄 = /^(\d+)\.[ \t]?(.*)$/;
const 하위줄 = /^[ \t]+-[ \t]?(.*)$/;

const 하위접두 = '  - ';
/** renumber 가 번호를 다시 붙여 주므로 새 줄은 아무 번호로나 만들어 둔다 */
const 번호자리 = '0. ';

/** 전체를 위에서부터 다시 번호 매긴다. 하위 줄과 빈 줄은 건드리지 않는다. */
function renumber(text: string): string {
  let n = 0;
  return text
    .split('\n')
    .map((line) => {
      const m = 번호줄.exec(line);
      if (!m) return line;
      n += 1;
      return `${n}. ${m[2]}`;
    })
    .join('\n');
}

/** 커서가 몇 번째 줄에 있는지 */
function lineIndexAt(text: string, caret: number): number {
  return text.slice(0, caret).split('\n').length - 1;
}

/** n번째 줄이 시작하는 위치와 그 줄의 길이 */
function lineSpan(text: string, index: number): { 시작: number; 길이: number } {
  const lines = text.split('\n');
  let 시작 = 0;
  for (let i = 0; i < index && i < lines.length; i++) 시작 += lines[i].length + 1;
  return { 시작, 길이: lines[index]?.length ?? 0 };
}

export function SmartArea({
  name,
  label,
  rows = 8,
  defaultValue = '',
  required,
  hint,
  /** 어제 적어 둔 내일 계획. 있으면 버튼 한 번으로 불러온다. */
  carryOver = '',
}: {
  name: string;
  label: string;
  rows?: number;
  defaultValue?: string;
  required?: boolean;
  hint?: string;
  carryOver?: string;
}) {
  const id = `f-${name}`;
  const ref = useRef<HTMLTextAreaElement>(null);
  // 비어 있으면 '1. ' 로 시작해 둔다. 첫 글자부터 형식 안에서 쓰게 된다.
  const [value, setValue] = useState(defaultValue || '1. ');

  /** 값과 커서를 함께 바꾼다. 그린 뒤에 옮겨야 해서 다음 프레임에 처리한다. */
  const 적용 = (다음: string, caret: number) => {
    setValue(다음);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.selectionStart = caret;
      el.selectionEnd = caret;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: t, value: text } = el;
    if (s !== t) return; // 범위를 잡고 있을 때는 브라우저 기본 동작에 맡긴다

    const 줄번호 = lineIndexAt(text, s);
    const lines = text.split('\n');
    const 줄 = lines[줄번호] ?? '';
    const 번호 = 번호줄.exec(줄);
    const 하위 = 하위줄.exec(줄);

    if (e.key === 'Enter' && !e.shiftKey) {
      if (!번호 && !하위) return; // 형식이 없는 줄은 평소대로

      // 알맹이 없이 형식만 남은 줄에서 Enter → 형식을 떼고 목록에서 빠져나간다
      if (!(번호?.[2] ?? 하위?.[1] ?? '').trim()) {
        e.preventDefault();
        lines[줄번호] = '';
        const 매겨짐 = renumber(lines.join('\n'));
        적용(매겨짐, lineSpan(매겨짐, 줄번호).시작);
        return;
      }

      e.preventDefault();
      // 커서 자리에서 줄을 가른다. 뒤에 남은 글자는 새 줄로 따라간다.
      const { 시작 } = lineSpan(text, 줄번호);
      const 커서앞 = 줄.slice(0, s - 시작);
      const 커서뒤 = 줄.slice(s - 시작);
      const 접두 = 하위 ? 하위접두 : 번호자리;

      lines.splice(줄번호, 1, 커서앞, `${접두}${커서뒤}`);
      const 매겨짐 = renumber(lines.join('\n'));

      // 번호를 다시 매기면서 자릿수가 달라질 수 있으니 줄 번호로 위치를 다시 잡는다
      const 새줄 = lineSpan(매겨짐, 줄번호 + 1);
      const 새접두 = (번호줄.exec(매겨짐.split('\n')[줄번호 + 1] ?? '')?.[1].length ?? 0) + 2;
      적용(매겨짐, 새줄.시작 + (하위 ? 하위접두.length : 새접두));
      return;
    }

    if (e.key === 'Tab' && !e.shiftKey && 번호) {
      // 번호 줄 → 딸린 내용
      e.preventDefault();
      lines[줄번호] = `${하위접두}${번호[2]}`;
      const 매겨짐 = renumber(lines.join('\n'));
      const { 시작, 길이 } = lineSpan(매겨짐, 줄번호);
      적용(매겨짐, 시작 + 길이);
      return;
    }

    if (e.key === 'Tab' && e.shiftKey && 하위) {
      // 딸린 내용 → 번호 줄. 번호는 renumber 가 붙인다.
      e.preventDefault();
      lines[줄번호] = `${번호자리}${하위[1]}`;
      const 매겨짐 = renumber(lines.join('\n'));
      const { 시작, 길이 } = lineSpan(매겨짐, 줄번호);
      적용(매겨짐, 시작 + 길이);
    }
  };

  /** 어제 적어 둔 내일 계획을 번호 형식으로 바꿔 넣는다 */
  const 불러오기 = () => {
    if (!carryOver) return;
    const 항목 = carryOver
      .split('\n')
      .map((l) => l.replace(/^[\s\-·]*\d*\.?\s*/, '').trim())
      .filter(Boolean);
    if (항목.length === 0) return;

    const 비어있음 = !value.trim() || value.trim() === '1.';
    const 앞 = 비어있음 ? '' : `${value.replace(/\n+$/, '')}\n`;
    const 다음 = renumber(`${앞}${항목.map((l) => `${번호자리}${l}`).join('\n')}`);

    적용(다음, 다음.length);
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <label className="block text-[13px] font-semibold text-ink-600" htmlFor={id}>
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        {carryOver && (
          <button
            type="button"
            onClick={불러오기}
            className="text-[12px] font-semibold text-brand-600 hover:text-brand-800"
          >
            어제 적어 둔 내일 계획 불러오기
          </button>
        )}
      </div>

      <textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        className="field leading-relaxed"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        required={required}
        spellCheck={false}
      />

      <p className="mt-1 text-[12px] leading-relaxed text-ink-400">
        Enter 를 누르면 다음 번호가 자동으로 붙습니다. Tab 은 딸린 내용(-)으로, Shift+Tab 은 다시
        번호로 돌립니다. 중간에 끼워 넣어도 번호는 알아서 다시 매겨집니다.
        {hint ? ` ${hint}` : ''}
      </p>
    </div>
  );
}
