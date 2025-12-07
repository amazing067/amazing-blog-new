# Vercel 환경 변수 체크리스트

## ✅ 현재 Vercel에 설정된 환경 변수 (5개)

1. `GEMINI_API_KEY` - Gemini AI API 키
2. `GOOGLE_API_KEY` - Google API 키 (Sheets, Custom Search 공용)
3. `GOOGLE_SHEETS_ID` - Google Sheets 파일 ID
4. `NEXT_PUBLIC_SUPABASE_URL` - Supabase 프로젝트 URL
5. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key

## ❌ 누락된 필수 환경 변수

### `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`
- **용도**: Google Custom Search 엔진 ID
- **사용 위치**: `lib/google-search.ts`
- **중요도**: ⚠️ **필수** (블로그 생성 시 실시간 검색 기능 사용)
- **없으면**: Google Custom Search가 작동하지 않아 블로그 생성 시 최신 정보 검색이 실패합니다.

## 📋 Vercel에 추가해야 할 환경 변수

### 1. GOOGLE_CUSTOM_SEARCH_ENGINE_ID
```
이름: GOOGLE_CUSTOM_SEARCH_ENGINE_ID
값: [로컬 .env.local에서 복사]
환경: Production, Preview, Development 모두 체크
```

## 🔍 확인 방법

로컬 `.env.local` 파일에서 다음 변수를 확인하세요:
```env
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your-search-engine-id
```

이 값을 Vercel 환경 변수에 추가하면 됩니다.

## 📝 참고

- `GOOGLE_CUSTOM_SEARCH_API_KEY`는 **선택사항**입니다. 
- 현재 코드 로직: `GOOGLE_CUSTOM_SEARCH_API_KEY`가 있으면 사용, 없으면 `GOOGLE_API_KEY` 사용
- Vercel에 이미 `GOOGLE_API_KEY`가 있으므로, `GOOGLE_CUSTOM_SEARCH_API_KEY`는 **추가하지 않아도 됩니다**.

## ✅ 최종 확인 사항

### 필수 환경 변수 (Vercel에 반드시 있어야 함)
1. ✅ `GEMINI_API_KEY` - 있음
2. ✅ `GOOGLE_API_KEY` - 있음 (Custom Search에도 사용됨)
3. ✅ `GOOGLE_SHEETS_ID` - 있음
4. ✅ `NEXT_PUBLIC_SUPABASE_URL` - 있음
5. ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 있음
6. ❌ `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` - **추가 필요!** (값: `e291b6146227a478d`)

### 선택사항 (없어도 됨)
- `GOOGLE_CUSTOM_SEARCH_API_KEY` - `GOOGLE_API_KEY`로 대체 가능

## 🔍 메인 서버 작동 확인 방법

### 1. Vercel 로그 확인
1. Vercel 대시보드 → 프로젝트 선택
2. **Deployments** 탭 → 최신 배포 클릭
3. **Functions** 탭 → `/api/generate` 또는 `/api/generate-qa` 로그 확인
4. 다음 로그가 보이면 정상:
   ```
   🔍 Google Custom Search 환경 변수 확인: {
     hasGoogleApiKey: true,
     hasSearchEngineId: true,
     ...
   }
   ✅ Google Custom Search 완료: { resultCount: 3, success: true }
   ```

### 2. 블로그 생성 테스트
1. 메인 서버에서 블로그 생성 시도
2. 생성된 블로그에 "실시간 검색 결과" 섹션이 있는지 확인
3. 출처 링크가 포함되어 있는지 확인

### 3. 에러 확인
만약 다음 에러가 보이면 환경 변수가 누락된 것입니다:
```
❌ Google Custom Search API 키 또는 검색 엔진 ID가 설정되지 않았습니다.
   GOOGLE_CUSTOM_SEARCH_ENGINE_ID를 설정해주세요.
```

