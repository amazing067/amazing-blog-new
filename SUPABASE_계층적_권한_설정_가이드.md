# Supabase 계층적 권한 설정 가이드

## 📋 실행 순서

Supabase SQL Editor에서 다음 순서대로 실행하세요:

### 1단계: 본부/팀 필드 추가

**파일**: `supabase-schema-department-team.sql`

1. Supabase Dashboard → SQL Editor → New Query
2. `supabase-schema-department-team.sql` 파일 내용 전체 복사
3. 붙여넣기 후 **RUN** 클릭
4. ✅ 성공 메시지 확인

**주요 내용**:
- `profiles` 테이블에 `department_id`, `department_name`, `team_id`, `team_name` 필드 추가
- 인덱스 생성
- 주석 추가

---

### 2단계: RLS 정책 설정

**파일**: `supabase-schema-rls-hierarchy.sql`

1. Supabase Dashboard → SQL Editor → New Query
2. `supabase-schema-rls-hierarchy.sql` 파일 내용 전체 복사
3. 붙여넣기 후 **RUN** 클릭
4. ✅ 성공 메시지 확인

**주요 내용**:
- `blog_posts` 테이블: 본부장/팀장 조회 권한 추가
- `qa_sets` 테이블: 본부장/팀장 조회 권한 추가
- `usage_logs` 테이블: 관리자만 토큰 조회 가능
- `profiles` 테이블: 본부장/팀장 프로필 조회 권한 추가

---

## 🔍 실행 후 확인 사항

### 1. 필드 추가 확인

```sql
-- profiles 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

다음 필드가 있어야 합니다:
- `department_id` (TEXT)
- `department_name` (TEXT)
- `team_id` (TEXT)
- `team_name` (TEXT)

### 2. 인덱스 확인

```sql
-- 인덱스 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
AND indexname LIKE '%department%' OR indexname LIKE '%team%' OR indexname LIKE '%role%';
```

다음 인덱스가 있어야 합니다:
- `profiles_department_id_idx`
- `profiles_team_id_idx`
- `profiles_role_idx`

### 3. RLS 정책 확인

```sql
-- blog_posts RLS 정책 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'blog_posts'
AND policyname LIKE '%Department%' OR policyname LIKE '%Team%';

-- qa_sets RLS 정책 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'qa_sets'
AND policyname LIKE '%Department%' OR policyname LIKE '%Team%';

-- usage_logs RLS 정책 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'usage_logs';
```

---

## 📝 기존 사용자 설정 방법

### 방법 1: 관리자 화면에서 수동 설정 (권장)

1. 관리자 로그인
2. `/admin/users` 페이지 접속
3. 각 사용자의 본부/팀 정보 수동 설정
4. 역할 변경 (FC → 팀장 → 본부장)

### 방법 2: SQL로 일괄 설정

```sql
-- 예시: 모든 사용자를 서울본부 1팀으로 설정
UPDATE profiles
SET 
  department_id = 'seoul',
  department_name = '서울본부',
  team_id = 'seoul-team1',
  team_name = '서울본부 1팀'
WHERE department_id IS NULL;

-- 특정 사용자를 본부장으로 설정
UPDATE profiles
SET 
  role = 'department_head',
  department_id = 'seoul',
  department_name = '서울본부',
  team_id = NULL,  -- 본부장은 팀이 없을 수 있음
  team_name = NULL
WHERE username = '본부장아이디';

-- 특정 사용자를 팀장으로 설정
UPDATE profiles
SET 
  role = 'team_leader',
  department_id = 'seoul',
  department_name = '서울본부',
  team_id = 'seoul-team1',
  team_name = '서울본부 1팀'
WHERE username = '팀장아이디';
```

---

## ⚠️ 주의사항

### 1. 본부장 설정 시
- `department_id`는 필수
- `team_id`는 NULL 가능 (본부 전체 관리)

### 2. 팀장 설정 시
- `department_id` 필수
- `team_id` 필수 (같은 팀의 FC 관리)

### 3. FC 설정 시
- `department_id` 필수
- `team_id` 필수 (어느 팀 소속인지 명확히)

### 4. 역할 변경 시
- 관리자만 역할 변경 가능
- 역할 변경 시 본부/팀 정보도 함께 확인 필요

---

## 🧪 테스트 쿼리

### 본부장이 같은 본부 사용자 조회

```sql
-- 본부장의 본부 ID 확인
SELECT id, username, role, department_id, department_name
FROM profiles
WHERE role = 'department_head'
LIMIT 1;

-- 같은 본부의 모든 사용자 조회 (본부장 관점)
SELECT id, username, full_name, role, team_name
FROM profiles
WHERE department_id = 'seoul'  -- 본부장의 본부 ID
AND role != 'admin';
```

### 팀장이 같은 팀 사용자 조회

```sql
-- 팀장의 팀 ID 확인
SELECT id, username, role, team_id, team_name
FROM profiles
WHERE role = 'team_leader'
LIMIT 1;

-- 같은 팀의 모든 사용자 조회 (팀장 관점)
SELECT id, username, full_name, role
FROM profiles
WHERE team_id = 'seoul-team1'  -- 팀장의 팀 ID
AND role != 'admin';
```

---

## 📞 문제 해결

### 문제 1: RLS 정책이 작동하지 않음

**해결**:
1. RLS가 활성화되어 있는지 확인
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('profiles', 'blog_posts', 'qa_sets', 'usage_logs');
```

2. 정책이 올바르게 생성되었는지 확인
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

### 문제 2: 본부장이 다른 본부 사용자를 볼 수 있음

**해결**:
- `department_id`가 정확히 일치하는지 확인
- RLS 정책이 올바르게 적용되었는지 확인

### 문제 3: 토큰 정보가 본부장/팀장에게 보임

**해결**:
- `usage_logs` 테이블의 RLS 정책 확인
- 관리자만 조회 가능하도록 설정되어 있는지 확인

---

## ✅ 완료 체크리스트

- [ ] `supabase-schema-department-team.sql` 실행 완료
- [ ] `supabase-schema-rls-hierarchy.sql` 실행 완료
- [ ] 필드 추가 확인 완료
- [ ] 인덱스 생성 확인 완료
- [ ] RLS 정책 확인 완료
- [ ] 기존 사용자 본부/팀 정보 설정 완료
- [ ] 본부장/팀장 역할 지정 완료
- [ ] 테스트 쿼리 실행 완료

---

## 🚀 다음 단계

SQL 스키마 설정이 완료되면:
1. 회원가입 화면에 본부/팀 선택 추가
2. 관리자 회원 관리 화면 수정
3. 통계 화면 역할별 분리
4. API 엔드포인트 구현

