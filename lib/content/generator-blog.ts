import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedSummary, Topic } from './types';

const ANONYMIZATION_RULES = `
**절대 규칙 (위반 시 폐기):**
- 보험사명 직접 언급 금지: 삼성생명/한화생명/DB손해보험/현대해상/메리츠화재 등 회사명 X
  → "한 생명보험사", "주요 손해보험사", "업계", "일부 보험사" 로 익명화
- 상품명 직접 언급 금지: 구체 상품명 X → "실손의료보험", "암보험" 등 일반명사
- 광고 절대표현 금지: 최고/최저/100%/완벽/유일/절대/무조건/확실
- 비교표현 금지: "다른 보험사보다", "타사 대비", "업계 1위"
- 보장 단정 금지: "보장됩니다" → "약관에 따라"
- "실제 사례" 금지 → "예시 사례"
- 금액 표현 절대 금지: "수백만 원", "30만 원", "1억" 등 추상·구체 모두 X. 비율·횟수·등급으로 대체.
`;

const SEO_RULES = `
**블로그 SEO 톤·구조 (네이버/구글 검색 최적화):**

1. **제목**: 30~45자, 검색 키워드 + 후킹
   예) "5세대 실손보험 갈아타기, 4세대와 비교해서 진짜 이득일까?"

2. **도입부 (1~2단락, 300~400자)**:
   - 첫 문장에 핵심 검색 키워드 자연스럽게 포함
   - 독자 공감 시나리오 또는 흔한 오해
   - "오늘 이 글에서는 ○○에 대해 정리해드릴게요" 안내

3. **본문 — H2 섹션 정확히 5~7개**:
   - 각 H2는 검색에 잡힐 만한 짧은 의문문/키워드형
     예) "## 5세대 실손보험이 뭔가요?", "## 4세대와 무엇이 달라졌을까?"
   - 한 섹션 = 단락 3~5개 (한 단락 3~5문장, 200~400자)
   - 굵게 강조 단락당 1~3회 (전체 25~40회)
   - 비교/단계 있으면 표 또는 번호 리스트 적극 활용
   - 각 H2 사이에 자연스러운 흐름 (앞 섹션 → 다음 섹션 연결어)

4. **마무리 (Q&A 섹션 또는 정리)**:
   - "## 자주 묻는 질문" Q&A 3~5개 (각 Q는 검색 의도 반영)
   - 또는 "## 정리하면" 핵심 체크리스트

5. **메타**:
   - title: SEO 제목
   - meta_description: 150~160자, 검색 결과에 보이는 요약

**전체 분량**: 3,000~5,000자 (마크다운 마커 제외)
**굵게 강조**: 25~40회
**키워드 반복**: 핵심 키워드를 제목·H2·도입·본문에 자연스럽게 5~10회

**문체**:
- 친근한 존댓말 ("~예요", "~해보세요"), 카카오페이 톤
- 한 문장 25~50자
- 전문용어 1번 등장 시 괄호 설명
- 출처 일반화 인용 권장: "금감원 자료에 따르면", "약관에 따라"
`;

const TEMPLATE = (topic: Topic) => `당신은 보험 전문 블로거입니다. 네이버/구글 검색에서 잘 노출되는 SEO 최적화 블로그 글을 씁니다.

**주제**: "${topic.title}"
**도입 훅**: ${topic.hook}
**카테고리**: ${topic.category}
**다룰 핵심 포인트**:
${topic.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ANONYMIZATION_RULES}

${SEO_RULES}

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명·앞뒤 텍스트 없이):**
{
  "title": "SEO 제목 (30~45자, 검색 키워드 + 후킹)",
  "meta_description": "검색 결과 요약 (150~160자)",
  "body_md": "마크다운 본문 (도입 → ## H2 5~7개 → 마무리 Q&A 또는 정리, 3,000~5,000자)"
}`;

export type GeneratedBlogPost = GeneratedSummary & {
  meta_description: string;
};

export async function generateBlogPost(topic: Topic): Promise<GeneratedBlogPost> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 12000,
    temperature: 0.85,
    messages: [{ role: 'user', content: TEMPLATE(topic) }],
  });

  const block = message.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Claude 응답에 text block 없음');
  const text = block.text.trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) {
    console.error('[generator-blog] no JSON:', text.slice(0, 1000));
    throw new Error('Claude 응답 JSON 미발견');
  }
  let obj: { title?: unknown; body_md?: unknown; meta_description?: unknown };
  try {
    obj = JSON.parse(text.slice(s, e + 1));
  } catch (err) {
    console.error('[generator-blog] JSON parse failed. Raw:', text.slice(0, 1000));
    throw err;
  }
  if (typeof obj.title !== 'string' || typeof obj.body_md !== 'string') {
    throw new Error('Claude 응답 형식 오류');
  }
  return {
    title: obj.title,
    body_md: obj.body_md,
    meta_description: typeof obj.meta_description === 'string' ? obj.meta_description : '',
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    },
  };
}
