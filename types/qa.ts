/**
 * Q&A 생성·설계서 분석 공통 타입
 * API(analyze-design-sheet 응답, generate-qa 요청)와 프론트(BlogGenerator)에서 공유하여
 * keyCoverages, designFocusLabel, worryPoint, sellingPoint 등 누락을 타입으로 방지
 */

/** 설계서 분석 결과 한 건 (analyze-design-sheet 응답 data / generate-qa body.designSheetAnalysis) */
export interface DesignSheetAnalysis {
  premium?: string
  coverages?: string[]
  specialClauses?: string[]
  rawProductName?: string
  topicCore?: string
  topicConcern?: string
  topicConcernSearch?: string
  displayProductName?: string
  companyShort?: string
  personaBucket?: string
  /** 분석 시 추출된 고객 고민. canonical에서 우선 사용 */
  worryPoint?: string
  /** 분석 시 추출된 답변 강조 포인트. canonical에서 우선 사용 */
  sellingPoint?: string
  searchSummary?: string
  searchKeywordHints?: string[]
  evidenceMap?: {
    questionFacts: string[]
    answerFacts: string[]
    forbiddenPatterns: string[]
  }
  conflictAxis?: {
    keyword: string
    keywordNatural: string
    proCondition: string
    conCondition: string
    summary: string
  } | null
  /** 담보·특약 요약 (normalizedName/customerLabel). displayKeywords coverage_focus 등에 사용 */
  keyCoverages?: KeyCoverageItem[]
  /** 담보 축 라벨 (예: '암 보장 중심', '치매 보장 중심'). coverage_focus fallback */
  designFocusLabel?: string
  /** analyze-design-sheet 응답에만 있을 수 있는 필드 (generate-qa에서 참조) */
  selectedConcernSource?: string | null
  selectedConcernReason?: string | null
  customerConcernCandidates?: string[]
  recommendedMarketHead?: string
  internalConcern?: string | null
}

/** keyCoverages 배열 요소 (analyze-design-sheet buildKeyCoverages 출력과 동일) */
export interface KeyCoverageItem {
  rawName?: string
  normalizedName?: string
  customerLabel?: string
  category?: string
  amount?: string
  renewalType?: string
}

/** generate-qa POST body (designSheetAnalysis는 DesignSheetAnalysis와 동일 구조) */
export interface GenerateQABody {
  productName?: string
  targetPersona?: string
  worryPoint?: string
  sellingPoint?: string
  answerTone?: string
  answerLength?: string
  designSheetImage?: string | null
  designSheetAnalysis?: DesignSheetAnalysis | null
  questionTitle?: string
  questionContent?: string
  conversationMode?: boolean
  conversationLength?: number
  reviewCount?: number
  generateStep?: string
  [key: string]: unknown
}
