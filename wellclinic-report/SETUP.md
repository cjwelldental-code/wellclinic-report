# 설치 가이드

처음 한 번만 하면 됩니다. 순서대로 따라오시면 30~40분 정도 걸립니다.

---

## 1단계. 구글 스프레드시트 만들기

1. [sheets.new](https://sheets.new) 로 새 스프레드시트를 만듭니다.
2. 이름을 `웰치과 마케팅팀 업무보고 DB` 로 바꿉니다.
3. 주소창에서 ID를 복사해 둡니다.

```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjK.../edit
                                      ^^^^^^^^^^^^^^^ 이 부분이 GOOGLE_SHEET_ID
```

탭은 지금 만들지 않아도 됩니다. 배포 후 앱의 설정 화면에서 버튼 한 번으로 만듭니다.

---

## 2단계. 구글 서비스 계정 만들기

앱이 시트와 캘린더를 읽고 쓸 수 있게 하는 전용 계정입니다. 사람 계정이 아니라 프로그램용 계정입니다.

1. [console.cloud.google.com](https://console.cloud.google.com) 접속
2. 상단에서 새 프로젝트 생성 — 이름은 `wellclinic-report`
3. 왼쪽 메뉴 `API 및 서비스` → `라이브러리` 에서 아래 두 개를 각각 검색해 사용 설정
   - Google Sheets API
   - Google Calendar API
4. `API 및 서비스` → `사용자 인증 정보` → `사용자 인증 정보 만들기` → `서비스 계정`
   - 이름: `report-bot`
   - 역할은 지정하지 않아도 됩니다. `완료` 클릭
5. 만들어진 서비스 계정을 클릭 → `키` 탭 → `키 추가` → `새 키 만들기` → JSON 선택
6. JSON 파일이 내려받아집니다. 메모장으로 열면 아래 두 값이 있습니다.

```json
{
  "client_email": "report-bot@wellclinic-report.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
}
```

- `client_email` → 나중에 `GOOGLE_SERVICE_ACCOUNT_EMAIL` 에 넣습니다
- `private_key` → 나중에 `GOOGLE_PRIVATE_KEY` 에 넣습니다

> 이 JSON 파일은 비밀번호와 같습니다. 깃허브에 올리지 마세요.

---

## 3단계. 시트와 캘린더에 권한 주기

서비스 계정도 사람처럼 초대해야 접근할 수 있습니다.

시트

1. 1단계에서 만든 스프레드시트를 엽니다
2. 오른쪽 위 `공유` 클릭
3. `client_email` 주소를 붙여넣고 권한을 `편집자` 로 선택 후 공유

캘린더

1. [calendar.google.com](https://calendar.google.com) 접속
2. 왼쪽 캘린더 목록에서 웰치과 캘린더 옆 점 세 개 → `설정 및 공유`
3. `특정 사용자와 공유` → `사용자 추가` → `client_email` 주소 입력
4. 권한은 `모든 일정 세부정보 보기` 로 충분합니다
5. 같은 화면 아래 `캘린더 통합` 에서 `캘린더 ID` 를 복사해 둡니다

---

## 4단계. 깃허브에 올리기

`wellclinic-report` 폴더를 깃허브 새 저장소에 올립니다. 저장소는 반드시 Private 로 만드세요.

```bash
git init
git add .
git commit -m "웰치과 마케팅팀 업무보고 시스템 초기 버전"
git branch -M main
git remote add origin https://github.com/<계정>/wellclinic-report.git
git push -u origin main
```

> 구글 드라이브 폴더에서 그대로 `npm install` 을 돌리면 동기화 때문에 느려집니다.
> 로컬에서 돌려볼 계획이라면 폴더를 `C:\dev\wellclinic-report` 같은 곳으로 복사한 뒤 작업하세요.

---

## 5단계. Vercel 연결

1. [vercel.com/new](https://vercel.com/new) 에서 방금 만든 저장소를 선택
2. 프레임워크는 Next.js 로 자동 인식됩니다. 그대로 둡니다
3. `Environment Variables` 에 아래 7개를 넣습니다

| 이름 | 값 |
|---|---|
| `GOOGLE_SHEET_ID` | 1단계에서 복사한 ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON의 `client_email` |
| `GOOGLE_PRIVATE_KEY` | JSON의 `private_key` 값 전체. 앞뒤 따옴표는 있어도 되고 없어도 됩니다 |
| `GOOGLE_CALENDAR_IDS` | `웰치과=<캘린더ID>` 형식 |
| `TEAM_PASSWORD` | 다 같이 쓸 공용 비밀번호 |
| `SESSION_SECRET` | 아무 임의 문자열 32자 이상 |
| `INGEST_TOKEN` | 매일 아침 자동 수집용 토큰. 아무 임의 문자열 |

`SESSION_SECRET` 은 아래 명령으로 만들 수 있습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. `Deploy` 클릭

---

## 6단계. 시트 탭 만들기

1. 배포된 주소로 접속 → 로그인
2. 왼쪽 아래 `설정` 클릭
3. 구글 시트 / 구글 캘린더 상태가 모두 `정상` 인지 확인
4. `탭 만들기 · 확인` 버튼 클릭

`프로젝트`, `일일보고`, `월간보고`, `코멘트`, `알림확인`, `신규DB`, `광고비`, `매출`, `청구잔액`
탭이 만들어집니다.

> 이미 쓰고 있는 시스템에 기능을 새로 올렸을 때도 이 버튼을 한 번 눌러 주세요. 없는 탭만
> 새로 만들고 기존 탭과 데이터는 건드리지 않습니다.

---

## 자주 나오는 오류

| 증상 | 원인과 해결 |
|---|---|
| `The caller does not have permission` | 3단계 시트 공유를 안 했습니다. `client_email` 을 편집자로 초대하세요 |
| `Requested entity was not found` | `GOOGLE_SHEET_ID` 나 캘린더 ID가 틀렸습니다 |
| `GOOGLE_PRIVATE_KEY 형식이 올바르지 않습니다` | 키가 잘렸습니다. `-----BEGIN` 부터 `-----END PRIVATE KEY-----` 까지 통째로 넣으세요. 앞뒤 따옴표나 줄바꿈 형태는 앱이 알아서 처리합니다 |
| `SESSION_SECRET 환경변수(16자 이상)가 필요합니다` | 값이 없거나 너무 짧습니다 |
| 캘린더만 비어 있음 | 캘린더 공유를 안 했거나 `GOOGLE_CALENDAR_IDS` 형식이 `이름=ID` 가 아닙니다 |
| 환경변수를 고쳤는데 그대로 | Vercel은 재배포해야 반영됩니다. `Deployments` → 최신 항목 → `Redeploy` |

---

## 사람 추가하기

명단은 `src/lib/members.ts` 에 있습니다. Vercel 을 만질 필요가 없습니다.

```ts
export const ROSTER: readonly Member[] = [
  { name: '빙정호', role: '원장', director: true },
  ...
  { name: '새사람', role: '사원', director: false },   // ← 이 줄을 넣는다
];
```

- 적은 순서가 그대로 화면 순서입니다. 직급이 높은 사람부터 적습니다
- `director: true` 는 원장님 계정입니다. 남긴 코멘트가 화면에서 눈에 띄게 표시됩니다
- 저장하고 GitHub Desktop 으로 Commit → Push 하면 Vercel 이 알아서 다시 배포합니다

비밀번호는 모두 같은 `TEAM_PASSWORD` 를 씁니다. 사람이 나가면 이 값을 바꾸고 재배포하면 됩니다.

> 예전에 쓰던 `TEAM_MEMBERS` 환경변수는 더 이상 읽지 않습니다. Vercel 에 남아 있어도 무시됩니다.

---

## 로컬에서 돌려보기

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 에 5단계와 같은 값을 채우면 `http://localhost:3000` 에서 확인할 수 있습니다.
