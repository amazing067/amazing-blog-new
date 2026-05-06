// bigStat 글자 길이별 폰트 자동 축소 헬퍼.
// 카드뉴스 정책상 bigStat은 개념어(3~6자, 예: "NEW", "한도 ↑", "확인 필수")만 허용되도록 바뀌었고,
// 옛날 짧은 숫자("2배") 기준의 22~24cqw 고정 폰트는 4자 이상에서 좌우 넘침이 발생.
// length-aware clamp 공식으로 짧은 라벨은 크게, 긴 라벨은 작게 자동 조절한다.

type Opts = {
  /** 글자 1~2자 짧은 라벨일 때 허용할 최대 cqw. 디자인 강조 정도에 따라 14~20 사이. */
  max: number;
  /** 글자 길이로 나눠 이상적인 폰트 크기를 산출하는 분자. 70~80이 안전. */
  divisor?: number;
  /** 매우 긴 라벨일 때 떨어지는 하한 cqw. */
  min?: number;
};

export function bigStatFontStyle(text: string, { max, divisor = 70, min = 8 }: Opts): React.CSSProperties {
  const len = Math.max(text?.length ?? 1, 1);
  const ideal = Math.max(min, divisor / len);
  return { fontSize: `clamp(${min}cqw, ${ideal}cqw, ${max}cqw)` };
}
