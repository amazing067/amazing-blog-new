// 블로그/뉴스 본문을 제목·심의푸터와 함께 오프스크린에 복제·캡처(클라이언트 전용).
// PDF·전체이미지 내보내기가 공용으로 쓴다.
import { domToCanvas } from 'modern-screenshot';

export const CAPTURE_WIDTH = 800; // 캡처용 본문 컬럼 폭(px)

export function safeName(s: string): string {
  return (s || 'article').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

/**
 * 제목 + 본문 클론 + (선택)심의푸터를 오프스크린에 조립해 한 장의 canvas로 캡처.
 * styled 모양(표·통계박스·컬러)을 그대로 보존한다.
 */
export async function captureArticleCanvas(
  contentEl: HTMLElement,
  title: string,
  footerHtml?: string,
): Promise<HTMLCanvasElement> {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;left:-99999px;top:0;width:${CAPTURE_WIDTH}px;background:#ffffff;padding:32px 28px;box-sizing:border-box;`;
  if (title?.trim()) {
    const h = document.createElement('h1');
    h.textContent = title.trim();
    h.style.cssText = 'font-size:26px;font-weight:800;color:#0f172a;line-height:1.3;margin:0 0 20px';
    wrap.appendChild(h);
  }
  wrap.appendChild(contentEl.cloneNode(true));
  if (footerHtml?.trim()) {
    const f = document.createElement('div');
    f.innerHTML = footerHtml;
    wrap.appendChild(f);
  }
  document.body.appendChild(wrap);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 200)); // 레이아웃·이미지 안정
    return await domToCanvas(wrap, { scale: 2, backgroundColor: '#ffffff' });
  } finally {
    document.body.removeChild(wrap);
  }
}
