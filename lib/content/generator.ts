import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CandidateArticle, EnforcementMode, GeneratedSummary } from './types';

const ANONYMIZATION_RULES = `
**중요**: 원문 기사에 등장하는 모든 보험사명·상품명은 본문에서 다음과 같이 익명화하세요:
- 보험사명("삼성생명","DB손해보험","현대해상" 등) → "한 생명보험사","주요 손해보험사","업계","대형 보험사" 등
- 상품명("○○보험","○○플랜" 등) → "실손의료보험","자동차보험","암보험" 등 일반명사
- 인용이 불가피해도 회사명·상품명은 본문에 절대 노출 금지.

다음 광고 표현도 절대 금지:
- 절대표현: 최고/최상/최저/최대/제일/유일/100%/완벽/확실/절대/무조건
- 비교표현: 다른 보험사보다, 타사 대비, 업계 1위
- 보장단정: "보장됩니다", "확실히 받을 수 있", "평생 보장", "원금 보장"

정량 사실(통계·금감원/금융위 발표·약관 변경 등)만 정보성 톤으로 서술.
`;

const TEMPLATE = (article: CandidateArticle, mode: EnforcementMode) => `
당신은 보험 정보 전문 에디터입니다. 아래 기사 메타를 바탕으로 600~900자 분량의 정보성 보도 요약을 작성하세요.
출력은 JSON 한 객체만, 코드블록 없이:
{ "title": "...", "body_md": "..." }

요구사항:
- 톤: 객관적·중립·정보성. 광고·권유성 어조 금지.
- 본문은 마크다운, 단락 2~4개. 첫 단락에 핵심 사실 요약, 이후 배경/숫자/맥락.
- 출처는 본문 마지막에 "[출처: ${article.source}](${article.link})" 형태 1줄.

${ANONYMIZATION_RULES}

[기사 메타]
- 매체: ${article.source}
- 원제: ${article.title}
- 발행일: ${article.pubDate}
- 원문 발췌: ${article.excerpt}
`;

export async function generateNewsSummary(
  article: CandidateArticle, mode: EnforcementMode,
): Promise<GeneratedSummary> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(TEMPLATE(article, mode));
  const text = result.response.text().trim();
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('Gemini 응답 JSON 미발견: ' + text.slice(0, 200));
  const obj = JSON.parse(text.slice(s, e + 1));
  if (typeof obj.title !== 'string' || typeof obj.body_md !== 'string') {
    throw new Error('Gemini 응답 형식 오류');
  }
  return { title: obj.title, body_md: obj.body_md };
}
