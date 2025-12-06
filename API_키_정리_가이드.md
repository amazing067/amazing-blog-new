# API 키 정리 및 역할 설명

## 🔑 현재 사용 중인 API 키들

### 1. **GEMINI_API_KEY** (Gemini AI)
- **용도**: AI 블로그 생성, Q&A 생성, 제안서 분석
- **사용 위치**:
  - `app/api/generate/route.ts` - 블로그 생성
  - `app/api/generate-qa/route.ts` - Q&A 생성
  - `app/api/analyze-design-sheet/route.ts` - 제안서 분석
- **인증 방식**: API Key (서버 간 통신)
- **프로덕션 작동**: ✅ 동일하게 작동

### 2. **GOOGLE_API_KEY** (Google API)
- **용도**: 
  - Google Sheets 읽기 (공개 시트)
  - Google Custom Search
- **사용 위치**:
  - `lib/google-sheets.ts` - Sheets 데이터 읽기
  - `lib/google-search.ts` - 웹 검색
- **인증 방식**: API Key (읽기 전용)
- **프로덕션 작동**: ✅ 동일하게 작동

### 3. **GOOGLE_SHEETS_ID**
- **용도**: Google Sheets 파일 식별
- **형태**: 파일 ID (예: `1xLGmNw8JfgGk2Y01WAsSQ4cBOofynaXVmne165i_ly8`)
- **프로덕션 작동**: ✅ 동일하게 작동

### 4. **GOOGLE_CUSTOM_SEARCH_ENGINE_ID**
- **용도**: Google Custom Search 엔진 식별
- **프로덕션 작동**: ✅ 동일하게 작동

---

## ❓ OAuth 클라이언트 ID vs API Key

### **API Key** (현재 사용 중)
- ✅ **서버 간 통신**: 서버에서 직접 API 호출
- ✅ **읽기 전용**: Google Sheets 읽기, Custom Search
- ✅ **설정 간단**: 환경 변수만 설정
- ✅ **프로덕션 동일**: 로컬/프로덕션 동일하게 작동
- ❌ **쓰기 제한**: Google Sheets 쓰기는 OAuth 필요

### **OAuth 클라이언트 ID** (새로 만드는 것)
- ⚠️ **사용자 인증**: 브라우저에서 사용자 로그인 필요
- ⚠️ **웹 앱용**: 사용자가 직접 로그인하는 웹 앱에 적합
- ⚠️ **서버 스크립트 부적합**: 자동화 스크립트에는 어려움
- ✅ **쓰기 권한**: Google Sheets 쓰기 가능

### **서비스 계정** (권장)
- ✅ **서버 스크립트 완벽**: 자동화에 최적
- ✅ **쓰기 권한**: Google Sheets 읽기/쓰기 모두 가능
- ✅ **자동 인증**: 토큰 자동 갱신
- ✅ **프로덕션 동일**: 로컬/프로덕션 동일하게 작동

---

## 🌐 프로덕션 서버 작동 확인

### ✅ **현재 API Key들은 모두 프로덕션에서 작동합니다!**

**이유:**
1. **API Key는 도메인 무관**: 어디서든 동일한 키 사용 가능
2. **환경 변수만 설정**: `.env.local` → 프로덕션 환경 변수로 복사
3. **네이버 블로그 자동 생성**: `app/api/generate/route.ts`에서 모든 API 사용
   - Gemini API ✅
   - Google Sheets ✅
   - Google Custom Search ✅

### 📋 프로덕션 배포 시 할 일

1. **환경 변수 설정** (Vercel, AWS 등):
   ```
   GEMINI_API_KEY=your-key
   GOOGLE_API_KEY=your-key
   GOOGLE_SHEETS_ID=your-id
   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your-id
   ```

2. **서비스 계정 추가** (Sheets 쓰기용):
   ```
   GOOGLE_SERVICE_ACCOUNT_PATH=./google-service-account.json
   ```
   또는 JSON 내용을 환경 변수로:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

---

## 🎯 결론

### 현재 구조 (API Key 기반)
- ✅ **프로덕션 완벽 작동**: 모든 API Key는 도메인 무관
- ✅ **네이버 블로그 자동 생성**: 모든 기능 정상 작동
- ⚠️ **Sheets 쓰기만 제한**: 읽기는 가능, 쓰기는 OAuth/서비스 계정 필요

### OAuth 클라이언트 ID는?
- **필요 없음**: 현재 API Key로 충분
- **Sheets 쓰기만 필요하면**: 서비스 계정 권장

### 프로덕션 배포 시
- `.env.local`의 모든 키를 프로덕션 환경 변수로 복사
- **끝!** 추가 설정 불필요

---

## 💡 요약

**질문**: OAuth 클라이언트 ID 하나로 모든 API 사용?
**답변**: 아니요. OAuth는 사용자 인증용이고, API Key는 서버 간 통신용입니다.

**질문**: 프로덕션에서도 작동?
**답변**: 네! API Key는 도메인 무관하므로 동일하게 작동합니다.

**질문**: 네이버 블로그 자동 생성도 작동?
**답변**: 네! `app/api/generate/route.ts`에서 모든 API를 사용하므로 정상 작동합니다.

