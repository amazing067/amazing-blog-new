import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeneratedSummary, Topic } from './types';

const ANONYMIZATION_RULES = `
**절대 규칙 (위반 시 콘텐츠 폐기됩니다):**
- 보험사명 직접 언급 금지: "삼성생명/한화생명/DB손해보험/현대해상/메리츠화재" 등 어떤 회사명도 본문에 쓰지 마세요.
  - 필요하면 "한 생명보험사", "주요 손해보험사", "업계", "일부 보험사" 등으로 익명화.
- 상품명 직접 언급 금지: "○○플랜", "○○어시스트" 등 구체 상품명 금지. "실손의료보험", "암보험" 같은 일반명사로.
- 광고 절대표현 금지: 최고/최저/100%/완벽/유일/절대/무조건/확실
- 비교표현 금지: "다른 보험사보다", "타사 대비", "업계 1위"
- 보장 단정 금지: "보장됩니다", "확실히 받을 수 있", "평생 보장", "원금 보장" — 모두 "약관에 따라", "조건이 충족되면" 등 조건부로
`;

const TONE_RULES = `
**톤·구조 규칙 (카카오페이 머니콘텐츠 / 토스피드 스타일):**

1. **도입 (1단락, 3~4문장)**
   - 독자의 일상 시나리오나 흔한 오해로 시작 ("이런 경험 한 번쯤 있으시죠?", "흔히 이렇게 알고 계시는데...")
   - 핵심 결론을 미리 살짝 던져 호기심 자극

2. **본문 (3~5개 섹션)**
   - 각 섹션은 ## H2 헤딩 (질문형 또는 명확한 키워드)
   - 한 섹션은 짧은 단락(2~4문장) 2~4개로 구성
   - **굵은 글씨**로 핵심 단어 강조 (단락당 1~2회)
   - 비교/단계가 있으면 표(table) 또는 번호 리스트(1. 2. 3.) 적극 사용
   - 중간중간 \`> 💡 알아두세요\`, \`> ⚠️ 주의\`, \`> ✅ 체크리스트\` 같은 콜아웃 인용블록 1~2회

3. **마무리 (1단락)**
   - "정리하자면" 또는 "결국" 같은 마무리 어조
   - 독자가 다음에 할 행동 1~2가지 제시 ("약관에서 ○○ 항목을 확인하세요" 등)

4. **분량**: 전체 1200~1800자 (마크다운 마커 제외)

5. **문체**:
   - 친근한 존댓말 ("~이에요", "~해보세요")
   - 전문용어는 1번 등장 시 괄호 설명 ("자기부담금(본인이 내는 비율)")
   - 문장은 짧게, 한 문장 평균 25~35자

6. **마크다운 마커 활용**
   - ## (H2 섹션 헤딩 3~5개)
   - **굵게** (강조 7~12회)
   - 1. 2. 3. (단계·체크리스트)
   - | 표 | 표 | 형식 (비교가 있을 때 1~2개)
   - > 콜아웃 (1~2회)
`;

const TEMPLATE = (topic: Topic) => `
당신은 보험 소비자 가이드 작가입니다. 카카오페이 머니콘텐츠와 토스피드의 스타일로 글을 씁니다.
일반 고객이 "어, 이거 내 얘기네?" 하고 끝까지 읽게 만드는 게 목표입니다.

다음 주제로 글 한 편을 써주세요:

**제목 후보**: "${topic.title}"
**도입 훅**: ${topic.hook}
**카테고리**: ${topic.category}
**본문에서 다룰 핵심 포인트**:
${topic.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ANONYMIZATION_RULES}

${TONE_RULES}

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명·앞뒤 텍스트 없이):**
{
  "title": "최종 제목 (질문형 권장, 후킹 강하게, 30자 내외)",
  "body_md": "마크다운 본문 (## H2 섹션 3~5개, **강조** 7~12회, 표/리스트/콜아웃 적극 사용, 1200~1800자)"
}
`;

export async function generateTopicArticle(topic: Topic): Promise<GeneratedSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.9, maxOutputTokens: 16384 },
  });
  const result = await model.generateContent(TEMPLATE(topic));
  const text = result.response.text().trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) {
    console.error('[generator] raw response (no JSON braces):', text.slice(0, 1000));
    throw new Error('Gemini 응답 JSON 미발견: ' + text.slice(0, 200));
  }
  let obj: { title?: unknown; body_md?: unknown };
  try {
    obj = JSON.parse(text.slice(s, e + 1));
  } catch (parseErr) {
    console.error('[generator] JSON parse failed. Raw:', text.slice(0, 1000));
    throw parseErr;
  }
  if (typeof obj.title !== 'string' || typeof obj.body_md !== 'string') {
    throw new Error('Gemini 응답 형식 오류');
  }
  return { title: obj.title, body_md: obj.body_md };
}
