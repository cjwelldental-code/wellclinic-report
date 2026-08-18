'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { ensureTables } from '@/lib/sheets';
import type { ActionResult } from '@/app/actions';

/** 스프레드시트에 필요한 탭과 헤더를 만든다. 이미 있는 탭은 건드리지 않는다. */
export async function initSheet(
  _prev: ActionResult | null,
  _form: FormData,
): Promise<ActionResult> {
  try {
    await requireSession();
    const { created, existing } = await ensureTables();
    revalidatePath('/setup');

    if (created.length === 0) {
      return { ok: true, message: `이미 모든 탭이 준비돼 있습니다. (${existing.join(', ')})` };
    }
    return {
      ok: true,
      message: `탭 ${created.length}개를 만들었습니다: ${created.join(', ')}`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
