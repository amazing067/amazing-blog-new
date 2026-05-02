import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedCardSet, CardSlide, Topic, CardIconKey } from './types';

const ICON_KEYS: CardIconKey[] = [
  'sparkles', 'shield', 'trendingDown', 'alert',
  'gift', 'stethoscope', 'calculator', 'baby',
  'search', 'clipboard', 'zap', 'arrow',
];

const ANONYMIZATION_RULES = `
**절대 규칙 (위반 시 폐기):**
- 보험사명 직접 언급 금지: 삼성생명/한화생명/DB손해보험/현대해상/메리츠화재 등 어떤 회사명도 X
  → "한 생명보험사", "주요 손해보험사", "업계", "일부 보험사" 로 익명화
- 상품명 직접 언급 금지: "○○플랜" 같은 구체 상품명 X → "실손의료보험", "암보험" 등 일반명사
- 광고 절대표현 금지: 최고/최저/100%/완벽/유일/절대/무조건/확실
- 비교표현 금지: "다른 보험사보다", "타사 대비", "업계 1위"
- 보장 단정 금지: "보장됩니다", "확실히" → "약관에 따라", "조건 충족 시"
- "실제 사례" 금지 → 가상 케이스 필요시 "예시 사례"로

**💰 금액 표현 절대 금지 (어떤 형태든 X):**
- **추상 액수 X**: "수백만 원", "수천만 원", "수억", "몇십만 원"
- **구체 액수 X**: "30만 원", "월 5만 원", "1억 원", "5,000원", "100만원"
- **단위만이라도 X**: "○○만", "○○억", "○○천만" — 숫자+화폐단위 조합 모두 금지
- **돈을 떠올리게 하는 어떤 표현도 쓰지 마세요.**

대신 다음만 사용:
- **상대 비율**: "약 30% ↓", "약 2배", "절반"
- **횟수·기간**: "연 1회", "최대 3회", "30일 이내"
- **등급·점수**: "CDR 1점", "1등급"
- **개념어**: "NEW", "비급여 ↓", "면책", "갱신"
- **단계 차이**: "1점 차이", "한 단계"

bigStat 예시:
- ✅ OK: "30% ↓", "약 2배", "NEW", "비급여 ↓", "1점 차이", "최대 3회", "연 1회"
- ❌ NO: "수백만 원", "월 30만 원", "1억", "30만 원", "5만원짜리", "○○억"

body·title·bigStatLabel·items — **모든 텍스트에서 금액 단어 일절 사용 금지**.
`;

const STRUCTURE = `
**카드뉴스 구조 — 정확히 5장:**

1. **cover (1장)**: 표지
   - eyebrow: 카테고리 또는 키워드 (예: "5세대 실손보험")
   - title: 핵심 질문 또는 메시지 (15~22자, 짧고 후킹)
   - bigStat: 표지의 거대 통계, **반드시 6자 이내** (예: "30% ↓", "약 2배", "NEW", "비급여 ↓", "1점 차이")
   - bigStatLabel: 통계의 의미, **반드시 12자 이내, 한 줄에 들어가는 짧은 표현** (예: "월 보험료 인하", "임신·출산 보장")
   - iconKey: 주제에 맞는 아이콘 키 (sparkles 등)

2. **point (3장)**: 핵심 포인트 3개
   - number: "01", "02", "03" 순
   - bigStat: 거대 숫자/% **6자 이내** (예: "약 30%", "비급여 ↓", "NEW", "1점 차이")
   - bigStatLabel: 라벨 **12자 이내, 한 줄 짧은 표현** (예: "월 보험료", "도수·영양 보장")
   - title: 짧은 헤딩 (15~24자, 한 줄에 들어가야 함)
   - body: 본문 1~2문장 (45~70자, 짧고 명확)
   - iconKey: 주제 맞는 아이콘

3. **closing (1장)**: 마무리 체크리스트
   - title: 헤딩 (12~18자, 예: "결정 전 체크 3가지")
   - items: 3개 항목 (각 12~18자, **반드시 한 줄에 들어가는 길이**)
   - footer: 면책 한 줄 ("본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다." 권장)
   - iconKey: clipboard 또는 sparkles
`;

const ICON_GUIDE = `
**아이콘 키 (iconKey) 선택 가이드 — 주제에 가장 맞는 것:**
- sparkles: 표지·신상품·신규
- shield: 보장·안전
- trendingDown: 가격 인하·축소·절감
- alert: 주의·함정·놓치기 쉬운 점
- gift: 혜택·환급
- stethoscope: 의료·진단
- calculator: 계산·세제·비용
- baby: 출산·자녀
- search: 검색·확인·점검
- clipboard: 마무리·체크리스트
- zap: 빠른 결정·즉시
- arrow: 변환·갈아타기
`;

