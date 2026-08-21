'use server';

import { revalidatePath } from 'next/cache';
import { configuredMembers, requireSession } from '@/lib/auth';
import { appendRow, deleteRow, readTable, updateRow } from '@/lib/sheets';
import { calendarSources, createEvent } from '@/lib/calendar';
import { isValidDate, todayKST } from '@/lib/date';
import type { DailyReport, MonthlyReport } from '@/lib/schema';

export interface ActionResult {
  ok: boolean;
  message: string;
}

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

async function run(fn: () => Promise<string>, paths: string[]): Promise<ActionResult> {
  try {
    const message = await fn();
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// 일일보고
// ---------------------------------------------------------------------------

export async function saveDailyReport(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const session = await requireSession();
    const id = str(form, 'id');
    const date = str(form, '날짜') || todayKST();
    const done = str(form, '한일');

    if (!done) throw new Error('오늘 한 일을 입력해 주세요.');

    // 다른 팀원 대신 입력할 수 있게 작성자를 고를 수 있다.
    // 목록에 없는 이름이 들어오면 로그인한 사람으로 되돌린다.
    const picked = str(form, '작성자');
    const writer = configuredMembers().some((m) => m.name === picked) ? picked : session.name;

    const payload = {
      날짜: date,
      작성자: writer,
      프로젝트: str(form, '프로젝트'),
      한일: done,
      내일계획: str(form, '내일계획'),
      이슈: str(form, '이슈'),
      소요시간: str(form, '소요시간'),
    };

    if (id) {
      const updated = await updateRow('daily', id, payload);
      if (!updated) throw new Error('수정할 보고를 찾지 못했습니다.');
      return '보고를 수정했습니다.';
    }

    // 같은 사람이 같은 날짜에 이미 썼으면 새로 만들지 않고 내용을 이어붙인다.
    const rows = await readTable<DailyReport>('daily');
    const existing = rows.find((r) => r.날짜 === date && r.작성자 === writer);

    if (existing) {
      await updateRow('daily', existing.id, {
        ...payload,
        한일: `${existing.한일}\n${done}`.trim(),
        내일계획: payload.내일계획 || existing.내일계획,
        이슈: [existing.이슈, payload.이슈].filter(Boolean).join('\n'),
        소요시간: String((Number(existing.소요시간) || 0) + (Number(payload.소요시간) || 0)),
      });
      return '같은 날짜 보고가 있어 내용을 이어붙였습니다.';
    }

    await appendRow('daily', payload);
    return '보고를 저장했습니다.';
  }, ['/', '/daily', '/monthly']);
}

export async function deleteDailyReport(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await requireSession();
    const ok = await deleteRow('daily', str(form, 'id'));
    if (!ok) throw new Error('삭제할 보고를 찾지 못했습니다.');
    return '보고를 삭제했습니다.';
  }, ['/', '/daily', '/monthly']);
}

// ---------------------------------------------------------------------------
// 프로젝트
// ---------------------------------------------------------------------------

export async function saveProject(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await requireSession();
    const id = str(form, 'id');
    const name = str(form, '이름');
    if (!name) throw new Error('프로젝트 이름을 입력해 주세요.');

    const payload = {
      이름: name,
      클라이언트: str(form, '클라이언트') || '웰치과',
      상태: str(form, '상태') || '기획',
      담당자: str(form, '담당자'),
      우선순위: str(form, '우선순위') || '보통',
      시작일: str(form, '시작일'),
      마감일: str(form, '마감일'),
      진행률: str(form, '진행률') || '0',
      목표: str(form, '목표'),
      설명: str(form, '설명'),
      링크: str(form, '링크'),
    };

    if (id) {
      const updated = await updateRow('projects', id, payload);
      if (!updated) throw new Error('수정할 프로젝트를 찾지 못했습니다.');
      return '프로젝트를 수정했습니다.';
    }

    await appendRow('projects', payload);
    return '프로젝트를 등록했습니다.';
  }, ['/', '/projects', '/calendar']);
}

export async function deleteProject(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    await requireSession();
    const ok = await deleteRow('projects', str(form, 'id'));
    if (!ok) throw new Error('삭제할 프로젝트를 찾지 못했습니다.');
    return '프로젝트를 삭제했습니다.';
  }, ['/', '/projects', '/calendar']);
}

// ---------------------------------------------------------------------------
// 일정 (구글 캘린더에 직접 등록)
// ---------------------------------------------------------------------------

export async function addCalendarEvent(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const session = await requireSession();

    const 제목 = str(form, '제목');
    const 날짜 = str(form, '날짜');
    if (!제목) throw new Error('일정 이름을 입력해 주세요.');
    if (!isValidDate(날짜)) throw new Error('날짜를 선택해 주세요.');

    const 종료일 = str(form, '종료일');
    if (종료일 && 종료일 < 날짜) throw new Error('종료일이 시작일보다 빠릅니다.');

    const 시작시각 = str(form, '시작시각');
    const 종료시각 = str(form, '종료시각');
    if (종료시각 && !시작시각) throw new Error('시작 시각을 함께 입력해 주세요.');
    if (시작시각 && 종료시각 && (!종료일 || 종료일 === 날짜) && 종료시각 <= 시작시각) {
      throw new Error('종료 시각이 시작 시각보다 빠릅니다.');
    }

    const sources = calendarSources();
    if (sources.length === 0) {
      throw new Error('연결된 캘린더가 없습니다. GOOGLE_CALENDAR_IDS 를 확인해 주세요.');
    }
    const picked = str(form, '캘린더');
    const target = sources.find((s) => s.id === picked) ?? sources[0];

    try {
      await createEvent({
        calendarId: target.id,
        제목,
        날짜,
        종료일,
        시작시각,
        종료시각,
        장소: str(form, '장소'),
        참석자: str(form, '참석자'),
        메모: str(form, '메모'),
        작성자: session.name,
      });
    } catch (e) {
      const raw = (e as Error).message;
      // 권한이 열람까지만 열려 있으면 여기서 막힌다. 무엇을 바꿔야 하는지 알려 준다.
      if (/insufficient|forbidden|403|permission/i.test(raw)) {
        throw new Error(
          '캘린더에 쓸 권한이 없습니다. 구글 캘린더 설정에서 서비스 계정 권한을 ' +
            '"변경 후 모든 일정 세부정보 확인" 으로 바꿔 주세요.',
        );
      }
      throw e;
    }

    return `${target.label} 캘린더에 일정을 넣었습니다.`;
  }, ['/', '/calendar']);
}

// ---------------------------------------------------------------------------
// 월간보고
// ---------------------------------------------------------------------------

export async function saveMonthlyReport(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const session = await requireSession();
    const month = str(form, '연월');
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('연월 형식이 올바르지 않습니다.');

    const payload = {
      연월: month,
      작성자: session.name,
      성과요약: str(form, '성과요약'),
      주요지표: str(form, '주요지표'),
      다음달계획: str(form, '다음달계획'),
      이슈및제안: str(form, '이슈및제안'),
    };

    // 사람 × 월 하나만 유지한다. 이미 있으면 덮어쓴다.
    const rows = await readTable<MonthlyReport>('monthly');
    const existing = rows.find((r) => r.연월 === month && r.작성자 === session.name);

    if (existing) {
      await updateRow('monthly', existing.id, payload);
      return '월간보고를 수정했습니다.';
    }

    await appendRow('monthly', payload);
    return '월간보고를 저장했습니다.';
  }, ['/monthly']);
}
