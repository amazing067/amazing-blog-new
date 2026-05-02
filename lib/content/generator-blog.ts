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

const VISUAL_BLOCKS = `
**시각 컴포넌트 (반드시 본문에 4~6개 적극 사용 — 그래야 시각적으로 풍부함):**

각 컴포넌트는 마크다운 코드블록 형태로 출력하면 자동 렌더링됩니다.

1. **비교 카드** \\\`\\\`\\\`compare ... \\\`\\\`\\\` (사용 횟수 1~2회, 비교 정보가 있으면 무조건)
   첫 줄은 헤더 "항목 | A사 | B사 | C사", 다음 줄들은 "보험료 | 12000 | 15000 | 13000" 형태:
   \\\`\\\`\\\`compare
   항목 | 4세대 실손 | 5세대 실손
   보험료 | 기준 | 30% 인하
   비급여 보장 | 70% | 60%
   임신·출산 | X | NEW
   \\\`\\\`\\\`

2. **단계 카드** \\\`\\\`\\\`steps ... \\\`\\\`\\\` (절차·순서가 있으면 무조건)
   "번호. 제목 | 설명" 형태:
   \\\`\\\`\\\`steps
   1. 거절 사유서 확인 | 보험사가 제시한 약관 조항을 그대로 받아 적습니다
   2. 의무기록 보강 | 추가 진단서, 의사 소견서를 준비합니다
   3. 재심사 청구 | 보험사에 공식 재심사 신청서를 제출합니다
   \\\`\\\`\\\`

3. **통계 박스** \\\`\\\`\\\`stat ... \\\`\\\`\\\` (수치 강조, 1~2회)
   "값 | 라벨" 한 줄 또는 여러 줄:
   \\\`\\\`\\\`stat
   80% | 분쟁조정 청구인 승소율
   90일 | 면책기간
   1년 | 감액기간
   \\\`\\\`\\\`

4. **체크리스트 카드** \\\`\\\`\\\`checklist ... \\\`\\\`\\\` (가입·청구 전 확인 사항, 1회)
   \\\`\\\`\\\`checklist
   title: 가입 전 꼭 확인할 것
   - 면책기간이 90일인지 확인
   - 감액기간 1년인지 2년인지 확인
   - 약관에서 보장 범위 확인
   \\\`\\\`\\\`

5. **CTA 박스** \\\`\\\`\\\`cta ... \\\`\\\`\\\` (글 중간 1~2회 + 마무리 1회 = 총 2~3회)
   - 본문 30% 지점, 60% 지점에 작은 CTA (검색·상담 권유)
   - 마무리에 큰 CTA (해시태그 포함)
   - 예시들:
   \\\`\\\`\\\`cta
   title: 거절받은 보험금, 끝이 아닙니다
   body: 재심사·민원·분쟁조정까지 4단계 절차로 80% 이상 다시 받을 수 있어요.
   \\\`\\\`\\\`
   \\\`\\\`\\\`cta
   title: 지금 바로 움직이세요
   body: 거절 통보일로부터 14일 이내가 골든타임입니다. 빠르게 재심사 신청하세요.
   hashtags: #보험금청구 #재심사 #분쟁조정
   \\\`\\\`\\\`

6. **SVG 인포그래픽** (직접 SVG 그려서 1개 이상 본문에 임베드 — 가능하면 무조건 1개)
   - 마크다운에 \`<svg>...</svg>\` 직접 작성
   - viewBox는 0 0 800 400 같은 일반 비율
   - 글자는 한글, 색상은 인라인 fill 또는 style
   - 예: 4세대 vs 5세대 비교 다이어그램, 청구 절차 플로우, 면책/감액기간 타임라인
   - 절차도일 때는 사각형 박스 + 화살표
   - 통계일 때는 막대 그래프 또는 도넛
   - 글자 깨지지 않도록 font-family="sans-serif" + 한글
`;

const SEO_RULES = `
**블로그 SEO 톤·구조 (네이버/구글 검색 최적화):**

1. **제목**: 30~45자, 검색 키워드 + 후킹
2. **도입부 (200~300자)**: 공감 시나리오 → 결론 미리 살짝
3. **본문 — H2 섹션 5~7개**:
   - 각 H2는 의문문/키워드형
   - 단락 짧게 (네이버 블로그 모바일 가독성 ↑)
   - 굵게 강조 25~40회
   - **시각 컴포넌트 4~6개 적극 사용** (위 6종 중 골라서)
4. **마무리**: ##자주 묻는 질문 Q&A 3개 + ${VISUAL_BLOCKS.includes('cta') ? '\\\`\\\`\\\`cta\\\`\\\`\\\` 박스' : 'CTA'}

**메타**:
- title: SEO 제목
- meta_description: 150~160자

**분량**: 3,000~5,000자 (시각 컴포넌트 코드 제외)

**문체 (네이버 블로그 + 티스토리 SEO 최적화):**
- 친근한 1인칭 ("저는", "여러분"), 우신애 블로그 톤
- 인사말로 시작: "안녕하세요, ○○입니다" 같은 자기소개 1줄 (선택, 권장)
- **단락 매우 짧게 (2~4문장, 100~250자)** — 모바일 가독성 최우선
- 단락 사이 빈 줄로 명확히 분리
- 한 문장 25~50자
- "그런데/그래서/예를 들어/사실/근데" 연결어 적극
- 출처 일반화: "금감원 자료에 따르면", "약관에 따라"
- 강조는 굵게 + 큰따옴표 활용

**SEO 강화 요소 (반드시 포함):**
1. **검색 키워드를 제목·H2·도입부·본문에 자연스럽게 5~10회 반복**
2. **본문 마지막에 해시태그 5~10개** — \\\`\\\`\\\`cta\\\`\\\`\\\`의 hashtags 활용 또는 별도 줄
3. **외부 출처 인용**: "금감원 보도자료", "보험연구원" 같은 신뢰 기관 1~2회
4. **시각 컴포넌트 4~6개** (위 6종 중 골고루) — 체류시간 ↑

**여백·구조 주의:**
- H2 헤딩 직후 시각 컴포넌트 배치 X (헤딩 → 짧은 도입 단락 → 시각 컴포넌트)
- 시각 컴포넌트 연속 2개 이상 X (사이에 본문 1~2단락)
- 빈 줄은 단락 사이 1줄만 (2줄 이상 X)
`;

const TEMPLATE = (topic: Topic) => `당신은 보험 전문 블로거입니다. 네이버/구글 검색에서 잘 노출되는 SEO 최적화 블로그 글을 씁니다.

**주제**: "${topic.title}"
**도입 훅**: ${topic.hook}
**카테고리**: ${topic.category}
**다룰 핵심 포인트**:
${topic.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ANONYMIZATION_RULES}

${VISUAL_BLOCKS}

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
