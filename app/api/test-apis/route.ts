import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { fetchSheetsData } from '@/lib/google-sheets'
import { searchGoogle } from '@/lib/google-search'

/**
 * 모든 Google API 연결 상태 테스트
 */
export async function GET(request: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    tests: {}
  }

  // 1. Gemini API 테스트
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
    const testResult = await model.generateContent('테스트')
    const response = await testResult.response
    results.tests.gemini = {
      status: '✅ 성공',
      message: 'Gemini API 연결 성공',
      responseLength: response.text().length
    }
  } catch (error: any) {
    results.tests.gemini = {
      status: '❌ 실패',
      message: error.message || 'Gemini API 연결 실패',
      error: error.toString()
    }
  }

  // 2. Google Sheets API 테스트
  try {
    const sheetsData = await fetchSheetsData()
    
    // 담보별 보험료 데이터 개수 계산
    const detailPremiumsCount = sheetsData.comparisons
      .filter(comp => comp.detailPremiums && comp.detailPremiums.length > 0)
      .reduce((sum, comp) => sum + (comp.detailPremiums?.length || 0), 0)
    
    results.tests.googleSheets = {
      status: '✅ 성공',
      message: 'Google Sheets API 연결 성공',
      dataCount: {
        products: sheetsData.products.length,
        comparisons: sheetsData.comparisons.length,
        diseaseCodes: sheetsData.diseaseCodes.length,
        detailPremiums: detailPremiumsCount // 담보별 보험료 데이터 개수
      }
    }
  } catch (error: any) {
    results.tests.googleSheets = {
      status: '❌ 실패',
      message: error.message || 'Google Sheets API 연결 실패',
      error: error.toString()
    }
  }

  // 3. Google Custom Search API 테스트
  try {
    const searchResult = await searchGoogle('보험', 1)
    if (searchResult.success && searchResult.results.length > 0) {
      results.tests.googleCustomSearch = {
        status: '✅ 성공',
        message: 'Google Custom Search API 연결 성공',
        resultCount: searchResult.results.length,
        firstResult: {
          title: searchResult.results[0].title,
          link: searchResult.results[0].link
        }
      }
    } else {
      results.tests.googleCustomSearch = {
        status: '⚠️ 경고',
        message: searchResult.error || '검색 결과가 없습니다',
        success: searchResult.success
      }
    }
  } catch (error: any) {
    results.tests.googleCustomSearch = {
      status: '❌ 실패',
      message: error.message || 'Google Custom Search API 연결 실패',
      error: error.toString()
    }
  }

  // 4. 환경 변수 확인
  results.environment = {
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    hasCustomSearchApiKey: !!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY,
    hasCustomSearchEngineId: !!process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID,
    hasSheetsId: !!process.env.GOOGLE_SHEETS_ID
  }

  // 전체 상태 요약
  const allTests = Object.values(results.tests)
  const successCount = allTests.filter((t: any) => t.status === '✅ 성공').length
  const failCount = allTests.filter((t: any) => t.status === '❌ 실패').length

  results.summary = {
    total: allTests.length,
    success: successCount,
    failed: failCount,
    allPassed: failCount === 0
  }

  return NextResponse.json(results, {
    status: results.summary.allPassed ? 200 : 500
  })
}

