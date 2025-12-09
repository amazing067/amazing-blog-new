# Supabase 스키마 설정 가이드

## 📋 스키마 파일 목록

| 파일명 | 목적 | 실행 순서 |
|--------|------|----------|
| `supabase-schema-profiles.sql` | **profiles 테이블 생성** (기본 회원 정보) | **1단계** ⭐ |
| `supabase-schema.sql` | blog_posts 테이블 생성 (블로그 글 저장) | 2단계 |
| `supabase-schema-membership.sql` | profiles 테이블에 회원 관리 필드 추가 | 3단계 |
| `supabase-schema-usage.sql` | usage_logs, qa_sets 테이블 생성 | 4단계 |
| `supabase-schema-profiles-rls.sql` | profiles 테이블 RLS 정책 설정 (보안) | 5단계 |

## ⚠️ 중요: 실행 순서

**반드시 아래 순서대로 실행하세요!** 각 테이블이 이전 테이블을 참조합니다.

### 1단계: profiles 테이블 생성 (가장 먼저!)
**파일**: `supabase-schema-profiles.sql`
- `profiles` 테이블 생성 (회원 기본 정보)
- 인덱스 생성
- RLS 활성화 (정책은 5단계에서 설정)

### 2단계: blog_posts 테이블 생성
**파일**: `supabase-schema.sql`
- `blog_posts` 테이블 생성 (블로그 글 저장)
- RLS 정책 설정
- 인덱스 생성

### 3단계: 회원 관리 필드 추가
**파일**: `supabase-schema-membership.sql`
- `profiles` 테이블에 회원 관리 필드 추가
  - `membership_status` (active, pending, suspended, deleted)
  - `paid_until`, `suspended_at`, `deleted_at`
  - `last_payment_at`, `grace_period_until`, `payment_note`
- 인덱스 생성
- 관리 함수 생성 (`activate_membership`, `update_membership_status`)

### 4단계: 사용량 로그 및 Q&A 저장
**파일**: `supabase-schema-usage.sql`
- `usage_logs` 테이블 생성 (토큰 사용량 로그)
- `qa_sets` 테이블 생성 (Q&A 세트 저장)
- RLS 정책 설정
- `get_user_stats()` 함수 생성 (관리자 통계용)

### 5단계: profiles 테이블 RLS 정책 설정 (보안 강화)
**파일**: `supabase-schema-profiles-rls.sql`
- `profiles` 테이블 RLS 정책 설정
- 사용자/관리자 정책 설정
- **중요**: UNRESTRICTED 상태를 해제하여 보안 강화

## 실행 방법 (단계별)

### Supabase SQL Editor 접속
1. Supabase 대시보드 접속
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. 우측 상단 **+ New query** 버튼 클릭 (또는 **+** 버튼)

### 1단계: profiles 테이블 생성 (가장 먼저!)

1. **파일 열기**: `supabase-schema-profiles.sql` 파일을 에디터에서 열기
2. **전체 복사**: 파일 내용 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)
   - 첫 줄 `-- ⭐ 1단계...`부터 마지막 줄까지 **전체** 복사
3. **SQL Editor에 붙여넣기**: Supabase SQL Editor의 빈 쿼리 창에 붙여넣기 (Ctrl+V)
4. **실행**: 우측 하단 **RUN** 버튼 클릭 (또는 Ctrl+Enter)
5. **확인**: "Success. No rows returned" 메시지 확인

### 2단계: blog_posts 테이블 생성

1. **파일 열기**: `supabase-schema.sql` 파일을 에디터에서 열기
2. **전체 복사**: 파일 내용 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)
   - 첫 줄 `-- ⭐ 2단계...`부터 마지막 줄까지 **전체** 복사
3. **새 쿼리 생성**: SQL Editor에서 **+ New query** 클릭
4. **붙여넣기**: 새 쿼리 창에 붙여넣기 (Ctrl+V)
5. **실행**: **RUN** 버튼 클릭
6. **확인**: "Success. No rows returned" 메시지 확인

