/**
 * 구글 스프레드시트 탭 정의.
 * 탭 이름과 헤더는 사람이 시트에서 직접 읽고 고칠 수 있게 한글로 둔다.
 * 헤더 순서를 바꾸면 기존 데이터가 어긋나므로, 추가는 항상 맨 뒤에만 한다.
 */

export type TableKey =
  | 'projects'
  | 'daily'
  | 'monthly'
  | 'metrics'
  | 'compliance';

export const TABLES: Record<TableKey, { title: string; headers: string[] }> = {
  projects: {
    title: '프로젝트',
    headers: [
      'id', '이름', '클라이언트', '상태', '담당자', '우선순위',
      '시작일', '마감일', '진행률', '목표', '설명', '링크',
      '생성일시', '수정일시',
    ],
  },
  daily: {
    title: '일일보고',
    headers: [
      'id', '날짜', '작성자', '프로젝트', '한일', '내일계획',
      '이슈', '소요시간', '생성일시', '수정일시',
    ],
  },
  monthly: {
    title: '월간보고',
    headers: [
      'id', '연월', '작성자', '성과요약', '주요지표', '다음달계획',
      '이슈및제안', '생성일시', '수정일시',
    ],
  },
  metrics: {
    title: '광고성과',
    headers: [
      'id', '날짜', '매체', '캠페인', '노출', '클릭', '비용',
      '문의', '예약', '메모', '생성일시',
    ],
  },
  compliance: {
    title: '심의관리',
    headers: [
      'id', '소재명', '매체', '심의번호', '심의일', '만료일',
      '상태', '담당자', '비고', '생성일시',
    ],
  },
};

// ---------------------------------------------------------------------------
// 도메인 타입
// ---------------------------------------------------------------------------

export const PROJECT_STATUSES = ['기획', '진행중', '검수', '완료', '보류'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRIORITIES = ['높음', '보통', '낮음'] as const;
export type Priority = (typeof PRIORITIES)[number];

export type Project = {
  id: string;
  이름: string;
  클라이언트: string;
  상태: string;
  담당자: string;
  우선순위: string;
  시작일: string;
  마감일: string;
  진행률: string;
  목표: string;
  설명: string;
  링크: string;
  생성일시: string;
  수정일시: string;
};

export type DailyReport = {
  id: string;
  날짜: string;
  작성자: string;
  프로젝트: string;
  한일: string;
  내일계획: string;
  이슈: string;
  소요시간: string;
  생성일시: string;
  수정일시: string;
};

export type MonthlyReport = {
  id: string;
  연월: string;
  작성자: string;
  성과요약: string;
  주요지표: string;
  다음달계획: string;
  이슈및제안: string;
  생성일시: string;
  수정일시: string;
};

export const CHANNELS = [
  '메타', '구글', '네이버', '모두닥', '유튜브', '카카오', '기타',
] as const;

export type AdMetric = {
  id: string;
  날짜: string;
  매체: string;
  캠페인: string;
  노출: string;
  클릭: string;
  비용: string;
  문의: string;
  예약: string;
  메모: string;
  생성일시: string;
};

export const COMPLIANCE_STATUSES = ['심의중', '승인', '반려', '만료'] as const;

export type ComplianceItem = {
  id: string;
  소재명: string;
  매체: string;
  심의번호: string;
  심의일: string;
  만료일: string;
  상태: string;
  담당자: string;
  비고: string;
  생성일시: string;
};

/** 클라이언트 목록 — 웰치과 내부용이지만 원내 브랜드가 나뉠 수 있어 열어둔다. */
export const CLIENTS = ['웰치과', '웰플란트', '공통'] as const;
