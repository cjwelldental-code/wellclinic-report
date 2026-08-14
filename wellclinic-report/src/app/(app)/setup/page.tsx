import { configuredMembers, requireSession } from '@/lib/auth';
import { calendarSources, listEvents } from '@/lib/calendar';
import { getDailyReports } from '@/lib/data';
import { TABLES, type TableKey } from '@/lib/schema';
import { todayKST } from '@/lib/date';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { initSheet } from './actions';

export const dynamic = 'force-dynamic';

const ENV_VARS = [
  { key: 'GOOGLE_SHEET_ID', desc: '데이터가 저장될 스프레드시트 ID' },
  { key: 'GOOGLE_SERVICE_ACCOUNT_EMAIL', desc: '서비스 계정 이메일' },
  { key: 'GOOGLE_PRIVATE_KEY', desc: '서비스 계정 비공개 키' },
  { key: 'GOOGLE_CALENDAR_IDS', desc: '연결할 구글 캘린더 (이름=ID, 쉼표로 구분)' },
  { key: 'TEAM_MEMBERS', desc: '팀원 목록 (이름:역할, 쉼표로 구분)' },
  { key: 'TEAM_PASSWORD', desc: '팀 공용 로그인 비밀번호' },
  { key: 'SESSION_SECRET', desc: '세션 서명용 임의 문자열 (16자 이상)' },
];

export default async function SetupPage() {
  const session = await requireSession();
  const today = todayKST();

  const sheetCheck = await getDailyReports();
  const calendars = calendarSources();
  const calendarCheck = calendars.length > 0 ? await listEvents(today, today) : null;

  const envState = ENV_VARS.map((v) => ({ ...v, set: Boolean(process.env[v.key]) }));
  const members = configuredMembers();

  return (
    <>
      <PageHeader
        title="설정"
        description="구글 시트와 캘린더 연결 상태를 확인합니다."
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <Card title="구글 시트">
          {sheetCheck.error ? (
            <>
              <Badge tone="red">연결 실패</Badge>
              <p className="mt-2 break-all text-[13px] text-ink-600">{sheetCheck.error}</p>
            </>
          ) : (
            <>
              <Badge tone="green">정상</Badge>
              <p className="mt-2 text-[13px] text-ink-600">
                일일보고 {sheetCheck.rows.length}건을 읽었습니다.
              </p>
            </>
          )}
        </Card>

        <Card title="구글 캘린더">
          {calendars.length === 0 ? (
            <>
              <Badge tone="amber">미설정</Badge>
              <p className="mt-2 text-[13px] text-ink-600">
                GOOGLE_CALENDAR_IDS 환경변수를 추가하면 일정 화면이 채워집니다.
              </p>
            </>
          ) : calendarCheck?.error ? (
            <>
              <Badge tone="red">연결 실패</Badge>
              <p className="mt-2 break-all text-[13px] text-ink-600">{calendarCheck.error}</p>
              <p className="mt-2 text-[13px] text-ink-500">
                캘린더 설정에서 서비스 계정 이메일에 열람 권한을 공유했는지 확인해 주세요.
              </p>
            </>
          ) : (
            <>
              <Badge tone="green">정상</Badge>
              <ul className="mt-2 space-y-0.5 text-[13px] text-ink-600">
                {calendars.map((c) => (
                  <li key={c.id}>
                    {c.label} · <span className="break-all opacity-70">{c.id}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card title="환경변수" className="mb-5">
        <ul className="divide-y divide-ink-100">
          {envState.map((v) => (
            <li key={v.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate font-mono text-[13px] font-semibold text-ink-800">{v.key}</p>
                <p className="text-[12px] text-ink-400">{v.desc}</p>
              </div>
              <Badge tone={v.set ? 'green' : 'red'}>{v.set ? '설정됨' : '없음'}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-ink-400">
          값은 표시하지 않습니다. Vercel 프로젝트 설정 → Environment Variables 에서 수정한 뒤 다시
          배포해야 반영됩니다.
        </p>
      </Card>

      <Card title="시트 초기화" className="mb-5">
        <p className="mb-4 text-[14px] leading-relaxed text-ink-600">
          아래 버튼을 누르면 스프레드시트에 필요한 탭과 첫 줄 머리글을 만듭니다. 이미 있는 탭은
          손대지 않으므로 여러 번 눌러도 데이터가 지워지지 않습니다.
        </p>
        <ActionForm action={initSheet} submitLabel="탭 만들기 · 확인" pendingLabel="처리 중…">
          <ul className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(TABLES) as TableKey[]).map((k) => (
              <li key={k} className="rounded-lg bg-ink-50 px-3 py-2">
                <p className="text-[13px] font-semibold text-ink-800">{TABLES[k].title}</p>
                <p className="truncate text-[12px] text-ink-400">
                  {TABLES[k].headers.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </ActionForm>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`팀원 ${members.length}명`}>
          {members.length === 0 ? (
            <p className="text-[13px] text-ink-500">TEAM_MEMBERS 환경변수가 비어 있습니다.</p>
          ) : (
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li key={m.name} className="flex items-center gap-2 text-[14px]">
                  <span className="font-semibold text-ink-800">{m.name}</span>
                  <Badge>{m.role}</Badge>
                  {m.name === session.name && <Badge tone="brand">나</Badge>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-ink-400">
            팀원을 추가하려면 TEAM_MEMBERS 값에 &lsquo;,이름:역할&rsquo; 을 덧붙이고 다시
            배포하세요.
          </p>
        </Card>

        <Card title="데이터 내려받기">
          <p className="mb-3 text-[14px] text-ink-600">
            엑셀에서 열어 볼 수 있는 CSV로 받습니다.
          </p>
          <ul className="flex flex-wrap gap-2">
            {(Object.keys(TABLES) as TableKey[]).map((k) => (
              <li key={k}>
                <a href={`/api/export?table=${k}`} className="btn-ghost">
                  {TABLES[k].title}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-400">
            원본 스프레드시트를 직접 열어 편집해도 됩니다. 머리글 순서만 바꾸지 마세요.
          </p>
        </Card>
      </div>
    </>
  );
}
