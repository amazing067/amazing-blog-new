// 카드뉴스 디자인 스타일 선택.
// 기존엔 요일별 고정(월=A…토=F)이었으나, 다양성 강화를 위해 신규 G/H/I 포함 9종에서 랜덤 선택.
// ⚠️ G/H/I 사용 전 DB 제약(card_style CHECK)에 신규 키를 추가하는 마이그레이션이 적용돼야 한다.
//    (supabase/migrations/20260618_card_style_extend.sql)
import type { CardStyleKey } from './types';

const ALL_STYLES: CardStyleKey[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

/** 9종 디자인 중 랜덤 선택 (다양성 우선). now 인자는 호환용으로만 받고 무시. */
export function pickCardStyle(_now: Date = new Date()): CardStyleKey {
  void _now;
  return ALL_STYLES[Math.floor(Math.random() * ALL_STYLES.length)];
}
