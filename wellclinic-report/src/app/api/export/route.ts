import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { readTable } from '@/lib/sheets';
import { TABLES, type TableKey } from '@/lib/schema';
import { todayKST } from '@/lib/date';

export const dynamic = 'force-dynamic';

function csvCell(value: string): string {
  const v = value ?? '';
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const table = request.nextUrl.searchParams.get('table') as TableKey | null;
  if (!table || !(table in TABLES)) {
    return NextResponse.json({ error: '알 수 없는 표입니다.' }, { status: 400 });
  }

  try {
    const { title, headers } = TABLES[table];
    const rows = await readTable(table);
    const lines = [
      headers.map(csvCell).join(','),
      ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(',')),
    ];

    // 엑셀이 한글을 깨뜨리지 않도록 BOM을 붙인다
    const body = `﻿${lines.join('\r\n')}`;
    const filename = encodeURIComponent(`웰치과_${title}_${todayKST()}.csv`);

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
