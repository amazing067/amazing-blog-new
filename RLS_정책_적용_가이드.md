# RLS 정책 적용 가이드 (메인 서버)

## 문제 상황
메인 서버에서 상태 업데이트가 반영되지 않고 "RLS 정책을 확인해주세요" 오류가 발생합니다.

## 원인
1. `SERVICE_ROLE_KEY` 환경 변수가 메인 서버에 설정되지 않았거나
2. 관리자 UPDATE 정책이 Supabase에 적용되지 않았습니다.

## 해결 방법

### 방법 1: SERVICE_ROLE_KEY 설정 (권장)

**Vercel 환경 변수 설정:**
1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. 다음 변수 추가:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. Supabase Dashboard → Settings → API → Service Role Key 복사
4. Vercel에 환경 변수 추가 후 재배포

**장점:**
- RLS를 우회하므로 가장 안전하고 확실한 방법
- 관리자 정책 추가 없이도 작동

---

### 방법 2: 관리자 UPDATE 정책 추가

**Supabase SQL Editor에서 실행:**

1. Supabase Dashboard → SQL Editor → New Query
2. 아래 SQL 복사하여 실행:

```sql
-- 관리자 UPDATE 정책 추가 (무한 재귀 방지)
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND (
        (auth.users.raw_user_meta_data->>'role') = 'admin'
        OR
        (auth.users.raw_app_meta_data->>'role') = 'admin'
      )
    )
  );
```

**주의사항:**
- 이 정책이 작동하려면 관리자 사용자의 `user_metadata`에 `role: 'admin'`이 있어야 합니다.
- Supabase Dashboard → Authentication → Users → 해당 사용자 → user_metadata에 추가

---

## 확인 방법

### 1. SERVICE_ROLE_KEY 확인
```bash
# 로컬에서 확인 (메인 서버는 Vercel Dashboard에서 확인)
echo $SUPABASE_SERVICE_ROLE_KEY
```

### 2. RLS 정책 확인
Supabase Dashboard → Authentication → Policies → `profiles` 테이블
- "Admins can update all profiles" 정책이 있는지 확인

### 3. 관리자 user_metadata 확인
Supabase Dashboard → Authentication → Users → 관리자 계정
- user_metadata에 `role: 'admin'`이 있는지 확인

---

## 권장 순서

1. **먼저 방법 1 시도** (SERVICE_ROLE_KEY 설정)
   - 가장 간단하고 안전
   - 재배포 후 테스트

2. **방법 1이 안 되면 방법 2 시도** (RLS 정책 추가)
   - SQL 실행 후 관리자 user_metadata 확인
   - 테스트

---

## 트러블슈팅

### "상태 업데이트가 반영되지 않았습니다" 오류
- SERVICE_ROLE_KEY가 올바르게 설정되었는지 확인
- RLS 정책이 올바르게 적용되었는지 확인
- 관리자 계정의 user_metadata에 role이 있는지 확인

### "RLS 정책을 확인해주세요" 오류
- `supabase-schema-profiles-rls-fix.sql` 파일의 SQL을 실행했는지 확인
- 관리자 정책이 실제로 생성되었는지 Supabase Dashboard에서 확인

