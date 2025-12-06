# Google Search 기능 설정 가이드

## 개요

블로그 생성 시 **두 가지 검색 기능**을 함께 사용합니다:

1. **Google Custom Search API**: 우리가 제어하는 명확한 검색
2. **Google Grounding**: Gemini AI가 자동으로 수행하는 추가 검색

두 기능을 함께 사용하여 더 풍부하고 정확한 정보를 제공합니다.

## 설정 방법

### 1. Google Custom Search API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스 > 라이브러리**로 이동
4. "Custom Search API" 검색 후 활성화
5. **API 및 서비스 > 사용자 인증 정보**로 이동
6. **API 키 만들기** 클릭
7. 생성된 API 키 복사

### 2. Custom Search Engine 생성

1. [Google Custom Search](https://programmablesearchengine.google.com/) 접속
2. **새 검색 엔진 추가** 클릭
3. **검색할 사이트**: `*` (전체 웹 검색)
4. **언어**: 한국어
5. **검색 엔진 이름**: 원하는 이름 입력
6. **만들기** 클릭
7. 생성된 **검색 엔진 ID** 복사

### 3. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
# Google Custom Search API
GOOGLE_CUSTOM_SEARCH_API_KEY=your_api_key_here
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id_here
```

### 4. 서버 재시작

환경 변수를 추가한 후 Next.js 서버를 재시작하세요:

```bash
npm run dev
```

## 작동 방식

### 1단계: Google Custom Search (우리가 제어)
1. 주제와 키워드를 기반으로 **명확한 검색 쿼리** 생성
2. Google Custom Search API를 통해 최신 정보 검색
3. 검색 결과를 AI 프롬프트에 포함

### 2단계: Google Grounding (AI가 자동)
1. Gemini 모델이 **추가로 필요한 정보**를 자동으로 웹 검색
2. 우리가 놓친 최신 정보나 관련 정보를 자동으로 찾아서 사용
3. 출처를 자동으로 포함

### 결과
- **이중 검색**: 우리가 제어하는 검색 + AI가 자동으로 하는 검색
- **더 풍부한 정보**: 두 가지 검색 결과를 모두 활용
- **더 정확한 출처**: Custom Search 출처 + Grounding 출처

## 검색 쿼리

시스템은 다음 조합으로 검색을 수행합니다:
- `{주제} {키워드}`
- `{주제} 통계`
- `{주제} 최신 정보`
- `{키워드} 보험료 비교`

## API 제한

- Google Custom Search API는 무료 티어에서 **일일 100회** 검색 제한이 있습니다.
- 유료 플랜은 [Google Cloud Pricing](https://cloud.google.com/custom-search/pricing)을 참조하세요.

## 문제 해결

### Google Custom Search API 키 오류
- API 키가 올바르게 설정되었는지 확인
- Custom Search API가 활성화되었는지 확인

### 검색 결과가 없음
- 검색 엔진 ID가 올바른지 확인
- 검색 쿼리가 너무 구체적이지 않은지 확인

### Google Grounding이 작동하지 않음
- Gemini API가 Grounding 기능을 지원하는지 확인
- API 키가 올바른지 확인
- Grounding이 지원되지 않는 경우, Google Custom Search만 사용됩니다 (경고 메시지 표시)

### 검색 결과가 부정확함
- 검색 엔진 설정에서 언어를 한국어로 설정했는지 확인
- 검색 쿼리 조합을 조정할 수 있습니다 (`lib/google-search.ts`의 `searchInsuranceTopics` 함수)

## 참고

- **Google Custom Search**: 별도 API 키 필요 (무료 티어: 일일 100회)
- **Google Grounding**: Gemini API 키만 있으면 됨 (별도 비용 없음)
- 두 기능을 함께 사용하면 더 풍부한 정보를 얻을 수 있습니다

