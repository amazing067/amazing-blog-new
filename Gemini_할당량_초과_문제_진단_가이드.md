# Gemini 2.5 Pro 할당량 초과 문제 진단 가이드

**작성일**: 2024-12-16  
**문제**: Gemini 2.5 Pro 모델이 429 에러 발생 (할당량 초과)  
**증상**: 구글 콘솔에서는 할당량 초과가 보이지 않는데 계속 429 에러 발생

---

## 🔍 가능한 원인들

### 1. 프로덕션 서버가 이전 프로젝트의 API 키를 사용 중 ⚠️ (가장 가능성 높음)

**확인 방법**:
1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. `GEMINI_API_KEY` 값 확인
3. 로컬 `.env.local`의 `GEMINI_API_KEY`와 비교

**해결 방법**:
- Vercel 환경 변수를 새로 통합한 프로젝트의 API 키로 업데이트
- 재배포 (자동 또는 수동)

---

### 2. 무료 할당량 초과 (Free Tier Quota)

**Gemini 2.5 Pro 무료 할당량**:
- **일일 요청 수 제한**: 제한적 (정확한 수치는 프로젝트마다 다름)
- **분당 요청 수 제한**: 제한적
- **무료 크레딧**: $300 (90일간)

**확인 방법**:
1. Google Cloud Console → **API 및 서비스 → 할당량**
2. **Generative Language API** 선택
3. **gemini-2.5-pro** 모델 할당량 확인
4. **사용량** 탭에서 실제 사용량 확인

**해결 방법**:
- 할당량 증가 요청 (Google Cloud Console에서)
- 또는 Flash 모델로 우선 사용 (이미 Fallback 로직 적용됨)

---

### 3. API 키 제한 설정

**확인 방법**:
1. Google Cloud Console → **API 및 서비스 → 사용자 인증 정보**
2. API 키 클릭
3. **API 제한** 섹션 확인
4. **애플리케이션 제한** 섹션 확인

**문제가 될 수 있는 설정**:
- 특정 IP 주소로 제한 → Vercel IP가 허용되지 않음
- 특정 HTTP 리퍼러로 제한 → Vercel 도메인이 허용되지 않음
- 특정 API만 허용 → Generative Language API가 비활성화됨

**해결 방법**:
- **애플리케이션 제한**: "없음" 또는 "IP 주소" (Vercel IP 포함)
- **API 제한**: "제한 없음" 또는 "Generative Language API" 포함

---

### 4. 프로젝트별 할당량 제한

**확인 방법**:
1. Google Cloud Console → **API 및 서비스 → 할당량**
2. 프로젝트 선택 (통합한 프로젝트)
3. **Generative Language API** → **gemini-2.5-pro** 선택
4. 할당량 제한 확인

**일반적인 제한**:
- **분당 요청 수 (RPM)**: 15-60 (프로젝트마다 다름)
- **일일 요청 수 (RPD)**: 제한적
- **토큰 제한**: 분당/일일 토큰 수 제한

**해결 방법**:
- 할당량 증가 요청
- 또는 Flash 모델로 우선 사용

---

### 5. 결제 계정 문제

**확인 방법**:
1. Google Cloud Console → **결제**
2. 결제 계정 상태 확인
3. 무료 크레딧 잔액 확인

**문제가 될 수 있는 경우**:
- 무료 크레딧 소진 ($300 초과)
- 결제 계정 비활성화
- 결제 방법 미등록 (유료 사용 시)

**해결 방법**:
- 결제 방법 등록
- 또는 무료 할당량 내에서 사용

---

## 🔧 단계별 진단 방법

### Step 1: 프로덕션 서버 환경 변수 확인

1. **Vercel 대시보드 접속**
   - https://vercel.com/dashboard
   - 프로젝트 선택

2. **Settings → Environment Variables** 이동

3. **`GEMINI_API_KEY` 확인**:
   - 값이 로컬 `.env.local`과 동일한지 확인
   - 새로 통합한 프로젝트의 API 키인지 확인

4. **환경 확인**:
   - Production, Preview, Development 모두 확인
   - 모든 환경에 올바른 키가 설정되어 있는지 확인

---

### Step 2: Google Cloud Console 할당량 확인

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com/
   - 통합한 프로젝트 선택

2. **API 및 서비스 → 할당량** 이동

3. **Generative Language API** 선택

4. **필터**: `gemini-2.5-pro` 입력

5. **확인 사항**:
   - 할당량 제한 (RPM, RPD 등)
   - 현재 사용량
   - 할당량 초과 여부

---

### Step 3: API 키 제한 설정 확인

1. **API 및 서비스 → 사용자 인증 정보** 이동

2. **API 키 클릭** (사용 중인 키)

3. **확인 사항**:
   - **API 제한**: "제한 없음" 또는 "Generative Language API" 포함
   - **애플리케이션 제한**: "없음" 또는 Vercel IP 포함

---

### Step 4: 사용량 로그 확인

1. **Google Cloud Console → 로깅** 이동

2. **로그 탐색기** 선택

3. **필터**:
   ```
   resource.type="api"
   resource.labels.service="generativelanguage.googleapis.com"
   jsonPayload.error.message=~"429"
   ```

4. **확인 사항**:
   - 429 에러 발생 시간
   - 에러 메시지 상세 내용
   - 요청 빈도

---

## 🚨 즉시 확인해야 할 사항

### 1. 프로덕션 서버 환경 변수 (최우선)

**가장 가능성 높은 원인**: 프로덕션 서버가 이전 프로젝트의 API 키를 사용 중

**확인**:
- Vercel 환경 변수와 로컬 `.env.local` 비교
- API 키가 동일한지 확인

**해결**:
- Vercel 환경 변수 업데이트
- 재배포

---

### 2. 무료 할당량 초과

**확인**:
- Google Cloud Console → 할당량 → 사용량 확인
- 무료 크레딧 잔액 확인

**해결**:
- 할당량 증가 요청
- 또는 Flash 모델로 우선 사용 (이미 Fallback 적용됨)

---

### 3. API 키 제한 설정

**확인**:
- API 키 → 애플리케이션 제한 확인
- Vercel IP가 허용되어 있는지 확인

**해결**:
- 애플리케이션 제한을 "없음"으로 변경
- 또는 Vercel IP 주소 추가

---

## 💡 임시 해결 방법

현재 Fallback 로직이 적용되어 있어서:
- `gemini-2.5-pro` 실패 시 → `gemini-2.0-flash`로 자동 전환
- 기능은 정상 작동하지만 Pro 모델을 사용하지 못함

**임시 조치**:
1. Flash 모델로 우선 사용 (이미 적용됨)
2. 할당량 문제 해결 후 Pro 모델 사용 재개

---

## 📊 예상 원인 우선순위

1. **프로덕션 서버 환경 변수 미반영** (80% 가능성)
2. **무료 할당량 초과** (15% 가능성)
3. **API 키 제한 설정** (5% 가능성)

---

## ✅ 체크리스트

- [ ] Vercel 환경 변수 확인 및 업데이트
- [ ] Google Cloud Console 할당량 확인
- [ ] API 키 제한 설정 확인
- [ ] 사용량 로그 확인
- [ ] 결제 계정 상태 확인

---

**작성자**: AI Assistant  
**다음 단계**: 프로덕션 서버 환경 변수 확인 (최우선)

