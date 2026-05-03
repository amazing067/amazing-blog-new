// 카드뉴스 디자인 요일별 매핑 (KST 기준)
// 월=A 화=B 수=C 목=D 금=E 토=F, 일=쉼 (cron이 아예 안 돔)
import type { CardStyleKey } from './types';

const WEEKDAY_TO_STYLE: Record<number, CardStyleKey> = {
  1: 'A', // Mon
  2: 'B', // Tue
  3: 'C', // Wed
  4: 'D', // Thu
  5: 'E', // Fri
  6: 'F', // Sat
  // 0(일)은 cron이 안 도는데, 안전장치로 'A' 폴백
};

/** 주어진 시각의 KST 요일을 보고 디자인 키 반환 */
export function pickCardStyle(now: Date = new Date()): CardStyleKey {
  // KST = UTC + 9
  const kstMs = now.getTime() + 9 * 3600_000;
  const kstWeekday = new Date(kstMs).getUTCDay(); // 0=일~6=토
  return WEEKDAY_TO_STYLE[kstWeekday] ?? 'A';
}
