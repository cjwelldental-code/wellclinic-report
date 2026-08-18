'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { login, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? '확인 중…' : '들어가기'}
    </button>
  );
}

export function LoginForm({
  members,
  next,
}: {
  members: { name: string; role: string }[];
  next: string;
}) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className="label" htmlFor="name">
          팀원
        </label>
        <select id="name" name="name" className="field" defaultValue={members[0]?.name}>
          {members.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} · {m.role}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="password">
          팀 비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          placeholder="공용 비밀번호"
          required
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
