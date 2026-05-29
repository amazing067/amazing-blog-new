// 블로그/뉴스 본문을 styled 화면 그대로 PDF로 (클라이언트 전용).
// 한글 폰트 임베드 이슈를 피하려 이미지 기반: 본문을 캡처 → A4 페이지 분할.
import jsPDF from 'jspdf';
import { captureArticleCanvas, safeName } from './article-capture';

/**
 * 본문 요소(contentEl)를 제목·심의푸터와 함께 캡처해 A4 PDF로 저장.
 * 화면의 styled 모양(표·통계박스·컬러)을 그대로 보존한다.
 */
export async function downloadArticlePdf(contentEl: HTMLElement, title: string, footerHtml?: string): Promise<void> {
  const canvas = await captureArticleCanvas(contentEl, title, footerHtml);
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;

  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH, undefined, 'FAST');
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageW, imgH, undefined, 'FAST');
    heightLeft -= pageH;
  }
  pdf.save(`${safeName(title)}.pdf`);
}
