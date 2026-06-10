import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedCardSet, CardSlide, Topic, CardIconKey, SlideSource } from './types';
import { findVerifiedSource } from './verified-stats';

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

**🚫 부정·공포·비하 자극어 절대 금지 (손보협회 금지단어 — 즉시 반송):**
- ❌ "함정", "낚시", "호구/호갱", "눈탱이", "바가지", "독박", "사기", "속는다/당한다", "뒤통수", "폭탄", "깡통"
- 보험을 부정적으로 묘사하거나 소비자를 비하하는 표현 일절 X. 대괄호 강조("[함정]")도 금지.
- 후킹은 "놓치기 쉬운 점", "꼭 확인할 점", "의외의 포인트" 같은 중립 표현으로.

**🚫 상품 목적 오인 금지 (반송 사유):**
- 연금보험·보장성보험을 "저축/적금/재테크/투자/돈 굴리기"로 표현 X. (연금보험 = 노후소득 보장 상품)
- eyebrow·title·body 어디에도 "저축", "재테크", "투자" 로 보험을 묶지 말 것.

**💰 금액·단위 유추 표현 절대 금지 (반송 1순위 사유):**
- ❌ 구체 액수: "30만 원", "월 5만 원", "1억 원", "5,000원", "100만원", "약 50만원"
- ❌ 추상 액수: "수백만 원", "수천만 원", "수억", "몇십만 원", "수십만"
- ❌ 단위만이라도: "○○만 원", "○○억", "XX원", "약 XX원", "[약XX원]"
- ❌ 보험료 차액 유추: "보험료가 X원 싸진다", "월 X만원 절감", "연 X원 차이"
- ❌ 단위 빈칸 placeholder: "약 □만원", "X원 차이"
- 모든 텍스트(title·body·eyebrow·bigStatLabel·items·footer)에서 **숫자+원/만/억/천 조합 일절 사용 금지**.
- 보험료 비교가 필요하면 "보험료 차이 큼", "절감 효과", "구간별 차이" 같은 정성 표현으로.
`;

// bigStat 정책 — 수치 환각이 광고심의 반송 1순위라서 prompt 차원에서 원천 차단.
// 검증된 통계 카탈로그(verified-stats.ts)에 등록된 항목만 통계 인용 가능.
// 그 외 모든 카드는 bigStat을 개념어로만 작성.
const BIG_STAT_RULES = `
**🚫 bigStat 절대 규칙 (광고심의 통과 핵심):**

bigStat에 **숫자/% 환각**은 광고심의 반송 1순위입니다.
당신은 통계 자료를 직접 검증할 수 없으므로, **모든 수치 표현을 사용하지 마세요.**

**❌ 절대 금지 (어떤 형태든 X):**
- "30%", "약 30%", "37%", "2배", "약 2배", "1.5배", "2.4배"
- "5년", "10년", "30일", "연 1회", "최대 3회", "1점 차이", "3개월"
- "절반", "1/3", "두 배", "세 배" — 비율 표현 모두 X
- 숫자가 들어간 어떤 표현도 금지

**✅ 오직 다음 카테고리의 개념어만 허용 (6자 이내):**
- 변화 방향: "한도 ↑", "한도 ↓", "비급여 ↓", "월보험료 ↓", "보장 ↑"
- 신호 라벨: "NEW", "주의", "확인 필수", "갱신", "면책", "추가"
- 비교 라벨: "차이 큼", "추가 한도", "비교 필요", "별도 한도", "구간 차이"
- 상태 라벨: "갱신형", "비갱신", "표준형", "선택형", "유의"

**bigStatLabel(12자 이내)도 마찬가지로 숫자 0개.**
- ✅ OK: "월 보험료 인하", "임신·출산 보장", "IRP 추가 한도", "비급여 항목"
- ❌ NO: "30만원 차이", "5년 갱신주기", "월 1회 청구"

**title·body·items·eyebrow·footer 모든 필드에서도 숫자형 표현 금지:**
- ❌ "30%", "37%", "2배", "1.5배", "1점", "5년", "10배", "절반", "1/3" — %·배·점·년수·비율 전부 X
- ❌ 주제·훅·아웃라인에 숫자(%·배·금액·점수)가 있어도 **그건 내부 참고용**일 뿐, 카드 텍스트에 절대 옮기지 마세요.
- 숫자가 꼭 필요하면 "차이 큼", "구간별 차이", "단계에 따라" 같은 정성 표현 또는 "약관에 따라"로 일반화.

