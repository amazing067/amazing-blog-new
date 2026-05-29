// 네이버 블로그용 "서식글 + 이미지" 복사 (클라이언트 전용).
// 네이버 SmartEditor는 HTML 소스 텍스트는 못 받지만, 클립보드에 진짜 text/html
// 포맷으로 넣으면 서식 있는 글로 인식한다(제목·굵게·표·리스트 + 공개 URL 이미지).
// 전략: 본문 prose는 클래스/스타일·SVG 아이콘을 벗긴 깔끔한 시맨틱 HTML로,
//       시각 블록(data-naver-image: 통계·비교·단계·체크·CTA·SVG)은 PNG로 구워
//       Supabase 공개 URL로 올려 <img>로 심는다. (네이버는 data: URL을 막음)
import { domToBlob } from 'modern-screenshot';

const KEEP_ATTRS = new Set(['href', 'src', 'alt', 'colspan', 'rowspan']);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// prose 요소 → 네이버 친화 HTML (클래스/스타일/data·svg 제거, 구조만 유지)
function cleanProse(src: Element): string {
  const clone = src.cloneNode(true) as Element;
  clone.querySelectorAll('svg').forEach((s) => s.remove()); // 리스트 체크 아이콘 등 제거(텍스트는 유지)
  const walk = (el: Element) => {
    for (const a of [...el.attributes]) if (!KEEP_ATTRS.has(a.name)) el.removeAttribute(a.name);
    for (const c of [...el.children]) walk(c);
  };
  walk(clone);
  if (clone.tagName === 'BLOCKQUOTE') {
    clone.setAttribute('style', 'border-left:3px solid #10b981;padding-left:12px;color:#334155;margin:12px 0');
  }
  return clone.outerHTML;
}

async function uploadPng(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append('file', blob, 'block.png');
  const res = await fetch('/api/admin/content/upload-image', { method: 'POST', body: fd });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error || '이미지 업로드 실패');
  return j.url as string;
}

// 시각 블록을 PNG로 굽고 업로드 → <img> 태그 반환
async function rasterizeToImg(el: HTMLElement): Promise<string> {
  const blob = await domToBlob(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    type: 'image/png',
    quality: 1,
  });
  if (!blob) throw new Error('블록 캡처 실패');
  const url = await uploadPng(blob);
  return `<img src="${url}" style="display:block;max-width:100%;height:auto;margin:16px auto" />`;
}

export type NaverCopyOpts = {
  footerHtml?: string; // 광고심의 푸터(있으면 본문 끝에 그대로 붙임)
  onProgress?: (done: number, total: number) => void;
};

/**
 * 렌더된 본문(contentEl)을 순서대로 네이버용 HTML로 변환.
 * onProgress(done,total)로 이미지 업로드 진행 알림(선택).
 */
export async function buildNaverHtml(
  contentEl: HTMLElement,
  title: string,
  opts: NaverCopyOpts = {},
): Promise<string> {
  const { footerHtml, onProgress } = opts;
  const children = [...contentEl.children] as HTMLElement[];
  const imageNodes = children.filter((c) => c.matches('[data-naver-image]') || c.querySelector('[data-naver-image]'));
  let done = 0;
  const total = imageNodes.length;

  const parts: string[] = [];
  if (title?.trim()) parts.push(`<h2>${escapeHtml(title.trim())}</h2>`);

  for (const child of children) {
    const isImageBlock = child.matches('[data-naver-image]') || !!child.querySelector('[data-naver-image]');
    if (isImageBlock) {
      const target = (child.matches('[data-naver-image]') ? child : child.querySelector('[data-naver-image]')) as HTMLElement;
      try {
        parts.push(await rasterizeToImg(target));
      } catch (e) {
        parts.push(cleanProse(child)); // 캡처 실패 시 텍스트라도
        console.warn('[naver-copy] 블록 캡처 실패 — 텍스트 폴백', e);
      }
      onProgress?.(++done, total);
    } else {
      parts.push(cleanProse(child));
    }
  }
  if (footerHtml?.trim()) parts.push(footerHtml);
  return parts.join('\n');
}

/**
 * 본문을 네이버용으로 클립보드에 복사(text/html + text/plain).
 * 붙여넣으면 서식 글 + 이미지가 함께 들어간다.
 */
export async function copyArticleForNaver(
  contentEl: HTMLElement,
  title: string,
  opts: NaverCopyOpts = {},
): Promise<void> {
  const html = await buildNaverHtml(contentEl, title, opts);
  const plain = (title ? title + '\n\n' : '') + (contentEl.innerText || '');
  const item = new ClipboardItem({
    'text/html': new Blob([html], { type: 'text/html' }),
    'text/plain': new Blob([plain], { type: 'text/plain' }),
  });
  await navigator.clipboard.write([item]);
}
