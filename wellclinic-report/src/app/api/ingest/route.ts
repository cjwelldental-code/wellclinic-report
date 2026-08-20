import { NextResponse, type NextRequest } from 'next/server';
import { upsertRows, type Row } from '@/lib/sheets';
import { LEAD_SOURCES, TOTAL_ROW } from '@/lib/schema';
import { isTotalLabel } from '@/lib/data';
import { isValidDate, todayKST } from '@/lib/date';

export const dynamic = 'force-dynamic';

/**
 * 매일 아침 자동 수집 결과를 받아 시트에 적재한다.
 *
 * 인증: Authorization: Bearer <INGEST_TOKEN>
 * 같은 날짜로 다시 보내면 덮어쓴다(중복이 쌓이지 않는다).
 * 각 섹션은 선택이라, 일부 소스만 수집된 날에도 그만큼만 보내면 된다.
 */

type Json = Record<string, unknown>;

const asNumber = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? String(n) : '';
};

const asText = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim();

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'INGEST_TOKEN 환경변수가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token !== expected) return unauthorized('토큰이 올바르지 않습니다.');

  let body: Json;
  try {
    body = (await request.json()) as Json;
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 형식이 아닙니다.' }, { status: 400 });
  }

  const 기록일 = isValidDate(asText(body.기록일)) ? asText(body.기록일) : todayKST();
  const 연월 = asText(body.연월) || 기록일.slice(0, 7);
  const result: Record<string, { inserted: number; updated: number }> = {};
  const warnings: string[] = [];

  try {
    // --- 신규 DB (날짜별) ---
    const leads = Array.isArray(body.신규DB) ? (body.신규DB as Json[]) : [];
    if (leads.length > 0) {
      const rows: Row[] = [];
      for (const item of leads) {
        const 날짜 = asText(item.날짜);
        if (!isValidDate(날짜)) {
          warnings.push(`신규DB 날짜 형식이 올바르지 않아 건너뜀: ${날짜 || '(빈 값)'}`);
          continue;
        }
        const counts = LEAD_SOURCES.map((k) => Number(asNumber(item[k]) || 0));
        rows.push({
          날짜,
          dbcart: asNumber(item.dbcart) || '0',
          디지털패키지: asNumber(item.디지털패키지) || '0',
          러시아: asNumber(item.러시아) || '0',
          베트남: asNumber(item.베트남) || '0',
          합계: String(counts.reduce((s, n) => s + n, 0)),
        });
      }
      if (rows.length > 0) result.신규DB = await upsertRows('leads', rows, (r) => r.날짜);
    }

    // --- 광고비 (이번 달 누적 스냅샷) ---
    const spend = (body.광고비 ?? {}) as Json;
    const spendMonth = asText(spend.연월) || 연월;
    const spendRows: Row[] = [];

    for (const medium of ['메타', '구글']) {
      const block = spend[medium] as Json | undefined;
      if (!block) continue;

      const detail = Array.isArray(block.세부) ? (block.세부 as Json[]) : [];

      // 보고서 표의 소계·합계 줄이 세부에 섞여 오는 경우가 있다.
      // 캠페인으로 저장하면 나중에 두 번 세게 되므로 여기서 갈라낸다.
      const campaigns = detail.filter(
        (l) => asText(l.캠페인) && !isTotalLabel(asText(l.캠페인)),
      );
      const totalFromDetail = detail.find((l) => isTotalLabel(asText(l.캠페인)));
      if (detail.length !== campaigns.length) {
        warnings.push(`${medium}: 세부에 섞여 있던 소계 줄을 제외했습니다.`);
      }

      for (const line of campaigns) {
        spendRows.push({
          기록일, 연월: spendMonth, 매체: medium, 캠페인: asText(line.캠페인),
          지출: asNumber(line.지출) || '0',
          결과: asNumber(line.결과) || '0',
        });
      }

      // 총계 행. 구글은 일시중지 캠페인까지 포함된 Total 값이 들어온다.
      // 총지출이 없으면 세부에 섞여 있던 소계 줄을, 그것도 없으면 캠페인 합을 쓴다.
      const sum = (key: '지출' | '결과') =>
        String(campaigns.reduce((s, l) => s + Number(asNumber(l[key]) || 0), 0));

      spendRows.push({
        기록일, 연월: spendMonth, 매체: medium, 캠페인: TOTAL_ROW,
        지출: asNumber(block.총지출) || asNumber(totalFromDetail?.지출) || sum('지출'),
        결과: asNumber(block.총결과) || asNumber(totalFromDetail?.결과) || sum('결과'),
      });
    }

    if (spendRows.length > 0) {
      result.광고비 = await upsertRows(
        'adspend',
        spendRows,
        (r) => `${r.기록일}|${r.매체}|${r.캠페인}`,
      );
    }

    // --- 확정매출 (이번 달 채널별 스냅샷) ---
    const revenue = (body.매출 ?? {}) as Json;
    const revenueMonth = asText(revenue.연월) || 연월;
    const channels = Array.isArray(revenue.채널) ? (revenue.채널 as Json[]) : [];
    const revenueRows: Row[] = channels
      .filter((c) => asText(c.채널))
      .map((c) => ({
        기록일,
        연월: revenueMonth,
        채널: asText(c.채널),
        예약: asNumber(c.예약) || '0',
        예약취소: asNumber(c.예약취소) || '0',
        내원: asNumber(c.내원) || '0',
        수술동의: asNumber(c.수술동의) || '0',
        견적금액: asNumber(c.견적금액) || '0',
        확정매출: asNumber(c.확정매출) || '0',
        수납금액: asNumber(c.수납금액) || '0',
      }));

    if (revenueRows.length > 0) {
      result.매출 = await upsertRows(
        'revenue',
        revenueRows,
        (r) => `${r.기록일}|${r.채널}`,
      );
    }

    // --- 청구 잔액 ---
    const balances = Array.isArray(body.청구잔액) ? (body.청구잔액 as Json[]) : [];
    const balanceRows: Row[] = balances
      .filter((b) => asText(b.매체))
      .map((b) => ({
        기록일,
        매체: asText(b.매체),
        잔액: asNumber(b.잔액) || '0',
        예상세금: asNumber(b.예상세금) || '0',
        결제수단: asText(b.결제수단),
        다음결제: asText(b.다음결제),
      }));

    if (balanceRows.length > 0) {
      result.청구잔액 = await upsertRows(
        'balance',
        balanceRows,
        (r) => `${r.기록일}|${r.매체}`,
      );
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message, 기록일, 저장: result },
      { status: 500 },
    );
  }

  if (Object.keys(result).length === 0) {
    return NextResponse.json(
      { ok: false, error: '저장할 데이터가 없습니다. 본문 형식을 확인해 주세요.', 기록일 },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, 기록일, 저장: result, warnings });
}

/** 연결 확인용 */
export async function GET(request: NextRequest) {
  const expected = process.env.INGEST_TOKEN;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!expected) {
    return NextResponse.json({ ok: false, error: 'INGEST_TOKEN 미설정' }, { status: 500 });
  }
  if (token !== expected) return unauthorized('토큰이 올바르지 않습니다.');

  return NextResponse.json({ ok: true, message: '연결 정상', 오늘: todayKST() });
}