**source 필드는 비워두세요(생략).** 검증된 출처는 시스템에서 자동으로 매핑합니다.
`;

// 자주 틀리는 사실관계 가드 — 협회 반송 사유 기반. 단정적 오류를 원천 차단.
const FACT_GUARDS = `
**📌 사실관계 주의 (단정 금지 — 반송 사유):**
- 실손의료보험은 **표준화** 이후 자기부담금 범위·기본 보장내역이 **보험사 간 동일**합니다.
  → "본인부담금/보장이 보험사마다 다르다"라고 단정 X. 차이가 있다면 비급여 특약·갱신주기 등 **제한적 부분**으로만 기술.
- 연금보험은 노후소득 보장 상품 — "저축/투자로 돈을 불린다"는 식의 단정 X.
- 비과세·세제혜택은 "요건 충족 시 적용"으로만. "무조건 비과세" 같은 단정 X.
- 특정 진단·등급·점수로 보험금이 "얼마 갈린다"는 금액·수치 단정 X (위 숫자 금지 규칙 준수).
`;

const STRUCTURE = `
**카드뉴스 구조 — 정확히 5장:**

1. **cover (1장)**: 표지
   - eyebrow: 카테고리 키워드 (예: "5세대 실손보험")
   - title: 핵심 질문/메시지 (15~22자, 짧고 후킹)
   - bigStat: **개념어만** (6자 이내, 숫자 0개) — 위 BIG_STAT_RULES 참조
   - bigStatLabel: 의미 라벨 (12자 이내, 숫자 0개)
   - iconKey: 주제 맞는 아이콘
   - source: 생략 (시스템 자동 매핑)

2. **point (3장)**: 핵심 포인트 3개
   - number: "01", "02", "03"
   - bigStat: **개념어만** (6자 이내, 숫자 0개)
   - bigStatLabel: 라벨 (12자 이내, 숫자 0개)
   - title: 짧은 헤딩 (15~24자)
   - body: 본문 1~2문장 (45~70자, 짧고 명확)
   - iconKey: 주제 맞는 아이콘
   - source: 생략

3. **closing (1장)**: 마무리 체크리스트
   - title: 헤딩 (12~18자, 예: "결정 전 체크 3가지")
   - items: 3개 (각 12~18자, 한 줄에 들어가는 길이)
   - footer: 면책 한 줄 ("본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다." 권장)
   - iconKey: clipboard 또는 sparkles
`;

const ICON_GUIDE = `
**iconKey 선택 가이드:**
- sparkles: 표지·신상품·신규
- shield: 보장·안전
- trendingDown: 가격 인하·축소·절감
- alert: 주의·유의·놓치기 쉬운 점
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

${BIG_STAT_RULES}

${FACT_GUARDS}

${STRUCTURE}

${ICON_GUIDE}

**문체**:
- 친근한 존댓말 ("~예요", "~네요", "~해보세요")
- 한 카드 = 한 메시지. 짧고 명확.
- 수치 대신 비교 구조·체크리스트·NEW/주의 라벨로 후킹.

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명·앞뒤 텍스트 없이):**
{
  "title": "전체 콘텐츠 제목",
  "slides": [
    { "kind":"cover", "eyebrow":"...", "title":"...", "bigStat":"NEW", "bigStatLabel":"...", "iconKey":"sparkles" },
    { "kind":"point", "number":"01", "bigStat":"한도 ↑", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"trendingDown" },
    { "kind":"point", "number":"02", "bigStat":"주의", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"alert" },
    { "kind":"point", "number":"03", "bigStat":"확인 필수", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"search" },
    { "kind":"closing", "title":"...", "items":["...","...","..."], "footer":"본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다.", "iconKey":"clipboard" }
  ]
}

