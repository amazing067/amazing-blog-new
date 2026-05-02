import { GoogleGenerativeAI } from '@google/generative-ai';

export type FactCheckIssue = {
  claim: string;        // 본문에서 의심되는 진술
  reason: string;       // 왜 의심스러운지 / 검증 결과
  severity: 'high' | 'medium' | 'low';  // 발행 차단 여부 결정용
};

export type FactCheckResult = {
  passed: boolean;          // high 이슈 없으면 통과
  issues: FactCheckIssue[];
  raw: string;              // 원본 응답 (디버깅용)
};

const PROMPT = (title: string, body: string) => `당신은 한국 보험 콘텐츠의 사실 검증 전문가입니다.
아래 본문을 읽고, 사실관계가 의심스럽거나 검증 안 된 진술을 찾아주세요.

검증할 항목:
- 구체적 수치 (보험료 인하율, 자기부담률, 한도, 등급 점수 등)
- 제도·법령 (5세대 실손 시행 시점, CDR 등급, 세제 한도 등)
- 절차 (청구·심의·환급 단계)
- "○○하면 보험금 받을 수 없다" 같은 단정적 진술

검증 방법: 필요하면 Google Search로 금감원·금융위·신문·보험사 공식 자료에서 확인.

[제목]
${title}

[본문]
${body}

**출력 형식 (반드시 이 JSON 한 객체만, 코드블록·설명·앞뒤 텍스트 없이):**
{
  "issues": [
    {
      "claim": "본문에서 의심되는 진술 그대로 인용",
      "reason": "검증 결과 또는 의심 이유 (한 문장)",
      "severity": "high | medium | low"
    }
  ]
}

severity 기준:
- high: 명백히 틀린 사실, 발행하면 안 되는 수준
- medium: 출처 확인이 필요한 진술, 발행 전 사람 검수 필요
- low: 일반론 수준, 보강하면 좋지만 발행 가능

이슈가 없으면 \`{"issues":[]}\` 반환.`;

export async function factCheckArticle(title: string, body: string): Promise<FactCheckResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const genAI = new GoogleGenerativeAI(apiKey);
  // Google Search Grounding을 활용해 사실 검증
  // SDK 타입은 googleSearchRetrieval만 정의돼 있지만, REST API는 googleSearch도 받음.
  // 안전한 캐스팅으로 활성화.
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
    tools: [{ googleSearch: {} }] as unknown as Parameters<typeof genAI.getGenerativeModel>[0]['tools'],
  });

  const result = await model.generateContent(PROMPT(title, body));
  const text = result.response.text().trim();

  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s === -1 || e === -1) {
    console.error('[fact-check] no JSON in response:', text.slice(0, 500));
    return { passed: true, issues: [], raw: text };
  }
  try {
    const obj = JSON.parse(text.slice(s, e + 1)) as { issues?: FactCheckIssue[] };
    const issues = Array.isArray(obj.issues) ? obj.issues : [];
    const hasHigh = issues.some(i => i.severity === 'high');
    return { passed: !hasHigh, issues, raw: text };
  } catch (err) {
    console.error('[fact-check] JSON parse failed:', text.slice(0, 500), err);
    return { passed: true, issues: [], raw: text };
  }
}
