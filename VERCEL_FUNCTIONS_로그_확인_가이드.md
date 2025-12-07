# Vercel Functions 로그 확인 가이드

## 🔍 Functions 로그를 보는 방법

### 방법 1: 배포 상세 페이지에서 Functions 탭 찾기

1. **Vercel 대시보드** → 프로젝트 선택
2. **Deployments** 탭 클릭
3. **최신 배포** 클릭 (예: `de7b095`)
4. 배포 상세 페이지에서:
   - 상단 탭 메뉴에서 **"Functions"** 탭 찾기
   - 또는 **"Runtime Logs"** 카드 클릭
   - 또는 하단의 **"Functions"** 섹션 찾기

### 방법 2: 실제 API 호출 후 로그 확인

**중요**: Functions 로그는 API 라우트가 실제로 호출되어야 나타납니다!

1. **메인 서버에서 블로그 생성 시도**
   - `/api/generate` 호출 발생
   - 또는 Q&A 생성 시도 → `/api/generate-qa` 호출 발생

2. **호출 후 다시 Logs 탭 확인**
   - Route 필터에서 `/api/generate` 또는 `/api/generate-qa` 검색
   - 또는 "Request Path" 필터에서 API 경로 확인

### 방법 3: 실시간 로그 모니터링

1. **Logs 탭**에서:
   - 우측 상단의 **"Live"** 버튼 활성화
   - **Route 필터**에서 `/api/*` 경로만 필터링
   - 블로그 생성 시도 → 실시간으로 로그 확인

## 📋 현재 화면에서 확인할 수 있는 것

현재 보이는 로그:
- `GET /` (4개) - 홈페이지 요청
- `GET /login` (2개) - 로그인 페이지 요청

**Functions 로그가 없는 이유:**
- API 라우트(`/api/generate`, `/api/generate-qa`)가 아직 호출되지 않았기 때문입니다.

## ✅ Functions 로그를 보려면

1. **메인 서버에서 블로그 생성 시도**
   - 대시보드 → 블로그 생성기 → 블로그 생성 버튼 클릭
   - 또는 Q&A 생성 시도

2. **호출 후 Logs 탭에서 확인**
   - Route 필터에서 `/api/generate` 검색
   - 또는 "Request Path" 필터에서 `/api/*` 경로 확인

3. **로그에서 확인할 내용:**
   ```
   🔍 Google Custom Search 환경 변수 확인: {
     hasGoogleApiKey: true,
     hasSearchEngineId: true,
     ...
   }
   ✅ Google Custom Search 완료: { resultCount: 3, success: true }
   ```

## 🎯 빠른 확인 방법

1. **메인 서버 접속** → 블로그 생성 시도
2. **Vercel Logs 탭** → Route 필터에서 `/api/generate` 검색
3. **로그 확인** → 환경 변수 확인 메시지 확인

