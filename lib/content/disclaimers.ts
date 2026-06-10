// 상품별 필수 유의문구 — 손보협회 반송 사유에서 직접 요구된 문구 + 표준 유의문구.
// 카드 본문/제목/캡션 텍스트에서 키워드를 감지해 해당 유의문구를 자동 부착한다.
// 협회 심의 제출 자료(캡션 .txt)에 그대로 들어가도록 caption-builder가 호출.

type Rule = { id: string; pattern: RegExp; text: string };

const RULES: Rule[] = [
  {
    id: 'fetal',
    pattern: /태아/,
    // 반송 사유 원문(자녀·태아 카드)
    text: '태아보험은 어린이보험에 태아특약이 추가된 상품이며, 출생 이후 보장됩니다.',
  },
  {
    id: 'tax-free',
    pattern: /비과세|연금보험|저축성|연금저축/,
    // 반송 사유 원문(연금 카드)
    text: '비과세 혜택은 관련 세법 요건 충족 시 적용되며, 자세한 사항은 세무사 등 전문가 및 관련 법령을 확인하시기 바랍니다.',
  },
  {
    id: 'universal',
    pattern: /유니버셜|납입면제|중도인출|월대체/,
    // 반송 사유 원문(연금 카드)
    text:
      '유니버셜 기능 이용 시 납입하기로 한 보험료보다 적게 납입하거나 중도인출 등을 하는 경우 종신까지 보장을 받지 못할 수 있으며, 보험금 및 해약환급금이 줄어들 수 있습니다. ' +
      '의무납입기간 내에 납입을 연체하거나 기본보험료에서 월대체보험료를 충당할 수 없게 된 경우 계약이 해지될 수 있습니다.',
  },
  {
    id: 'variable',
    pattern: /변액/,
    text: '변액보험은 운용 실적에 따라 원금손실이 발생할 수 있으며, 예금자보호법에 따른 보호를 받지 않습니다.',
  },
  {
    id: 'renewal',
    pattern: /갱신형|갱신\s*보험|갱신될/,
    text: '갱신형 상품은 갱신 시점의 연령 증가 및 위험률 변동에 따라 보험료가 인상될 수 있습니다.',
  },
];

// 텍스트에서 감지된 상품별 필수 유의문구 목록(중복 제거, 규칙 정의 순서).
export function requiredDisclaimers(text: string): string[] {
  const out: string[] = [];
  for (const r of RULES) {
    if (r.pattern.test(text) && !out.includes(r.text)) out.push(r.text);
  }
  return out;
}
