/**
 * 로그인·작성자·담당자 목록.
 *
 * 예전에는 TEAM_MEMBERS 환경변수에서 읽었는데, 사람이 늘 때마다 Vercel 환경변수를 고치고
 * 수동으로 다시 배포해야 했다. 코드에 두면 이 파일만 고쳐 Push 하면 자동 배포로 반영된다.
 * 그래서 지금은 이 목록이 유일한 기준이고 TEAM_MEMBERS 는 쓰지 않는다.
 *
 * 순서가 곧 화면에 보이는 순서다. 직급이 높은 사람부터 적는다.
 */

export interface Member {
  name: string;
  /** 화면에 보이는 직급 */
  role: string;
  /** 원장님 계정. 코멘트·피드백 표시에 쓴다. */
  director: boolean;
}

export const ROSTER: readonly Member[] = [
  { name: '빙정호', role: '원장', director: true },
  { name: '이의묵', role: '원장', director: true },
  { name: '이선호', role: '부장', director: false },
  { name: '김태형', role: '팀장', director: false },
  { name: '이하늘', role: '대리', director: false },
  { name: '하이엔', role: '사원', director: false },
  { name: '정바다', role: '사원', director: false },
];

export function findMember(name: string): Member | undefined {
  return ROSTER.find((m) => m.name === name);
}

export function isDirector(name: string): boolean {
  return findMember(name)?.director ?? false;
}

/** 이름만 뽑은 목록. 명단 순서(직급 순)를 그대로 유지한다. */
export const MEMBER_NAMES: readonly string[] = ROSTER.map((m) => m.name);
