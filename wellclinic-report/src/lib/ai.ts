import 'server-only';

/**
 * 구글 Gemini 로 보고 글을 다듬는다.
 *
 * 왜 이 모델인가 (2026-08 기준)
 *   AI콜 모니터링 시스템이 3.6 Flash / 3.1 Flash Lite / 3.5 Flash Lite 의 무료 한도를 이미 넘겼다.
 *   같은 모델을 부르면 서로 한도를 빼앗아 둘 다 막히므로, 그쪽이 안 쓰면서 한도가 남아 있는
 *   3.5 Flash 를 쓴다. (Lite 가 더 가볍지만 두 Lite 모델 다 이미 소진 상태다)
 *   2.5 계열은 이 프로젝트에서 신규 사용이 막혀 있어 404 가 난다.
 *
 *   무료 한도가 하루 20회라 넉넉하지 않다. 그래서 자동으로 부르지 않고 사람이 버튼을 눌렀을 때만
 *   호출한다. 한도를 늘리려면 구글 AI Studio 에서 결제를 켠다.
 *   모델을 바꾸려면 GEMINI_MODEL 환경변수만 채우면 된다.
 *
 * SDK 를 넣지 않고 fetch 로 부른다. 쓰는 곳이 여기 하나라 의존성을 늘릴 이유가 없다.
 */

const DEFAULT_MODEL = 'gemini-3.5-flash';

function model(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export interface AiResult {
  ok: boolean;
  text: string;
  message: string;
}

/** 무엇이 잘못됐는지 사람이 알아볼 수 있게 바꿔 준다 */
function explain(status: number, raw: string): string {
  if (status === 429) {
    return 'AI 사용량(무료 한도)을 다 썼습니다. 내일 다시 시도하거나 구글 AI Studio에서 결제를 켜 주세요.';
  }
  if (status === 400 && /API key not valid/i.test(raw)) {
    return 'GEMINI_API_KEY 가 올바르지 않습니다. 구글 AI Studio에서 키를 다시 확인해 주세요.';
  }
  if (status === 403) {
    return 'AI 키에 권한이 없습니다. Generative Language API 가 켜져 있는지 확인해 주세요.';
  }
  if (status === 404) {
    return `모델 '${model()}' 을 찾지 못했습니다. GEMINI_MODEL 환경변수를 확인해 주세요.`;
  }
  return `AI 호출이 실패했습니다. (${status})`;
}

/**
 * 지시문과 원문을 보내고 다듬은 글을 받는다.
 * 실패해도 예외를 던지지 않는다. 화면은 원문을 그대로 두고 메시지만 보여 주면 된다.
 */
export async function ask(instruction: string, input: string): Promise<AiResult> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return { ok: false, text: '', message: 'AI가 아직 연결되지 않았습니다. 설정 화면을 확인해 주세요.' };
  }
  if (!input.trim()) {
    return { ok: false, text: '', message: '정리할 내용이 비어 있습니다.' };
  }

  // 응답이 늦어질 때 화면이 하염없이 기다리지 않게 끊는다
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents: [{ role: 'user', parts: [{ text: input }] }],
          generationConfig: {
            temperature: 0.2,      // 사실을 지어내지 않게 낮게 둔다
            // 3.x 모델은 답을 내기 전에 생각을 하고, 그 생각도 이 한도를 같이 쓴다.
            // 1200 으로 뒀더니 생각에 다 쓰고 요약이 문장 중간에서 잘렸다. 넉넉히 준다.
            // 생각을 끄면(thinkingBudget 0) 빠르지만 항목을 묶지 못하고 한 덩어리로 쏟아낸다.
            maxOutputTokens: 4000,
          },
        }),
        signal: controller.signal,
      },
    );

    const raw = await res.text();
    if (!res.ok) {
      console.error('[ai] 실패', res.status, raw.slice(0, 300));
      return { ok: false, text: '', message: explain(res.status, raw) };
    }

    const data = JSON.parse(raw) as {
      candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
    };
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    // 한도에 걸려 문장 중간에서 끊긴 글을 그대로 넣어 주면 안 된다
    if (candidate?.finishReason === 'MAX_TOKENS') {
      return {
        ok: false,
        text: '',
        message: '내용이 너무 길어 AI가 끝까지 정리하지 못했습니다. 나눠서 정리해 주세요.',
      };
    }
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
      return { ok: false, text: '', message: 'AI가 이 내용은 정리하지 않았습니다. 직접 다듬어 주세요.' };
    }
    if (!text) {
      return { ok: false, text: '', message: 'AI가 빈 답을 돌려줬습니다. 다시 시도해 주세요.' };
    }
    return { ok: true, text, message: '정리했습니다.' };
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      return { ok: false, text: '', message: 'AI 응답이 너무 오래 걸려 중단했습니다.' };
    }
    console.error('[ai] 오류', e);
    return { ok: false, text: '', message: 'AI를 부르는 중 문제가 생겼습니다.' };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// 지시문
//
// 공통 원칙: 없는 사실을 만들지 않는다. 보고는 원장님이 읽는 기록이라
// 매끄럽게 고치려다 내용이 바뀌면 안 다듬느니만 못하다.
// ---------------------------------------------------------------------------

export const TIDY_DAILY = `당신은 치과 마케팅팀의 일일 업무보고를 다듬는 편집자다.

받은 글을 아래 형식으로 정리해서 "정리된 본문만" 출력한다. 설명, 인사말, 코드블록 표시는 붙이지 않는다.

형식
- 큰 항목은 "1. " "2. " 처럼 번호를 붙인다
- 항목에 딸린 세부 내용은 "  - " 로 두 칸 들여쓴다
- 한 줄에 한 가지 일만 적는다

지켜야 할 것
- 없는 내용을 추가하지 않는다. 원문에 있는 사실만 쓴다
- 사람 이름, 직함, 기관명, 날짜, 시각, 숫자, 금액은 원문 그대로 둔다
- URL 은 한 글자도 바꾸지 않고 그대로 옮긴다. 앞의 설명과 같은 항목에 딸린 세부 내용으로 넣는다
- 비밀번호나 계정 정보처럼 보이는 값도 그대로 둔다
- 문장은 "~함", "~완료" 같은 간결한 보고체로 통일한다
- 중복된 항목은 하나로 합친다
- 내용이 이미 잘 정리돼 있으면 거의 그대로 둔다`;

export const DRAFT_MONTHLY = `당신은 치과 마케팅팀의 월간보고 초안을 쓰는 편집자다.

한 달치 일일보고를 프로젝트별로 묶은 목록을 받는다. 이것을 원장님께 보고할 "성과 요약"으로 정리해서 요약문만 출력한다.

형식
- 프로젝트(또는 분류)마다 "[이름]" 으로 시작하는 한 덩어리
- 그 아래 "- " 로 그달에 한 일을 3줄 안팎으로 묶어 적는다
- 비슷한 일은 합쳐서 한 줄로 만든다

지켜야 할 것
- 없는 성과를 만들지 않는다. 목록에 있는 사실만 쓴다
- 숫자, 금액, 날짜, 기관명, 사람 이름은 원문 그대로 둔다
- URL, 비밀번호, 계정 정보는 요약문에 넣지 않는다
- 평가나 감상("잘 진행됨", "성공적")은 쓰지 않는다. 한 일만 적는다
- 전체 15줄을 넘기지 않는다`;
