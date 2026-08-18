import 'server-only';
import { readTable } from './sheets';
import {
  LEAD_SOURCES,
  MEDIA,
  REVENUE_CHANNELS,
  TOTAL_ROW,
  type AdSpendRow,
  type BalanceRow,
  type DailyReport,
  type LeadRow,
  type MonthlyReport,
  type Project,
  type RevenueRow,
} from './schema';
import { addDays, monthRange } from './date';

/**
 * 시트 읽기 래퍼. 시트가 아직 준비되지 않았거나 권한이 없으면
 * 화면 전체가 죽지 않도록 빈 배열과 에러 메시지를 함께 돌려준다.
 */
export interface Loaded<T> {
  rows: T[];
  error: string | null;
}

async function safeRead<T extends Record<string, string>>(
  table: Parameters<typeof readTable>[0],
): Promise<Loaded<T>> {
  try {
    return { rows: await readTable<T>(table), error: null };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  }
}

export const getProjects = () => safeRead<Project>('projects');
export const getDailyReports = () => safeRead<DailyReport>('daily');
export const getMonthlyReports = () => safeRead<MonthlyReport>('monthly');
export const getLeads = () => safeRead<LeadRow>('leads');
export const getAdSpend = () => safeRead<AdSpendRow>('adspend');
export const getRevenue = () => safeRead<RevenueRow>('revenue');
export const getBalances = () => safeRead<BalanceRow>('balance');

// ---------------------------------------------------------------------------
// 공통
// ---------------------------------------------------------------------------

export const num = (v: string | undefined): number => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const formatNumber = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const formatWon = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

