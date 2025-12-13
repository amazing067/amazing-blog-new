# Vercel 환경 변수 설정 가이드

## 필수 환경 변수

Vercel 대시보드에서 다음 환경 변수를 설정해야 합니다:

### 1. Supabase 관련 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**중요 사항:**
- 환경 변수 이름은 정확히 `SUPABASE_SERVICE_ROLE_KEY`로 설정해야 합니다 (대소문자 구분)
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드에서만 사용되므로 `NEXT_PUBLIC_` 접두사가 없습니다
- 환경 변수 값에는 공백이나 줄바꿈이 없어야 합니다

### 2. Vercel에서 환경 변수 설정 방법

1. Vercel 대시보드 → 프로젝트 선택
2. Settings → Environment Variables
3. 다음 변수들을 추가:
   - `NEXT_PUBLIC_SUPABASE_URL` (Production, Preview, Development 모두)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, Development 모두)
   - `SUPABASE_SERVICE_ROLE_KEY` (Production, Preview, Development 모두)

### 3. 환경 변수 설정 후

**중요:** 환경 변수를 추가하거나 수정한 후에는 **반드시 재배포**해야 합니다.

1. Vercel 대시보드 → Deployments
2. 최신 배포의 "..." 메뉴 → "Redeploy" 클릭
3. 또는 Git에 커밋/푸시하여 자동 재배포

### 4. 환경 변수 확인

배포 후 Vercel Functions 로그에서 다음 메시지를 확인할 수 있습니다:

```
[API] SERVICE_ROLE_KEY 존재 여부: true
[API] SERVICE_ROLE_KEY 원본 길이: [숫자]
[API] SERVICE_ROLE_KEY 정리 후 시작: eyJ...
```

만약 `SERVICE_ROLE_KEY 존재 여부: false`가 나온다면:
- 환경 변수 이름이 정확한지 확인
- 환경 변수가 Production/Preview/Development에 모두 설정되었는지 확인
- 재배포를 했는지 확인

### 5. 문제 해결

#### 환경 변수가 적용되지 않는 경우:
1. 환경 변수 이름 확인 (대소문자 정확히 일치)
2. 재배포 확인
3. Vercel Functions 로그 확인
4. `.env.local` 파일과 Vercel 환경 변수가 일치하는지 확인

#### 빌드 오류가 발생하는 경우:
1. 개발 서버 재시작: `npm run dev`
2. `.next` 폴더 삭제 후 재빌드: `rm -rf .next && npm run build`
3. Vercel에서도 재배포

