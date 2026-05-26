import Anthropic from '@anthropic-ai/sdk';
import type { GeneratedCardSet, CardSlide, CardIconKey, RecruitTopic, RecruitCompare, RecruitGridItem } from './types';

const ICON_KEYS: CardIconKey[] = [
  'sparkles', 'shield', 'trendingDown', 'alert',
  'gift', 'stethoscope', 'calculator', 'baby',
  'search', 'clipboard', 'zap', 'arrow',
];

// 리쿠르팅 가드레일 — 협회 심의는 면제지만 직업안정법·금소법·섀도우밴·2030 불신은 살아있음.
const RECRUIT_GUARDRAILS = `
**🚫 절대 금지 (위반 시 광고법 위반·계정 제재·역효과):**
1. 소득 보장·과장 (직업안정법 제34조 = 5년 이하 징역·5천만원):
   - ❌ "고수익 보장", "월 ○○만원 확정/보장", "무조건", "누구나 가능", "떼돈", "쉽게 번다"
   - ✅ 대신: "성과에 따라 다릅니다", "상위 사례는 생각보다 큽니다", "한 만큼 가져가는 구조" (범위·조건부 표현만)
2. 럭셔리·플렉스 인증 (2030 다단계 연상 = 거부 트리거):
   - ❌ 외제차·명품·롤렉스·"이달의 왕"·트로피·연봉/수익 인증샷
   - ✅ 대신: 현실적인 하루 루틴, 시간 자율성, 전문성 성장 경로
3. 유사수신·다단계 연상:
   - ❌ "월급관리 스터디", "투자 권유", "원금/수익률 보장", "하위 모집"
   - ✅ 직업을 그대로 솔직하게 소개
4. 전화번호 직접 노출 금지 → "DM으로 문의"로 (금소법 업무광고 경계)

**핵심 메시지 방향 (2030이 유일하게 긍정 반응):** 시간 자율성 + 전문성 성장 + 현실적 소득 경로.
보험사명·특정 상품명은 쓰지 말 것 (어메이징 사업부 / GA / 회사 로 일반화).
`;

const BIG_STAT_RULES = `
**bigStat (6자 이내) — 숫자보다 개념·감정 라벨로 후킹:**
- ✅ 예: "퇴사각", "DB 제공", "자유근무", "성과형", "NEW", "솔직후기", "멘토 O", "N잡 OK"
- bigStatLabel(12자 이내)도 짧게. 소득 보장 뉘앙스 금지.
`;

const STRUCTURE = `
**카드뉴스 구조 — 정확히 6장 (인스타 캐러셀 설득 최적):**
각 슬라이드는 "한 장 = 한 메시지". 1·2·3장은 각각 따로 봐도 후킹되게 독립적으로.

1. **cover (1장)** — 후킹: 타깃의 현재 고통/욕구를 한 문장으로 찌르기
   - eyebrow: 짧은 키워드(예: "직장인 → 설계사")
   - title: 후킹 문장 (15~24자), bigStat(개념 라벨), bigStatLabel, iconKey
   - 배경에 듀오톤 사진이 깔리므로 title은 짧고 강하게
2. **point 01 (2장) — 비교 인포그래픽 (layout:"compare")**: "직장인 vs 설계사" 또는 "예전 vs 지금" 대비
   - compare: { "aTitle":"직장인", "aItems":["..","..(2~3개, 각 8~16자)"], "bTitle":"설계사", "bItems":["..",".."] }
   - aTitle/bTitle은 카드 헤더로 크게 가운데 표시됨 → 2~4자 짧은 명사. title은 짧은 헤딩(예 "뭐가 다를까?")
3. **point 02 (3장)** — 통념 깨기/전환점 (layout:"default"): "근데 다를 수 있다". 배경 사진 위 흰 글씨 → title 짧게, body 1문장
4. **point 03 (4장) — 아이콘 그리드 (layout:"grid")**: 어메이징 강점 4가지
   - gridItems: 4개 [{ "iconKey":"shield", "label":"교육·멘토(10자 이내)" }, ...] (iconKey는 아래 가이드에서)
   - title은 "이런 게 다릅니다" 류
5. **point 04 (5장)** — 강점·증거 또는 사람 증거 (layout:"default", 배경 사진 위, 가드레일: 보장·럭셔리 금지). title 짧게, body 1문장
6. **closing (6장)** — 최종 CTA
   - title: 행동 유도 헤딩 (예: "준비됐을 때, 부담 없이")
   - items: 3개 — "DM으로 '어메이징' 보내기" / "프로필 링크 → 솔직 후기 블로그" / "나중에 볼 거면 저장"
   - footer: 공유 유발 + 압박 회피 (예: "이 글 고민하는 친구에게 공유해주세요. 먼저 연락하지 않습니다.")
   - iconKey: sparkles 또는 zap
`;

