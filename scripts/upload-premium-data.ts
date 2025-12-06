/**
 * 엑셀 파일을 자동으로 읽어서 Google Sheets에 업로드하는 스크립트
 * 
 * 사용 방법:
 * npm run upload-premium-data
 * 
 * 또는:
 * npx tsx scripts/upload-premium-data.ts
 */

// 환경 변수 로드 (.env.local 파일에서) - 먼저 실행
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// .env.local 파일 로드
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log('✅ .env.local 파일 로드 완료')
} else {
  // .env 파일도 시도
  dotenv.config()
  console.log('⚠️ .env.local 파일을 찾을 수 없습니다. .env 파일을 사용합니다.')
}

import * as XLSX from 'xlsx'
import { google } from 'googleapis'

// 환경 변수
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || ''
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || ''
const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const GOOGLE_SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || ''

interface PremiumData {
  age: number
  gender: string
  coverageName: string
  subscriptionAmount: string | number
  company: string
  premium: number
}

/**
 * 엑셀 파일에서 연령과 성별 추출 (파일명에서)
 */
function extractAgeAndGender(filename: string): { age: number; gender: string } | null {
  const ageMatch = filename.match(/(\d+)세/)
  const genderMatch = filename.match(/남|여/)
  
  if (!ageMatch || !genderMatch) {
    console.warn(`⚠️ 파일명에서 연령/성별을 추출할 수 없습니다: ${filename}`)
    return null
  }
  
  return {
    age: parseInt(ageMatch[1]),
    gender: genderMatch[0]
  }
}

/**
 * 엑셀 파일 읽기 및 변환
 */
function readExcelFile(filePath: string): PremiumData[] {
  console.log(`📖 파일 읽는 중: ${filePath}`)
  
  const workbook = XLSX.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
  
  if (data.length === 0) {
    console.warn(`⚠️ 파일에 데이터가 없습니다: ${filePath}`)
    return []
  }
  
  // 파일명에서 연령/성별 추출
  const filename = path.basename(filePath)
  const ageGender = extractAgeAndGender(filename)
  
  if (!ageGender) {
    console.warn(`⚠️ 파일을 건너뜁니다: ${filePath}`)
    return []
  }
  
  // 헤더 행 찾기
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(10, data.length); i++) {
    if (data[i][0] === '담보명' || data[i][0]?.toString().includes('담보')) {
      headerRowIndex = i
      break
    }
  }
  
  if (headerRowIndex === -1) {
    console.warn(`⚠️ 헤더 행을 찾을 수 없습니다: ${filePath}`)
    return []
  }
  
  const headerRow = data[headerRowIndex]
  const insuranceCompanies: { name: string; colIndex: number }[] = []
  
  // 보험사 이름 추출 (C열 이후)
  for (let col = 2; col < headerRow.length; col++) {
    const headerValue = headerRow[col]?.toString().trim()
    if (headerValue && 
        headerValue !== '합계' && 
        headerValue !== '' && 
        !headerValue.includes('가입금액') &&
        !headerValue.includes('담보명')) {
      insuranceCompanies.push({
        name: headerValue,
        colIndex: col
      })
    }
  }
  
  console.log(`   발견된 보험사: ${insuranceCompanies.length}개`)
  
  const result: PremiumData[] = []
  
  // 데이터 변환
  for (let row = headerRowIndex + 1; row < data.length; row++) {
    const coverageName = data[row][0]?.toString().trim()
    const subscriptionAmount = data[row][1]
    
    // "합계" 행은 건너뛰기
    if (!coverageName || 
        coverageName === '합계' || 
        coverageName === '' || 
        coverageName.includes('합계')) {
      continue
    }
    
    // 각 보험사별로 데이터 변환
    for (const company of insuranceCompanies) {
      const premiumValue = data[row][company.colIndex]
      
      if (premiumValue !== undefined && premiumValue !== '' && premiumValue !== 0 && premiumValue !== null) {
        // 숫자로 변환
        let premium = 0
        if (typeof premiumValue === 'number') {
          premium = premiumValue
        } else if (typeof premiumValue === 'string') {
          premium = parseInt(premiumValue.replace(/,/g, '')) || 0
        }
        
        if (premium > 0) {
          // 가입금액 정리 (쉼표 제거, 숫자만 저장)
          let cleanAmount: string | number = subscriptionAmount || ''
          if (typeof subscriptionAmount === 'string') {
            cleanAmount = subscriptionAmount.replace(/,/g, '').trim()
          } else if (typeof subscriptionAmount === 'number') {
            cleanAmount = subscriptionAmount.toString()
          }
          
          result.push({
            age: ageGender.age,
            gender: ageGender.gender,
            coverageName,
            subscriptionAmount: cleanAmount,
            company: company.name,
            premium
          })
        }
      }
    }
  }
  
  console.log(`   ✅ 변환된 데이터: ${result.length}개`)
  return result
}

