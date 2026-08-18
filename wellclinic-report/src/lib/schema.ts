/**
 * 구글 스프레드시트 탭 정의.
 * 탭 이름과 헤더는 사람이 시트에서 직접 읽고 고칠 수 있게 한글로 둔다.
 * 헤더 순서를 바꾸면 기존 데이터가 어긋나므로, 추가는 항상 맨 뒤에만 한다.
 */

export type TableKey =
  | 'projects'
  | 'daily'
  | 'monthly'
  | 'leads'
  | 'adspend'
  | 'revenue'
  | 'balance';

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

  // --- 매일 아침 자동 수집 ---

  /** 신규 DB. 하루 한 행. */
  leads: {
    title: '신규DB',
    headers: [
      'id', '날짜', 'dbcart', '디지털패키지', '러시아', '베트남',
      '합계', '생성일시', '수정일시',
    ],
  },

  /**
   * 광고비. 매일 아침 "이번 달 누적(MTD)" 스냅샷을 기록한다.
   * 캠페인이 '총계'인 행이 그 매체의 합계(구글은 일시중지 포함 Total 행).
   * 하루치 소진액은 어제 스냅샷과의 차이로 계산한다.
   */
  adspend: {
    title: '광고비',
    headers: [
      'id', '기록일', '연월', '매체', '캠페인', '지출', '결과',
      '생성일시', '수정일시',
    ],
  },

  /** 확정매출. 매일 아침 이번 달 채널별 스냅샷을 기록한다. */
  revenue: {
    title: '매출',
    headers: [
      'id', '기록일', '연월', '채널', '예약', '예약취소', '내원',
      '수술동의', '견적금액', '확정매출', '수납금액',
      '생성일시', '수정일시',
    ],
  },

  /** 광고 계정 청구 잔액. 매일 아침 매체별 스냅샷. */
  balance: {
    title: '청구잔액',
    headers: [
      'id', '기록일', '매체', '잔액', '예상세금', '결제수단', '다음결제',
      '생성일시', '수정일시',
    ],
  },
};

// ---------------------------------------------------------------------------
// 업무 관리
// ---------------------------------------------------------------------------

export const PROJECT_STATUSES = ['기획', '진행중', '검수', '완료', '보류'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRIORITIES = ['높음', '보통', '낮음'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** 클라이언트 목록 — 웰치과 내부용이지만 원내 브랜드가 나뉠 수 있어 열어둔다. */
export const CLIENTS = ['웰치과', '웰플란트', '공통'] as const;

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

// ---------------------------------------------------------------------------
// 광고 성과
// ---------------------------------------------------------------------------

/** 신규 DB 유입 경로 */
export const LEAD_SOURCES = ['dbcart', '디지털패키지', '러시아', '베트남'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** 광고 매체 */
export const MEDIA = ['메타', '구글'] as const;
export type Medium = (typeof MEDIA)[number];

/** 매체 합계 행을 나타내는 캠페인 이름 */
export const TOTAL_ROW = '총계';

/** 매출 집계 채널 */
export const REVENUE_CHANNELS = ['베트남', '러시아', '스트라우만', '디지털패키지'] as const;
export type RevenueChannel = (typeof REVENUE_CHANNELS)[number];

export type LeadRow = {
  id: string;
  날짜: string;
  dbcart: string;
  디지털패키지: string;
  러시아: string;
  베트남: string;
  합계: string;
  생성일시: string;
  수정일시: string;
};

export type AdSpendRow = {
  id: string;
  기록일: string;
  연월: string;
  매체: string;
  캠페인: string;
  지출: string;
  결과: string;
  생성일시: string;
  수정일시: string;
};

export type RevenueRow = {
  id: string;
  기록일: string;
  연월: string;
  채널: string;
  예약: string;
  예약취소: string;
  내원: string;
  수술동의: string;
  견적금액: string;
  확정매출: string;
  수납금액: string;
  생성일시: string;
  수정일시: string;
};

export type BalanceRow = {
  id: string;
  기록일: string;
  매체: string;
  잔액: string;
  예상세금: string;
  결제수단: string;
  다음결제: string;
  생성일시: string;
  수정일시: string;
};