const ICON_GUIDE = `
**iconKey 가이드:** sparkles(후킹·신규), zap(빠른 결정·CTA), arrow(전환·이직),
search(탐색·확인), shield(안정·신뢰), gift(혜택), clipboard(체크·정리),
trendingDown(부담↓), alert(통념 깨기), calculator(수수료·구조), stethoscope(전문), baby(육아·워라밸).
`;

const PROMPT = (topic: RecruitTopic) => `당신은 인스타에서 "이거 내 얘기네" 하고 끝까지 넘기게 만드는 보험설계사 리쿠르팅 카드뉴스 작가입니다.
어메이징 사업부(보험대리점 GA)로 사람을 끌어당기는 6장 캐러셀을 만듭니다. 직접 "모집합니다"가 아니라, 본인이 스스로 궁금해서 지원하게 만드는 톤.

**앵글 제목**: "${topic.title}"
**커버 후킹**: ${topic.hook}
**톤**: ${toneLabel(topic.tone)}
**타깃**: ${targetLabel(topic.target)}
**흐름(beats)**:
${topic.beats.map((b, i) => `${i + 1}. ${b}`).join('\n')}

${RECRUIT_GUARDRAILS}

${BIG_STAT_RULES}

${STRUCTURE}

${ICON_GUIDE}

**문체·분량 (중요)**: 친근한 SNS 톤("~였어요","~거든요"). **글 많으면 안 읽힙니다 — 한 카드 한 포인트, 최대한 짧게.**
- 제목 12~18자 / body는 1문장 30~40자 이내(짧을수록 좋고, 없어도 되면 생략) / compare 항목 각 6~12자 / grid label 8자 이내 / closing 항목 12~18자.

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명 없이):**
{
  "title": "전체 콘텐츠 제목",
  "slides": [
    { "kind":"cover", "eyebrow":"...", "title":"...", "bigStat":"퇴사각", "bigStatLabel":"...", "iconKey":"sparkles" },
    { "kind":"point", "number":"01", "layout":"compare", "compare":{"aTitle":"직장인","aItems":["출퇴근 고정","월급 천장"],"bTitle":"설계사","bItems":["시간 자율","성과만큼"]}, "bigStat":"비교", "bigStatLabel":"...", "title":"뭐가 다를까?", "body":"...", "iconKey":"arrow" },
    { "kind":"point", "number":"02", "bigStat":"...", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"arrow" },
    { "kind":"point", "number":"03", "layout":"grid", "gridItems":[{"iconKey":"shield","label":"교육·멘토"},{"iconKey":"search","label":"고객 DB 제공"},{"iconKey":"zap","label":"디지털 툴"},{"iconKey":"calculator","label":"성과형 수수료"}], "bigStat":"강점", "bigStatLabel":"...", "title":"이런 게 다릅니다", "body":"...", "iconKey":"shield" },
    { "kind":"point", "number":"04", "bigStat":"...", "bigStatLabel":"...", "title":"...", "body":"...", "iconKey":"search" },
    { "kind":"closing", "title":"...", "items":["DM으로 '어메이징' 보내기","프로필 링크 → 솔직 후기 블로그","나중에 볼 거면 저장"], "footer":"이 글 고민하는 친구에게 공유해주세요. 먼저 연락하지 않습니다.", "iconKey":"sparkles" }
  ]
}

소득은 보장·확정 없이 "성과에 따라/상위 사례/범위"로만. 전화번호·럭셔리 인증·다단계 연상 표현 금지.`;

