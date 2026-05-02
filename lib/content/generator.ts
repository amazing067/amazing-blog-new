import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedSummary, Topic } from './types';

const ANONYMIZATION_RULES = `
**절대 규칙 (위반 시 콘텐츠 폐기):**
- 보험사명 직접 언급 금지: 삼성생명/한화생명/DB손해보험/현대해상/메리츠화재 등 회사명 일절 X
  → "한 생명보험사", "주요 손해보험사", "업계", "일부 보험사" 로 익명화
- 상품명 직접 언급 금지: "○○플랜" 같은 구체 상품명 X → "실손의료보험", "암보험" 등 일반명사
- 광고 절대표현 금지: 최고/최저/100%/완벽/유일/절대/무조건/확실
- 비교표현 금지: "다른 보험사보다", "타사 대비", "업계 1위"
- 보장 단정 금지: "보장됩니다", "확실히", "평생 보장" → "약관에 따라", "조건 충족 시" 로 조건부
`;

// 카카오페이/토스피드 분석 후 정착시킨 5종 콜아웃 — 본문 시각 풍성함의 핵심
const CALLOUT_RULES = `
**5종 콜아웃 (본문에 2~4개 적극 사용):**
- \`> 💡 [알아두세요]\` 핵심 정보 (가장 자주 사용)
- \`> ⚠️ [주의]\` 함정·실수 경고
- \`> ✅ [체크리스트]\` 행동 항목 (1.~3.)
- \`> 📌 [핵심 요약]\` 마무리 박스
- \`> 💬 [실제 사례]\` 가상의 케이스로 이해 돕기
콜아웃 안에는 짧은 단락 1~3개. 콜아웃 시작은 위 형식 정확히 (이모지 + 대괄호 라벨).
`;

const TONE_RULES = `
**톤·구조 (카카오페이 머니콘텐츠 / 토스피드 스타일):**

1. **도입 (3~4문장)**: 독자의 일상 시나리오 또는 흔한 오해로 시작 → 핵심 결론 살짝 던짐
   예) "보험료가 30% 싸진다는데, 정작 갈아타면 손해 보는 사람도 있어요. 정말 갈아타도 되는 걸까요?"

2. **본문 (## 헤딩 3~5개)**:
   - 한 섹션 = 짧은 단락 2~4개 (한 단락 2~4문장)
   - **굵게**로 핵심 단어 강조 (단락당 1~2회)
   - 비교/단계가 있으면 표 또는 번호 리스트 적극 사용
   - 5종 콜아웃을 본문 흐름에 자연스럽게 2~4회 배치

3. **마무리 (📌 핵심 요약 콜아웃 1개)**: "이렇게 정리하시면 됩니다" 톤. 독자가 다음에 할 행동 1~2가지.

4. **분량**: 1500~2200자 (마크다운 마커 제외)

5. **문체**:
   - 친근한 존댓말 ("~이에요", "~해보세요", "~인데요")
   - 전문용어는 1번 등장 시 괄호 설명 ("자기부담금(본인이 내는 금액)")
   - 한 문장 25~40자, 너무 길지 않게
   - 첫 단어로 "그래서/근데/사실/혹시" 같은 자연스러운 연결어 적극

6. **수치는 신중하게**: 확실하지 않은 수치(예: 정확한 보험료, 자기부담률, 한도 등)는 쓰지 마세요. 일반론으로 서술. 검증된 사실만 기술.
`;

const TEMPLATE = (topic: Topic) => `당신은 보험 소비자 가이드 전문 작가입니다. 카카오페이 머니콘텐츠와 토스피드의 스타일로 글을 씁니다.
일반 고객이 "어, 이거 내 얘기네?" 하고 끝까지 읽게 만드는 게 목표입니다.

다음 주제로 글 한 편을 작성하세요:

**제목 후보**: "${topic.title}"
**도입 훅**: ${topic.hook}
**카테고리**: ${topic.category}
**본문에서 다룰 핵심 포인트**:
${topic.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ANONYMIZATION_RULES}

${CALLOUT_RULES}

${TONE_RULES}

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명·앞뒤 텍스트 없이):**
{
  "title": "최종 제목 (질문형 권장, 후킹 강하게, 30자 내외)",
  "body_md": "마크다운 본문 (## 헤딩 3~5개, **강조** 8~14회, 5종 콜아웃 2~4개, 표/리스트 활용, 1500~2200자)"
}`;

export async function generateTopicArticle(topic: Topic): Promise<GeneratedSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8192,
    temperature: 0.9,
    messages: [{ role: 'user', content: TEMPLATE(topic) }],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude 응답에 text block 없음');
  }
  const text = textBlock.text.trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) {
    console.error('[generator] Claude raw (no JSON):', text.slice(0, 1000));
    throw new Error('Claude 응답 JSON 미발견: ' + text.slice(0, 200));
  }
  let obj: { title?: unknown; body_md?: unknown };
  try {
    obj = JSON.parse(text.slice(s, e + 1));
  } catch (err) {
    console.error('[generator] JSON parse failed. Raw:', text.slice(0, 1000));
    throw err;
  }
  if (typeof obj.title !== 'string' || typeof obj.body_md !== 'string') {
    throw new Error('Claude 응답 형식 오류');
  }
  return { title: obj.title, body_md: obj.body_md };
}