/**
 * Google Sheets에 데이터 업로드
 */
async function uploadToSheets(allData: PremiumData[]) {
  if (!GOOGLE_SHEETS_ID) {
    console.error('❌ GOOGLE_SHEETS_ID 환경 변수가 설정되지 않았습니다.')
    return
  }
  
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다.')
    console.error('   .env.local 파일에 GOOGLE_API_KEY를 추가하세요.')
    return
  }
  
  console.log('\n📤 Google Sheets에 업로드 중...')
  console.log(`   Sheets ID: ${GOOGLE_SHEETS_ID.substring(0, 20)}...`)
  
  // 인증 방식 선택 (서비스 계정 > OAuth > API Key)
  let auth: any
  
  if (GOOGLE_SERVICE_ACCOUNT_PATH && fs.existsSync(GOOGLE_SERVICE_ACCOUNT_PATH)) {
    // 서비스 계정 사용 (권장)
    console.log('   🔑 서비스 계정 인증 사용 중...')
    const serviceAccount = JSON.parse(fs.readFileSync(GOOGLE_SERVICE_ACCOUNT_PATH, 'utf-8'))
    auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
  } else {
    // API Key 사용 (읽기 전용)
    console.log('   ⚠️ API Key 사용 중 (읽기 전용, 쓰기 불가)')
    console.log('   💡 Google Sheets 쓰기를 위해서는 서비스 계정이 필요합니다.')
    console.log('   📝 CSV 파일이 자동으로 생성되니 수동으로 업로드해주세요.')
    auth = GOOGLE_API_KEY
  }
  
  const sheets = google.sheets({ 
    version: 'v4', 
    auth: await auth
  })
  
  // 헤더 + 데이터
  const values: any[][] = [
    ['연령', '성별', '담보명', '가입금액', '보험사', '보험료']
  ]
  
  allData.forEach(item => {
    values.push([
      item.age,
      item.gender,
      item.coverageName,
      item.subscriptionAmount,
      item.company,
      item.premium
    ])
  })
  
  try {
    // 시트 존재 여부 확인
    const existingSheetId = await getSheetId(sheets, '담보별_보험료')
    
    if (existingSheetId === null) {
      console.error('❌ "담보별_보험료" 시트를 찾을 수 없습니다.')
      console.error('   Google Sheets에서 수동으로 "담보별_보험료" 시트를 생성해주세요.')
      console.error('   또는 Google Apps Script를 사용하여 시트를 생성할 수 있습니다.')
      return
    }
    
    console.log('   기존 "담보별_보험료" 시트 발견')
    
    // 기존 데이터 모두 삭제 (A1부터 Z10000까지 클리어)
    console.log('   기존 데이터 삭제 중...')
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: GOOGLE_SHEETS_ID,
        range: '담보별_보험료!A1:Z10000'
      })
    } catch (e: any) {
      // 클리어 실패해도 계속 진행 (시트가 비어있을 수 있음)
      console.warn(`   ⚠️ 기존 데이터 삭제 실패 (무시): ${e.message}`)
    }
    
    // 데이터 업로드 (데이터가 많으면 배치로 나눠서 업로드)
    console.log(`   데이터 업로드 중... (${values.length}행)`)
    
    // Google Sheets API는 한 번에 최대 10,000행까지 업로드 가능
    // 하지만 안전하게 5000행씩 나눠서 업로드
    const batchSize = 5000
    let uploadedRows = 0
    
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize)
      const startRow = i + 1 // A1부터 시작
      const endRow = startRow + batch.length - 1
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_SHEETS_ID,
        range: `담보별_보험료!A${startRow}:F${endRow}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: batch
        }
      })
      
      uploadedRows += batch.length
      console.log(`   ${uploadedRows}/${values.length}행 업로드됨...`)
    }
    
    console.log(`✅ 업로드 완료! 총 ${allData.length}개의 데이터가 업로드되었습니다.`)
  } catch (error: any) {
    console.error('❌ 업로드 오류:')
    console.error(`   메시지: ${error.message}`)
    if (error.response?.data?.error) {
      console.error(`   상세: ${JSON.stringify(error.response.data.error, null, 2)}`)
      
      // 인증 오류인 경우 안내
      if (error.response.data.error.code === 401) {
        console.error('\n💡 해결 방법:')
        console.error('   1. Google Sheets에서 "담보별_보험료" 시트를 수동으로 생성하세요.')
        console.error('   2. 시트를 "링크가 있는 모든 사용자"에게 공개로 설정하세요.')
        console.error('   3. 그 다음 다시 스크립트를 실행하세요.')
      }
    }
    throw error
  }
}

/**
 * CSV 파일 생성
 */
function generateCSV(data: PremiumData[]): string {
  // BOM 추가 (한글 깨짐 방지)
  const BOM = '\uFEFF'
  
  // 헤더
  const headers = ['연령', '성별', '담보명', '가입금액', '보험사', '보험료']
  let csv = BOM + headers.join(',') + '\n'
  
  // 데이터
  data.forEach(item => {
    // 가입금액에서 쉼표 제거 (숫자만 저장)
    let subscriptionAmount = typeof item.subscriptionAmount === 'string' 
      ? item.subscriptionAmount.replace(/,/g, '').trim()
      : (item.subscriptionAmount || '').toString()
    
    // 빈 값이면 기본값 설정
    if (!subscriptionAmount || subscriptionAmount === '') {
      subscriptionAmount = '0'
    }
    
    const row = [
      item.age,
      `"${item.gender}"`,
      `"${item.coverageName}"`, // 따옴표로 감싸서 쉼표 포함 문자열 처리
      subscriptionAmount, // 쉼표 제거된 숫자
      `"${item.company}"`,
      item.premium
    ]
    csv += row.join(',') + '\n'
  })
  
  return csv
}

/**
 * 시트 ID 가져오기
 */
async function getSheetId(sheets: any, sheetName: string): Promise<number | null> {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEETS_ID
    })
    
    if (!response.data.sheets) {
      return null
    }
    
    const sheet = response.data.sheets.find((s: any) => s.properties?.title === sheetName)
    return sheet?.properties?.sheetId || null
  } catch (e: any) {
    console.warn(`   ⚠️ 시트 정보 조회 실패: ${e.message}`)
    return null
  }
}

/**
 * 메인 함수
 */
async function main() {
  console.log('🚀 담보별 보험료 데이터 자동 업로드 시작\n')
  console.log('📌 참고: Google Sheets에 "담보별_보험료" 시트가 있어야 합니다.')
  console.log('   시트가 없으면 Google Sheets에서 수동으로 생성해주세요.\n')
  
  // data 폴더 경로
  const dataDir = path.join(process.cwd(), 'data')
  
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ data 폴더를 찾을 수 없습니다: ${dataDir}`)
    return
  }
  
  // 엑셀 파일 찾기
  const files = fs.readdirSync(dataDir)
    .filter(file => 
      (file.endsWith('.xlsx') || file.endsWith('.xls')) &&
      file.includes('한장보험료비교')
    )
    .map(file => path.join(dataDir, file))
  
  if (files.length === 0) {
    console.error('❌ 엑셀 파일을 찾을 수 없습니다.')
    console.error('   data 폴더에 "*한장보험료비교*.xlsx" 파일을 넣어주세요.')
    return
  }
  
  console.log(`📁 발견된 파일: ${files.length}개\n`)
  
  // 모든 파일 읽기
  const allData: PremiumData[] = []
  
  for (const file of files) {
    const data = readExcelFile(file)
    allData.push(...data)
    console.log('')
  }
  
  console.log(`\n📊 총 데이터: ${allData.length}개\n`)
  
  // CSV 파일로 내보내기 (Google Sheets API 제한으로 인해)
  if (allData.length > 0) {
    // CSV 파일 생성
    const csvPath = path.join(process.cwd(), 'data', '담보별_보험료.csv')
    const csvContent = generateCSV(allData)
    fs.writeFileSync(csvPath, csvContent, 'utf-8')
    console.log(`\n✅ CSV 파일 생성 완료: ${csvPath}`)
    console.log(`   총 ${allData.length}개의 데이터가 포함되었습니다.`)
    console.log('\n📋 다음 단계:')
    console.log('   1. Google Sheets를 열고 "담보별_보험료" 시트를 선택하세요.')
    console.log('   2. 파일 > 가져오기 > 업로드 > CSV 파일 선택')
    console.log(`   3. "${csvPath}" 파일을 선택하세요.`)
    console.log('   4. 또는 CSV 파일을 열어서 Google Sheets에 복사 붙여넣기하세요.')
    
    // Google Sheets 업로드 시도 (실패해도 CSV는 생성됨)
    try {
      await uploadToSheets(allData)
    } catch (error) {
      console.log('\n⚠️ Google Sheets 자동 업로드는 실패했습니다 (API Key 제한).')
      console.log('   CSV 파일을 사용하여 수동으로 업로드해주세요.')
    }
    
    console.log('\n✅ 완료!')
  } else {
    console.error('❌ 업로드할 데이터가 없습니다.')
  }
}

// 실행
if (require.main === module) {
  main().catch(console.error)
}

export { main }

