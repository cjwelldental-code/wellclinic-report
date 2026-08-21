import 'server-only';
import { readTable } from './sheets';
import {
  LEAD_SOURCES,
  MEDIA,
  REVENUE_CHANNELS,
  type AdSpendRow,
  type BalanceRow,
  type CommentRow,
  type DailyReport,
  type LeadRow,
  type ReadRow,
  type MonthlyReport,
  type Project,
  type RevenueRow,
} from './schema';
import { addDays, dayOfWeek, monthRange, shiftMonth, todayKST } from './date';

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
export const getComments = () => safeRead<CommentRow>('comments');
export const getReads = () => safeRead<ReadRow>('reads');
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

/**
 * 수집 과정에서 보고서 표의 소계·합계 줄이 캠페인 이름처럼 섞여 들어오는 일이 있다.
 * (예: '__소계__', '__합계__', 'Total')
 * 이걸 캠페인으로 세면 같은 금액을 두 번 더하게 되므로 반드시 걸러낸다.
 */
const TOTAL_LABELS = new Set([
  '총계', '합계', '소계', '총합', '총지출', '총결과',
  'total', 'totals', 'grandtotal', 'subtotal', 'sum',
]);

/** 매체 칸에 '전체'처럼 실제 매체가 아닌 값이 들어온 행 */
const AGGREGATE_MEDIA = new Set(['전체', '합계', '총계', '총합', 'total', 'all']);

const flatten = (v: string) =>
  String(v ?? '')
    .replace(/[_\s·・\-–—]/g, '')
    .toLowerCase();

export const isTotalLabel = (v: string) => TOTAL_LABELS.has(flatten(v));
export const isAggregateMedium = (v: string) => AGGREGATE_MEDIA.has(flatten(v));

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

/** 특정 기록일 하나를 매체별로 정리한다. */
export function spendAt(rows: AdSpendRow[], month: string, 기록일: string): SpendSnapshot {
  // 매체 칸이 '전체'인 행은 이미 매체 합을 다시 합친 값이라 여기서 버린다.
  // 아래에서 매체별로 다시 더하므로 그대로 두면 두 번 세게 된다.
  const snap = rows.filter(
    (r) => r.기록일 === 기록일 && r.연월 === month && !isAggregateMedium(r.매체),
  );

  const media: string[] = [...MEDIA].filter((m) => snap.some((r) => r.매체 === m));
  for (const r of snap) if (r.매체 && !media.includes(r.매체)) media.push(r.매체);

  const byMedium = media.map((매체) => {
    const all = snap.filter((r) => r.매체 === 매체);
    const totalRow = all.find((r) => isTotalLabel(r.캠페인));
    const lines = all
      .filter((r) => !isTotalLabel(r.캠페인))
      .map((r) => ({
        매체,
        캠페인: r.캠페인 || '(이름 없음)',
        지출: num(r.지출),
        결과: num(r.결과),
        cpa: num(r.결과) ? num(r.지출) / num(r.결과) : 0,
      }))
      .sort((a, b) => b.지출 - a.지출);

    // 총계 행이 있으면 그것만 쓴다. 구글은 일시중지 캠페인까지 포함된 값이라
    // 캠페인 합과 다를 수 있고, 그럴 때는 총계 쪽이 맞다.
    const 지출 = totalRow ? num(totalRow.지출) : lines.reduce((s, l) => s + l.지출, 0);
    const 결과 = totalRow ? num(totalRow.결과) : lines.reduce((s, l) => s + l.결과, 0);

    return { 매체, 지출, 결과, cpa: 결과 ? 지출 / 결과 : 0, lines };
  });

  const 지출 = byMedium.reduce((s, m) => s + m.지출, 0);
  const 결과 = byMedium.reduce((s, m) => s + m.결과, 0);

  return { 기록일, byMedium, 지출, 결과, cpa: 결과 ? 지출 / 결과 : 0 };
}