const PROMPT = (topic: Topic) => `당신은 카카오페이/토스피드 톤의 보험 카드뉴스 작가입니다.
일반 고객이 인스타에서 슬라이드를 끝까지 넘기게 만드는 5장 시리즈를 만듭니다.

**주제**: "${topic.title}"
**도입 훅**: ${topic.hook}
**카테고리**: ${topic.category}
**다룰 핵심 포인트**:
${topic.outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}

${ANONYMIZATION_RULES}

${STRUCTURE}

${ICON_GUIDE}

**문체**:
- 친근한 존댓말 ("~예요", "~네요", "~해보세요")
- 한 카드 = 한 메시지. 짧고 명확.
- 수치는 신중하게 — 확실하지 않은 구체 수치는 "약", "추정" 등으로
- 출처 일반화 인용 권장: "금감원 자료에 따르면", "약관에 따라" 등 신뢰 기관

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명·앞뒤 텍스트 없이):**
{
  "title": "전체 콘텐츠 제목 (표지 title과 동일하거나 비슷)",
  "slides": [
    { "kind":"cover", "eyebrow":"...", "title":"...", "bigStat":"...", "bigStatLabel":"...", "iconKey":"sparkles" },
    { "kind":"point", "number":"01", "bigStat":"...", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"trendingDown" },
    { "kind":"point", "number":"02", "bigStat":"...", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"alert" },
    { "kind":"point", "number":"03", "bigStat":"...", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"baby" },
    { "kind":"closing", "title":"...", "items":["...","...","..."], "footer":"본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다.", "iconKey":"clipboard" }
  ]
}`;

function isValidIconKey(k: unknown): k is CardIconKey {
  return typeof k === 'string' && ICON_KEYS.includes(k as CardIconKey);
}

function validateSlides(slides: unknown): CardSlide[] {
  if (!Array.isArray(slides) || slides.length !== 5) {
    throw new Error(`slides는 정확히 5개여야 하는데 ${Array.isArray(slides) ? slides.length : 'not array'}개`);
  }
  const result: CardSlide[] = [];
  for (let i = 0; i < 5; i++) {
    const s = slides[i] as Record<string, unknown>;
    const expectedKind = i === 0 ? 'cover' : i === 4 ? 'closing' : 'point';
    if (s.kind !== expectedKind) {
      throw new Error(`slide[${i}].kind는 "${expectedKind}"여야 하는데 "${s.kind}"`);
    }
    const iconKey = isValidIconKey(s.iconKey) ? s.iconKey : 'sparkles';
    if (s.kind === 'cover') {
      result.push({
        kind: 'cover',
        eyebrow: String(s.eyebrow ?? ''),
        title: String(s.title ?? ''),
        bigStat: String(s.bigStat ?? ''),
        bigStatLabel: String(s.bigStatLabel ?? ''),
        iconKey,
      });
    } else if (s.kind === 'point') {
      result.push({
        kind: 'point',
        number: String(s.number ?? `0${i}`),
        bigStat: String(s.bigStat ?? ''),
        bigStatLabel: String(s.bigStatLabel ?? ''),
        title: String(s.title ?? ''),
        body: String(s.body ?? ''),
        iconKey,
      });
    } else {
      const items = Array.isArray(s.items) ? s.items.map(String).slice(0, 3) : [];
      while (items.length < 3) items.push('');
      result.push({
        kind: 'closing',
        title: String(s.title ?? ''),
        items,
        footer: String(s.footer ?? '본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다.'),
        iconKey,
      });
    }
  }
  return result;
}

export async function generateCardSet(topic: Topic): Promise<GeneratedCardSet> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    temperature: 0.85,
    messages: [{ role: 'user', content: PROMPT(topic) }],
  });

  const block = message.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Claude 응답에 text block 없음');
  const text = block.text.trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) {
    console.error('[generator-card] no JSON:', text.slice(0, 500));
    throw new Error('Claude 응답에서 JSON 못 찾음');
  }
  const obj = JSON.parse(text.slice(s, e + 1)) as { title?: unknown; slides?: unknown };
  const title = String(obj.title ?? '');
  const slides = validateSlides(obj.slides);
  return {
    title,
    slides,
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    },
  };
}
