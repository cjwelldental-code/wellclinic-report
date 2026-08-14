import 'server-only';
import { readTable } from './sheets';
import type {
  AdMetric, ComplianceItem, DailyReport, MonthlyReport, Project,
} from './schema';
import { monthRange, todayKST } from './date';

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
export const getMetrics = () => safeRead<AdMetric>('metrics');
export const getCompliance = () => safeRead<ComplianceItem>('compliance');

// ---------------------------------------------------------------------------
// 집계
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

export function metricsInMonth(metrics: AdMetric[], month: string): AdMetric[] {
  const { start, end } = monthRange(month);
  return metrics.filter((m) => m.날짜 >= start && m.날짜 <= end);
}

export interface MetricTotals {
  노출: number;
  클릭: number;
  비용: number;
  문의: number;
  예약: number;
  ctr: number;   // %
  cpc: number;   // 원
  cpa: number;   // 문의 1건당 비용
}

const num = (v: string) => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function sumMetrics(rows: AdMetric[]): MetricTotals {
  const t = rows.reduce(
    (acc, r) => ({
      노출: acc.노출 + num(r.노출),
      클릭: acc.클릭 + num(r.클릭),
      비용: acc.비용 + num(r.비용),
      문의: acc.문의 + num(r.문의),
      예약: acc.예약 + num(r.예약),
    }),
    { 노출: 0, 클릭: 0, 비용: 0, 문의: 0, 예약: 0 },
  );

  return {
    ...t,
    ctr: t.노출 ? (t.클릭 / t.노출) * 100 : 0,
    cpc: t.클릭 ? t.비용 / t.클릭 : 0,
    cpa: t.문의 ? t.비용 / t.문의 : 0,
  };
}

export function groupMetricsByChannel(rows: AdMetric[]): { 매체: string; totals: MetricTotals }[] {
  const map = new Map<string, AdMetric[]>();
  for (const r of rows) {
    const key = r.매체 || '미지정';
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()]
    .map(([매체, list]) => ({ 매체, totals: sumMetrics(list) }))
    .sort((a, b) => b.totals.비용 - a.totals.비용);
}

/** 만료가 임박했거나 이미 지난 심의 건 */
export function complianceAlerts(items: ComplianceItem[], withinDays = 30): ComplianceItem[] {
  const today = todayKST();
  return items
    .filter((c) => c.상태 === '승인' && c.만료일)
    .filter((c) => {
      const diff = Math.round(
        (Date.parse(`${c.만료일}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
      );
      return Number.isFinite(diff) && diff <= withinDays;
    })
    .sort((a, b) => a.만료일.localeCompare(b.만료일));
}

export const formatNumber = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const formatWon = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