/** 특정 달의 최신 스냅샷을 매체별로 정리한다. */
export function spendSnapshot(rows: AdSpendRow[], month: string): SpendSnapshot {
  const 기록일 = latestSpendDate(rows, month);
  if (!기록일) return { 기록일, byMedium: [], 지출: 0, 결과: 0, cpa: 0 };
  return spendAt(rows, month, 기록일);
}

/** 날짜별 MTD 누적 지출 (같은 달 안에서만) */
export function spendTimeline(rows: AdSpendRow[], month: string): { 날짜: string; 누적: number }[] {
  const dates = [...new Set(rows.filter((r) => r.연월 === month).map((r) => r.기록일))].sort();
  // 합계 계산은 화면과 똑같은 규칙을 써야 하므로 spendAt 을 그대로 재사용한다
  return dates.map((날짜) => ({ 날짜, 누적: spendAt(rows, month, 날짜).지출 }));
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

/**
 * 신규 DB가 그달의 며칠치를 담고 있는지.
 * 수집이 하루라도 빠지면 신규 DB 합계가 실제보다 적게 나오는데,
 * 화면에서 그걸 모르면 숫자를 그대로 믿게 되므로 빠진 날짜를 그대로 드러낸다.
 */
export interface LeadCoverage {
  기대일수: number;
  수집일수: number;
  빠진날짜: string[];
  시작: string | null;
  끝: string | null;
  완전한가: boolean;
}

/** 이 시스템이 자료를 모으기 시작한 날. 이전 기간은 비어 있는 게 정상이다. */
export const DATA_START = '2026-08-01';

export function leadCoverage(
  leads: LeadRow[],
  month: string,
  today = todayKST(),
): LeadCoverage {
  const { start, end } = monthRange(month);
  // 오늘치는 아직 마감 전이라 기대하지 않는다
  const 마지막기대일 = [addDays(today, -1), end].sort()[0];
  const 첫기대일 = start < DATA_START ? DATA_START : start;

  const 기대: string[] = [];
  for (let d = 첫기대일; d <= 마지막기대일; d = addDays(d, 1)) 기대.push(d);

  const 있는날 = new Set(leadsInMonth(leads, month).map((r) => r.날짜));
  const 빠진날짜 = 기대.filter((d) => !있는날.has(d));
  const 정렬 = [...있는날].sort();

  return {
    기대일수: 기대.length,
    수집일수: 있는날.size,
    빠진날짜,
    시작: 정렬[0] ?? null,
    끝: 정렬.at(-1) ?? null,
    완전한가: 기대.length > 0 && 빠진날짜.length === 0,
  };
}

export interface MonthSummary {
  month: string;
  광고비: number;
  결과: number;
  확정매출: number;
  수납금액: number;
  신규DB: number;
  roas: number;              // 배수
  dbCost: number | null;     // DB 1건당 광고비. 수집이 빠진 날이 있으면 null
  기록일: string | null;
  coverage: LeadCoverage;
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
  const coverage = leadCoverage(leads, month);

  return {
    month,
    광고비: s.지출,
    결과: s.결과,
    확정매출: r.합계.확정매출,
    수납금액: r.합계.수납금액,
    신규DB: l.total,
    roas: s.지출 > 0 ? r.합계.확정매출 / s.지출 : 0,
    // 광고비는 한 달 누적인데 신규 DB에 빠진 날이 있으면 분모가 작아져
    // DB 단가가 실제보다 비싸게 나온다. 그럴 때는 아예 계산하지 않는다.
    dbCost: coverage.완전한가 && l.total > 0 ? s.지출 / l.total : null,
    기록일: s.기록일 ?? r.기록일,
    coverage,
  };
}

// ---------------------------------------------------------------------------
// 기간 단위 시계열 (일별 / 주별 / 월별)
// ---------------------------------------------------------------------------

export type Bucket = 'day' | 'week' | 'month';

export interface SeriesPoint {
  key: string;                 // 정렬·식별용
  label: string;               // 화면에 보이는 이름
  신규DB: number;
  광고비: number | null;       // 알 수 없으면 null (스냅샷이 연달아 없는 구간)
  확정매출: number | null;     // 월 단위에서만 값이 있다
  roas: number | null;
  dbCost: number | null;
}

const 요일 = ['일', '월', '화', '수', '목', '금', '토'];

/** 그 날이 속한 주의 월요일 */
function weekStart(date: string): string {
  const dow = new Date(Date.UTC(
    Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)),
  )).getUTCDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

const shortDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/** 선택한 달의 날짜별 시계열 */
export function dailySeries(
  spend: AdSpendRow[],
  leads: LeadRow[],
  month: string,
  today = todayKST(),
): SeriesPoint[] {
  const { start, end } = monthRange(month);
  const 마지막 = [addDays(today, -1), end].sort()[0];
  const 시작 = start < DATA_START ? DATA_START : start;
  if (시작 > 마지막) return [];

  const byDate = new Map(leadsInMonth(leads, month).map((r) => [r.날짜, leadTotal(r)]));
  const daily = dailySpend(spend, month);

  const out: SeriesPoint[] = [];
  for (let d = 시작; d <= 마지막; d = addDays(d, 1)) {
    const 신규DB = byDate.get(d) ?? 0;
    const 광고비 = daily.has(d) ? daily.get(d)! : null;
    out.push({
      key: d,
      label: `${shortDate(d)}(${요일[dayOfWeek(d)]})`,
      신규DB,
      광고비,
      확정매출: null,
      roas: null,
      dbCost: 광고비 !== null && 신규DB > 0 ? 광고비 / 신규DB : null,
    });
  }
  return out;
}

/** 선택한 달을 주 단위로 묶은 시계열 (월요일 시작) */
export function weeklySeries(
  spend: AdSpendRow[],
  leads: LeadRow[],
  month: string,
  today = todayKST(),
): SeriesPoint[] {
  const days = dailySeries(spend, leads, month, today);
  const buckets = new Map<string, SeriesPoint[]>();

  for (const d of days) {
    const k = weekStart(d.key);
    buckets.set(k, [...(buckets.get(k) ?? []), d]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, list]) => {
      const 신규DB = list.reduce((s, d) => s + d.신규DB, 0);
      const 알려진 = list.filter((d) => d.광고비 !== null);
      const 광고비 = 알려진.length ? 알려진.reduce((s, d) => s + d.광고비!, 0) : null;
      return {
        key: k,
        label: `${shortDate(list[0].key)}~${shortDate(list.at(-1)!.key)}`,
        신규DB,
        광고비,
        확정매출: null,
        roas: null,
        dbCost: 광고비 !== null && 신규DB > 0 ? 광고비 / 신규DB : null,
      };
    });
}

/** 최근 몇 달을 월 단위로 묶은 시계열 */
export function monthlySeries(
  spend: AdSpendRow[],
  revenue: RevenueRow[],
  leads: LeadRow[],
  endMonth: string,
  count = 6,
): SeriesPoint[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = shiftMonth(endMonth, -i);
    if (m >= DATA_START.slice(0, 7)) months.push(m);
  }

  return months.map((m) => {
    const s = monthSummary(spend, revenue, leads, m);
    return {
      key: m,
      label: `${Number(m.slice(5, 7))}월`,
      신규DB: s.신규DB,
      광고비: s.광고비 || null,
      확정매출: s.확정매출 || null,
      roas: s.roas || null,
      dbCost: s.dbCost,
    };
  });
}

export function buildSeries(
  bucket: Bucket,
  spend: AdSpendRow[],
  revenue: RevenueRow[],
  leads: LeadRow[],
  month: string,
): SeriesPoint[] {
  if (bucket === 'month') return monthlySeries(spend, revenue, leads, month);
  if (bucket === 'week') return weeklySeries(spend, leads, month);
  return dailySeries(spend, leads, month);
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
