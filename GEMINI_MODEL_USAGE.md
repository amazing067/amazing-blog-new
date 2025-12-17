# Gemini 모델 사용 현황

## 모델별 사용처

### Gemini 2.5 Pro 사용처
**우선 사용 (useFlash = false):**
1. **Step 2: 답변 생성** (라인 767)
   - `generateContentWithFallback(answerPrompt, designSheetImage, false)`
   - 복잡한 분석, 검색 결과 통합, 전문가 답변 생성
   - 품질이 중요한 단계

2. **Step 3: 설계사 댓글** (라인 970)
   - `generateContentWithFallback(conversationPrompt, designSheetImage, isCustomerTurn)`
   - `isCustomerTurn = false` (짝수 step, 설계사 차례)
   - 전문적이고 디테일한 분석이 필요한 답변

**폴백 순서 (useFlash = false):**
- 2.5 Pro → 2.5 Flash → 2.0 Flash

### Gemini 2.5 Flash 사용처
**우선 사용 (useFlash = true):**
1. **Step 1: 질문 생성** (라인 605)
   - `generateContentWithFallback(questionPrompt, designSheetImage, true)`
   - 간단한 질문 생성 작업
   - 비용 절감 목적

2. **Step 3: 고객 댓글** (라인 970)
   - `generateContentWithFallback(conversationPrompt, designSheetImage, isCustomerTurn)`
   - `isCustomerTurn = true` (홀수 step, 고객 차례)
   - 간단한 질문 생성 작업

3. **후기성 문구 생성** (라인 1045)
   - `generateContentWithFallback(reviewPrompt, designSheetImage, true)`
   - 간단한 후기 생성

**폴백 사용 (useFlash = false일 때):**
- Step 2: 답변 생성 실패 시 (2.5 Pro → 2.5 Flash → 2.0 Flash)
- Step 3: 설계사 댓글 생성 실패 시 (2.5 Pro → 2.5 Flash → 2.0 Flash)

### Gemini 2.0 Flash 사용처
**폴백 사용:**
- 2.5 Flash 실패 시 최종 폴백 모델
- 모든 모델 실패 시 마지막 시도

## 폴백 로직

### generateContentWithFallback 함수 (라인 411-560)
```typescript
const generateContentWithFallback = async (
  prompt: string, 
  imageBase64?: string | null,
  useFlash: boolean = false // true: Flash 우선, false: Pro 우선
)
```

**useFlash = true (Flash 우선):**
1. Gemini-2.5-Flash 시도
2. 실패 시 → Gemini-2.0-Flash 폴백

**useFlash = false (Pro 우선):**
1. Gemini-2.5-Pro 시도
2. 실패 시 → Gemini-2.5-Flash 폴백
3. 실패 시 → Gemini-2.0-Flash 폴백

## 모델 선택 기준

### 2.5 Pro 사용 기준
- ✅ 복잡한 분석이 필요한 작업
- ✅ 검색 결과 통합이 필요한 작업
- ✅ 전문가 수준의 답변이 필요한 작업
- ✅ 품질이 중요한 작업

### 2.5 Flash 사용 기준
- ✅ 간단한 생성 작업
- ✅ 비용 절감이 중요한 작업
- ✅ 빠른 응답이 필요한 작업
- ✅ 2.5 Pro와 2.0 Flash의 중간 성능/비용

### 2.0 Flash 사용 기준
- ✅ 최종 폴백 모델
- ✅ 가장 저렴한 비용
- ✅ 빠른 응답이 필요한 작업

## 현재 사용 패턴

| 단계 | 작업 | 우선 모델 | 폴백 모델 | useFlash |
|------|------|----------|----------|----------|
| Step 1 | 질문 생성 | 2.5 Flash | 2.0 Flash | `true` |
| Step 2 | 답변 생성 | 2.5 Pro | 2.5 Flash → 2.0 Flash | `false` |
| Step 3 (고객) | 고객 댓글 | 2.5 Flash | 2.0 Flash | `true` |
| Step 3 (설계사) | 설계사 댓글 | 2.5 Pro | 2.5 Flash → 2.0 Flash | `false` |
| 후기 | 후기 생성 | 2.5 Flash | 2.0 Flash | `true` |

## 2.5 Pro 로직 체크

### ✅ 정상 동작 확인
1. **폴백 순서**: 
   - Pro 우선: 2.5 Pro → 2.5 Flash → 2.0 Flash (라인 424-426)
   - Flash 우선: 2.5 Flash → 2.0 Flash (라인 418-422)
2. **에러 처리**: 할당량 초과 시 자동 폴백 (라인 538-545)
3. **재시도 로직**: 1초 지연 후 재시도 (라인 543-544)
4. **토큰 추적**: 사용량 로깅 및 추적 (라인 499-505)

### ⚠️ 주의사항
1. **할당량 제한**: Free tier에서 2.5 Pro 할당량 = 0
2. **RPM 제한**: 150 RPM 제한 대응 (1초 지연 추가)
3. **비용**: 2.5 Pro > 2.5 Flash > 2.0 Flash (비용 순서)
4. **2.5 Flash**: 2.5 Pro와 2.0 Flash의 중간 성능/비용 모델

### 🔍 검증 필요 사항
1. 할당량 초과 시 Flash로 자동 전환되는지 확인
2. 토큰 사용량 추적이 정확한지 확인
3. 에러 메시지가 명확한지 확인
