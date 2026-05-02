// 마크다운 → 카페 본문 plain text 변환
// 카페 에디터는 마크다운 미지원이므로 마커를 제거하고 공백만 정리.

export function mdToCafeText(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .trim();
}