function toneLabel(t: RecruitTopic['tone']): string {
  return t === 'empathy' ? '공감·자극(현타·퇴사 공감)' : t === 'flex-reframed' ? '성공·소득(리프레이밍 — 보장·럭셔리 금지)' : '진정성·스토리(솔직·사람 중심)';
}
function targetLabel(t: RecruitTopic['target']): string {
  return t === '2030-newbie' ? '2030 신입·이직자' : t === 'career-changer' ? '경력 설계사 이직' : t === 'side-job' ? '주부·N잡·부업' : '폭넓은 믹스';
}

function isValidIconKey(k: unknown): k is CardIconKey {
  return typeof k === 'string' && ICON_KEYS.includes(k as CardIconKey);
}

// 후처리 안전망 — 모델이 가드레일을 어겨도 후방에서 안전 표현으로 치환.
const RECRUIT_SANITIZERS: Array<[RegExp, string]> = [
  // 소득 보장·확정 (월 500만원 확정/보장 …)
  [/(월|연|월급|연봉)\s*[\d,]+\s*(만\s*원|억)[^.]{0,10}(보장|확정|가능|벌\s*수)/g, '성과에 따라 다른 수입'],
  [/고수익\s*보장|수익\s*보장|소득\s*보장|확정\s*수익/g, '성과형 수입'],
  [/무조건|누구나\s*가능|떼돈|쉽게\s*(벌|버는)/g, ''],
  // 럭셔리 인증
  [/외제차|수입차|벤츠|포르쉐|롤렉스|명품|이달의\s*왕|트로피|연봉\s*인증|수익\s*인증|월급\s*인증/g, ''],
  // 유사수신 연상
  [/월급관리\s*스터디|재테크\s*스터디|투자\s*권유|유사수신|원금\s*보장|수익률\s*보장|하위\s*모집/g, ''],
  // 전화번호 → DM 안내
  [/01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, 'DM 문의'],
  // 정리
  [/\s{2,}/g, ' '],
];

function sanitizeRecruit(text: string): string {
  let v = text;
  for (const [pat, rep] of RECRUIT_SANITIZERS) v = v.replace(pat, rep);
  return v.trim();
}
function sanitizeArr(items: string[]): string[] {
  return items.map(sanitizeRecruit).filter(Boolean);
}

function clampBigStat(value: string, fallback: string): string {
  const v = sanitizeRecruit(String(value ?? '')).trim();
  if (!v) return fallback;
  return v.length > 8 ? fallback : v;
}

// 인포그래픽 데이터 파싱 — 누락/불량이면 undefined 반환 → 렌더는 default로 폴백.
function parseCompare(raw: unknown): RecruitCompare | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const aTitle = sanitizeRecruit(String(r.aTitle ?? ''));
  const bTitle = sanitizeRecruit(String(r.bTitle ?? ''));
  const cut = (x: string) => (x.length > 13 ? x.slice(0, 13).trim() : x);
  const aItems = Array.isArray(r.aItems) ? sanitizeArr(r.aItems.map(String)).slice(0, 3).map(cut) : [];
  const bItems = Array.isArray(r.bItems) ? sanitizeArr(r.bItems.map(String)).slice(0, 3).map(cut) : [];
  if (!aTitle || !bTitle || aItems.length < 2 || bItems.length < 2) return undefined;
  return { aTitle, aItems, bTitle, bItems };
}

