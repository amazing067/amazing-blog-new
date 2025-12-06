/**
 * 보험분쟁조정사례집 PDF 파싱 스크립트
 * 
 * 사용법:
 * 1. data 폴더에 "보험분쟁조정사례집.pdf" 파일 배치
 * 2. npm install pdf-parse @types/pdf-parse
 * 3. npm run parse-precedents
 * 
 * 결과: data/precedents.json 생성
 */

import fs from 'fs'
import path from 'path'

// pdf-parse는 CommonJS 모듈이므로 require 사용
const pdfParse = require('pdf-parse')

interface Precedent {
  caseNumber: string  // "제2023-1234호"
  title: string       // 판례 제목
  content: string     // 판례 내용 (최대 5000자)
  keywords: string[]  // 자동 추출된 키워드
  pageNumber?: number // 페이지 번호
}

/**
 * 보험 관련 키워드 목록
 */
const INSURANCE_KEYWORDS = [
  // 보험 종류
  '암보험', '실손보험', '운전자보험', '종신보험', '연금보험',
  '상해보험', '질병보험', '입원보험', '수술보험', '중대질병보험',
  '치매간병보험', '순환계', '장기요양보험', '자녀보험',
  
  // 보험 용어
  '보험금', '보험약관', '면책', '분쟁조정', '보험회사',
  '진단비', '수술비', '입원비', '치료비', '간병비',
  '해지환급금', '특약', '가입조건', '보장범위',
  
  // 질병 관련
  '암', '뇌졸중', '심근경색', '치매', '고혈압', '당뇨'
]

/**
 * 판례에서 키워드 추출
 */
function extractKeywords(text: string): string[] {
  const foundKeywords: string[] = []
  const lowerText = text.toLowerCase()
  
  INSURANCE_KEYWORDS.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword)
    }
  })
  
  // 중복 제거 및 정렬
  return Array.from(new Set(foundKeywords)).sort()
}

/**
 * 판례 제목 추출 (첫 몇 줄에서)
 */
function extractTitle(content: string): string {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 10) // 너무 짧은 줄 제외
  
  // 처음 3줄을 합쳐서 제목으로 사용 (최대 200자)
  const title = lines.slice(0, 3).join(' ').substring(0, 200)
  
  return title || '제목 없음'
}

/**
 * PDF 텍스트에서 판례 분할
 */
function splitPrecedents(text: string): Precedent[] {
  const precedents: Precedent[] = []
  
  // 사건번호 패턴: "제2023-1234호", "제2018-12호" 등
  const casePattern = /(제\d{4}-\d+호)/g
  const matches = Array.from(text.matchAll(casePattern))
  
  if (matches.length === 0) {
    console.warn('⚠️ 사건번호 패턴을 찾을 수 없습니다.')
    return precedents
  }
  
  console.log(`📌 발견된 사건번호: ${matches.length}개`)
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const caseNumber = match[1]
    const startIndex = match.index || 0
    
    // 다음 판례의 시작 위치 찾기
    const nextIndex = i < matches.length - 1 
      ? (matches[i + 1].index || text.length)
      : text.length
    
    // 판례 내용 추출
    let content = text.substring(startIndex, nextIndex).trim()
    
    // 사건번호 제거 (제목/내용에서)
    content = content.replace(new RegExp(caseNumber, 'g'), '').trim()
    
    // 내용이 너무 짧으면 스킵
    if (content.length < 100) {
      continue
    }
    
    // 제목 추출
    const title = extractTitle(content)
    
    // 키워드 추출
    const keywords = extractKeywords(content)
    
    // 내용 최대 길이 제한 (5000자)
    const limitedContent = content.substring(0, 5000)
    
    precedents.push({
      caseNumber,
      title,
      content: limitedContent,
      keywords
    })
  }
  
  return precedents
}

/**
 * PDF 파싱 메인 함수
 */
async function parsePrecedentsPDF(filePath: string): Promise<Precedent[]> {
  console.log(`📖 PDF 읽는 중: ${filePath}`)
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ 파일을 찾을 수 없습니다: ${filePath}`)
  }
  
  const dataBuffer = fs.readFileSync(filePath)
  console.log(`📦 파일 크기: ${(dataBuffer.length / 1024 / 1024).toFixed(2)} MB`)
  
  console.log('🔄 PDF 파싱 중... (시간이 걸릴 수 있습니다)')
  // pdf-parse v1.x는 직접 함수로 사용 가능
  const data = await pdfParse(dataBuffer)
  
  console.log(`✅ 페이지 수: ${data.numpages}페이지`)
  console.log(`✅ 텍스트 길이: ${data.text.length.toLocaleString()}자`)
  
  // 판례 분할
  console.log('🔍 판례 분할 중...')
  const precedents = splitPrecedents(data.text)
  
  console.log(`✅ 추출된 판례: ${precedents.length}개`)
  
  // 키워드 통계
  const keywordStats: Record<string, number> = {}
  precedents.forEach(p => {
    p.keywords.forEach(k => {
      keywordStats[k] = (keywordStats[k] || 0) + 1
    })
  })
  
  const topKeywords = Object.entries(keywordStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  
  console.log('\n📊 주요 키워드:')
  topKeywords.forEach(([keyword, count]) => {
    console.log(`  - ${keyword}: ${count}개 판례`)
  })
  
  return precedents
}

/**
 * 메인 실행 함수
 */
async function main() {
  try {
    const pdfPath = path.join(process.cwd(), 'data', '보험분쟁조정사례집.pdf')
    const outputPath = path.join(process.cwd(), 'data', 'precedents.json')
    
    console.log('🚀 판례집 파싱 시작\n')
    
    // PDF 파싱
    const precedents = await parsePrecedentsPDF(pdfPath)
    
    // JSON 저장
    fs.writeFileSync(
      outputPath,
      JSON.stringify(precedents, null, 2),
      'utf-8'
    )
    
    console.log(`\n✅ 완료!`)
    console.log(`📁 저장 위치: ${outputPath}`)
    console.log(`📊 총 판례 수: ${precedents.length}개`)
    console.log(`💾 파일 크기: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`)
    
  } catch (error) {
    console.error('❌ 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  main()
}

export { parsePrecedentsPDF, type Precedent }

