import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateQuestionPrompt, generateAnswerPrompt, generateConversationThreadPrompt, generateCommentPairPrompt, generateReviewMessagePrompt, generateReviewResponsePrompt, generateUnifiedQAPrompt, generateThreadBatchPrompt, ConversationMessage } from '@/lib/prompts/qa-prompt'
import { createClient } from '@/lib/supabase/server'
import { searchGoogle, SearchResult } from '@/lib/google-search'
import { getBestKeywordsFromNaverSearchAd } from '@/lib/naver-searchad'
import { convertToCustomerTopicName, extractPersonaBucket, type TopicStructure } from '@/lib/topic-utils'
import { sampleFamilies, buildTitlePrompt, scoreTitleCandidate as scoreTitleFamily, pickOpeningFamily, OPENING_FAMILIES, type TitleScoreInput } from '@/lib/title-family'
import { gateTitle, gateQuestionBody, gateAnswer, gateThread, gateHumanLikeness, gateEvidenceConsistency, gateKeywordHealth, gateOperationalRisk, calculateOverallScore, classifyFailureTags, type GateResult, type FirstSentences, type FailureTag } from '@/lib/quality-gate'

/** 문서 14절: 프롬프트·운영 명세 버전 (변경 시 문서 버전 표 업데이트) */
const QA_PROMPT_VERSION = '1.2'

const recentFirstSentencesStore: FirstSentences[] = []
const MAX_RECENT_FIRST_SENTENCES = 5

type TokenUsage = {
  model: string
  promptTokens: number
  candidatesTokens: number
  totalTokens: number
}

type CostEstimate = {
  currency: 'USD'
  totalCost: number | null
  details: Array<{
    model: string
    cost: number | null
    promptTokens: number
    completionTokens: number
  }>
}

type CostRate = {
  prompt: number | null
  completion: number | null
}

type CostRates = {
  [key: string]: CostRate
} & {
  'gemini-2.0-flash': CostRate
  'gemini-2.5-flash': CostRate
  'gemini-2.5-pro': CostRate
}

const getCostRates = (): CostRates => {
  const toNumber = (v?: string, defaultValue?: number) => {
    const n = v ? parseFloat(v) : defaultValue ?? NaN
    return Number.isFinite(n) ? n : null
  }

  return {
    'gemini-2.0-flash': {
      prompt: toNumber(process.env.GEMINI_FLASH_2_0_INPUT_COST_PER_1M, 0.10),
      completion: toNumber(process.env.GEMINI_FLASH_2_0_OUTPUT_COST_PER_1M, 0.40)
    },
    'gemini-2.5-flash': {
      prompt: toNumber(process.env.GEMINI_FLASH_2_5_INPUT_COST_PER_1M, 0.075),
      completion: toNumber(process.env.GEMINI_FLASH_2_5_OUTPUT_COST_PER_1M, 0.30)
    },
    'gemini-2.5-pro': {
      prompt: toNumber(process.env.GEMINI_PRO_2_5_INPUT_COST_PER_1M, 1.25),
      completion: toNumber(process.env.GEMINI_PRO_2_5_OUTPUT_COST_PER_1M, 10.00)
    }
  }
}

const estimateCost = (usages: TokenUsage[]): CostEstimate => {
  const rates = getCostRates()
  const details: CostEstimate['details'] = usages.map((u) => {
    const rate = rates[u.model] || { prompt: null, completion: null }
    const cost =
      rate.prompt !== null && rate.completion !== null
        ? (u.promptTokens / 1_000_000) * rate.prompt + (u.candidatesTokens / 1_000_000) * rate.completion
        : null
    return {
      model: u.model,
      cost,
      promptTokens: u.promptTokens,
      completionTokens: u.candidatesTokens
    }
  })

  const totalCost = details.some((d) => d.cost !== null)
    ? details.reduce((sum, d) => sum + (d.cost || 0), 0)
    : null

  return {
    currency: 'USD',
    totalCost,
    details
  }
}

// 검색 결과를 프롬프트용 불릿 문자열로 변환 (출처 표기 없이 내용만)
const formatSearchResultsForPrompt = (results: SearchResult[]): string => {
  if (!results || results.length === 0) return ''
  return results
    .slice(0, 5)
    .map((r, idx) => {
      const title = (r.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      const snippet = (r.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200)
      return `- (${idx + 1}) ${title} — ${snippet}`
    })
    .join('\n')
}

// 상품명에서 검색·키워드용 핵심 부분만 추출 (회사명·버전·코드·괄호 등 제거)
const normalizeProductNameForSearch = (raw?: string | null): string => {
  if (!raw) return ''
  let name = raw.trim()
  // 회사명/법인 표기 제거
  name = name
    .replace(/보험\(주\)/g, '')
    .replace(/\(주\)/g, '')
    .replace(/주식회사/g, '')
    .replace(/라이나생명보험/g, '라이나생명')
    .replace(/라이나생명보험주식회사/g, '라이나생명')
  // 내부 표기 제거
  name = name.replace(/무배당/g, '')
  name = name.replace(/\d+N\d+/gi, '')
  name = name.replace(/\d+종/g, '')
  // 괄호와 내부 코드/버전 제거
  name = name.replace(/\([^)]*\)/g, '')
  // 연속 공백 정리
  name = name.replace(/\s+/g, ' ').trim()
  // 너무 길면 앞쪽 2~3단어만 사용
  const parts = name.split(' ')
  if (parts.length > 3) {
    name = parts.slice(0, 3).join(' ')
  }
  return name
}

// ============================================
// 3단 상품명 체계: raw → display → topic
// 로직은 lib/topic-utils.ts 공유 모듈로 이관됨
// convertToCustomerTopicName, extractPersonaBucket 모두 import 사용
// ============================================

// ============================================
// 필드별 정제 함수 3종 (정제 강도: 강 → 중 → 약)
// ============================================

// 제목·핵심키워드용: 가장 강한 정제 (괄호·버전·로마숫자·(주)·무배당 모두 제거)
const cleanForTitle = (text: string): string => {
  if (!text) return ''
  let c = text
  c = c.replace(/\([^)]*\)/g, '')
  c = c.replace(/무배당/g, '')
  c = c.replace(/\(주\)/g, '')
  c = c.replace(/\s+(I{1,3}|IV|V|VI{0,3})(\s|$)/g, '$2')
  c = c.replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(\s|$)/g, '$2')
  c = c.replace(/(I{1,3}|IV|V|VI{0,3})(\s|$)/g, '$2')
  c = c.replace(/\d+\.\d+/g, '')
  c = c.replace(/\s+/g, ' ').trim()
  return c
}

// 본문 설명용: 약한 정제 (버전 코드·(주)·무배당만 제거, 핵심 구조어는 보존)
// 해약환급금미지급형, 3-2-5, 특정4대질병제외 같은 보장 의미어는 유지
const cleanForBody = (text: string): string => {
  if (!text) return ''
  let c = text
  c = c.replace(/\(주\)/g, '')
  c = c.replace(/무배당/g, '')
  // 버전 코드 괄호만 제거: (3.105), (2024.01) 같은 숫자만 들어간 괄호
  c = c.replace(/\(\s*\d[\d.]*\s*\)/g, '')
  // 나머지 괄호: 핵심 보장 구조어가 들어있으면 괄호만 벗기고, 아닌 경우만 제거
  c = c.replace(/\(([^)]*)\)/g, (_match, inner: string) => {
    if (/^\s*[\d.]+\s*$/.test(inner)) return ''
    if (/해약환급금|미지급|무해약|특정\d|질병제외|간편심사|3-2-5|고액치료비|표적항암/.test(inner)) return ` ${inner.trim()}`
    return ''
  })
  // 로마숫자 제거 (괄호 확장 후, 문자열 어디서든: 보험료납입면제대상 II → 보험료납입면제대상)
  c = c.replace(/\s+(I{2,3}|IV|VI{0,3})(?=[\s,.]|[가-힣]|$)/g, '')
  c = c.replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.]|[가-힣]|$)/g, '')
  c = c.replace(/\s+/g, ' ').trim()
  return c
}

// 키워드용: 강한 정제 (cleanForTitle과 동일하지만 별도 함수로 분리해 의도 명시)
const cleanForKeyword = cleanForTitle

// 제목 채점은 lib/title-family.ts의 scoreTitleCandidate로 이관됨

// 한국어 문장 끝 패턴 찾기 (자연스러운 문장 완성 지점)
const findKoreanSentenceEnd = (text: string, maxPos: number, searchRange: number = 30): number | null => {
  // 안전성 검사
  if (!text || typeof text !== 'string' || text.length === 0) {
    return null
  }
  
  // maxPos가 text 길이보다 크면 text 길이로 제한
  const actualMaxPos = Math.min(maxPos, text.length)
  if (actualMaxPos <= 0) {
    return null
  }
  
  // maxPos 위치에서 앞으로 searchRange만큼 검색하여 문장 끝 패턴 찾기
  const startPos = Math.max(0, actualMaxPos - searchRange)
  const searchText = text.slice(startPos, actualMaxPos)
  
  if (!searchText || searchText.length === 0) {
    return null
  }
  
  // 한국어 문장 끝 패턴 (우선순위 순)
  const patterns = [
    /[?!.]\s*$/,  // 물음표, 느낌표, 마침표
    /(요|니다|습니다|해요|어요|아요|죠|지요|에요|이에요|네요|군요|거예요|예요|까요|나요|다|어|아)\s*$/,  // 한국어 어미
    /(되요|돼요|되나요|돼나요|되죠|돼죠)\s*$/,  // 특수 어미
    /(입니다|입니까|입니다만|입니다요)\s*$/,  // 입니다 계열
    /(겠어요|겠습니다|겠죠|겠네요)\s*$/,  // 겠 계열
    /(할게요|할거예요|할거야|할거예요)\s*$/,  // 할 계열
  ]
  
  // 뒤에서부터 패턴 검색 (가장 가까운 문장 끝 찾기)
  try {
    for (let i = searchText.length; i >= 0; i--) {
      const substr = searchText.slice(0, i)
      if (!substr) continue
      
      for (const pattern of patterns) {
        try {
          if (pattern.test(substr)) {
            const foundPos = startPos + i
            // 찾은 위치가 maxPos에 가깝고 (5자 이내 차이) 최소 길이(50자) 이상인 경우
            if (foundPos >= 50 && foundPos <= actualMaxPos && (actualMaxPos - foundPos) <= 5) {
              return foundPos
            }
            // 찾은 위치가 maxPos보다 작고 합리적인 거리(30자 이내)에 있는 경우
            if (foundPos < actualMaxPos && (actualMaxPos - foundPos) <= searchRange) {
              return foundPos
            }
          }
        } catch (patternError) {
          // 패턴 테스트 중 오류 발생 시 다음 패턴으로
          continue
        }
      }
    }
  } catch (error) {
    // 검색 중 오류 발생 시 null 반환
    console.warn('findKoreanSentenceEnd 오류:', error)
    return null
  }
  
  return null
}

// 답변/댓글 역할 누수 제거: 전문가 자기소개, 상담 유도, 영업성 CTA 패턴 제거
const ROLE_LEAKAGE_PATTERNS = [
  /\d{1,2}년\s*(이상\s*)?경력[^.?!\n]*/g,
  /전문가\s*님[-~]?/g,
  /나[-~]\s*전문가님/g,
  /설계사입니다[.!]?/g,
  /상담\s*(요청|문의)[^.?!\n]*/g,
  /연락\s*주세요[.!]?/g,
  /문의\s*주세요[.!]?/g,
  /전화\s*주세요[.!]?/g,
  /쪽지\s*주세요[.!]?/g,
  /언제든\s*문의[^.?!\n]*/g,
  /상담\s*환영[^.?!\n]*/g,
  /상담\s*도와드릴[^.?!\n]*/g,
]

function stripAnswerRoleLeakage(text: string): string {
  let result = text
  for (const pat of ROLE_LEAKAGE_PATTERNS) {
    const before = result
    result = result.replace(pat, '')
    if (before !== result) {
      console.log(`[역할 누수 제거] 패턴 제거됨: ${pat.source}`)
    }
  }
  return result.replace(/\n{3,}/g, '\n\n').replace(/^\s*\n/, '').trim()
}

// 마지막 agent 댓글 영업성 제거: "비교 설계", "설계 받아보세요" 등을 판단 정리형으로 대체
const SALES_ENDING_PATTERNS = [
  /비교\s*설계[^.?!\n]*(받아|한번|해보)[^.?!\n]*/gi,
  /설계\s*(다시|한번|받아)[^.?!\n]*/gi,
  /상담\s*(받아|한번)[^.?!\n]*/gi,
  /설계사\s*(만나|찾아)[^.?!\n]*/gi,
]

function normalizeFinalAgentEnding(text: string): string {
  let result = text
  for (const pat of SALES_ENDING_PATTERNS) {
    result = result.replace(pat, '')
  }
  return result.replace(/\n{3,}/g, '\n\n').trim()
}

// 질문 본문 문단 자동 분리: 260자+ & 빈 줄 2개 미만이면 3블록으로 분리
function autoSplitQuestionParagraphs(text: string): string {
  if (!text || text.length < 260) return text
  const existingBreaks = (text.match(/\n\s*\n/g) || []).length
  if (existingBreaks >= 2) return text

  const sentences = text.split(/(?<=[?？!！\n])\s*/).filter(s => s.trim().length > 0)
  if (sentences.length < 3) return text

  const totalLen = sentences.reduce((sum, s) => sum + s.length, 0)
  const block1Target = totalLen * 0.35
  const block2Target = totalLen * 0.75

  let block1: string[] = []
  let block2: string[] = []
  let block3: string[] = []
  let accumulated = 0

  for (const sentence of sentences) {
    accumulated += sentence.length
    if (accumulated <= block1Target) {
      block1.push(sentence)
    } else if (accumulated <= block2Target) {
      block2.push(sentence)
    } else {
      block3.push(sentence)
    }
  }

  if (block1.length === 0) block1 = [sentences[0]]
  if (block2.length === 0 && sentences.length > 1) block2 = [sentences[Math.floor(sentences.length / 2)]]
  if (block3.length === 0 && sentences.length > 2) block3 = [sentences[sentences.length - 1]]

  const result = [block1.join(' '), block2.join(' '), block3.join(' ')]
    .filter(b => b.trim().length > 0)
    .join('\n\n')

  console.log(`[Q&A 생성] 문단 자동 분리 적용: ${sentences.length}문장 → ${result.split('\n\n').length}문단`)
  return result
}

function normalizeExclamationMarks(text: string): string {
  const exclamationCount = (text.match(/!/g) || []).length
  if (exclamationCount <= 2) return text

  let replaced = 0
  return text.replace(/!/g, (match) => {
    replaced++
    if (replaced <= 2) return match
    return replaced === exclamationCount ? '요' : ''
  })
}

