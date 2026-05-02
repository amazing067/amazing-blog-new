import { TOPIC_POOL } from './topics';
import type { Topic } from './types';

/**
 * 최근 사용된 slug 집합과 풀을 받아 안 쓴 주제 N개 반환.
 * 풀이 다 소진되면 가장 오래된 것부터 재사용 (즉 카테고리 다양성 유지 위해 셔플).
 */
export function pickFreshTopics(usedSlugs: Set<string>, count: number, seed?: number): Topic[] {
  const fresh = TOPIC_POOL.filter(t => !usedSlugs.has(t.slug));
  const candidates = fresh.length >= count ? fresh : TOPIC_POOL; // 풀 소진 시 전체 재사용

  // 카테고리 다양성을 위해 카테고리당 1개씩 라운드로빈으로 뽑기
  const byCategory = new Map<string, Topic[]>();
  const shuffled = shuffle(candidates, seed);
  for (const t of shuffled) {
    const arr = byCategory.get(t.category) ?? [];
    arr.push(t);
    byCategory.set(t.category, arr);
  }

  const picked: Topic[] = [];
  const categories = [...byCategory.keys()];
  while (picked.length < count) {
    let progressed = false;
    for (const c of categories) {
      const arr = byCategory.get(c)!;
      const next = arr.shift();
      if (next) {
        picked.push(next);
        progressed = true;
        if (picked.length >= count) break;
      }
    }
    if (!progressed) break;
  }
  return picked;
}

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = arr.slice();
  let s = seed ?? Date.now();
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
