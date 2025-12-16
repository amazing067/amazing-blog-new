# 프로덕션 서버 API 키 업데이트 가이드

**작성일**: 2024-12-16  
**목적**: Vercel 프로덕션 서버에 새로운 GCP 통합 프로젝트의 API 키 반영

---

## 📋 현재 상황

- 로컬 환경: `.env.local`에 새로운 API 키 설정 완료 ✅
- 프로덕션 서버: 아직 이전 API 키 사용 중 ❌
- 문제: 프로덕션 서버가 작동하지 않음

---

## 🔧 해결 방법: Vercel 환경 변수 업데이트

### 1. Vercel 대시보드 접속

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. 프로젝트 선택 (`amazing-biz-blog` 또는 해당 프로젝트)

### 2. 환경 변수 설정 페이지로 이동

1. 프로젝트 대시보드에서 **Settings** 클릭
2. 왼쪽 메뉴에서 **Environment Variables** 클릭

### 3. 필요한 환경 변수 확인 및 업데이트

로컬 `.env.local` 파일에서 다음 변수들을 확인하세요:

```env
# Gemini API 키 (새로운 통합 프로젝트)
GEMINI_API_KEY=AIzaSy...

# Google API 키 (새로운 통합 프로젝트)
GOOGLE_API_KEY=AIzaSy...

# Google Custom Search Engine ID (기존 것 재사용 가능)
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=e291b6146227a478d

# Supabase (변경 없음)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Google Sheets (변경 없음)
GOOGLE_SHEETS_ID=...
```

### 4. Vercel에 환경 변수 추가/수정

#### 4-1. GEMINI_API_KEY 업데이트

1. **기존 키가 있으면**:
   - `GEMINI_API_KEY` 찾기
   - **Edit** 클릭
   - 새로운 키 값 입력 (로컬 `.env.local`에서 복사)
   - **Save** 클릭

2. **기존 키가 없으면**:
   - **Add New** 클릭
   - Key: `GEMINI_API_KEY`
   - Value: 새로운 키 값 (로컬 `.env.local`에서 복사)
   - Environment: **Production, Preview, Development 모두 체크** ✅
   - **Save** 클릭

#### 4-2. GOOGLE_API_KEY 업데이트

1. **기존 키가 있으면**:
   - `GOOGLE_API_KEY` 찾기
   - **Edit** 클릭
   - 새로운 키 값 입력 (로컬 `.env.local`에서 복사)
   - **Save** 클릭

2. **기존 키가 없으면**:
   - **Add New** 클릭
   - Key: `GOOGLE_API_KEY`
   - Value: 새로운 키 값 (로컬 `.env.local`에서 복사)
   - Environment: **Production, Preview, Development 모두 체크** ✅
   - **Save** 클릭

#### 4-3. GOOGLE_CUSTOM_SEARCH_ENGINE_ID 확인

- 기존 값이 `e291b6146227a478d`인지 확인
- 없으면 추가 (기존 커스텀 서치 엔진 재사용)

### 5. 재배포 트리거

환경 변수를 변경한 후:

#### 방법 1: 자동 재배포 (권장)
- Vercel이 자동으로 재배포를 시작할 수 있습니다
- **Deployments** 탭에서 새 배포가 시작되는지 확인

#### 방법 2: 수동 재배포
1. **Deployments** 탭으로 이동
2. 최신 배포 옆 **"..."** 메뉴 클릭
3. **Redeploy** 선택
4. **Redeploy** 버튼 클릭

### 6. 배포 완료 대기

1. **Deployments** 탭에서 배포 상태 확인
2. 상태가 **"Ready"**가 될 때까지 대기 (보통 2-5분)
3. 배포 완료 후 **1-2분 추가 대기** (환경 변수 적용 시간)

---

## ✅ 확인 방법

### 1. Vercel 로그 확인

1. **Deployments** 탭 → 최신 배포 클릭
2. **Functions** 탭 클릭
3. `/api/generate-qa` 또는 `/api/generate` 로그 확인
4. 다음 로그가 보이면 정상:
   ```
   Gemini API 키 확인: AIzaSyCqes...92Kk (길이: 39)
   환경: production
   ```

### 2. 실제 테스트

1. 프로덕션 서버에서 Q&A 생성 시도
2. 정상 작동하는지 확인
3. 에러가 없으면 성공! ✅

---

## 🔍 문제 해결

### 문제 1: 여전히 이전 API 키 사용 중

**원인**: 재배포가 완료되지 않았거나, 환경 변수가 제대로 저장되지 않음

**해결**:
1. Vercel 환경 변수 페이지에서 키 값 다시 확인
2. 수동으로 **Redeploy** 실행
3. 배포 완료 후 2-3분 대기

### 문제 2: API 할당량 초과 에러

**원인**: 새로운 프로젝트의 할당량 설정이 아직 완료되지 않음

**해결**:
1. Google Cloud Console에서 할당량 확인
2. 필요시 할당량 증가 요청
3. 또는 폴백 로직이 작동하는지 확인 (gemini-2.0-flash로 자동 전환)

### 문제 3: 환경 변수가 적용되지 않음

**원인**: 환경 변수 저장 시 Environment 선택이 잘못됨

**해결**:
1. 환경 변수 편집
2. **Production, Preview, Development 모두 체크** 확인
3. 저장 후 재배포

---

## 📝 체크리스트

- [ ] 로컬 `.env.local`에서 새로운 API 키 확인
- [ ] Vercel 대시보드 접속
- [ ] Settings → Environment Variables 이동
- [ ] `GEMINI_API_KEY` 업데이트 (새로운 키로)
- [ ] `GOOGLE_API_KEY` 업데이트 (새로운 키로)
- [ ] `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` 확인 (기존 값 유지)
- [ ] Environment: Production, Preview, Development 모두 체크
- [ ] 저장 완료
- [ ] Deployments 탭에서 재배포 확인
- [ ] 배포 완료 대기 (Ready 상태)
- [ ] 1-2분 추가 대기
- [ ] 프로덕션 서버에서 테스트
- [ ] Vercel 로그에서 정상 작동 확인

---

## 🎯 빠른 참조

### Vercel 환경 변수 설정 위치
```
Vercel 대시보드 → 프로젝트 선택 → Settings → Environment Variables
```

### 필수 환경 변수 목록
1. `GEMINI_API_KEY` - Gemini AI API 키 (새로운 통합 프로젝트)
2. `GOOGLE_API_KEY` - Google API 키 (새로운 통합 프로젝트)
3. `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` - Custom Search Engine ID (기존 값)
4. `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL (변경 없음)
5. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key (변경 없음)
6. `GOOGLE_SHEETS_ID` - Google Sheets ID (변경 없음)

---

**작성자**: AI Assistant  
**상태**: 가이드 완료 ✅

