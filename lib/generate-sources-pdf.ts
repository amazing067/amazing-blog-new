import jsPDF from 'jspdf'

export interface Source {
  title: string
  url?: string
  organization?: string
  date?: string
}

/**
 * 출처 목록을 PDF로 생성
 */
export function generateSourcesPDF(sources: Source[], blogTitle: string): Blob {
  const doc = new jsPDF()
  
  let y = 20  // 시작 Y 위치
  const lineHeight = 7
  const pageHeight = doc.internal.pageSize.height
  const margin = 20
  
  // 제목
  doc.setFontSize(18)
  doc.text('참고 자료 및 출처', 20, y)
  y += lineHeight * 2
  
  doc.setFontSize(12)
  doc.text(`블로그: ${blogTitle}`, 20, y)
  y += lineHeight
  
  const today = new Date().toLocaleDateString('ko-KR')
  doc.text(`생성일: ${today}`, 20, y)
  y += lineHeight * 2
  
  // 구분선
  doc.line(20, y, 190, y)
  y += lineHeight
  
  // 출처 목록
  doc.setFontSize(11)
  
  sources.forEach((source, idx) => {
    // 페이지 넘김 확인
    if (y > pageHeight - margin) {
      doc.addPage()
      y = 20
    }
    
    // 번호
    doc.setFont('helvetica', 'bold')
    doc.text(`${idx + 1}. ${source.title}`, 20, y)
    y += lineHeight
    
    doc.setFont('helvetica', 'normal')
    
    // 기관
    if (source.organization) {
      doc.text(`   기관: ${source.organization}`, 20, y)
      y += lineHeight
    }
    
    // URL
    if (source.url) {
      doc.setTextColor(54, 131, 241)  // 파란색
      doc.textWithLink(`   URL: ${source.url}`, 20, y, { url: source.url })
      doc.setTextColor(0, 0, 0)  // 검정색으로 복귀
      y += lineHeight
    }
    
    // 날짜
    if (source.date) {
      doc.text(`   날짜: ${source.date}`, 20, y)
      y += lineHeight
    }
    
    y += lineHeight / 2  // 항목 간 간격
  })
  
  // 하단 안내 (상자)
  y += lineHeight * 2
  if (y > pageHeight - margin * 4) {
    doc.addPage()
    y = 20
  }
  
  // 안내 박스
  doc.setDrawColor(255, 193, 7)
  doc.setFillColor(255, 248, 225)
  doc.roundedRect(15, y - 5, 180, 40, 3, 3, 'FD')
  
  doc.setFontSize(10)
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.text('📥 원본 자료 다운로드 방법', 20, y + 3)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y += lineHeight + 3
  doc.text('1. 위 URL 링크를 클릭하여 해당 기관 페이지로 이동', 20, y)
  y += lineHeight
  doc.text('2. 페이지에서 PDF 또는 Excel 다운로드 버튼 클릭', 20, y)
  y += lineHeight
  doc.text('3. 원본 통계 파일 다운로드 및 확인', 20, y)
  y += lineHeight + 3
  
  doc.setTextColor(217, 119, 6)
  doc.text('※ 심의 제출 시 원본 파일을 함께 첨부하시기 바랍니다.', 20, y)
  
  // 하단 정보
  y += lineHeight * 3
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.text('본 문서는 AI 블로그 생성 시 자동으로 생성되었습니다.', 20, y)
  y += lineHeight
  doc.text('어메이징사업부 - 보험 영업 지원 플랫폼', 20, y)
  
  // PDF Blob 생성
  return doc.output('blob')
}

/**
 * 브라우저에서 PDF 다운로드
 */
export function downloadSourcesPDF(sources: Source[], blogTitle: string): void {
  const pdfBlob = generateSourcesPDF(sources, blogTitle)
  const url = URL.createObjectURL(pdfBlob)
  const a = document.createElement('a')
  a.href = url
  
  // 파일명 생성 (한글 제거, 공백을 언더스코어로)
  const safeTitlePart = blogTitle
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 30)
  
  const dateStr = new Date().toISOString().split('T')[0]
  a.download = `출처_${safeTitlePart}_${dateStr}.pdf`
  
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 출처 목록을 Markdown으로 변환
 */
export function sourcesToMarkdown(sources: Source[]): string {
  let md = '# 참고 자료 및 출처\n\n'
  md += '> 이 문서는 블로그 작성 시 참고한 출처 목록입니다.\n\n'
  md += '---\n\n'
  
  sources.forEach((source, idx) => {
    md += `## ${idx + 1}. ${source.title}\n\n`
    if (source.organization) {
      md += `- **기관:** ${source.organization}\n`
    }
    if (source.url) {
      md += `- **다운로드 링크:** [클릭하여 원본 자료 확인](${source.url})\n`
      md += `  \`\`\`\n  ${source.url}\n  \`\`\`\n`
    }
    if (source.date) {
      md += `- **날짜:** ${source.date}\n`
    }
    md += '\n'
  })
  
  md += '---\n\n'
  md += '## 📥 원본 자료 다운로드 방법\n\n'
  md += '1. 위 "다운로드 링크"를 클릭하여 해당 기관 페이지로 이동\n'
  md += '2. 페이지에서 **PDF 또는 Excel 다운로드 버튼** 클릭\n'
  md += '3. 원본 통계 파일 다운로드 및 확인\n\n'
  md += '> ⚠️ **심의 제출 시:** 위 URL에서 다운받은 원본 파일을 함께 첨부하시기 바랍니다.\n\n'
  md += '---\n\n'
  md += '*이 문서는 자동으로 생성되었습니다.*\n'
  md += '*어메이징사업부 - 보험 영업 지원 플랫폼*\n'
  
  return md
}