// 답변 길이 제한 함수 (정확히 maxLength로 맞추기 - 의미 보존, 문장 중간 끊김 방지)
// 카페 답변은 마침표를 사용하지 않으므로, 줄바꿈과 자연스러운 구분점을 기준으로 자름
const enforceAnswerLength = (content: string, maxLength: number = 120): string => {
  try {
    // 안전성 검사
    if (!content || typeof content !== 'string') {
      return content || ''
    }
    
    if (content.length <= maxLength) {
      return content
    }
    
    // maxLength가 너무 작으면 최소값으로 제한
    const safeMaxLength = Math.max(50, maxLength)
    
    // 1. 문단 단위로 분리
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
  
  // 2. 문단 단위로 자르기 시도 (정확히 safeMaxLength 이하로)
  let result = ''
  for (const paragraph of paragraphs) {
    const testResult = result ? `${result}\n\n${paragraph}` : paragraph
    
    if (testResult.length <= safeMaxLength) {
      result = testResult
    } else {
      // 이 문단을 추가하면 초과하므로, 문장 단위로 자르기
      // 카페 답변은 마침표를 사용하지 않으므로, 줄바꿈이나 자연스러운 구분점을 기준으로
      const sentences = paragraph
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
      
      for (const sentence of sentences) {
        const testSentence = result 
          ? (result.endsWith('\n\n') ? `${result}${sentence}` : `${result}\n\n${sentence}`)
          : sentence
        
        if (testSentence.length <= safeMaxLength) {
          result = testSentence
        } else {
          // 이 문장을 추가하면 초과하므로, 문장 끝에서만 자르기 (문장 중간 끊김 방지)
          if (result) {
            // result에 이미 완성된 문장들이 있으므로 그대로 반환
            // 단, result가 너무 짧으면(50자 미만) 문장을 단어 단위로 자르기 시도 (문장 끝 찾기 포함)
            if (result.length < 50 && sentence.length > 0) {
              const remaining = safeMaxLength - result.length
              if (remaining > 20) {
                // 문장 끝 패턴 찾기 시도
                const combinedText = result + '\n\n' + sentence
                const sentenceEndPos = findKoreanSentenceEnd(combinedText, safeMaxLength, 30)
                
                if (sentenceEndPos && sentenceEndPos > result.length) {
                  // 문장 끝을 찾았으면 그 위치에서 자르기
                  result = combinedText.slice(0, sentenceEndPos).trim()
                } else {
                  // 문장 끝을 찾지 못했으면 단어 단위로 자르기
                  const words = sentence.split(/\s+/)
                  let truncated = ''
                  
                  for (const word of words) {
                    const testWord = truncated ? `${truncated} ${word}` : word
                    const testResult = result ? `${result}\n\n${testWord}` : testWord
                    if (testResult.length <= safeMaxLength) {
                      truncated = testWord
                    } else {
                      // 이 단어를 추가하면 초과하므로, 이전까지의 텍스트에서 문장 끝 찾기
                      const testText = result ? `${result}\n\n${truncated}` : truncated
                      const endPos = findKoreanSentenceEnd(testText, safeMaxLength, 30)
                      if (endPos && endPos >= 50) {
                        truncated = testText.slice((result ? result.length + 2 : 0), endPos).trim()
                      }
                      break
                    }
                  }
                  
                  if (truncated.length > 0) {
                    result = result ? `${result}\n\n${truncated}` : truncated
                  }
                }
              }
            }
            break
          } else {
            // result가 비어있으면, 문장을 단어 단위로 자르기 (문장 끝 찾기 포함)
            const remaining = safeMaxLength
            if (remaining > 20) {
              // 먼저 문장 끝 패턴 찾기 시도 (sentence의 실제 길이와 remaining 중 작은 값 사용)
              const searchLength = Math.min(sentence.length, remaining)
              const sentenceEndPos = findKoreanSentenceEnd(sentence, searchLength, 30)
              
              if (sentenceEndPos && sentenceEndPos >= 50) {
                result = sentence.slice(0, sentenceEndPos).trim()
              } else {
                // 문장 끝을 찾지 못했으면 단어 단위로 자르기
                const words = sentence.split(/\s+/)
                let truncated = ''
                
                for (const word of words) {
                  const testWord = truncated ? `${truncated} ${word}` : word
                  if (testWord.length <= remaining) {
                    truncated = testWord
                  } else {
                    // 이 단어를 추가하면 초과하므로, 이전까지의 텍스트에서 문장 끝 찾기
                    const searchLength = Math.min(truncated.length, remaining)
                    const endPos = findKoreanSentenceEnd(truncated, searchLength, 30)
                    if (endPos && endPos >= 50) {
                      truncated = truncated.slice(0, endPos).trim()
                    }
                    break
                  }
                }
                
                if (truncated.length > 0) {
                  result = truncated
                } else {
                  // 단어도 없으면 최소한 앞부분만
                  result = sentence.slice(0, remaining)
                }
              }
            }
          }
          break
        }
      }
      break
    }
  }
  
  // 3. 결과가 비어있거나 너무 짧으면 원본의 앞부분을 문단 단위로 자르기
  if (!result || result.length < 50) {
    const allText = content.replace(/\n{3,}/g, '\n\n').trim()
    const paragraphs = allText.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    result = ''
    for (const paragraph of paragraphs) {
      const testResult = result ? `${result}\n\n${paragraph}` : paragraph
      if (testResult.length <= maxLength) {
        result = testResult
      } else {
        // 문단이 너무 길면 앞부분만 자르기 (단어 단위로, 문장 끝 찾기 포함)
        const remaining = safeMaxLength - result.length
        if (remaining > 20) {
          // 먼저 문장 끝 패턴 찾기 시도
          const combinedText = result ? `${result}\n\n${paragraph}` : paragraph
          const sentenceEndPos = findKoreanSentenceEnd(combinedText, safeMaxLength, 30)
          
          if (sentenceEndPos && sentenceEndPos > (result ? result.length + 2 : 0) && sentenceEndPos >= 50) {
            result = combinedText.slice(0, sentenceEndPos).trim()
          } else {
            // 문장 끝을 찾지 못했으면 단어 단위로 자르기
            const words = paragraph.split(/\s+/)
            let truncated = ''
            
            for (const word of words) {
              const testWord = truncated ? `${truncated} ${word}` : word
              const testText = result ? `${result}\n\n${testWord}` : testWord
              if (testText.length <= safeMaxLength) {
                truncated = testWord
              } else {
                // 이 단어를 추가하면 초과하므로, 이전까지의 텍스트에서 문장 끝 찾기
                const prevText = result ? `${result}\n\n${truncated}` : truncated
                const endPos = findKoreanSentenceEnd(prevText, safeMaxLength, 30)
                if (endPos && endPos > (result ? result.length + 2 : 0) && endPos >= 50) {
                  truncated = prevText.slice((result ? result.length + 2 : 0), endPos).trim()
                }
                break
              }
            }
            
            if (truncated.length > 0) {
              result = result ? `${result}\n\n${truncated}` : truncated
            } else {
              result = result ? `${result}\n\n${paragraph.slice(0, remaining)}` : paragraph.slice(0, remaining)
            }
          }
        }
        break
      }
    }
  }
  
  // 4. 최종 결과가 safeMaxLength를 초과하면 강제로 자르기 (문장 끝 찾기 우선, 단어 단위로)
  if (result.length > safeMaxLength) {
    // 먼저 문장 끝 패턴 찾기 시도
    const sentenceEndPos = findKoreanSentenceEnd(result, safeMaxLength, 30)
    
    if (sentenceEndPos && sentenceEndPos >= 50) {
      result = result.slice(0, sentenceEndPos).trim()
    } else {
      // 문장 끝을 찾지 못했으면 단어 단위로 자르기
      const words = result.split(/\s+/)
      let truncated = ''
      
      for (const word of words) {
        const testWord = truncated ? `${truncated} ${word}` : word
        if (testWord.length <= safeMaxLength) {
          truncated = testWord
        } else {
          // 이 단어를 추가하면 초과하므로, 이전까지의 텍스트에서 문장 끝 찾기
          const searchLength = Math.min(truncated.length, safeMaxLength)
          const endPos = findKoreanSentenceEnd(truncated, searchLength, 30)
          if (endPos && endPos >= 50) {
            truncated = truncated.slice(0, endPos).trim()
          }
          break
        }
      }
      
      if (truncated.length > 0) {
        result = truncated
      } else {
        // 단어도 없으면 최소한 앞부분만 (최후의 수단)
        result = result.slice(0, safeMaxLength).trim()
        const lastSpace = result.lastIndexOf(' ')
        if (lastSpace > result.length * 0.7) {
          result = result.slice(0, lastSpace)
        }
      }
    }
  }
  
  return result.trim()
  } catch (error: any) {
    // 에러 발생 시 원본 내용을 최대 길이로 단순 자르기
    console.error('enforceAnswerLength 오류:', error)
    if (content && typeof content === 'string') {
      const safeMaxLength = Math.max(50, maxLength || 120)
      return content.slice(0, safeMaxLength).trim()
    }
    return content || ''
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    let requestBody
    try {
      requestBody = await request.json()
    } catch (jsonError: any) {
      console.error('JSON 파싱 오류:', jsonError)
      return NextResponse.json(
        { error: '요청 데이터 형식이 올바르지 않습니다', details: jsonError?.message },
        { status: 400 }
      )
    }
    
    let { 
      productName, 
      targetPersona, 
      worryPoint, 
      sellingPoint, 
      answerTone,
      answerLength, // 답변 길이: 'default' (단계별)
      designSheetImage,
      designSheetAnalysis, // 설계서 분석 결과 (보험료, 담보, 특약 등)
      questionTitle, // 답변 재생성 시 사용
      questionContent, // 답변 재생성 시 사용
      conversationMode, // 대화형 모드 활성화 여부
      conversationLength, // 대화 횟수 (기본 6회 - 짝수만 허용, 항상 설계사가 마무리)
      reviewCount, // 후기성 댓글 개수 (0, 1, 2 - 고객만 생성, 설계사 응답 없음)
      generateStep // 생성 단계: 'question' | 'answer' | 'conversation' | 'all' (기본값: 'all')
    } = requestBody

    // 필수 입력 검증
    if (!productName || !targetPersona || !worryPoint || !sellingPoint) {
      return NextResponse.json(
        { error: '필수 입력 항목을 모두 입력해주세요' },
        { status: 400 }
      )
    }

    // 파이프라인 순서 guard: 설계서 이미지가 있는데 분석 결과가 없으면 분석 미완료 상태
    if (designSheetImage && !designSheetAnalysis) {
      console.warn('[Q&A 생성] ⛔ 설계서 분석 미완료 상태에서 생성 요청 거부')
      return NextResponse.json(
        { error: '설계서 분석이 아직 완료되지 않았습니다. 분석 완료 후 다시 시도해주세요.' },
        { status: 422 }
      )
    }

    // 타겟고객 검증 (빈 값, 최소 길이)
    const trimmedTargetPersona = targetPersona.trim()
    if (trimmedTargetPersona.length === 0) {
      return NextResponse.json(
        { error: '타겟 고객을 입력해주세요' },
        { status: 400 }
      )
    }
    if (trimmedTargetPersona.length < 3) {
      return NextResponse.json(
        { error: '타겟 고객을 더 구체적으로 입력해주세요 (최소 3자 이상)' },
        { status: 400 }
      )
    }

    // 설계서 분석 데이터에서 로마숫자·내부 코드 정제 (AI 입력 전처리)
    if (designSheetAnalysis?.coverages) {
      designSheetAnalysis.coverages = designSheetAnalysis.coverages.map((c: string) =>
        c.replace(/\s+(I{2,3}|IV|VI{0,3})(?=[\s,.]|[가-힣]|$)/g, '')
         .replace(/\s+(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ)(?=[\s,.]|[가-힣]|$)/g, '')
         .replace(/\s+/g, ' ').trim()
      )
      // coverages 중복 제거 (같은 보장명 반복 방지)
      const seen = new Set<string>()
      designSheetAnalysis.coverages = designSheetAnalysis.coverages.filter((c: string) => {
        const norm = c.replace(/\s+/g, '').toLowerCase()
        if (seen.has(norm)) return false
        seen.add(norm)
        return true
      })
    }

    // ============================================
    // Canonical Payload: 설계서 모드에서는 분석 결과가 절대 진실
    // 폼에서 온 값이 아니라, analysisResult가 persona/worry/selling 전체를 지배
    // ============================================
    const isDesignSheetMode = !!(designSheetImage && designSheetAnalysis)
    const canonical = {
      productName: isDesignSheetMode
        ? (designSheetAnalysis.rawProductName || productName)
        : productName,
      targetPersona: isDesignSheetMode
        ? (designSheetAnalysis.personaBucket || targetPersona)
        : targetPersona,
      worryPoint: isDesignSheetMode && designSheetAnalysis.worryPoint
        ? designSheetAnalysis.worryPoint
        : worryPoint,
      sellingPoint: isDesignSheetMode && designSheetAnalysis.sellingPoint
        ? designSheetAnalysis.sellingPoint
        : sellingPoint,
    }

    // 설계서 모드: 분석값과 폼값 불일치 시 경고 + 분석값 우선
    if (isDesignSheetMode) {
      if (designSheetAnalysis.personaBucket && designSheetAnalysis.personaBucket !== extractPersonaBucket(targetPersona)) {
        console.warn(`[Q&A 생성] ⚠️ 페르소나 불일치 감지! 폼: "${targetPersona}" → 분석 결과: "${designSheetAnalysis.personaBucket}" → 분석 결과 우선 사용`)
      }
      if (designSheetAnalysis.worryPoint && designSheetAnalysis.worryPoint !== worryPoint) {
        console.warn(`[Q&A 생성] ⚠️ worryPoint canonical override: 폼값 → 분석값 "${designSheetAnalysis.worryPoint.substring(0, 50)}..."`)
      }
      if (designSheetAnalysis.sellingPoint && designSheetAnalysis.sellingPoint !== sellingPoint) {
        console.warn(`[Q&A 생성] ⚠️ sellingPoint canonical override: 폼값 → 분석값 "${designSheetAnalysis.sellingPoint.substring(0, 50)}..."`)
      }
    }

    // 설계서 모드: canonical 값으로 변수 직접 덮어쓰기
    // 이후 모든 로직에서 폼값 대신 분석 결과가 사용됨
    if (isDesignSheetMode) {
      const personaChanged = canonical.targetPersona !== targetPersona
      if (personaChanged) {
        console.warn(`[Q&A 생성] ⚠️ 페르소나 canonical override: "${targetPersona}" → "${canonical.targetPersona}"`)
      }
      targetPersona = canonical.targetPersona
      productName = canonical.productName
      worryPoint = canonical.worryPoint
      sellingPoint = canonical.sellingPoint
    }

    console.log('[Q&A 생성] Canonical payload 확정:', {
      mode: isDesignSheetMode ? 'designSheet' : 'manual',
      productName,
      targetPersona,
      worryPoint: worryPoint?.substring(0, 50) + '...',
      sellingPoint: sellingPoint?.substring(0, 50) + '...',
    })
    
    // 환경 변수 확인 (디버깅용)
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY가 설정되지 않았습니다!')
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다. 서버 설정을 확인해주세요.' },
        { status: 500 }
      )
    }
    
    // API 키 일부만 로그 (보안)
    const apiKeyPreview = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4)
    console.log('Gemini API 키 확인:', apiKeyPreview, '(길이:', apiKey.length, ')')
    console.log('환경:', process.env.NODE_ENV || 'unknown')

    // Gemini API 초기화
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // ============================================
    // ⚠️ 테스트용: 토큰 사용량 추적
    // 실제 운영 시에는 이 부분을 제거해야 합니다
    // ============================================
    const tokenUsage: TokenUsage[] = []
    let customSearchCount = 0 // 커스텀 서치 횟수 추적
    
    // ============================================
    // 1단계: 상품명 정규화 — raw → 고객 검색형 topicName 변환
    // 핵심: 설계서 분석에서 이미 구조화된 topic이 있으면 재정규화하지 않고 그대로 사용
    // ============================================
    const preStructured = designSheetAnalysis?.topicCore && designSheetAnalysis.topicCore.length > 2
    let customerTopicName: string
    let displayProductName: string
    let companyShort: string
    let cleanProductCore: string
    let topicConcern: string
    let topicConcernSearch: string

    if (preStructured) {
      // 설계서 분석에서 이미 구조화 완료 → 그대로 사용 (재정규화 금지)
      cleanProductCore = designSheetAnalysis.topicCore
      topicConcern = designSheetAnalysis.topicConcern || ''
      topicConcernSearch = designSheetAnalysis.topicConcernSearch || ''
      companyShort = designSheetAnalysis.companyShort || ''
      displayProductName = designSheetAnalysis.displayProductName || productName
      customerTopicName = companyShort && companyShort.length <= 6
        ? `${companyShort} ${cleanProductCore}`.trim()
        : cleanProductCore
      console.log('[Q&A 생성] ✅ 분석 구조화 topic 그대로 사용 (재정규화 건너뜀):', { topicCore: cleanProductCore, topicConcern, topicConcernSearch, display: displayProductName, topic: customerTopicName })
    } else {
      // 설계서 분석 없음 → 기존 로직으로 productName에서 추출
      const converted = convertToCustomerTopicName(productName)
      customerTopicName = converted.topicName
      displayProductName = converted.displayProductName
      companyShort = converted.companyShort
      cleanProductCore = converted.cleanProductCore
      topicConcern = converted.topicConcern
      topicConcernSearch = converted.topicConcernSearch
      console.log('[Q&A 생성] 🔄 productName에서 구조화:', { raw: productName, topicCore: cleanProductCore, topicConcern, topicConcernSearch, display: displayProductName, topic: customerTopicName })
    }

    // ============================================
    // Q&A 전용 최신 검색 요약
    // 설계서 모드: analyze-design-sheet에서 받은 searchSummary를 재사용 (검색 스킵)
    // 수동 모드: 기존 로직으로 Google CSE 검색
    // ============================================
    let searchResultsText = ''
    let collectedForKeywords: SearchResult[] = []

    const hasUpstreamSearch = isDesignSheetMode && designSheetAnalysis?.searchSummary && designSheetAnalysis.searchSummary.length > 50

    if (hasUpstreamSearch) {
      // 설계서 모드: 상류 분석에서 이미 검색된 결과를 그대로 사용 (Google CSE 스킵)
      searchResultsText = designSheetAnalysis.searchSummary
      console.log(`[Q&A 생성] ✅ 설계서 모드 - 상류 검색 요약 재사용 (${searchResultsText.length}자, Google CSE 스킵)`)
    } else {
      // 수동 모드 또는 상류 검색 결과 없음: 기존 Google CSE 검색
      try {
        const shortProductName = normalizeProductNameForSearch(productName)
        const prePersonaBucket = designSheetAnalysis?.personaBucket
        let shortPersona = ''
        if (prePersonaBucket && prePersonaBucket.length > 2) {
          shortPersona = prePersonaBucket
        } else {
          const shortPersonaRaw = (targetPersona || '').replace(/\s+/g, ' ').trim()
          const shortPersonaBucketized = shortPersonaRaw.replace(/(\d{1,2})세/g, (_: string, n: string) => {
            const decade = Math.floor(parseInt(n, 10) / 10) * 10
            return `${decade}대`
          }).replace(/\s+/g, ' ').trim()
          const ageGenderMatch = shortPersonaBucketized.match(/(\d+대)\s*(남성|여성|남자|여자|남|여)/)
          shortPersona = ageGenderMatch ? `${ageGenderMatch[1]} ${ageGenderMatch[2]}` : shortPersonaBucketized
        }
        const topicShort = cleanProductCore || shortProductName
        const searchQueries = Array.from(new Set([
          `${topicShort} 보험료`,
          `${topicShort} 보험료 비교`,
          `${topicShort} 장단점`,
          `${topicShort} 보장 내용`,
          shortPersona ? `${topicShort} ${shortPersona} 보험료` : '',
          shortPersona ? `${topicShort} ${shortPersona} 추천` : '',
          shortProductName !== topicShort ? `${shortProductName} 보험료` : '',
          shortProductName !== topicShort ? `${shortProductName} 후기` : '',
        ].filter(Boolean)))
        
        const collected: SearchResult[] = []
        const seen = new Set<string>()
        
        console.log('[Q&A 생성] 수동 모드 검색 시작 - 검색 쿼리 개수:', searchQueries.length)
        
        for (const q of searchQueries) {
          try {
            const res = await searchGoogle(q, 3)
            customSearchCount++
            console.log('[Q&A 생성] 검색 완료:', q, '- 커스텀 서치 횟수:', customSearchCount)
            
            if (res.success && res.results.length > 0) {
              for (const r of res.results) {
                if (r.link && !seen.has(r.link)) {
                  seen.add(r.link)
                  collected.push(r)
                }
              }
            }
            await new Promise(resolve => setTimeout(resolve, 120))
          } catch (err) {
            console.warn('[Q&A 생성] ⚠️ 검색 오류:', q, err)
          }
        }
        
        searchResultsText = formatSearchResultsForPrompt(collected)
        collectedForKeywords = collected
        console.log('[Q&A 생성] 🔍 수동 모드 검색 완료 - 수집된 결과:', collected.length, '건, 커스텀 서치 총 횟수:', customSearchCount)
      } catch (searchError) {
        console.error('[Q&A 생성] ⚠️ 검색 요약 생성 중 오류:', searchError)
        searchResultsText = ''
      }
    }
    
    console.log('[Q&A 생성] 최종 커스텀 서치 횟수:', customSearchCount)

    // 검색 결과 기반 키워드 (상품명 연관 베스트 키워드) 추출
    // 설계서 모드: analyze에서 받은 searchKeywordHints 우선 사용
    // 수동 모드: Google CSE 결과에서 추출
    let searchKeywords: string[] = []
    let searchKeywordsWithVolume: Array<{ keyword: string; volume: number | null }> = []
    const keywordCandidates: string[] = []

    if (hasUpstreamSearch && designSheetAnalysis?.searchKeywordHints?.length > 0) {
      keywordCandidates.push(...designSheetAnalysis.searchKeywordHints)
      console.log('[Q&A 생성] ✅ 설계서 모드 - 상류 키워드 힌트 재사용:', keywordCandidates)
    } else {
      try {
        if (collectedForKeywords.length > 0) {
          const baseProduct = (productName || '').split(/\s+/)[0] || productName || ''

          for (const item of collectedForKeywords) {
            const source = `${item.title || ''} ${item.snippet || ''}`.replace(/\s+/g, ' ').trim()
            if (!source) continue

            const regex = /([가-힣0-9A-Za-z]+보험)/g
            let match: RegExpExecArray | null
            while ((match = regex.exec(source)) !== null) {
              const kw = match[1].trim()
              if (!kw) continue
              if (baseProduct && !kw.includes(baseProduct) && !kw.includes('보험')) continue
              keywordCandidates.push(kw)
            }
          }

          const fallbackBase = productName || collectedForKeywords[0]?.title || ''
          if (keywordCandidates.length < 5 && fallbackBase) {
            const base = fallbackBase.replace(/\s+/g, ' ').trim()
            const fallbackCandidates = [
              `${base} 추천`,
              `${base} 비교`,
              `${base} 보장 내용`,
              `${base} 가입조건`,
              `${base} 보험료`
            ]
            keywordCandidates.push(...fallbackCandidates)
          }
        }
      } catch (keywordError) {
        console.warn('[Q&A 생성] 검색 키워드 추출 중 오류:', keywordError)
      }
    }

    // 2차: 네이버 검색광고 API(키워드 도구)로 연관키워드·월간검색수 조회 후 상위 5개 사용 (환경 변수 설정 시)
    try {
      console.log('[Naver SearchAd] env check:', {
        customerId: !!process.env.NAVER_SEARCHAD_CUSTOMER_ID,
        accessLicense: !!process.env.NAVER_SEARCHAD_ACCESS_LICENSE,
        secretKey: !!process.env.NAVER_SEARCHAD_SECRET_KEY
      })

      // 상품명 + 관심 연관어로 여러 hint 전달 → Naver가 사망보험금, 30대 사망보험금 등 더 다양한 연관어 반환
      const productNameTrim = normalizeProductNameForSearch(productName) || '실손보험'
      const nameLower = productNameTrim.toLowerCase()

      // 상품군 판별: SearchAd 힌트/후보는 이 상품군에만 맞춤. 다른 상품군 키워드는 탈락.
      type ProductGroup = 'cancer' | 'silsan' | 'simple' | 'jongsin' | 'driver' | 'health' | 'other'
      let productGroup: ProductGroup = 'other'
      if (/암|유사암|암보험/.test(nameLower) || productNameTrim.includes('암')) productGroup = 'cancer'
      else if (/실손|실비|의료비/.test(nameLower) || productNameTrim.includes('실손')) productGroup = 'silsan'
      else if (/간편|유병/.test(nameLower)) productGroup = 'simple'
      else if (/종신|만기|연금/.test(nameLower) || productNameTrim.includes('종신')) productGroup = 'jongsin'
      else if (/자동차|운전자|차량/.test(nameLower) || productNameTrim.includes('자동차')) productGroup = 'driver'
      else if (/건강보험|상해보험|질병보험|3대질환|종합보험|어린이보험|자녀보험|건강/.test(nameLower)) productGroup = 'health'

      // 롱테일/노출용 키워드는 상품명이 길 때(18자 초과) 상품군별 짧은 이름 사용. 예: "36세 여성 간편건강보험"
      const SHORT_KEYWORD_NAME_BY_GROUP: Record<ProductGroup, string> = {
        cancer: '암보험',
        silsan: '실손보험',
        simple: '간편건강보험',
        jongsin: '종신보험',
        driver: '운전자보험',
        health: '건강보험',
        other: productNameTrim.length <= 12 ? productNameTrim : '보험'
      }
      // 키워드용 상품명: cleanProductCore(회사명 제거, 코드 제거) 우선, 너무 길면 상품군 키워드
      const groupKeyword = SHORT_KEYWORD_NAME_BY_GROUP[productGroup] || productNameTrim
      const shortKeywordName = cleanProductCore.length > 0 && cleanProductCore.length <= 14 && cleanProductCore !== productNameTrim
        ? cleanProductCore
        : productNameTrim.length > 14
          ? groupKeyword
          : productNameTrim

      const extraHints: string[] = []
      if (/종신|만기|연금/.test(nameLower) || productNameTrim.includes('종신')) {
        extraHints.push('종신보험', '사망보험금', '30대 사망보험금')
      }
      if (/암|유사암|암보험/.test(nameLower) || productNameTrim.includes('암')) {
        extraHints.push('암보험', '암보험금')
      }
      if (/종합|종합보험/.test(nameLower) || productNameTrim.includes('종합')) {
        extraHints.push('종합보험', '종합보험 추천')
      }
      if (/수술|수술비/.test(nameLower) || productNameTrim.includes('수술')) {
        extraHints.push('수술비보험', '수술비')
      }
      if (/상해|상해보험/.test(nameLower) || productNameTrim.includes('상해')) {
        extraHints.push('상해보험', '상해보험금')
      }
      if (/질병|질병보험/.test(nameLower) || productNameTrim.includes('질병')) {
        extraHints.push('질병보험', '질병보험 추천')
      }
      if (/실손|실비|의료비/.test(nameLower) || productNameTrim.includes('실손')) {
        extraHints.push('실손보험', '실손의료비')
      }
      if (/자동차|운전자|차량/.test(nameLower) || productNameTrim.includes('자동차')) {
        extraHints.push('자동차보험')
      }
      if (/치아|치아보험/.test(nameLower)) extraHints.push('치아보험')
      if (/간편|유병/.test(nameLower)) extraHints.push('간편건강보험', '유병자보험')
      if (/건강보험|건강/.test(nameLower) && !/간편|유병/.test(nameLower)) {
        extraHints.push('건강보험', '건강보험 보험료', '건강보험 비교')
      }
      if (/해약환급금/.test(nameLower)) extraHints.push('해약환급금미지급형', '해약환급금 없는 보험')
      // 카테고리 미매칭이어도 상품명만으로는 1~2개만 나오므로, 기본 hint 하나 추가
      if (extraHints.length === 0) extraHints.push('보험')
      // 롱테일 핵심키워드 수급: 타깃(50대 남자 등) + 상품명 힌트. 직업·직급은 제거, 연령대+성별만 유지
      const shortPersonaRawForAd = (targetPersona || '').replace(/\s+/g, ' ').trim()
        .replace(/(\d{1,2})세/g, (_: string, n: string) => `${Math.floor(parseInt(n, 10) / 10) * 10}대`)
        .replace(/\s+/g, ' ').trim()
      const adAgeGender = shortPersonaRawForAd.match(/(\d+대)\s*(남성|여성|남자|여자|남|여)/)
      const shortPersonaForKeyword = adAgeGender ? `${adAgeGender[1]} ${adAgeGender[2]}` : shortPersonaRawForAd
      if (shortPersonaForKeyword) {
        extraHints.push(`${shortPersonaForKeyword} ${shortKeywordName}`, `${shortKeywordName} ${shortPersonaForKeyword} 보험료`)
      }
      const hintKeywords = [productNameTrim, ...extraHints.filter((h, i, a) => a.indexOf(h) === i)]
      console.log('[Q&A 생성] SearchAd hintKeywords(상품군별만, 롱테일힌트 포함):', hintKeywords, 'productGroup:', productGroup)
      // 상품과 무관한 고검색량 키워드(건강보험·실비·경쟁사명 등) 제거: 후보 15개 받아서 상품 타입 관련어 우선 정렬 후 상위 5개
      const rankedWithVolumeRaw = await getBestKeywordsFromNaverSearchAd(hintKeywords, { maxKeywords: 15 })

      // 상품군·문맥 관련성에 따라 점수 부여 (검색량은 보조 지표로만 사용)
      const relevanceTerms: string[] = []
      if (/암|유사암/.test(nameLower) || productNameTrim.includes('암')) relevanceTerms.push('암')
      if (/종신|만기|연금/.test(nameLower) || productNameTrim.includes('종신')) relevanceTerms.push('종신', '사망')
      if (/실손|실비|의료비/.test(nameLower) || productNameTrim.includes('실손')) relevanceTerms.push('실손', '실비')
      if (/종합|종합보험/.test(nameLower) || productNameTrim.includes('종합')) relevanceTerms.push('종합')
      if (/수술|수술비/.test(nameLower) || productNameTrim.includes('수술')) relevanceTerms.push('수술')
      if (/상해|상해보험/.test(nameLower) || productNameTrim.includes('상해')) relevanceTerms.push('상해')
      if (/질병|질병보험/.test(nameLower) || productNameTrim.includes('질병')) relevanceTerms.push('질병')
      if (/자동차|운전자|차량/.test(nameLower) || productNameTrim.includes('자동차')) relevanceTerms.push('자동차')
      if (/치아|치아보험/.test(nameLower)) relevanceTerms.push('치아')
      if (/간편|유병/.test(nameLower)) relevanceTerms.push('간편', '유병자')
      if (/건강보험|건강/.test(nameLower) && !/간편|유병/.test(nameLower)) relevanceTerms.push('건강보험', '건강')
      if (/해약환급금/.test(nameLower)) relevanceTerms.push('해약환급금')
      const isRelevant = (kw: string) => relevanceTerms.some((t) => kw.includes(t))

      /** 현재 상품군이 아닌 다른 상품군 키워드 포함 시 탈락 (감점이 아닌 컷오프) */
      const OTHER_GROUP_PATTERNS: Record<ProductGroup, RegExp[]> = {
        cancer: [/실손보험/, /실손의료/, /실비보험/, /도수치료/, /입원일당/, /급여.*보험|비급여/, /4세대실손|5세대실손/, /자동차보험/, /운전자보험/, /치아보험/, /종신보험/, /연금보험/],
        silsan: [/암보험|암진단|비갱신암|고액암/, /종신보험/, /연금보험/, /자동차보험/, /운전자보험/, /치아보험/],
        simple: [/실손보험|실비보험/, /암보험/, /종신보험/, /자동차보험/, /운전자보험/, /치아보험/],
        jongsin: [/실손보험|실비보험/, /암보험/, /자동차보험/, /운전자보험/, /치아보험/],
        driver: [/실손보험|실비보험/, /암보험/, /종신보험/, /치아보험/],
        health: [/실손보험|실비보험/, /자동차보험/, /운전자보험/, /치아보험/, /종신보험/, /연금보험/],
        other: []
      }

      const GENERIC_BAD_KEYWORDS = productGroup === 'health'
        ? ['보험', '국민건강보험', '내보험조회', '보험조회', '건강보험료', '건강보험료조회', '건강보험료계산', '건강보험료납부', '건강보험요율']
        : ['보험', '건강보험', '건강보험료', '국민건강보험', '내보험조회', '보험조회']
      const INTENT_WORDS = ['보험료', '보장', '보장 내용', '가입', '가입조건', '비교', '추천']
      const PERSONA_PATTERN = /(10대|20대|30대|40대|50대|60대|70대|직장인|주부|자영업자|유병자|노년|시니어)/
      const COMPETITOR_KEYWORDS = ['삼성화재', '현대해상', 'DB손해보험', 'DB생명', 'KB손해보험', '메리츠', '흥국화재', 'AIG', 'AIG손해보험']
      const CLAIM_WORDS = ['청구서류', '청구 서류', '청구', '서류']

      /** 핵심키워드: 상품명 + 의도(보험료/보장/가입/비교 등) 또는 상품명 + 타깃(50대 등) 또는 상품명 자체. 연관/서브토픽·비교사이트형은 제외 */
      const isCoreKeyword = (kw: string) => {
        const k = kw.trim()
        if (!productNameTrim || !k) return false
        if (/비교사이트|비교몰|비교앱|비교어플/.test(k)) return false
        const hasProduct = k.includes(productNameTrim) || relevanceTerms.some((t) => k.includes(t))
        if (!hasProduct) return false
        if (k === productNameTrim) return true
        if (INTENT_WORDS.some((w) => k.includes(w))) return true
        if (PERSONA_PATTERN.test(k)) return true
        return false
      }

      const scoreKeyword = (kw: string, volume: number) => {
        let score = 0
        const buckets: string[] = []

        // 상품군 관련성 (실손/암/종신 등)
        if (isRelevant(kw)) {
          score += 40
          buckets.push('product')
        }

        // 의도/행동어 (보험료·보장내용·가입조건·비교·추천 등)
        if (INTENT_WORDS.some((w) => kw.includes(w))) {
          score += 25
          buckets.push('intent')
        }

        // 타깃/페르소나
        if (PERSONA_PATTERN.test(kw)) {
          score += 15
          buckets.push('persona')
        }

        // 핵심키워드: 상품+의도/타깃 또는 상품명 자체 → 가산 (연관키워드보다 우선)
        if (isCoreKeyword(kw)) {
          score += 30
          buckets.push('core')
        }
        // 롱테일 핵심키워드: 상품+타깃(50대 남자 암보험 등) → 경쟁 적고 노출·전환에 유리하므로 추가 가산
        if (isCoreKeyword(kw) && PERSONA_PATTERN.test(kw)) {
          score += 25
          buckets.push('longtail_core')
        }

        // 지나치게 포괄적인 제도/조회성 키워드 강한 감점
        if (GENERIC_BAD_KEYWORDS.some((bad) => kw === bad || kw.startsWith(bad))) {
          score -= 80
          buckets.push('generic')
        }

        // 타사 브랜드/경쟁사 키워드 감점
        if (COMPETITOR_KEYWORDS.some((c) => kw.includes(c))) {
          score -= 60
          buckets.push('competitor')
        }

        // 청구/서류 중심 키워드는 이번 Q&A 문맥에선 보조적이므로 감점
        if (CLAIM_WORDS.some((w) => kw.includes(w))) {
          score -= 30
          buckets.push('claim')
        }

        // 비교몰/비교사이트형: Q&A 문서 목적과 어긋나 상위 단독 노출 억제 (감점)
        if (/비교사이트|비교몰|비교앱|비교어플/.test(kw)) {
          score -= 35
          buckets.push('comparison_site')
        }

        // 검색량은 보조 지표로만 사용 (log 스케일)
        const volBonus = volume > 0 ? Math.log10(volume + 1) * 3 : 0
        score += volBonus

        return { score, buckets }
      }

      const scored = rankedWithVolumeRaw.map((x) => {
        const { score, buckets } = scoreKeyword(x.keyword, x.volume)
        return { ...x, score, buckets }
      })

      // 상품군 불일치 키워드 탈락 (다른 상품군 키워드는 점수와 관계없이 제외)
      const otherPatterns = OTHER_GROUP_PATTERNS[productGroup]
      const scoredInGroup = otherPatterns.length === 0
        ? scored
        : scored.filter((x) => !otherPatterns.some((pat) => pat.test(x.keyword)))
      const droppedByGroup = scored.length - scoredInGroup.length
      if (droppedByGroup > 0) {
        console.log('[Q&A 생성] 상품군 불일치 탈락:', droppedByGroup, '건 (productGroup:', productGroup, ')')
      }

      // 핵심키워드만 사용 (연관키워드·서브토픽 제외): core 버킷 있는 것만 후보. 롱테일(상품+타깃) 우선 정렬
      const coreCandidates = scoredInGroup.filter(
        (x) => x.score > 0 && x.buckets && x.buckets.includes('core') && !x.buckets.includes('generic')
      )
      const sortedCore = [...coreCandidates].sort((a, b) => {
        const aLong = a.buckets?.includes('longtail_core') ? 1 : 0
        const bLong = b.buckets?.includes('longtail_core') ? 1 : 0
        if (bLong !== aLong) return bLong - aLong
        return b.score - a.score
      })
      if (coreCandidates.length > 0) {
        console.log('[Q&A 생성] 핵심키워드 후보(SearchAd):', coreCandidates.length, '개', coreCandidates.map((x) => x.keyword))
      }

      // simple(간편건강보험) 상품군: SearchAd 유효 후보가 2개 미만이면 규칙 기반 핵심키워드만 사용 (정식상품명은 본문용, 검색형 요약어만 노출)
      const SIMPLE_RULE_BASED_KEYWORDS = [
        '간편건강보험',
        '유병자보험',
        '해약환급금미지급형',
        '간편건강보험 보험료',
        shortPersonaForKeyword ? `${shortPersonaForKeyword} 간편건강보험` : '간편건강보험 가입'
      ].slice(0, 5)

      const TEMPLATE_BY_GROUP: Record<ProductGroup, string[]> = {
        cancer: ['암보험', '암보험 보험료', '암보험 보장내용', '암보험 비교', '암보험 가입'],
        silsan: ['실손보험', '실손보험 보험료', '실손보험 보장내용', '실손보험 비교', '실손보험 가입'],
        simple: ['간편건강보험', '유병자보험', '간편건강보험 보험료', '유병자 가입'],
        jongsin: ['종신보험', '종신보험 보험료', '사망보험금', '종신보험 비교'],
        driver: ['자동차보험', '운전자보험', '자동차보험 보험료', '운전자보험 비교'],
        health: ['건강보험 보험료', '건강보험 보장내용', '건강보험 가입'],
        other: ['보험', '보험료', '보험 비교']
      }

      // ============================================
      // 반반 구조: 우리 주제 키워드 3개 + 관련 대형 키워드 2개
      // ============================================
      const RELATED_BIG_KEYWORDS_BY_GROUP: Record<ProductGroup, string[]> = {
        cancer: ['암보험', '암진단비', '비갱신암보험', '암보험 비교'],
        silsan: ['실손보험', '실비보험', '의료비보험', '실손보험 비교'],
        simple: ['유병자보험', '간편심사보험', '간편보험', '유병자 가입'],
        jongsin: ['종신보험', '사망보험금', '종신보험 비교'],
        driver: ['운전자보험', '자동차보험', '운전자보험 비교'],
        health: ['건강보험 보험료'],
        other: []
      }

      // 그룹별 ours:big 비율 — 큰 키워드가 넓은 그룹은 ours 비중 높임
      const KEYWORD_RATIO: Record<ProductGroup, { ours: number; big: number }> = {
        cancer: { ours: 3, big: 2 },
        silsan: { ours: 4, big: 1 },
        simple: { ours: 4, big: 1 },
        jongsin: { ours: 3, big: 2 },
        driver: { ours: 3, big: 2 },
        health: { ours: 4, big: 1 },
        other: { ours: 3, big: 2 },
      }
      const { ours: oursLimit, big: bigLimit } = KEYWORD_RATIO[productGroup]

      const selected: typeof sortedCore = []
      const used = new Set<string>()

      // 설계서 모드: concern 키워드를 최우선으로 삽입
      if (isDesignSheetMode && topicConcern) {
        const concernKws = [topicConcern]
        if (topicConcernSearch && topicConcernSearch !== topicConcern) {
          concernKws.push(topicConcernSearch)
        }
        for (const ckw of concernKws) {
          if (selected.length >= oursLimit) break
          const norm = ckw.replace(/\s+/g, '').trim()
          if (used.has(norm)) continue
          selected.push({ keyword: ckw, volume: 0, score: 999, buckets: ['concern_priority'] })
          used.add(norm)
        }
        console.log('[Q&A 생성] 설계서 concern 키워드 우선 삽입:', concernKws.filter(k => used.has(k.replace(/\s+/g, '').trim())))
      }

      for (const x of sortedCore) {
        if (selected.length >= oursLimit) break
        const norm = x.keyword.replace(/\s+/g, '').trim()
        if (used.has(norm)) continue
        selected.push(x)
        used.add(norm)
      }
      let rankedWithVolume = selected.slice(0, oursLimit)

      if (productGroup === 'simple' && coreCandidates.length < 2) {
        rankedWithVolume = SIMPLE_RULE_BASED_KEYWORDS.slice(0, 3).map((kw) => ({ keyword: kw, volume: 0, score: 0, buckets: ['core'] as string[] }))
        console.log('[Q&A 생성] simple 그룹 SearchAd 유효 후보 부족 → 규칙 기반 핵심키워드:', rankedWithVolume.map((x) => x.keyword))
      }

      // 우리 주제 키워드가 3개 미만이면 3계층 템플릿으로 채움
      // 1계층: 상품 키워드 (하나더퍼스트 건강보험)
      // 2계층: 페르소나+상품군 (50대 여성 건강보험)
      // 3계층: 구조 키워드 (해약환급금미지급형)
      if (rankedWithVolume.length < oursLimit) {
        const existingSet = new Set(rankedWithVolume.map((x) => x.keyword.trim()))
        const baseTemplate = TEMPLATE_BY_GROUP[productGroup]

        // 상품 구조 키워드 추출 (display에 포함된 보장 구조어)
        const structuralKeywords: string[] = []
        if (/해약환급금미지급형|해약환급금/.test(displayProductName)) structuralKeywords.push('해약환급금미지급형')
        if (/간편심사/.test(displayProductName)) structuralKeywords.push('간편심사 보험')
        if (/무해약/.test(displayProductName)) structuralKeywords.push('무해약환급금')

        const tieredTemplate = [
          shortKeywordName,
          ...(shortPersonaForKeyword ? [`${shortPersonaForKeyword} ${groupKeyword}`] : []),
          ...structuralKeywords,
          ...baseTemplate
        ]
        for (const kw of tieredTemplate) {
          if (rankedWithVolume.length >= oursLimit) break
          const k = kw.trim()
          if (!k || existingSet.has(k)) continue
          existingSet.add(k)
          rankedWithVolume = [...rankedWithVolume, { keyword: k, volume: 0, score: 0, buckets: ['core'] }]
        }
      }

      // 관련 대형 키워드 추가 (health=1개, 나머지=2개)
      const bigKeywordCandidates = RELATED_BIG_KEYWORDS_BY_GROUP[productGroup] || []
      const existingKwSet = new Set(rankedWithVolume.map((x) => x.keyword.replace(/\s+/g, '').trim()))
      let bigAdded = 0
      for (const bk of bigKeywordCandidates) {
        if (bigAdded >= bigLimit) break
        const bkNorm = bk.replace(/\s+/g, '').trim()
        if (existingKwSet.has(bkNorm)) continue
        existingKwSet.add(bkNorm)
        rankedWithVolume = [...rankedWithVolume, { keyword: bk, volume: 0, score: 0, buckets: ['big_related'] }]
        bigAdded++
      }
      console.log('[Q&A 생성] 반반 구조 키워드:', {
        ours: rankedWithVolume.filter(x => !x.buckets.includes('big_related')).map(x => x.keyword),
        big: rankedWithVolume.filter(x => x.buckets.includes('big_related')).map(x => x.keyword)
      })

      // 키워드 후압축: 전체 상품명이 포함된 키워드는 cleanProductCore로 치환
      if (productNameTrim !== shortKeywordName) {
        rankedWithVolume = rankedWithVolume.map((x) => {
          let k = x.keyword
          if (k.includes(productNameTrim)) {
            k = k.replace(new RegExp(productNameTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), shortKeywordName).trim()
          }
          // 회사명이 포함된 긴 키워드(>18자)에서 회사명 제거
          if (k.length > 18 && companyShort && k.includes(companyShort)) {
            k = k.replace(companyShort, '').replace(/\s+/g, ' ').trim()
          }
          return k !== x.keyword ? { ...x, keyword: k } : x
        }).filter(x => x.keyword.length >= 2)
      }

      // 키워드 길이 제한: 최대 20자, 문장형 금지
      rankedWithVolume = rankedWithVolume.map((x) => {
        let kw = x.keyword.trim()
        // 조사 포함된 문장형 키워드 거부 (예: "~을 고민", "~가 좋을까요")
        if (/[을를이가은는에도으로와과의]$/.test(kw) && kw.length > 12) {
          kw = kw.replace(/[을를이가은는에도으로와과의]$/, '').trim()
        }
        // 20자 초과 시 마지막 공백 기준 절단
        if (kw.length > 20) {
          const lastSpace = kw.lastIndexOf(' ', 20)
          kw = lastSpace > 6 ? kw.substring(0, lastSpace).trim() : kw.substring(0, 20).trim()
        }
        return { ...x, keyword: kw }
      }).filter(x => x.keyword.length >= 2)

      // 내부 표기(괄호·버전·II) 제거를 키워드에도 적용 (강한 정제)
      rankedWithVolume = rankedWithVolume.map((x) => ({
        ...x,
        keyword: cleanForKeyword(x.keyword)
      })).filter(x => x.keyword.length >= 2)

      // 우리 키워드가 앞(1-3번), 대형 키워드가 뒤(4-5번)에 오도록 순서 고정
      const oursFirst = rankedWithVolume.filter(x => !x.buckets.includes('big_related'))
      const bigLast = rankedWithVolume.filter(x => x.buckets.includes('big_related'))
      rankedWithVolume = [...oursFirst, ...bigLast]

      // 디버깅용: 어떤 기준으로 상위 키워드가 선택됐는지 로그
      console.log(
        '[Q&A 생성] 키워드 스코어링 상위 10개:',
        scored
          .sort((a, b) => b.score - a.score)
          .slice(0, 10)
          .map((x) => ({
            keyword: x.keyword,
            volume: x.volume,
            score: Math.round(x.score * 10) / 10,
            buckets: x.buckets,
          }))
      )
      const ranked = rankedWithVolume.map((x) => x.keyword)
      if (ranked.length > 0) {
        // 5개 미만이면 Google 후보로 보강
        if (ranked.length < 5 && keywordCandidates.length > 0) {
          const naverSet = new Set(ranked.map((k: string) => k.trim()))
          const fromGoogle = Array.from(new Set(keywordCandidates))
            .filter((k: string) => k && !naverSet.has(k.trim()) && k.length <= 20)
            .slice(0, 5 - ranked.length)
          searchKeywords = [...ranked, ...fromGoogle].slice(0, 5)
          searchKeywordsWithVolume = [
            ...rankedWithVolume.map((x) => ({ keyword: x.keyword, volume: x.volume })),
            ...fromGoogle.map((k) => ({ keyword: k, volume: null as number | null }))
          ].slice(0, 5)
          console.log('[Q&A 생성] 핵심 키워드 5개 (부족분 Google 보강):', searchKeywords)
        } else {
          searchKeywords = ranked.slice(0, 5)
          searchKeywordsWithVolume = rankedWithVolume.slice(0, 5).map((x) => ({ keyword: x.keyword, volume: x.volume }))
          console.log('[Q&A 생성] 핵심 키워드 5개 (반반 구조):', searchKeywords)
        }
      } else {
        if (keywordCandidates.length > 0) {
          searchKeywords = Array.from(new Set(keywordCandidates)).filter(k => k.length <= 20).slice(0, 5)
          searchKeywordsWithVolume = searchKeywords.map((k) => ({ keyword: k, volume: null as number | null }))
          console.log('[Q&A 생성] [실패 대응 9절] SearchAd 없음 → Google 후보 폴백:', searchKeywords)
        }
      }
    } catch (keywordError) {
      console.warn('[Q&A 생성] Naver SearchAd 키워드 조회 중 오류:', keywordError)
      if (keywordCandidates.length > 0) {
        searchKeywords = Array.from(new Set(keywordCandidates)).slice(0, 5)
        searchKeywordsWithVolume = searchKeywords.map((k) => ({ keyword: k, volume: null as number | null }))
        console.log('[Q&A 생성] [실패 대응 9절] SearchAd 예외 → Google 후보 폴백:', searchKeywords)
      }
    }
    
    // API 호출 헬퍼 함수 (재시도 및 폴백 로직 포함, 이미지 지원)
    // 
    // 폴백 순서:
    // 1. Gemini-2.5-Pro
    // 2. Gemini-2.0-Flash (실패 시)
    //
    // Flash 사용 위치 (비용 절감):
    // - 질문 생성 (Step 1)
    // - 고객 댓글 (대화형 모드, 홀수 step)
    //
    // Pro 사용 위치 (품질 유지):
    // - 답변 생성 (Step 2)
    // - 설계사 댓글 (대화형 모드, 짝수 step)
    const generateContentWithFallback = async (
      prompt: string, 
      imageBase64?: string | null,
      useFlash: boolean = false // true: Flash 우선, false: Pro 우선
    ): Promise<{ text: string; usage?: TokenUsage; provider?: 'gemini' }> => {
      // useFlash에 따라 모델 순서 결정
      // true: 2.5 Flash 우선 → 2.0 Flash 폴백, false: 2.5 Pro 우선 → 2.5 Flash → 2.0 Flash 폴백
      const models = useFlash
        ? [
            { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
            { provider: 'gemini' as const, model: 'gemini-2.0-flash' }
          ]
        : [
            { provider: 'gemini' as const, model: 'gemini-2.5-pro' },
            { provider: 'gemini' as const, model: 'gemini-2.5-flash' },
            { provider: 'gemini' as const, model: 'gemini-2.0-flash' }
          ]
      
      // 이미지가 있으면 MIME 타입 감지
      let mimeType = 'image/png'
      let base64Data = ''
      if (imageBase64) {
        base64Data = imageBase64.includes(',') 
          ? imageBase64.split(',')[1] 
          : imageBase64
        
        if (imageBase64.includes('data:image/jpeg') || imageBase64.includes('data:image/jpg')) {
          mimeType = 'image/jpeg'
        } else if (imageBase64.includes('data:image/png')) {
          mimeType = 'image/png'
        } else if (imageBase64.includes('data:image/webp')) {
          mimeType = 'image/webp'
        }
      }
      
      // Gemini 폴백 순서로 시도
      const modelOrder = useFlash 
        ? 'Gemini-2.5-Flash → Gemini-2.0-Flash' 
        : 'Gemini-2.5-Pro → Gemini-2.5-Flash → Gemini-2.0-Flash'
      console.log(`[Q&A 생성] 🔄 Gemini 폴백 순서 시작: ${modelOrder}`)
      
      for (let attempt = 0; attempt < models.length; attempt++) {
        const { provider, model: modelName } = models[attempt]
        
        try {
          console.log(`[Q&A 생성] ${provider.toUpperCase()} 모델 시도: ${modelName} (시도 ${attempt + 1}/${models.length})`)
          
          let text = ''
          let usage: TokenUsage | undefined
          
          // Gemini만 사용
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            tools: [{ googleSearch: {} }] as any // Google Grounding 활성화
          })
          
          // 프롬프트 길이 로깅 (할당량 초과 진단용)
          const promptLength = prompt.length
          const estimatedTokens = Math.ceil(promptLength / 4) // 대략적인 토큰 추정 (1 토큰 ≈ 4 문자)
          console.log(`[Q&A 생성] [${modelName}] 프롬프트 길이: ${promptLength} 문자 (약 ${estimatedTokens} 토큰)`)
          
          let result
          if (imageBase64 && base64Data) {
            result = await model.generateContent([
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              prompt
            ])
          } else {
            result = await model.generateContent(prompt)
          }
          
          const response = await result.response
          text = response.text().trim()
          
          // 그라운딩 결과 확인
          const groundingMetadata = response.candidates?.[0]?.groundingMetadata as any
          if (groundingMetadata) {
            console.log(`[Q&A 생성] [${modelName}] 🔍 그라운딩 결과:`)
            console.log(`  - 웹 검색 쿼리:`, groundingMetadata.webSearchQueries || [])
            const chunks = groundingMetadata.groundingChunks || groundingMetadata.groundingChuncks || []
            console.log(`  - 검색된 청크 수:`, chunks.length)
          }
          
          // 토큰 사용량 추출
          const usageMetadata = response.usageMetadata
          usage = {
            model: modelName,
            promptTokens: usageMetadata?.promptTokenCount || 0,
            candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
            totalTokens: usageMetadata?.totalTokenCount || 0
          }
          
          if (text) {
            console.log(`[Q&A 생성] ✅ Gemini 성공! (${modelName})`)
            if (usage && usage.totalTokens > 0) {
              tokenUsage.push(usage)
            }
            // RPM 150 제한 대응: 성공 후 1초 지연 (동시 요청 방지)
            await new Promise(resolve => setTimeout(resolve, 1000))
            return { text, usage, provider: 'gemini' }
          }
        } catch (error: any) {
          const errorMessage = error?.message || ''
          const errorString = JSON.stringify(error || {})
          
          // 모델 이름 오류 감지
          const isModelNotFoundError = 
            errorMessage.includes('404') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('Model not found') ||
            errorMessage.includes('Invalid model') ||
            errorString.includes('404') ||
            errorString.includes('not found')
          
          const isQuotaError = 
            errorMessage.includes('429') || 
            errorMessage.includes('quota') || 
            errorMessage.includes('rate limit') ||
            errorMessage.includes('Too Many Requests') ||
            errorMessage.includes('exceeded') ||
            errorMessage.includes('Resource has been exhausted') ||
            errorString.includes('free_tier') ||
            errorString.includes('QuotaFailure') ||
            errorMessage.includes('insufficient_quota')
          
          console.error(`[Q&A 생성] ${provider.toUpperCase()} ${modelName} 실패:`, {
            provider,
            model: modelName,
            error: errorMessage.substring(0, 500),
            errorFull: errorString.substring(0, 1000),
            isQuotaError,
            isModelNotFoundError
          })
          
          // 모델이 존재하지 않으면 다음 모델로 즉시 폴백
          if (isModelNotFoundError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[Q&A 생성] ⚠️ ${modelName} 모델을 찾을 수 없음 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          
          // 할당량 에러이고 마지막 모델이 아니면 다음 모델로 시도
          if (isQuotaError && attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[Q&A 생성] ⚠️ ${modelName} 할당량 초과 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 할당량 초과 시 1초 지연 후 재시도
            console.log(`[Q&A 생성] ⏳ 1초 대기 후 재시도...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
          
          // 마지막 모델이 아니면 다음 모델로 시도
          if (attempt < models.length - 1) {
            const nextModel = models[attempt + 1]
            console.log(`[Q&A 생성] ⚠️ ${modelName} 실패 → ${nextModel.provider.toUpperCase()} ${nextModel.model} 모델로 폴백 시도...`)
            // RPM 150 제한 대응: 실패 시 1초 지연 후 재시도
            await new Promise(resolve => setTimeout(resolve, 1000))
            continue
          }
        }
      }
      
      const failedModels = models.map(m => m.model).join(' → ')
      throw new Error(`모든 모델 시도 실패 (${failedModels})`)
    }
    
    // 토큰 사용량 합계 계산
    const calculateTotalUsage = (): TokenUsage => {
      return tokenUsage.reduce((acc, usage) => ({
        model: 'total',
        promptTokens: acc.promptTokens + usage.promptTokens,
        candidatesTokens: acc.candidatesTokens + usage.candidatesTokens,
        totalTokens: acc.totalTokens + usage.totalTokens
      }), { model: 'total', promptTokens: 0, candidatesTokens: 0, totalTokens: 0 })
    }

    // generateStep에 따라 생성 단계 결정
    const requestedStep = requestBody.generateStep || 'all' // 'question' | 'answer' | 'conversation' | 'all'
    
    let finalQuestionTitle = questionTitle
    let finalQuestionContent = questionContent
    let answerContent = '' // 답변 변수 미리 선언
    let selectedOpeningFamilyId: string | undefined
    let selectedOpeningFamilyName: string | undefined
    let selectedTitlePatternId: string | undefined
    let selectedQuestionConceptId: string | undefined
    let selectedConcernVariant: string | undefined

    // 문서 9절: persona 추출 결과 로깅 (기본값 사용 시 디버깅용)
    const personaAgeMatch = targetPersona?.match(/(\d+)대|(\d+)세/)
    const personaGenderExplicit = targetPersona && (targetPersona.includes('여') || targetPersona.includes('남') || targetPersona.includes('주부'))
    if (!personaAgeMatch && targetPersona) {
      console.log('[Q&A 생성] [실패 대응 9절] targetPersona에서 나이 추출 불가 → 프롬프트 내 기본값(30세) 사용:', targetPersona)
    }
    if (!personaGenderExplicit && targetPersona) {
      console.log('[Q&A 생성] [실패 대응 9절] targetPersona에서 성별 미명시 → 프롬프트 내 기본값 사용:', targetPersona)
    }

    // ============================================
    // 설계서 모드 통합 생성 경로 (Pro 2회: 제목+질문+답변 1회 + 댓글 스레드 1회)
    // hasUpstreamSearch가 있으면 검색 스킵 + 통합 프롬프트 사용
    // 실패 시 기존 개별 호출 경로(fallback)로 자동 전환
    // ============================================
    let usedUnifiedPath = false
    let unifiedConversationThread: ConversationMessage[] = []

    // 통합 생성 경로는 비활성화: 품질 우선 원칙에 의해 기존 개별 호출(Step1→1.5→2→3) 유지
    // 검색 스킵 최적화(hasUpstreamSearch)는 그대로 적용됨
    // 통합 경로를 사용하려면 아래 조건의 false를 제거하면 됨
    if (false && hasUpstreamSearch && isDesignSheetMode && requestedStep === 'all') {
      console.log('[Q&A 생성] ⚡ 설계서 모드 통합 생성 경로 시작 (Pro 2회)')
      const unifiedStartTime = Date.now()

      try {
        // ── 1) 통합 QA 생성 (제목 후보 + 질문 본문 + 답변) ──
        const sampledFamilies = sampleFamilies(6)
        const unifiedResult = generateUnifiedQAPrompt({
          productName,
          topicName: customerTopicName,
          displayProductName,
          targetPersona,
          worryPoint,
          sellingPoint,
          answerTone: answerTone || 'friendly',
          designSheetImage,
          designSheetAnalysis,
          searchResultsText,
          searchKeywords: searchKeywords?.length ? searchKeywords : undefined,
          cleanProductCore: cleanProductCore || '',
          companyShort: designSheetAnalysis?.companyShort || '',
          personaBucket: designSheetAnalysis?.personaBucket || '',
          topicConcern: topicConcern || '',
          topicConcernSearch: topicConcernSearch || '',
          titleFamilies: sampledFamilies.map(f => ({ id: f.id, name: f.name, guide: f.guide, example: f.example })),
        })

        selectedOpeningFamilyId = unifiedResult.openingFamilyId
        selectedOpeningFamilyName = unifiedResult.openingFamilyName
        selectedQuestionConceptId = unifiedResult.questionConceptId
        selectedConcernVariant = unifiedResult.concernVariant
        if (selectedConcernVariant) {
          console.log(`[Q&A 생성] [통합] concernVariant: "${selectedConcernVariant}"`)
        }

        console.log(`[Q&A 생성] [통합] Pro 호출 1/2 시작 (제목${sampledFamilies.length}개 + 질문 + 답변)`)
        const qaResult = await generateContentWithFallback(unifiedResult.prompt, designSheetImage, false)
        await new Promise(resolve => setTimeout(resolve, 500))

        if (!qaResult?.text) throw new Error('통합 QA 생성 결과가 비어있음')

        let qaText = qaResult.text.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
        const qaJsonMatch = qaText.match(/```json\s*([\s\S]*?)```/) || qaText.match(/\{[\s\S]*"titleCandidates"[\s\S]*"questionBody"[\s\S]*"answerBody"[\s\S]*\}/)

        if (!qaJsonMatch) throw new Error('통합 QA JSON 파싱 실패: JSON 블록을 찾을 수 없음')

        const qaJsonStr = (qaJsonMatch as RegExpMatchArray)[1] || (qaJsonMatch as RegExpMatchArray)[0]
        const qaParsed = JSON.parse(qaJsonStr.trim())

        if (!qaParsed.titleCandidates?.length || !qaParsed.questionBody || !qaParsed.answerBody) {
          throw new Error('통합 QA JSON 필수 필드 누락')
        }

        // 제목 채점 + 선택
        const scoredTitles = qaParsed.titleCandidates.map((t: string, i: number) => {
          const familyId = i < sampledFamilies.length ? sampledFamilies[i].id : 'unknown'
          const { score, reasons } = scoreTitleFamily({
            title: t,
            familyId,
            searchKeywords: searchKeywords || [],
            topicName: customerTopicName || '',
            rawProductName: productName,
            cleanProductCore: cleanProductCore || undefined,
          })
          return { title: t, familyId, score, reasons }
        })
        scoredTitles.sort((a: any, b: any) => b.score - a.score)
        console.log('[Q&A 생성] [통합] 제목 후보 채점:')
        scoredTitles.forEach((s: any) => console.log(`  [${s.familyId}] ${s.title} → ${s.score}점 (${s.reasons.join(', ')})`))

        if (scoredTitles[0]?.score >= 0) {
          finalQuestionTitle = scoredTitles[0].title.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ')
        } else {
          finalQuestionTitle = qaParsed.titleCandidates[0].trim()
        }

        let bodyText = qaParsed.questionBody.trim()
        bodyText = bodyText.replace(/^(선배님들|옆집\s*언니들|언니들|형님들|오빠들|여러분)[!?\s]*\n*/i, '')
        finalQuestionContent = bodyText

        answerContent = qaParsed.answerBody.trim()

        console.log(`[Q&A 생성] [통합] Pro 1/2 완료: 제목="${finalQuestionTitle.substring(0, 40)}...", 본문=${finalQuestionContent.length}자, 답변=${answerContent.length}자`)

        // ── 2) 댓글 스레드 배치 생성 (대화형 모드인 경우) ──
        if (conversationMode && conversationLength) {
          const validLengths = [4, 6, 8, 10]
          const totalSteps = validLengths.includes(conversationLength) ? conversationLength : 6
          const threadSteps = totalSteps - 2

          if (threadSteps > 0) {
            console.log(`[Q&A 생성] [통합] Pro 호출 2/2 시작 (댓글 스레드 ${threadSteps}개)`)

            const threadPrompt = generateThreadBatchPrompt({
              productName,
              topicName: customerTopicName,
              displayProductName,
              targetPersona,
              worryPoint,
              sellingPoint,
              designSheetAnalysis,
              questionTitle: finalQuestionTitle,
              questionBody: finalQuestionContent,
              answerBody: answerContent,
              threadSteps,
            })

            const threadResult = await generateContentWithFallback(threadPrompt, null, false)
            await new Promise(resolve => setTimeout(resolve, 500))

            if (!threadResult?.text) throw new Error('댓글 스레드 생성 결과가 비어있음')

            let threadText = threadResult.text.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x1F\x7F]/g, '')
            const threadJsonMatch = threadText.match(/```json\s*([\s\S]*?)```/) || threadText.match(/\{[\s\S]*"thread"[\s\S]*\}/)

            if (!threadJsonMatch) throw new Error('댓글 스레드 JSON 파싱 실패')

            const threadJsonStr = (threadJsonMatch as RegExpMatchArray)[1] || (threadJsonMatch as RegExpMatchArray)[0]
            const threadParsed = JSON.parse(threadJsonStr.trim())

            if (!threadParsed.thread?.length) throw new Error('댓글 스레드 배열이 비어있음')

            // ConversationMessage 형태로 변환
            const batchThread: ConversationMessage[] = threadParsed.thread.map((t: any) => ({
              role: t.role === 'agent' ? 'agent' as const : 'customer' as const,
              content: (t.content || '').trim().replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ''),
              step: t.step || 0,
            }))

            // 후기성 문구 삽입 (설계서 모드에서도 review는 별도 생성)
            const finalReviewCount = reviewCount !== undefined ? reviewCount : 0
            const minConversationLengthForReview = 6
            const allowReviewInsert = finalReviewCount > 0 && (conversationLength || 0) >= minConversationLengthForReview

            if (allowReviewInsert) {
              console.log(`[Q&A 생성] [통합] 후기성 문구 ${finalReviewCount}개 생성 중...`)
              const reviewMessages: ConversationMessage[] = []
              for (let i = 0; i < finalReviewCount; i++) {
                const reviewPrompt = generateReviewMessagePrompt(
                  {
                    productName,
                    topicName: customerTopicName,
                    displayProductName,
                    targetPersona,
                    worryPoint,
                    sellingPoint,
                    answerTone: answerTone || 'friendly',
                    designSheetImage,
                    designSheetAnalysis,
                    searchResultsText: searchResultsText || undefined,
                  },
                  { productName: customerTopicName || productName }
                )
                const reviewResult = await generateContentWithFallback(reviewPrompt, designSheetImage, true)
                await new Promise(resolve => setTimeout(resolve, 500))
                let reviewContent = reviewResult.text
                  .replace(/<ctrl\d+>/gi, '')
                  .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
                  .replace(/```[\s\S]*?```/g, '').trim()
                  .replace(/\[생성된 후기성 문구\]/g, '').trim()
                reviewMessages.push({ role: 'customer', content: reviewContent, step: 1999 + i })
              }
              let insertIdx = batchThread.length
              for (let bi = batchThread.length - 1; bi >= 0; bi--) {
                if (batchThread[bi].role === 'agent') { insertIdx = bi + 1; break }
              }
              if (insertIdx <= batchThread.length) {
                batchThread.splice(insertIdx, 0, ...reviewMessages)
              } else {
                batchThread.push(...reviewMessages)
              }
            }

            // unifiedConversationThread에 임시 저장 (아래에서 conversationThread에 할당)
            unifiedConversationThread = batchThread
            console.log(`[Q&A 생성] [통합] Pro 2/2 완료: 댓글 ${batchThread.length}개 (후기 포함)`)
          }
        }

        usedUnifiedPath = true
        const unifiedElapsed = ((Date.now() - unifiedStartTime) / 1000).toFixed(1)
        console.log(`[Q&A 생성] ⚡ 설계서 모드 통합 생성 완료: ${unifiedElapsed}초`)

      } catch (unifiedError: any) {
        console.warn(`[Q&A 생성] ⚠️ 통합 생성 경로 실패, 기존 개별 호출로 fallback:`, unifiedError?.message || unifiedError)
        usedUnifiedPath = false
        finalQuestionTitle = ''
        finalQuestionContent = ''
        answerContent = ''
      }
    }

    // conversationThread: 통합 경로에서 이미 생성된 경우 여기서 이어받음
    let conversationThread: ConversationMessage[] = usedUnifiedPath ? unifiedConversationThread : []

    // ============================================
    // 기존 개별 호출 경로 (수동 모드 또는 통합 경로 실패 시 fallback)
    // ============================================

    if (!usedUnifiedPath) {

    // Step 1: 질문 생성
    if (requestedStep === 'question' || requestedStep === 'all') {
      // generateStep이 'all'이면 항상 질문 생성, 'question'이면 기존 질문이 없을 때만 생성
      const shouldGenerateQuestion = requestedStep === 'all' || !questionTitle || !questionContent
      
      if (shouldGenerateQuestion) {
        console.log('Step 1: 질문 생성 중...')
        try {
          const questionPromptResult = generateQuestionPrompt({
            productName,
            topicName: customerTopicName,
            displayProductName,
            targetPersona,
            worryPoint,
            sellingPoint,
            answerTone: answerTone || 'friendly',
            designSheetImage,
            designSheetAnalysis,
            searchResultsText,
            searchKeywords: searchKeywords?.length ? searchKeywords : undefined,
            evidenceMap: designSheetAnalysis?.evidenceMap || undefined,
            conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
          })
          const questionPrompt = questionPromptResult.prompt
          selectedOpeningFamilyId = questionPromptResult.openingFamilyId
          selectedOpeningFamilyName = questionPromptResult.openingFamilyName
          selectedTitlePatternId = questionPromptResult.titlePatternId
          selectedQuestionConceptId = questionPromptResult.questionConceptId
          selectedConcernVariant = questionPromptResult.concernVariant
          if (selectedConcernVariant) {
            console.log(`[Q&A 생성] [Step 1] concernVariant: "${selectedConcernVariant}"`)
          }
          console.log(`[Q&A 생성] [Step 1] 선택된 스타일: opening=${selectedOpeningFamilyId}(${selectedOpeningFamilyName}), title=${selectedTitlePatternId}, concept=${selectedQuestionConceptId}`)

          // 프롬프트 길이 로깅 (할당량 초과 진단용)
          const questionPromptLength = questionPrompt.length
          const questionEstimatedTokens = Math.ceil(questionPromptLength / 4)
          console.log(`[Q&A 생성] [Step 1] 질문 생성 프롬프트 길이: ${questionPromptLength} 문자 (약 ${questionEstimatedTokens} 토큰)`)

          // 하이브리드: 질문 생성은 Flash 사용 (비용 절감)
          let questionResult
          try {
            questionResult = await generateContentWithFallback(questionPrompt, designSheetImage, true)
          } catch (genError: any) {
            console.error('[Q&A 생성] [Step 1] 질문 생성 API 호출 오류:', {
              error: genError,
              message: genError?.message,
              stack: genError?.stack,
              name: genError?.name
            })
            throw new Error(`질문 생성 API 호출 실패: ${genError?.message || '알 수 없는 오류'}`)
          }
          
          // RPM 150 제한 대응: 질문 생성 후 1초 지연
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          if (!questionResult || !questionResult.text) {
            console.error('[Q&A 생성] [Step 1] 질문 생성 결과가 비어있습니다:', questionResult)
            throw new Error('질문 생성 결과가 비어있습니다')
          }
          
          let questionText = questionResult.text

      // 제어 문자 제거 (<ctrl63>, <ctrl*> 등)
      questionText = questionText.replace(/<ctrl\d+>/gi, '')
      questionText = questionText.replace(/[\x00-\x1F\x7F]/g, '')

      console.log('[Q&A 생성] [Step 1] 원본 질문 텍스트 (처음 500자):', questionText.substring(0, 500))
      console.log('[Q&A 생성] [Step 1] 원본 질문 텍스트 전체 길이:', questionText.length)

      // === JSON 구조화 출력 파싱 (최우선) ===
      let jsonParsed = false
      let rawQuestionContent = ''
      try {
        const jsonMatch = questionText.match(/```json\s*([\s\S]*?)```/) || questionText.match(/\{[\s\S]*"title"[\s\S]*"body"[\s\S]*\}/)
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0]
          const parsed = JSON.parse(jsonStr.trim())
          if (parsed.title && parsed.body) {
            finalQuestionTitle = parsed.title.trim()
              .replace(/^["']|["']$/g, '')
              .replace(/\s+/g, ' ')
            // vocative-only 첫 문장 제거 (선배님들!, 안녕하세요! 등)
            let bodyText = parsed.body.trim()
            bodyText = bodyText.replace(/^(선배님들|옆집\s*언니들|언니들|형님들|오빠들|여러분)[!?\s]*\n*/i, '')
            rawQuestionContent = bodyText
            jsonParsed = true
            console.log('[Q&A 생성] [Step 1] ✅ JSON 구조화 파싱 성공:', { title: finalQuestionTitle.substring(0, 60), bodyLen: rawQuestionContent.length })
          }
        }
      } catch (jsonErr) {
        console.log('[Q&A 생성] [Step 1] JSON 파싱 실패, 기존 텍스트 파싱으로 fallback')
      }

      // === 기존 텍스트 파싱 (JSON 실패 시 fallback) ===
      if (!jsonParsed) {
      // "제목:"과 "본문:" 형식으로 명확히 구분되어 있는지 확인
      const titleSectionMatch = questionText.match(/제목[:\s]*\n?([\s\S]*?)(?:\n\s*본문[:\s]*\n?|$)/i)
      const contentSectionMatch = questionText.match(/본문[:\s]*\n?([\s\S]*?)$/i)
      // "[제목] ..." 한 줄 형식 (괄호만 있고 개행 없이 본문이 이어지는 경우)
      const bracketTitleMatch = questionText.match(/\[제목\]\s*([^\n]+)/)
      
      console.log('[Q&A 생성] [Step 1] titleSectionMatch:', titleSectionMatch ? '찾음' : '없음')
      console.log('[Q&A 생성] [Step 1] contentSectionMatch:', contentSectionMatch ? '찾음' : '없음')
      console.log('[Q&A 생성] [Step 1] bracketTitleMatch:', bracketTitleMatch ? '찾음' : '없음')
      
      // 본문 시작 패턴 감지 함수
      const findBodyStartPattern = (text: string): number => {
        // 본문 시작 패턴들 (안녕하세요, 저는, 저는 XX세, 현재는 등)
        const bodyStartPatterns = [
          /안녕하세요/i,
          /안녕/i,
          /저는\s*\d+세/i,
          /저는\s*\d+대/i,
          /저는\s*\d+살/i,
          /저는/i,
          /현재는/i,
          /지금은/i,
          /이번에/i,
          /요즘/i,
          /최근/i,
          /설계서를/i,
          /제안서를/i,
          /보험료가/i,
          /보험을/i,
          /회사\s*업무/i,
          /죄송합니다/i,
          /\d+세\s*남자/i,
          /\d+세\s*여자/i,
        ]
        
        for (const pattern of bodyStartPatterns) {
          const match = text.match(pattern)
          if (match && match.index !== undefined) {
            return match.index
          }
        }
        
        return -1
      }
      
      // 제목 후처리: "?" 뒤에 줄바꿈 없이 한글이 바로 이어지면 "?"에서 자르기
      const cutTitleAtQuestionMark = (title: string): string => {
        const qMatch = title.match(/^(.*?[?!])([가-힣a-zA-Z])/)
        if (qMatch && qMatch[1].length >= 10) return qMatch[1].trim()
        return title
      }

      // 제목 추출 (1줄, 최대 50자, 본문 시작 패턴 감지)
      if (bracketTitleMatch && bracketTitleMatch[1]) {
        // "[제목] ..." 형식: ] 없이 깔끔하게 추출, 본문 시작 전까지만
        let titleText = bracketTitleMatch[1]
          .trim()
          .replace(/<ctrl\d+>/gi, '')
          .replace(/[\x00-\x1F\x7F]/g, '')
        const bodyStartIndex = findBodyStartPattern(titleText)
        if (bodyStartIndex > 0) titleText = titleText.substring(0, bodyStartIndex).trim()
        finalQuestionTitle = titleText.length > 50 ? titleText.substring(0, 50).trim() : titleText.trim()
      } else if (titleSectionMatch && titleSectionMatch[1]) {
        // "제목:" 형식이 있으면 해당 부분만 추출
        let titleText = titleSectionMatch[1]
          .trim()
          .replace(/<ctrl\d+>/gi, '')
          .replace(/[\x00-\x1F\x7F]/g, '')
          .replace(/본문[:\s]*/i, '') // "본문:" 접두사 제거
          .trim()
        
        // "본문:" 이후의 내용이 있으면 제거
        const 본문Index = titleText.search(/본문[:\s]/i)
        if (본문Index > 0) {
          titleText = titleText.substring(0, 본문Index).trim()
        }
        
        // 본문 시작 패턴 감지
        const bodyStartIndex = findBodyStartPattern(titleText)
        if (bodyStartIndex > 0) {
          titleText = titleText.substring(0, bodyStartIndex).trim()
        }
        
        // 제목은 첫 줄만 사용 (최대 50자)
        const titleLines = titleText.split('\n').filter(line => line.trim().length > 0)
        if (titleLines.length > 0) {
          let titleCandidate = titleLines[0].trim()
          
          // 본문 시작 패턴이 첫 줄에 있으면 그 이전까지만
          const bodyStartInLine = findBodyStartPattern(titleCandidate)
          if (bodyStartInLine > 0) {
            titleCandidate = titleCandidate.substring(0, bodyStartInLine).trim()
          }
          
          // 50자 초과 시 자르기 (단어 단위로, 물음표/느낌표 전까지만)
          if (titleCandidate.length > 50) {
            // 물음표나 느낌표가 있으면 그 전까지만
            const questionMarkIndex = titleCandidate.lastIndexOf('?')
            const exclamationMarkIndex = titleCandidate.lastIndexOf('!')
            const lastMarkIndex = Math.max(questionMarkIndex, exclamationMarkIndex)
            
            if (lastMarkIndex > 0 && lastMarkIndex <= 50) {
              titleCandidate = titleCandidate.substring(0, lastMarkIndex + 1).trim()
            } else {
              // 마크가 없거나 50자 초과면 단어 단위로 자르기
              const words = titleCandidate.substring(0, 50).split(/\s+/)
              words.pop() // 마지막 단어 제거 (잘릴 수 있으므로)
              titleCandidate = words.join(' ')
            }
          }
          
          finalQuestionTitle = titleCandidate.trim()
        } else {
          finalQuestionTitle = titleText.substring(0, 50).trim()
        }
      } else {
        // "제목:" 형식이 없으면 첫 줄을 제목으로 사용 (본문 시작 패턴 감지)
        const lines = questionText.split('\n').filter(line => line.trim().length > 0)
        if (lines.length > 0) {
          let titleCandidate = lines[0]
            .replace(/<ctrl\d+>/gi, '')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/본문[:\s]*/i, '') // "본문:" 접두사 제거
            .trim()
          
          // "본문:" 이후의 내용이 있으면 제거
          const 본문Index = titleCandidate.search(/본문[:\s]/i)
          if (본문Index > 0) {
            titleCandidate = titleCandidate.substring(0, 본문Index).trim()
          }
          
          // 본문 시작 패턴 감지
          const bodyStartIndex = findBodyStartPattern(titleCandidate)
          if (bodyStartIndex > 0) {
            titleCandidate = titleCandidate.substring(0, bodyStartIndex).trim()
          }
          
          // 50자 초과 시 자르기 (물음표/느낌표 전까지만)
          if (titleCandidate.length > 50) {
            // 물음표나 느낌표가 있으면 그 전까지만
            const questionMarkIndex = titleCandidate.lastIndexOf('?')
            const exclamationMarkIndex = titleCandidate.lastIndexOf('!')
            const lastMarkIndex = Math.max(questionMarkIndex, exclamationMarkIndex)
            
            if (lastMarkIndex > 0 && lastMarkIndex <= 50) {
              titleCandidate = titleCandidate.substring(0, lastMarkIndex + 1).trim()
            } else {
              // 마크가 없거나 50자 초과면 단어 단위로 자르기
              const words = titleCandidate.substring(0, 50).split(/\s+/)
              words.pop()
              titleCandidate = words.join(' ')
            }
          }
          
          finalQuestionTitle = titleCandidate.trim()
          // 첫 줄만 제목인데 20자 미만이면 다음 줄 앞부분으로 보강 (25~40자 목표)
          if (finalQuestionTitle.length < 20 && lines.length > 1) {
            const extra = lines[1]
              .replace(/<ctrl\d+>/gi, '')
              .replace(/[\x00-\x1F\x7F]/g, '')
              .trim()
            const take = Math.min(extra.length, Math.max(0, 38 - finalQuestionTitle.length))
            if (take > 5) {
              let ext = extra.substring(0, take).trim()
              const lastSpace = ext.lastIndexOf(' ')
              if (lastSpace > 8) ext = ext.substring(0, lastSpace)
              if (ext.length > 0) finalQuestionTitle = (finalQuestionTitle + ' ' + ext).trim()
            }
          }
        } else {
          // 줄이 없으면 전체를 제목으로 (최대 50자, 본문 시작 패턴 감지)
          let titleCandidate = questionText
            .replace(/<ctrl\d+>/gi, '')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/본문[:\s]*/i, '') // "본문:" 접두사 제거
            .trim()
          
          // 본문 시작 패턴 감지
          const bodyStartIndex = findBodyStartPattern(titleCandidate)
          if (bodyStartIndex > 0) {
            titleCandidate = titleCandidate.substring(0, bodyStartIndex).trim()
          }
          
          finalQuestionTitle = titleCandidate.substring(0, 50).trim()
        }
      }

      // 제목 후처리: 마크다운/괄호·메타 제거, 40자 이내로 정리 (카페 제목 가독성)
      if (finalQuestionTitle && typeof finalQuestionTitle === 'string') {
        let titleCleaned = finalQuestionTitle
          .replace(/^#{1,6}\s*/, '')          // "## 제목" 같은 마크다운 헤딩 제거
          .replace(/^\s*\]\s*/, '')           // [제목] 파싱 시 남는 ]
          .replace(/^\s*\[제목\]\s*/i, '')   // [제목] 메타표현 제거
          .replace(/^\s*제목\s*[:\s]*/i, '') // "제목:" 접두사 제거
          .trim()
        // "?" 뒤에 줄바꿈 없이 한글이 바로 이어지면 "?"에서 자르기
        titleCleaned = cutTitleAtQuestionMark(titleCleaned)
        if (titleCleaned.length > 40) {
          // 단순 절단 대신, 40자 이내에서 마지막 공백 기준으로 자연스럽게 자르기
          const cut = titleCleaned.lastIndexOf(' ', 40)
          if (cut >= 20) {
            titleCleaned = titleCleaned.substring(0, cut).trim()
          } else {
            titleCleaned = titleCleaned.substring(0, 40).trim()
          }
        }
        if (titleCleaned.length > 0) finalQuestionTitle = titleCleaned
      }
      
      // 본문 추출
      if (contentSectionMatch && contentSectionMatch[1]) {
        // "본문:" 형식이 있으면 해당 부분만 추출
        rawQuestionContent = contentSectionMatch[1]
          .trim()
          .replace(/<ctrl\d+>/gi, '')
          .replace(/[\x00-\x1F\x7F]/g, '')
        
        // "제목:" 접두사가 본문에 포함되어 있으면 제거
        rawQuestionContent = rawQuestionContent.replace(/^제목[:\s]*/i, '').trim()
        
        // 본문의 첫 부분이 제목과 동일하면 제거
        const titleTrimmed = finalQuestionTitle.trim()
        if (titleTrimmed && rawQuestionContent.startsWith(titleTrimmed)) {
          rawQuestionContent = rawQuestionContent.substring(titleTrimmed.length).trim()
          // 제목 다음에 오는 구분자(줄바꿈, 공백 등)도 제거
          rawQuestionContent = rawQuestionContent.replace(/^[\s\n]+/, '').trim()
        }
        
        // "본문:" 라벨 자체가 내용에 포함되어 있으면 제거
        rawQuestionContent = rawQuestionContent.replace(/^본문[:\s]*/i, '').trim()
      } else {
        // "본문:" 형식이 없으면 제목을 제외한 나머지 사용
        const lines = questionText.split('\n')
        if (lines.length > 1) {
          // 첫 줄(제목)을 제외한 나머지
          rawQuestionContent = lines.slice(1).join('\n')
            .trim()
            .replace(/<ctrl\d+>/gi, '')
            .replace(/[\x00-\x1F\x7F]/g, '')
          
          // "제목:" 접두사가 본문에 포함되어 있으면 제거
          rawQuestionContent = rawQuestionContent.replace(/^제목[:\s]*/i, '').trim()
          
          // 본문의 첫 부분이 제목과 동일하면 제거
          const titleTrimmed = finalQuestionTitle.trim()
          if (titleTrimmed && rawQuestionContent.startsWith(titleTrimmed)) {
            rawQuestionContent = rawQuestionContent.substring(titleTrimmed.length).trim()
            rawQuestionContent = rawQuestionContent.replace(/^[\s\n]+/, '').trim()
          }
        } else {
          // 한 줄만 있으면 전체를 본문으로 사용 (제목은 비워두거나 첫 부분 사용)
          rawQuestionContent = questionText
            .trim()
            .replace(/<ctrl\d+>/gi, '')
            .replace(/[\x00-\x1F\x7F]/g, '')
            .replace(/^제목[:\s]*/i, '') // "제목:" 접두사 제거
            .trim()
        }
      }
      } // end if (!jsonParsed) — 기존 텍스트 파싱 fallback 블록 끝
      
      console.log('[Q&A 생성] [Step 1] 파싱된 제목:', finalQuestionTitle?.substring(0, 100))
      console.log('[Q&A 생성] [Step 1] 파싱된 제목 길이:', finalQuestionTitle?.length)
      console.log('[Q&A 생성] [Step 1] 파싱된 본문 (처음 200자):', rawQuestionContent?.substring(0, 200))
      console.log('[Q&A 생성] [Step 1] 파싱된 본문 길이:', rawQuestionContent?.length)

      // 질문 본문 줄단락 자동 재배치 (문단 최소 3개 확보)
      const formatQuestionContent = (text: string): string => {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          console.warn('[Q&A 생성] [Step 1] formatQuestionContent: 입력 텍스트가 비어있습니다')
          return ''
        }
        
        let cleaned = text
          .replace(/```[\s\S]*?```/g, '')
          .replace(/^제목[:\s]*/i, '')
          .replace(/^본문[:\s]*/i, '')
          .replace(/[ \t]+/g, ' ')
          .split('\n')
          .map(line => line.trim())
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        
        // vocative-only 첫 줄 제거 (호칭만 단독 문장인 경우)
        cleaned = cleaned.replace(/^(선배님들|옆집\s*언니들|언니들|형님들|오빠들|여러분|안녕하세요)[!?\s]*\n+/i, '')
        
        // 제목과 중복되는 첫 부분 제거
        const titleTrimmed = finalQuestionTitle.trim()
        if (titleTrimmed && cleaned.startsWith(titleTrimmed)) {
          cleaned = cleaned.substring(titleTrimmed.length).trim()
          cleaned = cleaned.replace(/^[\s\n]+/, '').trim()
        }
        
        if (!cleaned || cleaned.length === 0) {
          console.warn('[Q&A 생성] [Step 1] formatQuestionContent: 정리 후 텍스트가 비어있습니다')
          return text.trim() // 원본 반환
        }

        // 단어 중간 줄바꿈 제거 (예: "실\n손" → "실손", "3대진단\n보장이" → "3대진단 보장이")
        cleaned = cleaned.replace(/([가-힣])\n([가-힣])/g, '$1$2') // 한글-줄바꿈-한글 패턴 제거
        cleaned = cleaned.replace(/([가-힣])\s+\n\s+([가-힣])/g, '$1 $2') // 한글-공백-줄바꿈-공백-한글 패턴을 공백으로 변경
        
        // 기존 단락 확인 (문장 중간에서 끊어진 단락 검증)
        const existingParagraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0)
        
        // 문장 중간에서 끊어진 단락이 있는지 확인
        const hasBrokenParagraphs = existingParagraphs.some(p => {
          const trimmed = p.trim()
          // 문장 종결 어미 없이 끝나는 경우 (문장 중간이 잘린 경우)
          // 단, 너무 짧은 단락(10자 미만)은 제외
          if (trimmed.length >= 10 && !/[요네요어요습니다다?!]$/.test(trimmed)) {
            // 마지막 단어가 조사로 끝나는 경우 (예: "이 통합보험에")
            const lastWord = trimmed.split(/\s+/).pop() || ''
            if (/[에의를가을로와과]$/.test(lastWord)) {
              return true // 문장 중간에서 끊어진 것으로 판단
            }
            // 마지막 단어가 "다"로 끝나고 다음 문장이 조사나 동사로 시작할 가능성이 있는 경우
            if (/다$/.test(trimmed) && trimmed.length < 25) {
              return true
            }
          }
          return false
        })
        
        // 문장 중간에서 끊어진 단락이 없고, 단락이 3개 이상이면 그대로 사용
        if (!hasBrokenParagraphs && existingParagraphs.length >= 3) {
          const result = existingParagraphs.join('\n\n').trim()
          if (result.length > 0) {
            return result
          }
        }
        
        // 문장 중간에서 끊어진 단락이 있으면 재구성 필요
        if (hasBrokenParagraphs) {
          console.log('[Q&A 생성] [Step 1] 문장 중간에서 끊어진 단락 감지, 재구성 필요')
        }

        // 문장 단위 분리 (문장이 완전히 끝난 경우만 분리)
        // 한국어 문장 종결 어미: ~요, ~네요, ~어요, ~습니다, ~까요?, ~나요?, ~죠 등
        // 주의: "다"는 문장 중간에도 나올 수 있으므로(예: "3대진단까지 다 포함된") 제외
        const cleanedForSplit = cleaned.replace(/\n+/g, ' ')
        
        // 문장 종결 패턴: 확실한 종결 어미 또는 구두점 뒤에 공백이 있는 경우만 분리
        // "다"는 제외 (문장 중간에도 나올 수 있으므로)
        const sentenceCandidates = cleanedForSplit
          // 물음표/느낌표 뒤 공백 → 분리
          .split(/(?<=[?!])\s+/)
          .flatMap(s => {
            // 확실한 종결 어미(요, 네요, 어요, 습니다) 뒤 공백 → 분리
            // "다"는 제외 (문장 중간에도 나올 수 있으므로)
            return s.split(/(?<=[요네요어요습니다])\s+(?=[가-힣])/)
          })
          .map(s => s.trim())
          .filter(s => s.length > 0)
          // 문장 중간이 잘린 것 같은 조각 필터링
          .filter(s => {
            // 너무 짧은 조각 제거 (10자 미만이고 종결 어미가 없는 경우)
            if (s.length < 10 && !/[?!]$/.test(s)) {
              return false
            }
            // 마지막 단어가 조사로 끝나는 경우 제거 (문장 중간)
            const lastWord = s.split(/\s+/).pop() || ''
            if (/[에의를가을로와과]$/.test(lastWord) && !/[?!]$/.test(s)) {
              return false
            }
            // "다"로 끝나는 경우는 문장 중간일 가능성이 높으므로 제거
            // 예: "3대진단까지 다" → 문장 중간
            if (/^[^?!]*다$/.test(s) && !/[?!]$/.test(s)) {
              return false
            }
            return true
          })

        const buildParagraphsFromSentences = (sentences: string[], target: number): string[] => {
          if (sentences.length === 0) return []
          const sentencesPerParagraph = Math.max(1, Math.ceil(sentences.length / target))
          const grouped: string[] = []
          for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
            const chunk = sentences.slice(i, i + sentencesPerParagraph).join(' ').trim()
            if (chunk.length > 0) grouped.push(chunk)
          }
          return grouped
        }

        let paragraphs = sentenceCandidates.length > 0
          ? buildParagraphsFromSentences(sentenceCandidates, Math.min(4, Math.max(3, sentenceCandidates.length)))
          : []

        // 구두점이 거의 없을 때 단어 단위로 분리
        if (paragraphs.length < 3) {
          const words = cleaned.split(/\s+/).filter(Boolean)
          const wordsPerParagraph = Math.max(5, Math.ceil(words.length / 3))
          const wordParagraphs: string[] = []
          for (let i = 0; i < words.length; i += wordsPerParagraph) {
            const chunk = words.slice(i, i + wordsPerParagraph).join(' ').trim()
            if (chunk.length > 0) wordParagraphs.push(chunk)
          }
          paragraphs = wordParagraphs
        }

        if (paragraphs.length === 2 && paragraphs[1].length > 120) {
          // 2개만 만들어졌을 때는 두 번째 문단을 반으로 나눠 3개로 보정
          const second = paragraphs.pop() as string
          const words = second.split(/\s+/)
          const mid = Math.ceil(words.length / 2)
          paragraphs.push(words.slice(0, mid).join(' ').trim())
          paragraphs.push(words.slice(mid).join(' ').trim())
        }

        const finalParagraphs = paragraphs.filter(p => p.trim().length > 0)
        const result = finalParagraphs.length > 0 ? finalParagraphs.join('\n\n').trim() : cleaned
        
        // 최종 결과가 비어있으면 원본 반환
        if (!result || result.length === 0) {
          console.warn('[Q&A 생성] [Step 1] formatQuestionContent: 최종 결과가 비어있어 원본 반환')
          return text.trim()
        }
        
        return result
      }

          finalQuestionContent = formatQuestionContent(rawQuestionContent)
          
          // 질문 제목과 본문에서 마침표만 제거 (쉼표는 유지)
          if (finalQuestionTitle) {
            finalQuestionTitle = finalQuestionTitle
              .replace(/\./g, '') // 마침표만 제거
              .replace(/\s+/g, ' ') // 연속된 공백을 하나로
              .trim()
          }
          
          finalQuestionContent = finalQuestionContent
            .replace(/\./g, '') // 마침표만 제거 (쉼표는 유지)
            .replace(/\s+/g, ' ') // 연속된 공백을 하나로
            .trim()
          
          console.log('[Q&A 생성] [Step 1] 포맷팅 후 제목 길이:', finalQuestionTitle?.length || 0)
          console.log('[Q&A 생성] [Step 1] 포맷팅 후 본문 길이:', finalQuestionContent?.length || 0)

          // ── 느낌표 과다 제어: 3개 이상이면 초과분 제거 ──
          finalQuestionContent = normalizeExclamationMarks(finalQuestionContent)

          // ── 문단 자동 분리: 260자+ & 빈 줄 부족 시 강제 분리 ──
          finalQuestionContent = autoSplitQuestionParagraphs(finalQuestionContent)

          // ============================================
          // Step 1.5: 제목 전용 Gemini 2.5 Pro AI 완성기
          // 3개 후보 생성 → 코드 점수화 → 1개 선택
          // ============================================
          try {
            console.log('[Q&A 생성] [Step 1.5] Title Family 시스템 시작...')

            // 최근 제목 fingerprint: 최근 20개 제목을 가져와 유사도 비교용으로 사용
            let recentTitles: string[] = []
            try {
              const { data: recentQA } = await supabase
                .from('qa_sets')
                .select('title')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)
              if (recentQA && recentQA.length > 0) {
                recentTitles = recentQA.map((r: any) => r.title).filter(Boolean)
                console.log(`[Q&A 생성] [Step 1.5] 최근 제목 ${recentTitles.length}개 로드 (중복 방지용)`)
              }
            } catch (dbErr) {
              console.warn('[Q&A 생성] [Step 1.5] 최근 제목 로드 실패 (무시):', dbErr)
            }

            // 제목용 페르소나 버킷 계산
            const personaBucket = extractPersonaBucket(targetPersona || '')

            const worrySummary = (worryPoint || '').substring(0, 80)
            const sellingSummary = (sellingPoint || '').substring(0, 80)
            const premiumInfo = designSheetAnalysis?.premium || ''

            // Title Family 6개 샘플링 (가중치 기반, 최근 사용 family 감점)
            const sampledFamilies = sampleFamilies(6)
            console.log('[Q&A 생성] [Step 1.5] 샘플된 family:', sampledFamilies.map(f => f.id))

            const titlePrompt = buildTitlePrompt({
              families: sampledFamilies,
              cleanProductCore,
              topicConcern,
              topicConcernSearch,
              personaBucket,
              searchKeywords: searchKeywords || [],
              worrySummary,
              sellingSummary,
              premiumInfo,
            })

            let aiTitleSelected = false
            try {
              const titleResult = await generateContentWithFallback(titlePrompt, null, false)
              await new Promise(resolve => setTimeout(resolve, 1000))

              if (titleResult && titleResult.text) {
                let titleJson = titleResult.text.trim()
                titleJson = titleJson.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()

                try {
                  const parsed = JSON.parse(titleJson)
                  const aiTitles: string[] = parsed.titles || []

                  if (aiTitles.length > 0) {
                    const cleanedTitles = aiTitles.map(t => cleanForTitle(t).replace(/\./g, '').trim())
                    const scoredTitles = cleanedTitles.map((t, idx) => {
                      const familyId = idx < sampledFamilies.length ? sampledFamilies[idx].id : 'unknown'
                      const { score, reasons } = scoreTitleFamily({
                        title: t,
                        familyId,
                        searchKeywords: searchKeywords || [],
                        topicName: customerTopicName,
                        rawProductName: productName,
                        cleanProductCore,
                        recentTitles,
                      })
                      return { title: t, familyId, score, reasons }
                    })

                    scoredTitles.sort((a, b) => b.score - a.score)

                    console.log('[Q&A 생성] [Step 1.5] AI 제목 후보 (family 채점):')
                    scoredTitles.forEach(s => console.log(`  [${s.familyId}] ${s.title} → ${s.score}점 (${s.reasons.join(', ')})`))

                    const bestTitle = scoredTitles[0]
                    if (bestTitle && bestTitle.title.length >= 10 && bestTitle.title.length <= 50) {
                      finalQuestionTitle = bestTitle.title
                      aiTitleSelected = true
                      console.log('[Q&A 생성] [Step 1.5] 최종 선택:', finalQuestionTitle, `(${bestTitle.familyId}, ${bestTitle.score}점)`)
                    }
                  }
                } catch (parseErr) {
                  console.warn('[Q&A 생성] [Step 1.5] AI 제목 JSON 파싱 실패:', parseErr, '원본:', titleResult.text.substring(0, 200))
                }
              }
            } catch (titleGenErr) {
              console.warn('[Q&A 생성] [Step 1.5] AI 제목 생성 실패, 규칙형 폴백 사용:', titleGenErr)
            }

            // AI 생성 실패 시 규칙형 폴백 (다양한 family 기반)
            if (!aiTitleSelected) {
              console.log('[Q&A 생성] [Step 1.5] AI 실패 → 규칙형 폴백')
              const pk = (Array.isArray(searchKeywords) && searchKeywords[0]) || customerTopicName || '보험'
              const pp = personaBucket && !pk.includes(personaBucket) ? `${personaBucket} ` : ''

              const ruleCandidates = [
                `${pp}${pk}, 이 설계 괜찮을까요?`,
                `${pk} 가입하신 분들 어떠세요?`,
                `${pk} 설계서 받았는데 봐주실 수 있나요?`,
                `${pk} 보험료가 이 정도면 적당한가요?`,
                `${pp}${pk}, 해지하면 손해가 클까요?`,
              ]

              const ruleTitle = ruleCandidates.find(t => t.length <= 40 && t.length >= 15) || ruleCandidates[0]

              const hasCoreInTitle = (searchKeywords || []).some(kw => kw && finalQuestionTitle?.includes(kw))
              const looksLikeGreeting = /안녕하세요|언니들|가입했습니다|글 남겨요|회사 업무/.test(finalQuestionTitle || '')

              if (!hasCoreInTitle || looksLikeGreeting) {
                finalQuestionTitle = cleanForTitle(ruleTitle).replace(/\./g, '').trim()
                if (finalQuestionTitle.length > 40) {
                  const cut = finalQuestionTitle.lastIndexOf(' ', 40)
                  finalQuestionTitle = cut >= 20 ? finalQuestionTitle.substring(0, cut).trim() : finalQuestionTitle.substring(0, 40).trim()
                }
                console.log('[Q&A 생성] [Step 1.5] 규칙형 제목 적용:', finalQuestionTitle)
              }
            }

            finalQuestionTitle = cleanForTitle(finalQuestionTitle || '').replace(/\./g, '').trim()

          } catch (e) {
            console.warn('[Q&A 생성] [Step 1.5] Title Family 시스템 전체 오류:', e)
          }

          // 질문 생성 후 값이 제대로 설정되었는지 확인 (더 유연한 검증)
          const titleValid = finalQuestionTitle && finalQuestionTitle.trim().length > 0
          const contentValid = finalQuestionContent && finalQuestionContent.trim().length > 0
          
          if (!titleValid || !contentValid) {
            console.error('[Q&A 생성] [Step 1] 생성된 질문이 비어있습니다', { 
              titleValid,
              contentValid,
              finalQuestionTitle: finalQuestionTitle?.substring(0, 100), 
              finalQuestionContent: finalQuestionContent?.substring(0, 200),
              questionTextLength: questionText?.length || 0,
              rawQuestionContent: rawQuestionContent?.substring(0, 300)
            })
            
            // 원본 텍스트가 있으면 그것을 사용 (폴백)
            if (questionText && questionText.trim().length > 0) {
              console.warn('[Q&A 생성] [Step 1] 폴백: 원본 텍스트 사용')
              const fallbackLines = questionText.trim().split('\n').filter(l => l.trim().length > 0)
              if (fallbackLines.length > 0) {
                finalQuestionTitle = fallbackLines[0].trim().substring(0, 100)
                finalQuestionContent = fallbackLines.slice(1).join('\n\n').trim() || questionText.trim()
                
                // 다시 검증
                if (finalQuestionTitle && finalQuestionTitle.trim().length > 0 && 
                    finalQuestionContent && finalQuestionContent.trim().length > 0) {
                  console.log('[Q&A 생성] [Step 1] 폴백 성공:', { 
                    titleLength: finalQuestionTitle.length, 
                    contentLength: finalQuestionContent.length 
                  })
                } else {
                  throw new Error(`생성된 질문이 비어있습니다 (제목: ${titleValid}, 본문: ${contentValid})`)
                }
              } else {
                throw new Error(`생성된 질문이 비어있습니다 (제목: ${titleValid}, 본문: ${contentValid})`)
              }
            } else {
              throw new Error(`생성된 질문이 비어있습니다 (제목: ${titleValid}, 본문: ${contentValid})`)
            }
          }

          console.log('Step 1 완료:', { questionTitle: finalQuestionTitle, questionContentLength: finalQuestionContent.length })
        } catch (step1Error: any) {
          console.error('[Q&A 생성] [Step 1] 질문 생성 중 오류 발생:', {
            error: step1Error,
            message: step1Error?.message,
            stack: step1Error?.stack,
            name: step1Error?.name,
            cause: step1Error?.cause
          })
          return NextResponse.json(
            { 
              error: step1Error?.message || '질문 생성에 실패했습니다. 다시 시도해주세요.',
              details: process.env.NODE_ENV === 'development' ? {
                message: step1Error?.message,
                stack: step1Error?.stack,
                name: step1Error?.name
              } : undefined
            },
            { status: 500 }
          )
        }
      } else {
        // generateStep이 'question'이고 기존 질문이 있는 경우에만 생략
        console.log('Step 1 생략: 기존 질문 사용')
        // 기존 질문을 finalQuestionTitle과 finalQuestionContent에 설정
        finalQuestionTitle = questionTitle || ''
        finalQuestionContent = questionContent || ''
        
        // 기존 질문도 유효한지 확인
        if (!finalQuestionTitle || !finalQuestionContent || finalQuestionTitle.trim().length === 0 || finalQuestionContent.trim().length === 0) {
          console.error('Step 1 실패: 기존 질문이 유효하지 않습니다', { 
            finalQuestionTitle, 
            finalQuestionContent 
          })
          return NextResponse.json(
            { error: '질문이 필요합니다. 먼저 질문을 생성해주세요.' },
            { status: 400 }
          )
        }
      }
    } else {
      console.log('Step 1 생략: requestedStep이 question이 아님')
      if (!questionTitle || !questionContent) {
        return NextResponse.json(
          { error: '질문이 필요합니다. 먼저 질문을 생성해주세요.' },
          { status: 400 }
        )
      }
    }

    // Step 2: 답변 생성
    if (requestedStep === 'answer' || requestedStep === 'all') {
      if (!finalQuestionTitle || !finalQuestionContent) {
        return NextResponse.json(
          { error: '질문이 필요합니다. 먼저 질문을 생성해주세요.' },
          { status: 400 }
        )
      }
      
      console.log('Step 2: 답변 생성 중...')
      const answerPrompt = generateAnswerPrompt(
        {
          productName,
          topicName: customerTopicName,
          displayProductName,
          targetPersona,
          worryPoint,
          sellingPoint,
          answerTone: answerTone || 'friendly',
          answerLength: answerLength || 'default',
          designSheetImage,
          designSheetAnalysis,
          searchResultsText,
          searchKeywords: searchKeywords?.length ? searchKeywords : undefined,
          evidenceMap: designSheetAnalysis?.evidenceMap || undefined,
          conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
        },
        finalQuestionTitle,
        finalQuestionContent
      )

      // 프롬프트 길이 로깅 (할당량 초과 진단용)
      const answerPromptLength = answerPrompt.length
      const answerEstimatedTokens = Math.ceil(answerPromptLength / 4)
      console.log(`[Q&A 생성] [Step 2] 답변 생성 프롬프트 길이: ${answerPromptLength} 문자 (약 ${answerEstimatedTokens} 토큰)`)

      // 하이브리드: 답변 생성은 Pro 사용 (품질 유지)
      const answerResult = await generateContentWithFallback(answerPrompt, designSheetImage, false)
      // RPM 150 제한 대응: 답변 생성 후 1초 지연
      await new Promise(resolve => setTimeout(resolve, 1000))
      answerContent = answerResult.text

      // 제어 문자 제거 (<ctrl63>, <ctrl*> 등) - 이모티콘 보존
      answerContent = answerContent.replace(/<ctrl\d+>/gi, '')
      // 제어 문자 제거 (단, 줄바꿈(\n), 캐리지 리턴(\r), 탭(\t)은 제외하고 이모티콘은 보존)
      answerContent = answerContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

      // 마크다운이나 코드 블록 제거
      answerContent = answerContent.replace(/```[\s\S]*?```/g, '').trim()
      answerContent = answerContent.replace(/\[생성된 답변\]/g, '').trim()

      // 역할 누수 제거 (전문가님, 경력, 상담 유도 등)
      answerContent = stripAnswerRoleLeakage(answerContent)

      // 답변 포맷팅 개선 (띄어쓰기 및 문단 구분)
      // 1. 연속된 공백을 하나로 정리
      answerContent = answerContent.replace(/[ \t]+/g, ' ')
      
      // 2. 각 줄 앞뒤 공백 정리 (단, 줄바꿈은 유지)
      answerContent = answerContent.split('\n').map(line => line.trim()).join('\n')
      
      // 2-1. 만약 줄바꿈이 전혀 없거나 부족한 경우, 4-5문단으로 자동 분리
      const paragraphs = answerContent.split(/\n\s*\n/).filter(p => p.trim().length > 0)
      
      if (paragraphs.length < 4 && answerContent.length > 100) {
        // 문장 단위로 분리하여 4-5문단으로 재구성
        const sentences = answerContent
          .replace(/\n+/g, ' ') // 모든 줄바꿈을 공백으로
          .split(/([.!?]\s+)/) // 문장 단위로 분리
          .filter(s => s.trim().length > 0)
        
        // 문장들을 그룹화하여 4-5문단으로 나누기
        const targetParagraphs = 4 + Math.floor(Math.random() * 2) // 4 또는 5문단
        const sentencesPerParagraph = Math.ceil(sentences.length / targetParagraphs)
        const newParagraphs: string[] = []
        
        for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
          const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph)
          const paragraph = paragraphSentences.join(' ').trim()
          if (paragraph.length > 0) {
            newParagraphs.push(paragraph)
          }
        }
        
        // 4-5문단이 안 되면 조정
        if (newParagraphs.length < 4 && newParagraphs.length > 0) {
          // 마지막 문단을 나누어 4개 이상 만들기
          const lastParagraph = newParagraphs[newParagraphs.length - 1]
          const lastSentences = lastParagraph.split(/([.!?]\s+)/).filter(s => s.trim().length > 0)
          if (lastSentences.length >= 2) {
            newParagraphs.pop()
            const midPoint = Math.ceil(lastSentences.length / 2)
            newParagraphs.push(lastSentences.slice(0, midPoint).join(' ').trim())
            newParagraphs.push(lastSentences.slice(midPoint).join(' ').trim())
          }
        }
        
        if (newParagraphs.length >= 4) {
          answerContent = newParagraphs.join('\n\n').trim()
        } else {
          // 그래도 안 되면 기존 방식 사용 (문장 끝 뒤에 빈 줄 추가)
          answerContent = answerContent.replace(/([.!?])\s+([가-힣A-Z])/g, '$1\n\n$2')
        }
      }
      
      // 3. 이모티콘 앞에 줄바꿈이 없으면 추가 (이모티콘을 문단 시작점에 배치)
      // 이모티콘을 안전하게 처리하기 위해 일반적인 이모티콘을 직접 매칭
      // 서로게이트 페어로 구성된 이모티콘도 올바르게 처리됨
      try {
        // 일반적으로 사용하는 이모티콘 목록 (프롬프트에서 사용하는 것들 + 추가)
        const commonEmojis = ['👍', '💡', '✅', '📊', '💰', '🎯', '💼', '📋', '📈', '📞', '◆', '⭐', '💎', '🔔', '📝', '📌', '🎉', '🔥', '💪', '✨', '📱', '🏆', '🎁', '💯']
        
        // 각 이모티콘에 대해 개별적으로 처리 (더 안전함)
        commonEmojis.forEach(emoji => {
          // 이모티콘 앞에 줄바꿈이 없고, 이전 문자가 줄바꿈이 아닌 경우 줄바꿈 추가
          // 이스케이프 처리하여 특수 문자로 인식되지 않도록 함
          const escapedEmoji = emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          answerContent = answerContent.replace(new RegExp(`([^\\n])(${escapedEmoji})`, 'g'), '$1\n\n$2')
          
          // 이모티콘 뒤에 공백이 없으면 추가
          answerContent = answerContent.replace(new RegExp(`(${escapedEmoji})([^\\s\\n])`, 'g'), '$1 $2')
        })
      } catch (error) {
        console.error('이모티콘 처리 중 오류:', error)
        // 오류 발생 시 원본 내용 유지
      }
      
      // 4. 연속된 줄바꿈을 최대 2개로 정리 (과도한 줄바꿈 방지)
      answerContent = answerContent.replace(/\n{3,}/g, '\n\n')
      
      // 5. 문장 끝 부분에 자동 줄바꿈 추가하지 않음 (프롬프트에서 이미 적절히 처리하도록 함)
      // 과도한 줄바꿈을 방지하기 위해 자동 추가 로직 제거
      
      // 6. 최종 정리 (앞뒤 공백 제거)
      answerContent = answerContent.trim()
      
      // 7. 답변 길이: 500자 초과 시에만 450자로 soft cap (카페용 가독성, 89자처럼 과도하게 잘리지 않도록)
      const ANSWER_SOFT_CAP = 450
      if (answerContent.length > ANSWER_SOFT_CAP) {
        answerContent = enforceAnswerLength(answerContent, ANSWER_SOFT_CAP)
        console.log(`[Q&A 생성] [Step 2] 답변 길이 soft cap 적용: ${ANSWER_SOFT_CAP}자 이내 (원본 초과분 절단)`)
      }

      // 8. 300자 미만이면 자동 1회 재생성 (프롬프트만으로는 길이 하한 보장 불가)
      const ANSWER_MIN_THRESHOLD = 300
      if (answerContent.length < ANSWER_MIN_THRESHOLD) {
        console.log(`[Q&A 생성] [Step 2] ⚠️ 답변 ${answerContent.length}자 < ${ANSWER_MIN_THRESHOLD}자 → 자동 재생성 시도`)
        try {
          const retryPrompt = generateAnswerPrompt(
            {
              productName,
              topicName: customerTopicName,
              displayProductName,
              targetPersona,
              worryPoint,
              sellingPoint,
              answerTone: answerTone || 'friendly',
              answerLength: answerLength || 'default',
              designSheetImage,
              designSheetAnalysis,
              searchResultsText,
              searchKeywords: searchKeywords?.length ? searchKeywords : undefined,
              evidenceMap: designSheetAnalysis?.evidenceMap || undefined,
              conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
            },
            finalQuestionTitle,
            finalQuestionContent + `\n\n⚠️ 이전 답변이 ${answerContent.length}자로 너무 짧았습니다. 반드시 350자 이상, 공감→판단→체크포인트→행동유도 4블록을 빠짐없이 작성하세요.`
          )
          const retryResult = await generateContentWithFallback(retryPrompt, designSheetImage, false)
          await new Promise(resolve => setTimeout(resolve, 1000))
          let retryAnswer = retryResult.text
            .replace(/<ctrl\d+>/gi, '')
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
            .replace(/```[\s\S]*?```/g, '').trim()
            .replace(/\[생성된 답변\]/g, '').trim()
          if (retryAnswer.length > ANSWER_SOFT_CAP) {
            retryAnswer = enforceAnswerLength(retryAnswer, ANSWER_SOFT_CAP)
          }
          if (retryAnswer.length > answerContent.length) {
            console.log(`[Q&A 생성] [Step 2] ✅ 재생성 성공: ${answerContent.length}자 → ${retryAnswer.length}자`)
            answerContent = retryAnswer
          } else {
            console.log(`[Q&A 생성] [Step 2] 재생성 결과가 더 짧음, 원본 유지: ${answerContent.length}자`)
          }
        } catch (retryError) {
          console.error('[Q&A 생성] [Step 2] 재생성 실패, 원본 유지:', retryError)
        }
      }

      console.log(`[Q&A 생성] [Step 2] 최종 답변 길이: ${answerContent.length}자 (목표: 300-500자)`)

      console.log('Step 2 완료:', { answerContentLength: answerContent.length })
    } else {
      console.log('Step 2 생략: requestedStep이 answer가 아님')
      // answerContent는 이미 빈 문자열로 초기화됨
    }

    // Step 3: 대화형 모드일 경우 추가 댓글 생성
    conversationThread = []
    
    if ((requestedStep === 'conversation' || requestedStep === 'all') && conversationMode && conversationLength) {
      if (!finalQuestionTitle || !finalQuestionContent || !answerContent) {
        return NextResponse.json(
          { error: '질문과 답변이 필요합니다. 먼저 질문과 답변을 생성해주세요.' },
          { status: 400 }
        )
      }
      console.log('Step 3: 대화형 스레드 생성 중...', { conversationLength })

      // 짝수만 허용 (4, 6, 8, 10) - 항상 설계사가 마무리하도록
      const validLengths = [4, 6, 8, 10]
      const totalSteps = validLengths.includes(conversationLength) 
        ? conversationLength 
        : 6 // 기본값: 6개 (댓글 4개)
      const conversationHistory: ConversationMessage[] = []
      
      // 첫 질문과 답변을 히스토리에 추가
      conversationHistory.push({
        role: 'customer',
        content: `${finalQuestionTitle}\n\n${finalQuestionContent}`,
        step: 0
      })
      conversationHistory.push({
        role: 'agent',
        content: answerContent,
        step: 1
      })
      
      // 대화형 스레드는 나머지 댓글들만 포함 (질문과 첫 답변은 위에 따로 표시)
      
      // ── 2쌍 구조: 고객+설계사를 1쌍씩 생성 (4회 개별 → 2회 쌍 호출) ──
      // 품질 우선: 첫 쌍의 결과를 보고 둘째 쌍이 이어가므로 축적감이 자연스러움
      const threadStepsNeeded = totalSteps - 2 // 질문+첫답변 제외한 댓글 수
      const totalPairs = Math.ceil(threadStepsNeeded / 2) // 보통 2쌍 (댓글 4개)
      
      for (let pairIdx = 0; pairIdx < totalPairs; pairIdx++) {
        const isLastPair = pairIdx === totalPairs - 1
        console.log(`[Q&A 생성] [Step 3] 쌍 ${pairIdx + 1}/${totalPairs} 생성 중... (${isLastPair ? '마지막 쌍' : '중간 쌍'})`)
        
        const pairPrompt = generateCommentPairPrompt(
          {
            productName,
            topicName: customerTopicName,
            displayProductName,
            targetPersona,
            worryPoint,
            sellingPoint,
            answerTone: answerTone || 'friendly',
            answerLength: answerLength || 'default',
            designSheetImage,
            designSheetAnalysis,
            searchResultsText: searchResultsText || undefined,
            conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
          },
          {
            initialQuestion: {
              title: finalQuestionTitle,
              content: finalQuestionContent
            },
            firstAnswer: answerContent,
            conversationHistory: conversationHistory.slice(-4),
            pairIndex: pairIdx,
            totalPairs,
            isLastPair,
          }
        )
        
        // Pro 모델 사용 (쌍 단위로 품질 보장)
        const pairResult = await generateContentWithFallback(pairPrompt, designSheetImage, false)
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        let pairText = pairResult.text
        pairText = pairText.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        
        // JSON 파싱
        let customerContent = ''
        let agentContent = ''
        
        try {
          const jsonMatch = pairText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            customerContent = (parsed.customer || '').trim()
            agentContent = (parsed.agent || '').trim()
          }
        } catch (parseErr) {
          console.warn(`[Q&A 생성] [Step 3] 쌍 ${pairIdx + 1} JSON 파싱 실패, 개별 생성으로 fallback`)
        }
        
        // JSON 파싱 실패 또는 빈 결과 시 개별 생성 fallback
        if (!customerContent || !agentContent) {
          console.log(`[Q&A 생성] [Step 3] 쌍 ${pairIdx + 1} fallback: 개별 생성`)
          const baseStep = 3 + pairIdx * 2
          
          // 고객 댓글 개별 생성
          const customerPrompt = generateConversationThreadPrompt(
            { productName, topicName: customerTopicName, displayProductName, targetPersona, worryPoint, sellingPoint, answerTone: answerTone || 'friendly', answerLength: answerLength || 'default', designSheetImage, designSheetAnalysis, searchResultsText: searchResultsText || undefined },
            { initialQuestion: { title: finalQuestionTitle, content: finalQuestionContent }, firstAnswer: answerContent, conversationHistory: conversationHistory.slice(-4), totalSteps, currentStep: baseStep }
          )
          const custResult = await generateContentWithFallback(customerPrompt, designSheetImage, true)
          await new Promise(resolve => setTimeout(resolve, 1000))
          customerContent = custResult.text.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').replace(/```[\s\S]*?```/g, '').replace(/\[생성된 댓글\]/g, '').trim()
          
          // 설계사 답글 개별 생성
          const tempHistory = [...conversationHistory, { role: 'customer' as const, content: customerContent, step: baseStep }]
          const agentPrompt = generateConversationThreadPrompt(
            { productName, topicName: customerTopicName, displayProductName, targetPersona, worryPoint, sellingPoint, answerTone: answerTone || 'friendly', answerLength: answerLength || 'default', designSheetImage, designSheetAnalysis, searchResultsText: searchResultsText || undefined },
            { initialQuestion: { title: finalQuestionTitle, content: finalQuestionContent }, firstAnswer: answerContent, conversationHistory: tempHistory.slice(-4), totalSteps, currentStep: baseStep + 1 }
          )
          const agentResult = await generateContentWithFallback(agentPrompt, designSheetImage, false)
          await new Promise(resolve => setTimeout(resolve, 1000))
          agentContent = agentResult.text.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').replace(/```[\s\S]*?```/g, '').replace(/\[답글 작성\]/g, '').trim()
        }
        
        // 고객 댓글 최소 길이 보장
        if (customerContent.length > 0 && customerContent.length < 80) {
          customerContent = (customerContent + ' 저도 비슷한 고민이에요 조언 부탁드립니다').trim()
        }
        
        // 길이 제한 (극단적 초과만)
        const maxCustomer = pairIdx === 0 ? 375 : 300 // 150% of 250/200
        const maxAgent = pairIdx === 0 ? 420 : 345 // 150% of 280/230
        if (customerContent.length > maxCustomer) {
          customerContent = enforceAnswerLength(customerContent, pairIdx === 0 ? 250 : 200)
        }
        if (agentContent.length > maxAgent) {
          agentContent = enforceAnswerLength(agentContent, pairIdx === 0 ? 280 : 230)
        }
        
        const baseStep = 3 + pairIdx * 2
        const customerMsg: ConversationMessage = { role: 'customer', content: customerContent, step: baseStep }
        const agentMsg: ConversationMessage = { role: 'agent', content: agentContent, step: baseStep + 1 }
        
        conversationHistory.push(customerMsg, agentMsg)
        conversationThread.push(customerMsg, agentMsg)
        
        console.log(`[Q&A 생성] [Step 3] 쌍 ${pairIdx + 1} 완료: 고객 ${customerContent.length}자, 설계사 ${agentContent.length}자`)
      }
      
      // 후기성 문구 자동 삽입 (문서 11절: conversationLength 6 이상일 때만 허용)
      const finalReviewCount = reviewCount !== undefined ? reviewCount : 0
      const minConversationLengthForReview = 6
      const allowReviewInsert = finalReviewCount > 0 && (conversationLength || 0) >= minConversationLengthForReview

      if (finalReviewCount > 0 && !allowReviewInsert) {
        console.log(`[Q&A 생성] [11절 후기 규칙] 후기 삽입 생략: 대화 길이 ${conversationLength ?? 0} < ${minConversationLengthForReview}`)
      }

      if (allowReviewInsert) {
        console.log(`후기성 문구 생성 중... (${finalReviewCount}개)`)
        
        const reviewMessages: ConversationMessage[] = []
        
        // reviewCount만큼 고객 후기 생성 (1개 또는 2개)
        for (let i = 0; i < finalReviewCount; i++) {
          const reviewPrompt = generateReviewMessagePrompt(
            {
              productName,
              topicName: customerTopicName,
              displayProductName,
              targetPersona,
              worryPoint,
              sellingPoint,
              answerTone: answerTone || 'friendly',
              designSheetImage,
              designSheetAnalysis,
              searchResultsText: searchResultsText || undefined
            },
            {
              productName: customerTopicName || productName
            }
          )
          
          const reviewResult = await generateContentWithFallback(reviewPrompt, designSheetImage, true)
          // RPM 150 제한 대응: 후기 생성 사이에 1초 지연
          await new Promise(resolve => setTimeout(resolve, 1000))
          let reviewContent = reviewResult.text
          reviewContent = reviewContent.replace(/<ctrl\d+>/gi, '')
          reviewContent = reviewContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
          reviewContent = reviewContent.replace(/```[\s\S]*?```/g, '').trim()
          reviewContent = reviewContent.replace(/\[생성된 후기성 문구\]/g, '').trim()
          reviewContent = reviewContent.trim()
          
          const reviewMessage: ConversationMessage = {
            role: 'customer',
            content: reviewContent,
            step: 1999 + i // 대화 횟수에 포함되지 않음
          }
          
          reviewMessages.push(reviewMessage)
        }
        
        // 마지막 설계사 댓글 직전에 삽입
        const lastAgentIndex = conversationThread.map((msg, idx) => ({ msg, idx }))
          .filter(({ msg }) => msg.role === 'agent')
          .pop()?.idx
        
        if (lastAgentIndex !== undefined && lastAgentIndex >= 0) {
          conversationThread.splice(lastAgentIndex + 1, 0, ...reviewMessages)
        } else {
          // 설계사 댓글이 없으면 맨 끝에 추가
          conversationThread.push(...reviewMessages)
        }
        
        conversationHistory.push(...reviewMessages)
        
        console.log(`후기성 문구 ${finalReviewCount}개 삽입 완료`)
      } else if (finalReviewCount === 0) {
        console.log('후기성 문구 생성 안 함 (reviewCount: 0)')
      }
      console.log('Step 3 완료:', { totalThreads: conversationThread.length })
    }

    } // end of !usedUnifiedPath (기존 개별 호출 경로)

    // ============================================
    // ⚠️ 테스트용: 토큰 사용량 계산 및 반환
    // 실제 운영 시에는 tokenUsage 필드를 제거해야 합니다
    // ============================================
    const totalUsage = calculateTotalUsage()
    const costEstimate = estimateCost(tokenUsage)
    const customSearchCost = customSearchCount * 0.0005 // 커스텀 서치 비용 (USD, $0.0005 per search)
    
    // 서치 비용을 총 비용에 포함
    const totalCostWithSearch = costEstimate.totalCost !== null && customSearchCost > 0
      ? costEstimate.totalCost + customSearchCost
      : costEstimate.totalCost
    
    console.log('📊 총 토큰 사용량:', totalUsage)
    console.log('📊 서치 비용:', customSearchCost, '총 비용 (토큰 + 서치):', totalCostWithSearch)

    // 문서 8절: 품질 게이트 검수 기준 → 경고만 반환 (수동 검수·A/B 시 참고)
    const qualityWarnings: string[] = []
    const regenHistoryEntries: Array<{ attempted: boolean; field: string; beforeScore: number; afterScore: number; improved: boolean }> = []
    const qTitle = (finalQuestionTitle || '').trim()
    const qContent = (finalQuestionContent || '').trim()
    const aContent = (answerContent || '').trim()
    if (qTitle.length > 0) {
      if (qTitle.length < 10) qualityWarnings.push('질문 제목이 너무 짧음(10자 미만)')
      if (qTitle.length > 80) qualityWarnings.push('질문 제목이 너무 김(80자 초과)')
    }
    if (qContent.length > 0) {
      if (qContent.length < 50) qualityWarnings.push('질문 본문이 너무 짧음(50자 미만)')
    if (qContent.length > 800) qualityWarnings.push('질문 본문이 너무 김(800자 초과)')
    }
    if (aContent.length > 0) {
      if (aContent.length < 220) qualityWarnings.push('답변 본문이 너무 짧음(220자 미만)')
      if (aContent.length > 1200) qualityWarnings.push('답변 본문이 너무 김(1200자 초과)')
    }
    if (searchKeywords && searchKeywords.length > 0) {
      const inTitle = searchKeywords.filter(kw => qTitle.includes(kw)).length
      const inQuestion = searchKeywords.filter(kw => qContent.includes(kw)).length
      if (inTitle > 2) qualityWarnings.push(`연관 키워드 제목 과다(${inTitle}개, 목표 최대 1~2개)`)
      if (inQuestion > 4) qualityWarnings.push(`연관 키워드 질문 본문 과다(${inQuestion}개, 목표 최대 2개 수준)`)
    }
    if (qualityWarnings.length > 0) {
      console.log('[Q&A 생성] [8절 품질 게이트] 경고:', qualityWarnings)
    }

    // usage_logs 저장은 품질 게이트 이후로 이동 (qualityGate/failureTags 포함 위해)

    // ============================================
    // 최종 출력 전: 필드별 정제 강도 분리 적용
    //   제목       → 강한 정제 (cleanForTitle)
    //   질문 본문   → 약한 정제 (cleanForBody) — 보장 구조어 보존
    //   답변       → 약한 정제 (cleanForBody) — 보장 구조어 보존
    //   대화 댓글   → 약한 정제 (cleanForBody)
    //   로그/내부   → 정제 없음 (rawProductName 그대로)
    // ============================================
    if (finalQuestionTitle) {
      finalQuestionTitle = cleanForTitle(finalQuestionTitle)
    }
    if (finalQuestionContent) {
      finalQuestionContent = cleanForBody(finalQuestionContent)
    }
    if (answerContent) {
      answerContent = cleanForBody(answerContent)
    }
    if (conversationThread.length > 0) {
      conversationThread = conversationThread.map((msg, idx) => {
        let content = cleanForBody(msg.content)
        if (msg.role === 'agent') {
          content = stripAnswerRoleLeakage(content)
        }
        const isLastAgent = msg.role === 'agent' && idx === conversationThread.length - 1
        if (isLastAgent) {
          content = normalizeFinalAgentEnding(content)
        }
        return { ...msg, content }
      })
    }
    console.log('[Q&A 생성] 필드별 정제 완료 (제목→강, 본문/답변/댓글→약+역할누수제거, 로그→없음)')

    // ── 품질 게이트: 필드별 로컬 검증 ──
    const forbiddenPats = designSheetAnalysis?.evidenceMap?.forbiddenPatterns || []
    const gateResults: GateResult[] = []

    if (finalQuestionTitle) {
      const titleGate = gateTitle(finalQuestionTitle, undefined, { forbiddenPatterns: forbiddenPats })
      gateResults.push(titleGate)
      if (!titleGate.passed) {
        console.warn(`[품질 게이트] 제목 실패 (${titleGate.score}점): ${titleGate.failures.join(', ')}`)
        qualityWarnings.push(`제목 품질 경고: ${titleGate.failures.join('; ')}`)
      } else {
        console.log(`[품질 게이트] 제목 통과 (${titleGate.score}점)`)
      }
    }

    if (finalQuestionContent) {
      const bodyGate = gateQuestionBody(finalQuestionContent, { forbiddenPatterns: forbiddenPats })
      gateResults.push(bodyGate)
      if (!bodyGate.passed) {
        console.warn(`[품질 게이트] 본문 실패 (${bodyGate.score}점): ${bodyGate.failures.join(', ')}`)
        qualityWarnings.push(`본문 품질 경고: ${bodyGate.failures.join('; ')}`)
      } else {
        console.log(`[품질 게이트] 본문 통과 (${bodyGate.score}점)`)
      }
    }

    if (answerContent) {
      const answerGate = gateAnswer(answerContent, {
        conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
        forbiddenPatterns: forbiddenPats,
      })
      gateResults.push(answerGate)
      if (!answerGate.passed) {
        console.warn(`[품질 게이트] 답변 실패 (${answerGate.score}점): ${answerGate.failures.join(', ')}`)
        qualityWarnings.push(`답변 품질 경고: ${answerGate.failures.join('; ')}`)

        // 답변이 70점 미만이면 재생성 시도 (1회만)
        if (answerGate.score < 70 && finalQuestionTitle && finalQuestionContent) {
          console.log(`[품질 게이트] 답변 ${answerGate.score}점 < 70점 → 재생성 시도`)
          const regenEntry: { attempted: boolean; field: string; beforeScore: number; afterScore: number; improved: boolean } = {
            attempted: true, field: 'answer', beforeScore: answerGate.score, afterScore: answerGate.score, improved: false,
          }
          try {
            const retryPrompt = generateAnswerPrompt(
              {
                productName, topicName: customerTopicName, displayProductName, targetPersona,
                worryPoint, sellingPoint, answerTone: answerTone || 'friendly', answerLength: answerLength || 'default',
                designSheetImage, designSheetAnalysis, searchResultsText,
                searchKeywords: searchKeywords?.length ? searchKeywords : undefined,
                evidenceMap: designSheetAnalysis?.evidenceMap || undefined,
                conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
              },
              finalQuestionTitle,
              finalQuestionContent + `\n\n⚠️ 이전 답변이 품질 게이트를 통과하지 못했습니다 (${answerGate.score}점). 문제: ${answerGate.failures.join(', ')}. 반드시 판단 한 줄을 포함하고, 공감→판단→체크포인트→행동유도 4블록을 빠짐없이 작성하세요.`
            )
            const retryResult = await generateContentWithFallback(retryPrompt, designSheetImage, false)
            await new Promise(resolve => setTimeout(resolve, 1000))
            let retryAnswer = retryResult.text.replace(/<ctrl\d+>/gi, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '').trim()
            retryAnswer = cleanForBody(retryAnswer)

            const retryGate = gateAnswer(retryAnswer, {
              conflictAxis: designSheetAnalysis?.conflictAxis || undefined,
              forbiddenPatterns: forbiddenPats,
            })
            regenEntry.afterScore = retryGate.score
            if (retryGate.score > answerGate.score) {
              answerContent = retryAnswer
              regenEntry.improved = true
              console.log(`[품질 게이트] 답변 재생성 성공: ${answerGate.score}점 → ${retryGate.score}점`)
            } else {
              console.log(`[품질 게이트] 답변 재생성이 개선되지 않음: ${retryGate.score}점, 원본 유지`)
            }
          } catch (retryErr) {
            console.warn('[품질 게이트] 답변 재생성 실패, 원본 유지:', retryErr)
          }
          regenHistoryEntries.push(regenEntry)
        }
      } else {
        console.log(`[품질 게이트] 답변 통과 (${answerGate.score}점)`)
      }
    }

    if (conversationThread.length > 0) {
      const threadGate = gateThread(conversationThread, { forbiddenPatterns: forbiddenPats })
      gateResults.push(threadGate)
      if (!threadGate.passed) {
        console.warn(`[품질 게이트] 스레드 실패 (${threadGate.score}점): ${threadGate.failures.join(', ')}`)
        qualityWarnings.push(`스레드 품질 경고: ${threadGate.failures.join('; ')}`)
      } else {
        console.log(`[품질 게이트] 스레드 통과 (${threadGate.score}점)`)
      }
    }

    // ── 인간미 점수 (첫 문장 유사도 검사 포함) ──
    const humanGate = gateHumanLikeness(
      finalQuestionTitle || '',
      finalQuestionContent || '',
      answerContent || '',
      conversationThread,
      recentFirstSentencesStore.length > 0 ? recentFirstSentencesStore : undefined
    )
    gateResults.push(humanGate)
    if (!humanGate.passed) {
      console.warn(`[품질 게이트] 인간미 경고 (${humanGate.score}점): ${humanGate.failures.join(', ')}`)
      qualityWarnings.push(`인간미 경고: ${humanGate.failures.join('; ')}`)
    } else {
      console.log(`[품질 게이트] 인간미 통과 (${humanGate.score}점)`)
    }

    // ── Evidence 일관성 ──
    const evidenceGate = gateEvidenceConsistency(
      answerContent || '',
      conversationThread,
      {
        answerFacts: designSheetAnalysis?.evidenceMap?.answerFacts || [],
        forbiddenPatterns: forbiddenPats,
      }
    )
    gateResults.push(evidenceGate)
    if (!evidenceGate.passed) {
      console.warn(`[품질 게이트] Evidence 일관성 경고 (${evidenceGate.score}점): ${evidenceGate.failures.join(', ')}`)
      qualityWarnings.push(`Evidence 일관성: ${evidenceGate.failures.join('; ')}`)
    } else {
      console.log(`[품질 게이트] Evidence 일관성 통과 (${evidenceGate.score}점)`)
    }

    // ── 키워드 건강 게이트 ──
    const keywordHealthGate = gateKeywordHealth(
      searchKeywords,
      finalQuestionTitle || '',
      finalQuestionContent || '',
      searchKeywordsWithVolume.length > 0 ? searchKeywordsWithVolume : undefined,
      topicConcern || undefined
    )
    gateResults.push(keywordHealthGate)
    if (!keywordHealthGate.passed) {
      console.warn(`[품질 게이트] 키워드 건강 경고 (${keywordHealthGate.score}점): ${keywordHealthGate.failures.join(', ')}`)
      qualityWarnings.push(`키워드 건강 경고: ${keywordHealthGate.failures.join('; ')}`)
    } else {
      console.log(`[품질 게이트] 키워드 건강 통과 (${keywordHealthGate.score}점)`)
    }

    // ── 운영 리스크 게이트 ──
    const canonicalOverrideApplied = isDesignSheetMode && !!designSheetAnalysis
    const operationalRiskGate = gateOperationalRisk({
      wasRegenerated: regenHistoryEntries.length > 0,
      regenImproved: regenHistoryEntries.some(r => r.improved),
      firstSentenceSimilarityMax: undefined,
      familyRepeatCount: 0,
      canonicalOverrideApplied,
      hasDesignSheetAnalysis: !!designSheetAnalysis,
    })
    gateResults.push(operationalRiskGate)
    if (!operationalRiskGate.passed) {
      console.warn(`[품질 게이트] 운영 리스크 경고 (${operationalRiskGate.score}점): ${operationalRiskGate.failures.join(', ')}`)
      qualityWarnings.push(`운영 리스크 경고: ${operationalRiskGate.failures.join('; ')}`)
    } else {
      console.log(`[품질 게이트] 운영 리스크 통과 (${operationalRiskGate.score}점)`)
    }

    const overallQuality = calculateOverallScore(gateResults)
    const failureTags = classifyFailureTags(gateResults)
    console.log(`[품질 게이트] 종합 점수: ${overallQuality.totalScore}점, 필드별: ${JSON.stringify(overallQuality.breakdown)}`)
    if (failureTags.length > 0) {
      console.log(`[품질 게이트] failureTags: ${failureTags.join(', ')}`)
    }
    if (overallQuality.criticalFailures.length > 0) {
      console.warn(`[품질 게이트] Critical 실패: ${overallQuality.criticalFailures.join(' | ')}`)
    }

    // 현재 결과의 첫 문장을 세션 저장소에 저장 (다음 생성 시 유사도 비교용)
    const _getFirst = (t: string) => { const m = t.trim().match(/^.+?[.?!？！\n]/); return m ? m[0].trim() : t.trim().substring(0, 80) }
    const currentFirstSentences: FirstSentences = {
      questionFirst: _getFirst(finalQuestionContent || ''),
      answerFirst: _getFirst(answerContent || ''),
      customerCommentFirst: _getFirst(conversationThread.find(m => m.role === 'customer')?.content || ''),
      agentCommentFirst: _getFirst(conversationThread.find(m => m.role === 'agent')?.content || ''),
    }
    recentFirstSentencesStore.push(currentFirstSentences)
    if (recentFirstSentencesStore.length > MAX_RECENT_FIRST_SENTENCES) {
      recentFirstSentencesStore.shift()
    }
    console.log(`[Q&A 생성] 첫 문장 저장 완료 (저장소 크기: ${recentFirstSentencesStore.length})`)

    // 사용량 로그 (실패해도 응답은 진행) — 문서 13·14절: 버전·KPI 메타
    const usageLogMeta = {
      productName,
      conversationMode,
      generateStep: requestedStep,
      promptVersion: QA_PROMPT_VERSION,
      tokenBreakdown: tokenUsage,
      costEstimate: totalCostWithSearch,
      tokenCost: costEstimate.totalCost,
      customSearchCount: customSearchCount,
      customSearchCost: customSearchCost,
      qualityWarnings: qualityWarnings.length > 0 ? qualityWarnings : undefined,
      questionTitle: (finalQuestionTitle || '').trim().substring(0, 200) || undefined,
      questionContentSnippet: (finalQuestionContent || '').trim().replace(/\s+/g, ' ').substring(0, 300) || undefined,
      searchKeywords: searchKeywords && searchKeywords.length > 0 ? searchKeywords : undefined,
      searchKeywordsWithVolume: searchKeywordsWithVolume.length > 0 ? searchKeywordsWithVolume : undefined,
      topicCore: cleanProductCore || undefined,
      topicConcern: topicConcern || undefined,
      topicConcernSearch: topicConcernSearch || undefined,
      personaBucket: isDesignSheetMode ? (designSheetAnalysis?.personaBucket || undefined) : undefined,
      displayProductName: displayProductName || undefined,
      isDesignSheetMode,
      openingFamilyId: selectedOpeningFamilyId,
      titlePatternId: selectedTitlePatternId,
      questionConceptId: selectedQuestionConceptId,
      qualityGate: {
        totalScore: overallQuality.totalScore,
        breakdown: overallQuality.breakdown,
        allPassed: overallQuality.allPassed,
        criticalFailures: overallQuality.criticalFailures.length > 0 ? overallQuality.criticalFailures : undefined,
      },
      failureTags: failureTags.length > 0 ? failureTags : undefined,
      regenHistory: regenHistoryEntries.length > 0 ? regenHistoryEntries : undefined,
      latencyMs: Date.now() - startTime,
      selectedFamilies: {
        openingFamilyId: selectedOpeningFamilyId,
        titlePatternId: selectedTitlePatternId,
        questionConceptId: selectedQuestionConceptId,
        concernVariant: selectedConcernVariant || undefined,
      },
      canonicalOverrideApplied: isDesignSheetMode && !!designSheetAnalysis,
      evidenceMapSummary: designSheetAnalysis?.evidenceMap ? {
        questionFactsCount: designSheetAnalysis.evidenceMap.questionFacts?.length || 0,
        answerFactsCount: designSheetAnalysis.evidenceMap.answerFacts?.length || 0,
        forbiddenPatternsCount: designSheetAnalysis.evidenceMap.forbiddenPatterns?.length || 0,
      } : undefined,
    }

    Promise.resolve(
      supabase
        .from('usage_logs')
        .insert({
          user_id: user.id,
          type: 'qa',
          prompt_tokens: totalUsage.promptTokens,
          completion_tokens: totalUsage.candidatesTokens,
          total_tokens: totalUsage.totalTokens,
          meta: usageLogMeta
        })
    )
      .then((result: any) => {
        if (result?.error) {
          console.error('[Q&A 생성] usage_logs insert 실패:', result.error)
        }
      })
      .catch((err) => console.error('[Q&A 생성] usage_logs insert 예외:', err))

    // answer는 항상 설계사 첫 답변 반환 (대화형 스레드와 별개)
    const finalAnswerContent = answerContent
    
    return NextResponse.json({
      success: true,
      question: {
        title: finalQuestionTitle,
        content: finalQuestionContent,
        generatedAt: new Date().toISOString()
      },
      answer: {
        content: finalAnswerContent,
        generatedAt: new Date().toISOString()
      },
      conversation: conversationThread.length > 0 ? conversationThread : undefined,
      qualityGate: {
        totalScore: overallQuality.totalScore,
        breakdown: overallQuality.breakdown,
        allPassed: overallQuality.allPassed,
        criticalFailures: overallQuality.criticalFailures.length > 0 ? overallQuality.criticalFailures : undefined,
      },
      usage: {
        promptTokens: totalUsage.promptTokens,
        completionTokens: totalUsage.candidatesTokens,
        totalTokens: totalUsage.totalTokens,
        breakdown: tokenUsage,
        costEstimate: {
          ...costEstimate,
          totalCost: totalCostWithSearch,
          customSearchCost: customSearchCost,
          customSearchCount: customSearchCount
        }
      },
      metadata: {
        productName,
        topicName: customerTopicName,
        displayProductName,
        targetPersona,
        worryPoint,
        sellingPoint,
        answerTone: answerTone || 'friendly',
        conversationMode: conversationMode || false,
        conversationLength: conversationLength || 0,
        searchKeywords: searchKeywords && searchKeywords.length > 0 ? searchKeywords : undefined,
        promptVersion: QA_PROMPT_VERSION,
        qualityWarnings: qualityWarnings.length > 0 ? qualityWarnings : undefined,
        openingFamilyId: selectedOpeningFamilyId,
        titlePatternId: selectedTitlePatternId,
        questionConceptId: selectedQuestionConceptId,
        concernVariant: selectedConcernVariant || undefined,
      }
    })
  } catch (error: any) {
    // 에러 로깅 강화
    console.error('========== Q&A 생성 오류 발생 ==========')
    console.error('에러 타입:', typeof error)
    console.error('에러 객체:', error)
    console.error('에러 메시지:', error?.message)
    console.error('에러 스택:', error?.stack)
    console.error('에러 이름:', error?.name)
    console.error('에러 원인:', error?.cause)
    
    // 에러를 JSON으로 변환 시도
    try {
      const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error))
      console.error('에러 JSON:', errorString.substring(0, 2000))
    } catch (stringifyError) {
      console.error('에러 JSON 변환 실패:', stringifyError)
      console.error('에러 toString:', error?.toString())
    }
    console.error('==========================================')
    
    // 더 자세한 에러 메시지 제공
    let errorMessage = 'Q&A 생성 중 오류가 발생했습니다'
    
    // 에러 메시지 추출 (여러 방법 시도)
    if (error?.message && typeof error.message === 'string' && error.message.trim().length > 0) {
      errorMessage = error.message.trim()
      // 할당량 에러인 경우 더 친절한 메시지
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('할당량')) {
        errorMessage = 'API 할당량이 초과되었습니다. 잠시 후 다시 시도해주세요.'
      }
    } else if (error?.toString && typeof error.toString === 'function') {
      try {
        const errorString = error.toString()
        if (errorString && errorString !== '[object Object]' && errorString.trim().length > 0) {
          errorMessage = errorString.trim()
        }
      } catch (toStringError) {
        // toString 실패 시 무시
      }
    }
    
    // 에러가 객체이지만 메시지가 없는 경우
    if (errorMessage === 'Q&A 생성 중 오류가 발생했습니다' && typeof error === 'object' && error !== null) {
      // 에러 객체의 속성들을 확인
      const errorKeys = Object.keys(error)
      if (errorKeys.length > 0) {
        errorMessage = `Q&A 생성 중 오류가 발생했습니다 (${errorKeys.join(', ')})`
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        message: errorMessage, // 호환성을 위해 message도 추가
        details: process.env.NODE_ENV === 'development' ? {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
          type: typeof error,
          string: error?.toString?.(),
          keys: typeof error === 'object' && error !== null ? Object.keys(error) : undefined
        } : undefined
      },
      { status: 500 }
    )
  }
}

