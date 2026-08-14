import 'server-only';
import { google, type sheets_v4 } from 'googleapis';
import { TABLES, type TableKey } from './schema';

/**
 * 구글 스프레드시트를 단순 테이블 저장소로 쓴다.
 * 각 탭의 1행은 헤더, 2행부터 데이터. A열은 항상 id(uuid)다.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar.readonly',
];

let cached: sheets_v4.Sheets | null = null;

export function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL 과 GOOGLE_PRIVATE_KEY 환경변수가 필요합니다. SETUP.md를 확인하세요.',
    );
  }

  // Vercel 환경변수에 붙여넣으면 줄바꿈이 \n 문자열로 들어온다.
  const key = rawKey.replace(/\n/g, '\n');

  return new google.auth.JWT({ email, key, scopes: SCOPES });
}

function client(): sheets_v4.Sheets {
  if (!cached) cached = google.sheets({ version: 'v4', auth: getAuth() });
  return cached;
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID 환경변수가 필요합니다. SETUP.md를 확인하세요.');
  return id;
}

export type Row = Record<string, string>;

function colLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function lastCol(table: TableKey): string {
  return colLetter(TABLES[table].headers.length - 1);
}

/** 탭 전체를 객체 배열로 읽는다. 헤더 행은 제외한다. */
export async function readTable<T extends Row = Row>(table: TableKey): Promise<T[]> {
  const { title, headers } = TABLES[table];
  const res = await client().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `${title}!A2:${lastCol(table)}`,
  });

  const values = res.data.values ?? [];
  return values
    .filter((row) => row[0]) // id 없는 행(빈 줄)은 버린다
    .map((row) => {
      const obj: Row = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] ?? '').toString();
      });
      return obj as T;
    });
}

/** 새 행을 맨 아래에 추가하고, 만들어진 레코드를 돌려준다. */
export async function appendRow(table: TableKey, data: Row): Promise<Row> {
  const { title, headers } = TABLES[table];
  const record: Row = { ...data };
  record.id ||= crypto.randomUUID();
  if (headers.includes('생성일시')) record.생성일시 ||= new Date().toISOString();
  if (headers.includes('수정일시')) record.수정일시 = new Date().toISOString();

  const values = [headers.map((h) => record[h] ?? '')];

  await client().spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `${title}!A:${lastCol(table)}`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  return record;
}

/** id로 행을 찾아 일부 필드만 갱신한다. */
export async function updateRow(
  table: TableKey,
  id: string,
  patch: Row,
): Promise<Row | null> {
  const { title, headers } = TABLES[table];
  const rows = await readTable(table);
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const merged: Row = { ...rows[index], ...patch, id };
  if (headers.includes('수정일시')) merged.수정일시 = new Date().toISOString();

  const rowNumber = index + 2; // 헤더 1행 + 0-based 보정
  await client().spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${title}!A${rowNumber}:${lastCol(table)}${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers.map((h) => merged[h] ?? '')] },
  });

  return merged;
}

/** id로 행을 찾아 실제로 삭제한다(행 자체를 제거). */
export async function deleteRow(table: TableKey, id: string): Promise<boolean> {
  const rows = await readTable(table);
  const index = rows.findIndex((r) => r.id === id);
  if (index === -1) return false;

  const gid = await tabGid(TABLES[table].title);
  if (gid === null) return false;

  await client().spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: gid,
              dimension: 'ROWS',
              startIndex: index + 1, // 헤더 제외
              endIndex: index + 2,
            },
          },
        },
      ],
    },
  });

  return true;
}

async function tabGid(title: string): Promise<number | null> {
  const meta = await client().spreadsheets.get({ spreadsheetId: sheetId() });
  const found = meta.data.sheets?.find((s) => s.properties?.title === title);
  return found?.properties?.sheetId ?? null;
}

/**
 * 스프레드시트에 필요한 탭과 헤더를 만든다. 이미 있으면 건드리지 않는다.
 * 최초 1회 /setup 화면에서 실행한다.
 */
export async function ensureTables(): Promise<{ created: string[]; existing: string[] }> {
  const meta = await client().spreadsheets.get({ spreadsheetId: sheetId() });
  const present = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''),
  );

  const created: string[] = [];
  const existing: string[] = [];

  const addRequests: sheets_v4.Schema$Request[] = [];
  for (const key of Object.keys(TABLES) as TableKey[]) {
    const { title } = TABLES[key];
    if (present.has(title)) {
      existing.push(title);
    } else {
      created.push(title);
      addRequests.push({ addSheet: { properties: { title } } });
    }
  }

  if (addRequests.length > 0) {
    await client().spreadsheets.batchUpdate({
      spreadsheetId: sheetId(),
      requestBody: { requests: addRequests },
    });
  }

  // 새로 만든 탭에만 헤더를 쓴다. 기존 탭은 데이터가 있을 수 있으므로 손대지 않는다.
  for (const key of Object.keys(TABLES) as TableKey[]) {
    const { title, headers } = TABLES[key];
    if (!created.includes(title)) continue;
    await client().spreadsheets.values.update({
      spreadsheetId: sheetId(),
      range: `${title}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }

  return { created, existing };
}
