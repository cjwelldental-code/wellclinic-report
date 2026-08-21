import type {
  CommentRow,
  CommentTarget,
  DailyReport,
  Project,
  ReadRow,
} from './schema';

/**
 * 코멘트와 알림을 다루는 순수 계산.
 *
 * 코멘트는 일일보고 · 프로젝트 · 일정에 달린다. 원장님이 보고를 보고 바로 피드백을 남기고,
 * 남긴 사람 말고 받아야 할 사람에게 알림이 뜨는 것이 목적이다.
 *
 * "읽음" 은 코멘트마다 표시하지 않고 사람마다 마지막 확인 시각 하나만 둔다.
 * 알림 화면에서 확인 버튼을 누르면 그 시각이 지금으로 갱신되고,
 * 그 뒤에 달린 코멘트만 새 것으로 본다.
 *
 * 시트를 읽는 부분은 다른 표와 함께 data.ts 에 둔다. 이 파일은 계산만 해서 따로 돌려볼 수 있다.
 */

/** 특정 대상에 달린 코멘트를 오래된 순으로 */
export function commentsFor(
  rows: CommentRow[],
  kind: CommentTarget,
  targetId: string,
): CommentRow[] {
  return rows
    .filter((c) => c.대상종류 === kind && c.대상id === targetId)
    .sort((a, b) => a.생성일시.localeCompare(b.생성일시));
}

/** 대상별 코멘트 개수. 목록 화면에서 "코멘트 2" 배지를 붙일 때 쓴다. */
export function countByTarget(rows: CommentRow[], kind: CommentTarget): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of rows) {
    if (c.대상종류 !== kind) continue;
    out.set(c.대상id, (out.get(c.대상id) ?? 0) + 1);
  }
  return out;
}

export function lastReadAt(reads: ReadRow[], user: string): string {
  return reads.find((r) => r.사용자 === user)?.확인일시 ?? '';
}

/**
 * 이 코멘트를 알림으로 받아야 할 사람들.
 *
 *  - 일일보고  → 그 보고를 쓴 사람
 *  - 프로젝트  → 담당자
 *  - 일정      → 특정 주인이 없으므로 전원
 *  - 공통      → 같은 글에 이미 코멘트를 단 사람들 (오간 이야기를 놓치지 않게)
 *
 * 자기가 쓴 코멘트는 당연히 자기에게 알리지 않는다.
 */
function recipientsOf(
  comment: CommentRow,
  thread: CommentRow[],
  daily: DailyReport[],
  projects: Project[],
  everyone: string[],
): Set<string> {
  const to = new Set<string>();

  if (comment.대상종류 === 'daily') {
    const report = daily.find((r) => r.id === comment.대상id);
    if (report?.작성자) to.add(report.작성자);
  } else if (comment.대상종류 === 'project') {
    const project = projects.find((p) => p.id === comment.대상id);
    if (project?.담당자) to.add(project.담당자);
  } else if (comment.대상종류 === 'event') {
    for (const name of everyone) to.add(name);
  }

  // 같은 글에 이미 이야기를 남긴 사람들도 이어지는 코멘트를 봐야 한다
  for (const c of thread) {
    if (c.생성일시 < comment.생성일시 && c.작성자) to.add(c.작성자);
  }

  to.delete(comment.작성자);
  return to;
}

export interface Notification {
  comment: CommentRow;
  /** 마지막 확인 시각 이후에 달렸는지 */
  unread: boolean;
}

/**
 * 한 사람이 받아야 할 코멘트를 최신순으로 모은다.
 * 확인 시각이 없는 사람(처음 들어온 사람)에게 지난 코멘트가 한꺼번에 쏟아지지 않도록
 * 최근 30일치만 본다.
 */
export function notificationsFor(options: {
  user: string;
  comments: CommentRow[];
  reads: ReadRow[];
  daily: DailyReport[];
  projects: Project[];
  everyone: string[];
  days?: number;
}): Notification[] {
  const { user, comments, reads, daily, projects, everyone, days = 30 } = options;

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const readAt = lastReadAt(reads, user);

  // 대상별로 미리 묶어 두면 코멘트마다 전체를 훑지 않아도 된다
  const threads = new Map<string, CommentRow[]>();
  for (const c of comments) {
    const key = `${c.대상종류}:${c.대상id}`;
    threads.set(key, [...(threads.get(key) ?? []), c]);
  }

  const mine: Notification[] = [];
  for (const c of comments) {
    if (c.작성자 === user) continue;
    if (c.생성일시 < since) continue;

    const thread = threads.get(`${c.대상종류}:${c.대상id}`) ?? [];
    if (!recipientsOf(c, thread, daily, projects, everyone).has(user)) continue;

    mine.push({ comment: c, unread: !readAt || c.생성일시 > readAt });
  }

  return mine.sort((a, b) => b.comment.생성일시.localeCompare(a.comment.생성일시));
}

export function unreadCount(list: Notification[]): number {
  return list.filter((n) => n.unread).length;
}
