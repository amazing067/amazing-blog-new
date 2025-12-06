# Google Custom Search API 키 발급 가이드

## 📋 필요한 것

1. **Google Custom Search API 키** (Google Cloud Console에서 발급)
2. **Custom Search Engine ID** (Google Custom Search에서 생성)

---

## 1단계: Google Custom Search API 활성화

### 1. Google Cloud Console 접속
👉 [https://console.cloud.google.com/](https://console.cloud.google.com/)

### 2. 프로젝트 선택 또는 생성
- 기존 프로젝트가 있으면 선택
- 없으면 **"프로젝트 만들기"** 클릭하여 새 프로젝트 생성

### 3. Custom Search API 활성화
1. 왼쪽 메뉴에서 **"API 및 서비스"** → **"라이브러리"** 클릭
2. 검색창에 **"Custom Search API"** 입력
3. **"Custom Search API"** 클릭
4. **"사용 설정"** 버튼 클릭

### 4. API 키 생성
1. 왼쪽 메뉴에서 **"API 및 서비스"** → **"사용자 인증 정보"** 클릭
2. 상단의 **"+ 사용자 인증 정보 만들기"** 클릭
3. **"API 키"** 선택
4. 생성된 API 키 복사 ⚠️ **이 키를 안전하게 보관하세요!**

### 5. API 키 제한 설정 (보안 권장)
1. 생성된 API 키 옆의 **연필 아이콘(편집)** 클릭
2. **"API 제한사항"** 섹션에서:
   - **"키 제한"** 선택
   - **"API 선택"** 클릭
   - **"Custom Search API"** 체크
   - **"저장"** 클릭

---

## 2단계: Custom Search Engine 생성

### 1. Google Custom Search 접속
👉 [https://programmablesearchengine.google.com/](https://programmablesearchengine.google.com/)

### 2. 새 검색 엔진 추가
1. **"새 검색 엔진 추가"** 또는 **"Add"** 버튼 클릭

### 3. 검색 엔진 설정
- **"검색할 사이트"**: `*` (별표 하나만 입력 = 전체 웹 검색)
- **"언어"**: 한국어 선택
- **"검색 엔진 이름"**: 원하는 이름 입력 (예: "보험 블로그 검색")

### 4. 검색 엔진 만들기
- **"만들기"** 또는 **"Create"** 버튼 클릭

### 5. 검색 엔진 ID 확인
1. 생성된 검색 엔진을 클릭하여 상세 페이지로 이동
2. **"설정"** 또는 **"Setup"** 탭 클릭
3. **"검색 엔진 ID"** 또는 **"Search engine ID"** 복사
   - 형식: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx:xxxxxx`

---

## 3단계: 환경 변수 설정

`.env.local` 파일에 다음을 추가하세요:

```env
# 기존 Gemini API 키
GEMINI_API_KEY=your_gemini_api_key_here

# Google Custom Search API 키 (1단계에서 발급)
GOOGLE_CUSTOM_SEARCH_API_KEY=your_custom_search_api_key_here

# Custom Search Engine ID (2단계에서 생성)
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id_here
```

---

## 4단계: 서버 재시작

환경 변수를 추가한 후 Next.js 서버를 재시작하세요:

```bash
# 터미널에서 Ctrl+C로 서버 중지 후
npm run dev
```

---

## ✅ 확인 방법

블로그 생성 시 콘솔에 다음과 같은 로그가 나타나면 정상 작동입니다:

```
Google Custom Search 시작...
검색 결과: X개 발견
```

---

## 💡 참고사항

### API 제한
- **무료 티어**: 일일 100회 검색
- **유료 플랜**: [Google Cloud Pricing](https://cloud.google.com/custom-search/pricing) 참조

### 검색 범위 제한 (선택사항)
특정 사이트만 검색하고 싶다면:
- 검색 엔진 설정에서 **"검색할 사이트"**에 도메인 입력
- 예: `cancer.go.kr`, `hira.or.kr` (여러 개는 쉼표로 구분)

### 문제 해결

**API 키 오류가 발생하는 경우:**
1. API 키가 올바르게 복사되었는지 확인
2. Custom Search API가 활성화되었는지 확인
3. API 키 제한 설정에서 Custom Search API가 허용되었는지 확인

**검색 결과가 없는 경우:**
1. 검색 엔진 ID가 올바른지 확인
2. 검색 엔진이 활성화되어 있는지 확인
3. 검색 쿼리가 너무 구체적이지 않은지 확인

---

## 📚 추가 리소스

- [Google Custom Search API 문서](https://developers.google.com/custom-search/v1/overview)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Custom Search Engine](https://programmablesearchengine.google.com/)