bigStat·bigStatLabel은 절대 숫자를 포함하지 마세요. source는 비워두세요.`;

function isValidIconKey(k: unknown): k is CardIconKey {
  return typeof k === 'string' && ICON_KEYS.includes(k as CardIconKey);
}

// 숫자/% 등 수치 표현이 들어왔는지 검사. AI가 prompt를 어겨도 후방에서 잡는 안전망.
const NUMERIC_PATTERN = /[0-9０-９]|[일이삼사오육칠팔구십백천만억]\s*(?:[%％]|배|년|일|주|월|회|점|건|명|호|차|단계|개|개월)/;

function stripNumericBigStat(value: string, fallback: string): string {
  const v = value.trim();
  if (!v) return fallback;
  if (NUMERIC_PATTERN.test(v)) return fallback;
  return v.length > 8 ? fallback : v;
}

// 본문(body·title·items·eyebrow·footer 등)에서 금액·단위 유추 표현을 정성 표현으로 자동 치환.
// 광고심의 반송 1순위가 "약 XX원" 같은 보험료 차액 표현이라 prompt 강화에 더해 후방에서도 잡는다.
const MONEY_REPLACERS: Array<[RegExp, string]> = [
  // [약 XX원], (약 5만원) 같은 괄호 둘러싼 placeholder/실숫자
  [/[\[\(（［]\s*(?:약|월|연)?\s*[\dxX○*□Xx＿_\s]+\s*[천만억]?\s*원\s*[\]\)）］]/g, '보험료'],
  // "약 30만원", "월 5만원", "연 30만원", "약 XX원"
  [/(?:약|월|연)\s*[\dxX○*□＿_]+\s*(?:[천만억]\s*)?원/g, '보험료'],
  // 단순 "30만원", "5,000원", "1억원", "100만 원"
  [/[\d,]+\s*(?:[천만억]\s*)?원/g, '보험료'],
  // 추상 액수: "수백만원", "수천만원", "수억원", "수십만"
  [/수\s*(?:백|천|만|억|십)\s*만?\s*원?/g, '상당액'],
  [/몇\s*(?:백|천|만|억|십)\s*만?\s*원?/g, '상당액'],
  // 단위 placeholder: "○○만원", "XX원", "□□만원"
  [/[○xX□＿_]{1,3}\s*(?:[천만억]\s*)?원/g, '보험료'],
  // 잔여 정리: 연속 공백·"보험료 보험료" 중복
  [/\s+/g, ' '],
  [/(보험료\s*){2,}/g, '보험료 '],
  [/(상당액\s*){2,}/g, '상당액 '],
];

function sanitizeMoney(text: string): string {
  let v = text;
  for (const [pat, rep] of MONEY_REPLACERS) {
    v = v.replace(pat, rep);
  }
  return v.trim();
}

function sanitizeMoneyArray(items: string[]): string[] {
  return items.map(sanitizeMoney);
}

// AI가 만든 source는 카탈로그(verified-stats.ts)에 등록된 항목만 통과.
// 그 외엔 undefined → 슬라이드에 출처 표시 안 됨 → 가짜 출처 차단.
function parseSource(raw: unknown, contextText: string): SlideSource | undefined {
  if (!raw || typeof raw !== 'object') {
    // AI가 source 안 줘도, 컨텍스트로 카탈로그 매칭 시도
    const matched = findVerifiedSource({ context: contextText });
    if (matched) {
      return {
        organization: matched.source.organization,
        name: matched.source.name,
        url: matched.source.url,
        retrieved_at: matched.retrieved_at,
      };
    }
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const organization = String(r.organization ?? '').trim();
  const name = String(r.name ?? '').trim();
  if (!organization && !name) return undefined;
  const matched = findVerifiedSource({ organization, name, context: contextText });
  if (!matched) return undefined; // 카탈로그 미등록 출처는 폐기 (환각 차단)
  return {
    organization: matched.source.organization,
    name: matched.source.name,
    url: matched.source.url,
    retrieved_at: matched.retrieved_at,
  };
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
      const rawStat = String(s.bigStat ?? '');
      const rawLabel = String(s.bigStatLabel ?? '');
      const bigStat = stripNumericBigStat(rawStat, '확인 필수');
      const bigStatLabel = stripNumericBigStat(rawLabel, '핵심 포인트');
      const ctx = `${s.title ?? ''} ${rawLabel} ${rawStat}`;
      result.push({
        kind: 'cover',
        eyebrow: sanitizeMoney(String(s.eyebrow ?? '')),
        title: sanitizeMoney(String(s.title ?? '')),
        bigStat: sanitizeMoney(bigStat),
        bigStatLabel: sanitizeMoney(bigStatLabel),
        iconKey,
        source: parseSource(s.source, ctx),
      });
    } else if (s.kind === 'point') {
      const rawStat = String(s.bigStat ?? '');
      const rawLabel = String(s.bigStatLabel ?? '');
      const bigStat = stripNumericBigStat(rawStat, '주의');
      const bigStatLabel = stripNumericBigStat(rawLabel, '핵심 포인트');
      const ctx = `${s.title ?? ''} ${s.body ?? ''} ${rawLabel} ${rawStat}`;
      result.push({
        kind: 'point',
        number: String(s.number ?? `0${i}`),
        bigStat: sanitizeMoney(bigStat),
        bigStatLabel: sanitizeMoney(bigStatLabel),
        title: sanitizeMoney(String(s.title ?? '')),
        body: sanitizeMoney(String(s.body ?? '')),
        iconKey,
        source: parseSource(s.source, ctx),
      });
    } else {
      const rawItems = Array.isArray(s.items) ? s.items.map(String).slice(0, 3) : [];
      while (rawItems.length < 3) rawItems.push('');
      result.push({
        kind: 'closing',
        title: sanitizeMoney(String(s.title ?? '')),
        items: sanitizeMoneyArray(rawItems),
        footer: sanitizeMoney(String(s.footer ?? '본 콘텐츠는 정보 제공 목적이며, 보장은 약관에 따릅니다.')),
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
