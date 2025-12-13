/**
 * 전화번호 포맷팅 유틸리티
 */

/**
 * 전화번호를 하이픈이 포함된 형식으로 변환
 * @param phone 전화번호 (하이픈 포함/미포함 모두 가능)
 * @returns 포맷팅된 전화번호 (010-0000-0000)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '-'
  
  // 숫자만 추출
  const numbers = phone.replace(/[^\d]/g, '')
  
  // 빈 문자열이면 그대로 반환
  if (numbers.length === 0) return phone
  
  // 최대 11자리까지만 허용
  const limitedNumbers = numbers.slice(0, 11)
  
  // 포맷팅 적용
  if (limitedNumbers.length <= 3) {
    return limitedNumbers
  } else if (limitedNumbers.length <= 7) {
    return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
  } else {
    return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`
  }
}

