'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/app/actions';

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * 서버 액션을 감싸는 공용 폼.
 * 필드는 children 으로 받으므로 각 화면은 서버 컴포넌트로 유지된다.
 */
export function ActionForm({
  action,
  children,
  submitLabel = '저장',
  pendingLabel = '저장 중…',
  resetOnSuccess = false,
  extra,
}: {
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  resetOnSuccess?: boolean;
  extra?: ReactNode;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className="space-y-4">
      {children}

      <div className="flex flex-wrap items-center gap-3">
        <Submit label={submitLabel} pendingLabel={pendingLabel} />
        {extra}
        {state && (
          <p
            className={`text-[13px] font-semibold ${
              state.ok ? 'text-emerald-600' : 'text-red-600'
            }`}
            role="status"
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

/** 목록 옆의 삭제 버튼. 되돌릴 수 없으므로 한 번 더 묻는다. */
export function DeleteButton({
  action,
  id,
  label = '삭제',
  confirmText = '삭제하면 되돌릴 수 없습니다. 삭제할까요?',
}: {
  action: (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;
  id: string;
  label?: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <DeleteSubmit label={label} />
      {state && !state.ok && <span className="text-[12px] text-red-600">{state.message}</span>}
    </form>
  );
}

// useFormStatus 는 form 안쪽 컴포넌트에서만 값을 읽으므로 따로 분리한다.
function DeleteSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-danger" disabled={pending}>
      {pending ? '삭제 중…' : label}
    </button>
  );
}

/** 목록 위에 접혀 있는 "새로 추가" 영역 */
export function Disclosure({
  label,
  openLabel,
  children,
  defaultOpen = false,
}: {
  label: string;
  openLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card mb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="font-heading text-[15px] text-ink-800">
          {open ? (openLabel ?? label) : label}
        </span>
        <span className="text-[13px] font-semibold text-ink-400">{open ? '닫기' : '열기'}</span>
      </button>
      {open && <div className="border-t border-ink-100 p-5">{children}</div>}
    </div>
  );
}