### 3단계: 회원 관리 필드 추가

1. **파일 열기**: `supabase-schema-membership.sql` 파일을 에디터에서 열기
2. **전체 복사**: 파일 내용 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)
   - 첫 줄 `-- ⭐ 3단계...`부터 마지막 줄까지 **전체** 복사
3. **새 쿼리 생성**: SQL Editor에서 **+ New query** 클릭
4. **붙여넣기**: 새 쿼리 창에 붙여넣기 (Ctrl+V)
5. **실행**: **RUN** 버튼 클릭
6. **확인**: "Success. No rows returned" 메시지 확인

### 4단계: 사용량 로그 및 Q&A 저장

1. **파일 열기**: `supabase-schema-usage.sql` 파일을 에디터에서 열기
2. **전체 복사**: 파일 내용 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)
   - 첫 줄 `-- ⭐ 4단계...`부터 마지막 줄까지 **전체** 복사
3. **새 쿼리 생성**: SQL Editor에서 **+ New query** 클릭
4. **붙여넣기**: 새 쿼리 창에 붙여넣기 (Ctrl+V)
5. **실행**: **RUN** 버튼 클릭
6. **확인**: "Success. No rows returned" 메시지 확인

### 5단계: profiles 테이블 RLS 정책 설정 (보안 강화)

1. **파일 열기**: `supabase-schema-profiles-rls.sql` 파일을 에디터에서 열기
2. **전체 복사**: 파일 내용 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)
   - 첫 줄 `-- ⭐ 5단계...`부터 마지막 줄까지 **전체** 복사
3. **새 쿼리 생성**: SQL Editor에서 **+ New query** 클릭
4. **붙여넣기**: 새 쿼리 창에 붙여넣기 (Ctrl+V)
5. **경고 확인**: DROP POLICY 문으로 인해 경고가 표시될 수 있습니다
6. **실행**: **"Run this query"** 버튼 클릭 (경고 무시하고 실행)
7. **확인**: "Success. No rows returned" 메시지 확인
8. **테이블 목록 새로고침**: `profiles` 테이블에서 **UNRESTRICTED** 레이블이 사라졌는지 확인

## ⚠️ 중요 사항

- **각 파일의 전체 내용을 복사**해야 합니다 (주석 포함)
- **반드시 순서대로 실행**해야 합니다 (1단계 → 2단계 → 3단계 → 4단계 → 5단계)
- 각 단계마다 **새 쿼리 창**을 만들어서 실행하는 것을 권장합니다
- 에러가 발생하면 에러 메시지를 확인하고, 이미 생성된 테이블/정책이 있는지 확인하세요
- 5단계에서 경고가 표시되면 정상입니다. "Run this query" 버튼을 클릭하여 실행하세요

## ✅ 확인 사항

실행 후 다음 테이블이 생성되었는지 확인:

### 테이블 목록
- ✅ `profiles` (회원 기본 정보, 회원 관리 필드 포함, RLS 활성화됨)
- ✅ `blog_posts` (RLS 활성화됨)
- ✅ `usage_logs` (RLS 활성화됨)
- ✅ `qa_sets` (RLS 활성화됨)

### 보안 확인
- ✅ `profiles` 테이블에서 **UNRESTRICTED** 레이블이 사라졌는지 확인
- ✅ 모든 테이블에 RLS가 활성화되어 있는지 확인

### 함수 확인
- ✅ `activate_membership()` 함수 생성 확인
- ✅ `update_membership_status()` 함수 생성 확인
- ✅ `get_user_stats()` 함수 생성 확인

## 주의사항

- 각 파일은 여러 번 실행해도 안전합니다 (IF NOT EXISTS 사용)
- RLS 정책은 중복 생성 방지 로직 포함
- `get_user_stats()` 함수는 덮어쓰기됩니다 (CREATE OR REPLACE)

