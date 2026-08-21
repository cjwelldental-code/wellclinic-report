'use client';

import { useState, useTransition } from 'react';
import { draftMonthlySummary } from '@/app/actions';

/**
 * 월간보고 성과 요약 칸.
 *
 * 지금도 집계로 만든 초안이 들어가 있지만 일일보고를 줄줄이 이어 붙인 모양이라
 * 그대로 원장님께 드리기는 어려웠다. 버튼을 누르면 그 초안을 AI가 읽을 만한 문단으로 묶어 준다.
 *
 * 사람이 쓴 글을 갈아 끼우는 것이라 되돌리기를 함께 둔다. 저장은 확인하고 직접 누른다.
 */
export function AiDraftArea({
  name,
  label,
  rows = 6,
  defaultValue = '',
  hint,
  /** AI 에게 넘길 원자료. 프로젝트별 업무 내역을 줄글로 만든 것. */
  source,
  aiReady = false,
}: {
  name: string;
  label: string;
  rows?: number;
  defaultValue?: string;
  hint?: string;
  source: string;
  aiReady?: boolean;
}) {
  const id = `f-${name}`;
  const [value, setValue] = useState(defaultValue);
  const [정리중, start] = useTransition();
  const [알림, set알림] = useState<{ ok: boolean; message: string } | null>(null);
  const [되돌릴글, set되돌릴글] = useState<string | null>(null);

  const 초안받기 = () => {
    set알림(null);
    const 원문 = value;
    start(async () => {
      // 사람이 이미 쓴 글이 있으면 그것을 다듬고, 비어 있으면 집계 자료로 새로 쓴다
      const r = await draftMonthlySummary(원문.trim() || source);
      if (r.ok) {
        set되돌릴글(원문);
        setValue(r.text.trim());
      }
      set알림({ ok: r.ok, message: r.message });
    });
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <label className="block text-[13px] font-semibold text-ink-600" htmlFor={id}>
          {label}
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {aiReady && (
            <button
              type="button"
              onClick={초안받기}
              disabled={정리중 || (!value.trim() && !source.trim())}
              className="text-[12px] font-semibold text-brand-600 hover:text-brand-800 disabled:opacity-50"
            >
              {정리중 ? 'AI가 정리 중…' : '✨ AI로 정리'}
            </button>
          )}
          {되돌릴글 !== null && !정리중 && (
            <button
              type="button"
              onClick={() => {
                setValue(되돌릴글);
                set되돌릴글(null);
                set알림(null);
              }}
              className="text-[12px] font-semibold text-ink-400 hover:text-ink-700"
            >
              되돌리기
            </button>
          )}
        </div>
      </div>

      {알림 && (
        <p
          className={`mb-1.5 text-[12px] font-semibold ${알림.ok ? 'text-emerald-600' : 'text-red-600'}`}
          role="status"
        >
          {알림.message}
          {알림.ok && ' 숫자와 이름이 맞는지 확인하고 저장하세요.'}
        </p>
      )}

      <textarea
        id={id}
        name={name}
        rows={rows}
        className="field leading-relaxed"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {hint && <p className="mt-1 text-[12px] text-ink-400">{hint}</p>}
    </div>
  );
}
