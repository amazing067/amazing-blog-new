# Gemini API 키 발급 계정 확인 방법

## Gemini API 키는 어디서 발급받나요?

Gemini API 키는 **Google AI Studio**에서 발급받습니다:
👉 [https://aistudio.google.com/](https://aistudio.google.com/)

## 현재 사용 중인 Gemini API 키 확인

`.env.local` 파일에서:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 발급 계정 확인 방법

### 방법 1: Google AI Studio에서 확인
1. [Google AI Studio](https://aistudio.google.com/) 접속
2. 로그인된 계정 확인 (우측 상단 프로필 아이콘)
3. "Get API Key" 클릭
4. 생성된 API 키 목록 확인
5. 현재 사용 중인 API 키가 목록에 있는지 확인

### 방법 2: API 키 자체로는 계정 확인 불가
- API 키 자체에는 계정 정보가 포함되어 있지 않습니다
- Google AI Studio에 로그인해서 확인해야 합니다

## 다른 계정의 키를 사용 중인 경우

만약 현재 Gemini API 키가 다른 계정에서 발급받은 것이라면:

1. **통합하려는 계정으로 Google AI Studio 로그인**
2. **"Get API Key" 클릭**
3. **새 키 생성 또는 기존 키 확인**
4. **`.env.local` 업데이트**

## 참고

- Gemini API 키는 Google Cloud Console이 아닌 Google AI Studio에서 발급
- Google AI Studio 계정 = Google 계정 (같은 계정 사용)
- 여러 계정이 있다면 각 계정의 Google AI Studio에서 키를 확인할 수 있습니다

