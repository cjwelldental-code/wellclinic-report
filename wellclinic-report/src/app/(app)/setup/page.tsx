import { configuredMembers, requireSession } from '@/lib/auth';
import { calendarSources, listEvents } from '@/lib/calendar';
import { checkSheet } from '@/lib/sheets';
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
  { key: 'TEAM_PASSWORD', desc: '공용 로그인 비밀번호' },
  { key: 'SESSION_SECRET', desc: '세션 서명용 임의 문자열 (16자 이상)' },
  { key: 'INGEST_TOKEN', desc: '매일 아침 자동 수집이 데이터를 보낼 때 쓰는 토큰' },
];

export default async function SetupPage() {
  const session = await requireSession();
  const today = todayKST();

  const sheet = await checkSheet();
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
          {sheet.error ? (
            <>
              <Badge tone="red">연결 실패</Badge>
              <p className="mt-2 break-all text-[13px] text-ink-600">{sheet.error}</p>
              <p className="mt-2 text-[13px] text-ink-500">
                시트 공유에서 서비스 계정 이메일을 편집자로 초대했는지, GOOGLE_SHEET_ID 가 맞는지
                확인해 주세요.
              </p>
            </>
          ) : sheet.missing.length > 0 ? (
            <>
              <Badge tone="amber">탭 만들기 필요</Badge>
              <p className="mt-2 text-[13px] text-ink-600">
                시트 연결은 정상입니다{sheet.title && ` (${sheet.title})`}. 아래 탭 만들기 버튼을
                눌러 주세요.
              </p>
              <p className="mt-1 text-[13px] text-ink-500">
                없는 탭 {sheet.missing.length}개 · {sheet.missing.join(', ')}
              </p>
            </>
          ) : (
            <>
              <Badge tone="green">정상</Badge>
              <p className="mt-2 text-[13px] text-ink-600">
                탭 {sheet.existing.length}개가 모두 준비돼 있습니다
                {sheet.title && ` (${sheet.title})`}.
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
              <li key={k} className="min-w-0 rounded-lg bg-ink-50 px-3 py-2">
                <p className="truncate text-[13px] font-semibold text-ink-800">{TABLES[k].title}</p>
                <p className="truncate text-[12px] text-ink-400">
                  {TABLES[k].headers.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </ActionForm>
      </Card>

      <Card title="매일 아침 자동 수집 연동" className="mb-5">
        <p className="mb-3 text-[14px] leading-relaxed text-ink-600">
          매일 아침 도는 수집 작업이 아래 주소로 결과를 보내면, 시트에 자동으로 정리되고 광고 성과
          화면에 바로 반영됩니다. 같은 날짜로 여러 번 보내도 덮어쓰기만 되고 중복이 쌓이지
          않습니다.
        </p>
        <div className="rounded-lg bg-ink-50 p-4">
          <p className="text-[12px] font-semibold text-ink-500">보내는 주소</p>
          <code className="mt-1 block break-all font-mono text-[13px] text-ink-800">
            POST /api/ingest
          </code>
          <p className="mt-3 text-[12px] font-semibold text-ink-500">인증 헤더</p>
          <code className="mt-1 block break-all font-mono text-[13px] text-ink-800">
            Authorization: Bearer &lt;INGEST_TOKEN&gt;
          </code>
        </div>
        <p className="mt-3 text-[13px] text-ink-500">
          {process.env.INGEST_TOKEN
            ? 'INGEST_TOKEN 이 설정돼 있습니다. 본문 형식은 저장소의 DAILY-AGENT.md 를 참고하세요.'
            : 'INGEST_TOKEN 이 아직 없습니다. Vercel 환경변수에 임의의 긴 문자열을 넣고 다시 배포해 주세요.'}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`구성원 ${members.length}명`}>
          {members.length === 0 ? (
            <p className="text-[13px] text-ink-500">
              src/lib/members.ts 의 ROSTER 가 비어 있습니다.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li key={m.name} className="flex items-center gap-2 text-[14px]">
                  <span className="font-semibold text-ink-800">{m.name}</span>
                  <Badge tone={m.director ? 'brand' : 'neutral'}>{m.role}</Badge>
                  {m.name === session.name && <Badge tone="green">나</Badge>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-ink-400">
            사람을 추가하려면 <code className="text-ink-600">src/lib/members.ts</code> 의 ROSTER 에
            한 줄 넣고 Push 하면 됩니다. 적은 순서가 화면에 보이는 순서입니다.
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