/** 큰 금액을 만/억 단위로 짧게 (대시보드 카드용) */
export function formatCompactWon(n: number): string {
  const v = Math.round(n);
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString('ko-KR')}만`;
  return v.toLocaleString('ko-KR');
}

// ---------------------------------------------------------------------------
// 업무 관리
// ---------------------------------------------------------------------------

export const ACTIVE_STATUSES = ['기획', '진행중', '검수'];

export function activeProjects(projects: Project[]): Project[] {
  return projects
    .filter((p) => ACTIVE_STATUSES.includes(p.상태))
    .sort((a, b) => {
      const rank = (p: Project) => (p.우선순위 === '높음' ? 0 : p.우선순위 === '보통' ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return (a.마감일 || '9999').localeCompare(b.마감일 || '9999');
    });
}

export function reportsInRange(
  reports: DailyReport[],
  start: string,
  end: string,
): DailyReport[] {
  return reports
    .filter((r) => r.날짜 >= start && r.날짜 <= end)
    .sort((a, b) => b.날짜.localeCompare(a.날짜));
}

export function reportsInMonth(reports: DailyReport[], month: string): DailyReport[] {
  const { start, end } = monthRange(month);
  return reportsInRange(reports, start, end);
}

// ---------------------------------------------------------------------------
// 신규 DB
// ---------------------------------------------------------------------------

export function leadsInMonth(rows: LeadRow[], month: string): LeadRow[] {
  return rows
    .filter((r) => r.날짜.startsWith(month))
    .sort((a, b) => b.날짜.localeCompare(a.날짜));
}

export function leadTotal(row: LeadRow): number {
  // 합계 칸이 비어 있어도 항목을 더해서 계산한다
  const stored = num(row.합계);
  if (stored) return stored;
  return LEAD_SOURCES.reduce((s, k) => s + num(row[k]), 0);
}

export function sumLeads(rows: LeadRow[]): { total: number; bySource: Record<string, number> } {
  const bySource: Record<string, number> = {};
  for (const key of LEAD_SOURCES) {
    bySource[key] = rows.reduce((s, r) => s + num(r[key]), 0);
  }
  return { total: rows.reduce((s, r) => s + leadTotal(r), 0), bySource };
}

// ---------------------------------------------------------------------------
// 광고비 (매일 아침 MTD 스냅샷)
// ---------------------------------------------------------------------------

/** 해당 달에서 가장 최근 기록일 */
export function latestSpendDate(rows: AdSpendRow[], month: string): string | null {
  const dates = rows.filter((r) => r.연월 === month).map((r) => r.기록일);
  return dates.length ? dates.sort().at(-1)! : null;
}

export interface SpendLine {
  매체: string;
  캠페인: string;
  지출: number;
  결과: number;
  cpa: number;
}

export interface SpendSnapshot {
  기록일: string | null;
  byMedium: { 매체: string; 지출: number; 결과: number; cpa: number; lines: SpendLine[] }[];
  지출: number;
  결과: number;
  cpa: number;
}

/** 특정 달의 최신 스냅샷을 매체별로 정리한다. */
export function spendSnapshot(rows: AdSpendRow[], month: string): SpendSnapshot {
  const 기록일 = latestSpendDate(rows, month);
  const empty: SpendSnapshot = { 기록일, byMedium: [], 지출: 0, 결과: 0, cpa: 0 };
  if (!기록일) return empty;

  const snap = rows.filter((r) => r.기록일 === 기록일 && r.연월 === month);
  const media = [...MEDIA].filter((m) => snap.some((r) => r.매체 === m));
  // 시트에 예상 못한 매체가 들어와도 빠뜨리지 않는다
  for (const r of snap) if (!media.includes(r.매체 as never)) media.push(r.매체 as never);

  const byMedium = media.map((매체) => {
    const all = snap.filter((r) => r.매체 === 매체);
    const totalRow = all.find((r) => r.캠페인 === TOTAL_ROW);
    const lines = all
      .filter((r) => r.캠페인 !== TOTAL_ROW)
      .map((r) => ({
        매체,
        캠페인: r.캠페인 || '(이름 없음)',
        지출: num(r.지출),
        결과: num(r.결과),
        cpa: num(r.결과) ? num(r.지출) / num(r.결과) : 0,
      }))
      .sort((a, b) => b.지출 - a.지출);

    // 총계 행이 있으면 그것을 쓴다. 구글은 일시중지 캠페인까지 포함된 값이라 합산과 다를 수 있다.
    const 지출 = totalRow ? num(totalRow.지출) : lines.reduce((s, l) => s + l.지출, 0);
    const 결과 = totalRow ? num(totalRow.결과) : lines.reduce((s, l) => s + l.결과, 0);

    return { 매체, 지출, 결과, cpa: 결과 ? 지출 / 결과 : 0, lines };
  });

  const 지출 = byMedium.reduce((s, m) => s + m.지출, 0);
  const 결과 = byMedium.reduce((s, m) => s + m.결과, 0);

  return { 기록일, byMedium, 지출, 결과, cpa: 결과 ? 지출 / 결과 : 0 };
}

/** 날짜별 MTD 누적 지출 (같은 달 안에서만) */
export function spendTimeline(rows: AdSpendRow[], month: string): { 날짜: string; 누적: number }[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (r.연월 !== month || r.캠페인 !== TOTAL_ROW) continue;
    byDate.set(r.기록일, (byDate.get(r.기록일) ?? 0) + num(r.지출));
  }
  return [...byDate.entries()]
    .map(([날짜, 누적]) => ({ 날짜, 누적 }))
    .sort((a, b) => a.날짜.localeCompare(b.날짜));
}

/**
 * 하루치 소진액. MTD 누적의 차이로 구한다.
 *
 * 아침에 찍은 스냅샷은 "전날까지"의 누적이다.
 * 그래서 D일 아침과 D+1일 아침의 차이가 곧 D일 하루치가 된다.
 * 하루라도 수집을 건너뛰면 며칠치가 섞이므로 그 구간은 계산하지 않는다.
 */
export function dailySpend(rows: AdSpendRow[], month: string): Map<string, number> {
  const timeline = spendTimeline(rows, month);
  const out = new Map<string, number>();

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const cur = timeline[i];
    if (addDays(prev.날짜, 1) !== cur.날짜) continue;
    out.set(prev.날짜, cur.누적 - prev.누적);
  }

  return out;
}

// ---------------------------------------------------------------------------
// 매출
// ---------------------------------------------------------------------------

export interface RevenueLine {
  채널: string;
  예약: number;
  예약취소: number;
  내원: number;
  수술동의: number;
  견적금액: number;
  확정매출: number;
  수납금액: number;
  내원율: number;
  동의율: number;
}

export interface RevenueSnapshot {
  기록일: string | null;
  lines: RevenueLine[];
  합계: Omit<RevenueLine, '채널'>;
}

const EMPTY_TOTALS = {
  예약: 0, 예약취소: 0, 내원: 0, 수술동의: 0,
  견적금액: 0, 확정매출: 0, 수납금액: 0, 내원율: 0, 동의율: 0,
};

export function revenueSnapshot(rows: RevenueRow[], month: string): RevenueSnapshot {
  const dates = rows.filter((r) => r.연월 === month).map((r) => r.기록일);
  const 기록일 = dates.length ? dates.sort().at(-1)! : null;
  if (!기록일) return { 기록일, lines: [], 합계: { ...EMPTY_TOTALS } };

  const snap = rows.filter((r) => r.기록일 === 기록일 && r.연월 === month);
  const order = (c: string) => {
    const i = (REVENUE_CHANNELS as readonly string[]).indexOf(c);
    return i === -1 ? 99 : i;
  };

  const lines: RevenueLine[] = snap
    .map((r) => {
      const 예약 = num(r.예약);
      const 예약취소 = num(r.예약취소);
      const 내원 = num(r.내원);
      const 수술동의 = num(r.수술동의);
      const 유효예약 = 예약 - 예약취소;
      return {
        채널: r.채널,
        예약, 예약취소, 내원, 수술동의,
        견적금액: num(r.견적금액),
        확정매출: num(r.확정매출),
        수납금액: num(r.수납금액),
        내원율: 유효예약 > 0 ? (내원 / 유효예약) * 100 : 0,
        동의율: 내원 > 0 ? (수술동의 / 내원) * 100 : 0,
      };
    })
    .sort((a, b) => order(a.채널) - order(b.채널));

  const 합계 = lines.reduce(
    (acc, l) => ({
      예약: acc.예약 + l.예약,
      예약취소: acc.예약취소 + l.예약취소,
      내원: acc.내원 + l.내원,
      수술동의: acc.수술동의 + l.수술동의,
      견적금액: acc.견적금액 + l.견적금액,
      확정매출: acc.확정매출 + l.확정매출,
      수납금액: acc.수납금액 + l.수납금액,
      내원율: 0,
      동의율: 0,
    }),
    { ...EMPTY_TOTALS },
  );

  const 유효예약 = 합계.예약 - 합계.예약취소;
  합계.내원율 = 유효예약 > 0 ? (합계.내원 / 유효예약) * 100 : 0;
  합계.동의율 = 합계.내원 > 0 ? (합계.수술동의 / 합계.내원) * 100 : 0;

  return { 기록일, lines, 합계 };
}

// ---------------------------------------------------------------------------
// 청구 잔액
// ---------------------------------------------------------------------------

export function latestBalances(rows: BalanceRow[]): BalanceRow[] {
  const byMedium = new Map<string, BalanceRow>();
  for (const r of rows) {
    const prev = byMedium.get(r.매체);
    if (!prev || r.기록일 > prev.기록일) byMedium.set(r.매체, r);
  }
  return [...byMedium.values()].sort(
    (a, b) => MEDIA.indexOf(a.매체 as never) - MEDIA.indexOf(b.매체 as never),
  );
}

// ---------------------------------------------------------------------------
// 월 단위 종합
// ---------------------------------------------------------------------------

export interface MonthSummary {
  month: string;
  광고비: number;
  결과: number;
  확정매출: number;
  수납금액: number;
  신규DB: number;
  roas: number;      // 배수
  dbCost: number;    // DB 1건당 광고비
  기록일: string | null;
}

export function monthSummary(
  spend: AdSpendRow[],
  revenue: RevenueRow[],
  leads: LeadRow[],
  month: string,
): MonthSummary {
  const s = spendSnapshot(spend, month);
  const r = revenueSnapshot(revenue, month);
  const l = sumLeads(leadsInMonth(leads, month));

  return {
    month,
    광고비: s.지출,
    결과: s.결과,
    확정매출: r.합계.확정매출,
    수납금액: r.합계.수납금액,
    신규DB: l.total,
    roas: s.지출 > 0 ? r.합계.확정매출 / s.지출 : 0,
    dbCost: l.total > 0 ? s.지출 / l.total : 0,
    기록일: s.기록일 ?? r.기록일,
  };
}

/** 최근 N일 추세 — 신규 DB, 하루 광고비, DB 단가 */
export interface TrendPoint {
  날짜: string;
  신규DB: number;
  광고비: number | null;
  dbCost: number | null;
}

export function recentTrend(
  spend: AdSpendRow[],
  leads: LeadRow[],
  month: string,
  days = 7,
): TrendPoint[] {
  const daily = dailySpend(spend, month);
  const rows = leadsInMonth(leads, month).slice(0, days);

  return rows.map((r) => {
    const 신규DB = leadTotal(r);
    // 광고비는 다음날 아침 스냅샷에 반영되므로 해당 날짜의 하루치를 그대로 쓴다
    const 광고비 = daily.has(r.날짜) ? daily.get(r.날짜)! : null;
    return {
      날짜: r.날짜,
      신규DB,
      광고비,
      dbCost: 광고비 !== null && 신규DB > 0 ? 광고비 / 신규DB : null,
    };
  });
}
