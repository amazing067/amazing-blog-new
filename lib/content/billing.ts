// 모델별 토큰 단가 (USD per 1M tokens)
// 변동 시 여기만 수정.

export const MODEL_PRICING = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
} as const;

export type SupportedModel = keyof typeof MODEL_PRICING;

export function calcCost(model: SupportedModel, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

// 환율 (1 USD = N KRW). 정확한 환율은 Vercel 환경변수로 받을 수도 있지만, 보통 1,350원 근처라 상수로.
export const USD_TO_KRW = 1350;

export function formatKrw(usd: number): string {
  return Math.round(usd * USD_TO_KRW).toLocaleString('ko-KR') + '원';
}

export function formatUsd(usd: number): string {
  return '$' + usd.toFixed(usd < 0.01 ? 4 : 2);
}