function parseGrid(raw: unknown): RecruitGridItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: RecruitGridItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const label = sanitizeRecruit(String(o.label ?? '')).slice(0, 10);
    if (!label) continue;
    items.push({ iconKey: isValidIconKey(o.iconKey) ? o.iconKey : 'sparkles', label });
  }
  return items.length >= 3 ? items.slice(0, 4) : undefined;
}

function validateRecruitSlides(slides: unknown): CardSlide[] {
  if (!Array.isArray(slides) || slides.length !== 6) {
    throw new Error(`slides는 정확히 6개여야 하는데 ${Array.isArray(slides) ? slides.length : 'not array'}개`);
  }
  const result: CardSlide[] = [];
  for (let i = 0; i < 6; i++) {
    const s = slides[i] as Record<string, unknown>;
    const expectedKind = i === 0 ? 'cover' : i === 5 ? 'closing' : 'point';
    if (s.kind !== expectedKind) {
      throw new Error(`slide[${i}].kind는 "${expectedKind}"여야 하는데 "${s.kind}"`);
    }
    const iconKey = isValidIconKey(s.iconKey) ? s.iconKey : (i === 0 ? 'sparkles' : i === 5 ? 'zap' : 'arrow');
    if (expectedKind === 'cover') {
      result.push({
        kind: 'cover',
        eyebrow: sanitizeRecruit(String(s.eyebrow ?? '')),
        title: sanitizeRecruit(String(s.title ?? '')),
        bigStat: clampBigStat(String(s.bigStat ?? ''), 'NEW'),
        bigStatLabel: clampBigStat(String(s.bigStatLabel ?? ''), '지금 시작'),
        iconKey,
      });
    } else if (expectedKind === 'point') {
      const compare = s.layout === 'compare' ? parseCompare(s.compare) : undefined;
      const gridItems = s.layout === 'grid' ? parseGrid(s.gridItems) : undefined;
      const layout: 'default' | 'compare' | 'grid' = compare ? 'compare' : gridItems ? 'grid' : 'default';
      result.push({
        kind: 'point',
        number: String(s.number ?? `0${i}`),
        bigStat: clampBigStat(String(s.bigStat ?? ''), '확인'),
        bigStatLabel: clampBigStat(String(s.bigStatLabel ?? ''), '핵심 포인트'),
        title: sanitizeRecruit(String(s.title ?? '')),
        body: sanitizeRecruit(String(s.body ?? '')).slice(0, 46),
        iconKey,
        layout,
        ...(compare ? { compare } : {}),
        ...(gridItems ? { gridItems } : {}),
      });
    } else {
      const rawItems = Array.isArray(s.items) ? s.items.map(String) : [];
      const items = sanitizeArr(rawItems).slice(0, 3);
      while (items.length < 3) items.push('나중에 볼 거면 저장 👆');
      result.push({
        kind: 'closing',
        title: sanitizeRecruit(String(s.title ?? '준비됐을 때, 부담 없이')),
        items,
        footer: sanitizeRecruit(String(s.footer ?? '이 글 고민하는 친구에게 공유해주세요. 먼저 연락하지 않습니다.')),
        iconKey,
      });
    }
  }
  return result;
}

export async function generateRecruitCardSet(topic: RecruitTopic): Promise<GeneratedCardSet> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 4096,
    temperature: 0.9,
    messages: [{ role: 'user', content: PROMPT(topic) }],
  });

  const block = message.content.find(b => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Claude 응답에 text block 없음');
  const text = block.text.trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) {
    console.error('[generator-recruit-card] no JSON:', text.slice(0, 500));
    throw new Error('Claude 응답에서 JSON 못 찾음');
  }
  const obj = JSON.parse(text.slice(s, e + 1)) as { title?: unknown; slides?: unknown };
  const title = sanitizeRecruit(String(obj.title ?? ''));
  const slides = validateRecruitSlides(obj.slides);
  return {
    title,
    slides,
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    },
  };
}
