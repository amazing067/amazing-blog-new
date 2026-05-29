// 블로그/뉴스 본문 "전체를 이미지로" 저장 (클라이언트 전용).
// 픽셀 단위로 보이는 그대로 보존(네이버 업로드용). 긴 글은 페이지 단위로 잘라 여러 장 → ZIP.
import JSZip from 'jszip';
import { captureArticleCanvas, safeName } from './article-capture';

const SEG_H = 2200; // 세그먼트 높이(캡처 canvas px, scale2 기준 ≈ 1100 CSS px)

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob 실패'))), 'image/png'),
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * 본문을 제목·심의푸터까지 한 화면으로 캡처해 PNG로 저장.
 * 한 장이면 .png, 길어서 여러 장으로 잘리면 .zip(01.png, 02.png…)로 저장.
 */
export async function downloadArticleImages(
  contentEl: HTMLElement,
  title: string,
  footerHtml?: string,
): Promise<{ count: number }> {
  const canvas = await captureArticleCanvas(contentEl, title, footerHtml);
  const W = canvas.width;
  const H = canvas.height;
  const name = safeName(title);
  const count = Math.max(1, Math.ceil(H / SEG_H));

  if (count === 1) {
    triggerDownload(await canvasToBlob(canvas), `${name}.png`);
    return { count: 1 };
  }

  const zip = new JSZip();
  for (let i = 0; i < count; i++) {
    const segH = Math.min(SEG_H, H - i * SEG_H);
    const seg = document.createElement('canvas');
    seg.width = W;
    seg.height = segH;
    const ctx = seg.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, segH);
    ctx.drawImage(canvas, 0, i * SEG_H, W, segH, 0, 0, W, segH);
    zip.file(`${String(i + 1).padStart(2, '0')}.png`, await canvasToBlob(seg));
  }
  const archive = await zip.generateAsync({ type: 'blob' });
  triggerDownload(archive, `${name}.zip`);
  return { count };
}
