'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addComment, deleteComment, type ActionResult } from '@/app/actions';
import { Multiline } from './Field';
import type { CommentRow, CommentTarget } from '@/lib/schema';

/**
 * 일일보고 · 프로젝트 · 일정 아래에 붙는 피드백 영역.
 *
 * 원장님이 보고를 읽다가 바로 한마디 남기는 자리다. 그래서 접었다 펴는 대신
 * 이미 달린 코멘트는 항상 보이게 두고, 입력칸만 필요할 때 연다.
 */

function 시각(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary px-3 py-1.5 text-[13px]" disabled={pending}>
      {pending ? '남기는 중…' : '코멘트 남기기'}
    </button>
  );
}

function DeleteOne({ id }: { id: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(deleteComment, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm('이 코멘트를 지울까요?')) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-[12px] text-ink-400 hover:text-red-600">
        지우기
      </button>
      {state && !state.ok && <span className="ml-2 text-[12px] text-red-600">{state.message}</span>}
    </form>
  );
}

export function Comments({
  kind,
  targetId,
  targetTitle,
  href,
  comments,
  currentUser,
  /** 팝업 안처럼 좁은 자리에서는 여백을 줄인다 */
  compact = false,
}: {
  kind: CommentTarget;
  targetId: string;
  targetTitle: string;
  href: string;
  comments: CommentRow[];
  currentUser: string;
  compact?: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addComment, null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <div className={compact ? 'mt-3' : 'mt-4 border-t border-ink-100 pt-3'}>
      {comments.length > 0 && (
        <ul className="mb-2 space-y-2">
          {comments.map((c) => {
            const 원장 = c.역할 === '원장';
            return (
              <li
                key={c.id}
                className={`rounded-lg px-3 py-2 ${
                  원장 ? 'bg-brand-50' : 'bg-ink-50'
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`text-[13px] font-semibold ${
                      원장 ? 'text-brand-800' : 'text-ink-700'
                    }`}
                  >
                    {c.작성자}
                    {c.역할 && <span className="ml-1 font-normal opacity-70">{c.역할}</span>}
                  </span>
                  <span className="text-[12px] text-ink-400 tnum">{시각(c.생성일시)}</span>
                  {c.작성자 === currentUser && (
                    <span className="ml-auto">
                      <DeleteOne id={c.id} />
                    </span>
                  )}
                </div>
                <Multiline
                  text={c.내용}
                  className={`mt-0.5 text-[14px] leading-relaxed ${
                    원장 ? 'text-brand-900' : 'text-ink-700'
                  }`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <form ref={ref} action={formAction} className="space-y-2">
          <input type="hidden" name="대상종류" value={kind} />
          <input type="hidden" name="대상id" value={targetId} />
          <input type="hidden" name="대상제목" value={targetTitle} />
          <input type="hidden" name="링크" value={href} />
          <textarea
            name="내용"
            rows={2}
            className="field"
            placeholder="피드백이나 확인할 점을 남겨 주세요"
            required
            autoFocus
          />
          <div className="flex items-center gap-2">
            <SubmitButton />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] font-semibold text-ink-400 hover:text-ink-700"
            >
              취소
            </button>
            {state && !state.ok && (
              <span className="text-[13px] font-semibold text-red-600">{state.message}</span>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[13px] font-semibold text-brand-600 hover:text-brand-800"
        >
          {comments.length > 0 ? '코멘트 추가' : '코멘트 · 피드백 남기기'}
        </button>
      )}
    </div>
  );
}
