/**
 * 네이버 검색광고(SearchAd) API — 키워드 도구 (keywordstool)
 * 연관키워드 + 월간검색수(PC/모바일) 조회 후 검색량 순 상위 N개 반환
 *
 * 설정: NAVER_SEARCHAD_CUSTOMER_ID, NAVER_SEARCHAD_ACCESS_LICENSE, NAVER_SEARCHAD_SECRET_KEY
 * 발급: 검색광고 관리자센터 > 도구 > API 사용 관리
 * @see https://naver.github.io/searchad-apidoc/
 */

import crypto from 'crypto'

const BASE_URL = 'https://api.searchad.naver.com'

/** keywordstool API 응답 항목 (관련 키워드 1개) */
interface KeywordToolItem {
  relKeyword?: string
  monthlyPcQcCnt?: number
  monthlyMobileQcCnt?: number
  monthlyAvePcClkCnt?: number
  monthlyAveMobileClkCnt?: number
  [key: string]: unknown
}

interface KeywordToolResponse {
  keywordList?: KeywordToolItem[]
}

/**
 * 서명 생성: HMAC-SHA256(secret, "${timestamp}.GET.${path}") → Base64
 * path에는 쿼리스트링을 포함하지 않음
 */
function buildSignature(secretKey: string, timestamp: string, path: string): string {
  const message = `${timestamp}.GET.${path}`
  // 네이버 문서에 따라 secret을 그대로 사용 (UTF-8). 일부 문서는 base64 디코딩 권장.
  const key = secretKey.includes('base64:')
    ? Buffer.from(secretKey.replace(/^base64:/, ''), 'base64')
    : Buffer.from(secretKey, 'utf8')
  const hmac = crypto.createHmac('sha256', key)
  hmac.update(message, 'utf8')
  return hmac.digest('base64')
}

/**
 * 네이버 키워드 도구 API로 연관 키워드 + 월간검색수를 조회하고,
 * PC+모바일 검색량 합계 기준 상위 maxKeywords개를 반환합니다.
 *
 * - 환경 변수 미설정 시 빈 배열 반환 (에러 없이 폴백)
 * - hintKeywords: 검색어 1개 이상 (예: 상품명, "상품명 보험")
 */
export async function getBestKeywordsFromNaverSearchAd(
  hintKeywords: string[],
  options?: { maxKeywords?: number }
): Promise<string[]> {
  const customerId = process.env.NAVER_SEARCHAD_CUSTOMER_ID
  const accessLicense = process.env.NAVER_SEARCHAD_ACCESS_LICENSE
  const secretKey = process.env.NAVER_SEARCHAD_SECRET_KEY

  if (!customerId || !accessLicense || !secretKey) {
    console.warn(
      '[Naver SearchAd] 환경 변수(NAVER_SEARCHAD_CUSTOMER_ID, NAVER_SEARCHAD_ACCESS_LICENSE, NAVER_SEARCHAD_SECRET_KEY)가 없습니다. 연관 키워드 기능을 건너뜁니다.'
    )
    return []
  }

  const hints = hintKeywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
  if (hints.length === 0) return []

  // hintKeywords에 공백/쉼표가 있으면 11001 유효하지 않음 → API용은 공백·쉼표 제거
  const normalizeForApi = (raw: string) =>
    raw.replace(/\s+/g, '').replace(/,/g, '').trim()

  const maxKeywords = options?.maxKeywords ?? 5
  const path = '/keywordstool'

  // 시도할 키워드: 사용자 힌트(정규화) + 폴백. 여러 힌트로 호출해 결과를 합친 뒤 검색량 순 상위 N개 반환
  const toTry: string[] = []
  for (const h of hints) {
    const n = normalizeForApi(h)
    if (n.length > 0 && !toTry.includes(n)) toTry.push(n)
  }
  const fallbacks = ['실손보험', '실손의료보험', '실비보험']
  for (const fb of fallbacks) {
    if (!toTry.includes(fb)) toTry.push(fb)
  }
  if (toTry.length === 0) return []

  const merged: Array<{ keyword: string; volume: number }> = []

  for (const apiKeyword of toTry) {
    try {
      const timestamp = String(Date.now())
      const signature = buildSignature(secretKey, timestamp, path)
      const query = new URLSearchParams()
      query.set('hintKeywords', apiKeyword)
      query.set('showDetail', '1')
      query.set('includeHintKeywords', '1')
      const url = `${BASE_URL}${path}?${query.toString()}`

      console.log('[Naver SearchAd] keywordstool 요청 hintKeywords(공백제거):', apiKeyword)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Timestamp': timestamp,
          'X-API-KEY': accessLicense,
          'X-Customer': customerId,
          'X-Signature': signature,
          'Content-Type': 'application/json; charset=UTF-8'
        }
      })

      if (!response.ok) {
        const text = await response.text()
        console.warn('[Naver SearchAd] keywordstool 실패:', response.status, apiKeyword, text.substring(0, 200))
        await new Promise((r) => setTimeout(r, 150))
        continue
      }

      const json = (await response.json()) as KeywordToolResponse
      const list = json.keywordList ?? []

      if (list.length === 0) {
        await new Promise((r) => setTimeout(r, 150))
        continue
      }

      const withVolume = list
        .map((item) => ({
          keyword: (item.relKeyword ?? '').trim(),
          volume: (Number(item.monthlyPcQcCnt) || 0) + (Number(item.monthlyMobileQcCnt) || 0)
        }))
        .filter((x) => x.keyword.length > 0)

      for (const x of withVolume) {
        const existing = merged.find((m) => m.keyword === x.keyword)
        if (existing) existing.volume = Math.max(existing.volume, x.volume)
        else merged.push({ keyword: x.keyword, volume: x.volume })
      }

      await new Promise((r) => setTimeout(r, 150))
    } catch (error) {
      console.warn('[Naver SearchAd] keywordstool 조회 오류:', apiKeyword, error)
      await new Promise((r) => setTimeout(r, 150))
    }
  }

  if (merged.length === 0) return []

  const sorted = merged.sort((a, b) => b.volume - a.volume)
  const top = sorted.slice(0, maxKeywords).map((x) => x.keyword)
  return Array.from(new Set(top))
}
