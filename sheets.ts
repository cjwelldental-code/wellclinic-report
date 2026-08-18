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

const BEGIN = '-----BEGIN';
const END_MARKER = 'PRIVATE KEY-----';

/**
 * 서비스 계정 비공개 키를 PEM 형태로 정리한다.
 * 환경변수에 붙여넣는 방식이 사람마다 달라서 아래 경우를 모두 받아 준다.
 *  - JSON의 값만 복사 (줄바꿈이 \n 문자로 들어옴)
 *  - 앞뒤 따옴표까지 같이 복사
 *  - 실제 줄바꿈이 살아 있는 상태로 복사
 *  - JSON 파일 내용을 통째로 붙여넣음
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();

  // JSON 파일을 통째로 붙여넣은 경우 private_key 만 꺼낸다
  if (key.startsWith('{')) {
    try {
      const parsed = JSON.parse(key) as { private_key?: string };
      if (parsed.private_key) key = parsed.private_key.trim();
    } catch {
      // JSON이 아니면 아래 로직으로 계속 진행한다
    }
  }

  // 앞뒤를 감싼 따옴표 제거
  if (key.length > 1 && /^["'].*["']$/s.test(key)) {
    key = key.slice(1, -1).trim();
  }

  // \n 문자열로 들어온 줄바꿈을 실제 줄바꿈으로 되돌린다
  key = key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();

  return `${key}\n`;
}

export function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL 과 GOOGLE_PRIVATE_KEY 환경변수가 필요합니다. SETUP.md를 확인하세요.',
    );
  }

  const key = normalizePrivateKey(rawKey);

  // 형식이 깨졌으면 OpenSSL의 알아보기 힘든 오류 대신 무엇이 잘못됐는지 알려 준다
  if (!key.startsWith(BEGIN) || !key.trimEnd().endsWith(END_MARKER)) {
    throw new Error(
      'GOOGLE_PRIVATE_KEY 형식이 올바르지 않습니다. ' +
        '서비스 계정 JSON의 private_key 값을 -----BEGIN 부터 -----END PRIVATE KEY----- 까지 ' +
        '앞뒤 따옴표 없이 통째로 넣어 주세요.',
    );
  }

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
