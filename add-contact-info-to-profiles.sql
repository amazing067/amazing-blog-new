-- ⭐ 연락처 정보 컬럼 추가 마이그레이션
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 중요: 이 파일은 profiles 테이블이 이미 생성된 후에 실행해야 합니다!
-- 실행 순서: supabase-schema-profiles.sql 실행 후 → 이 파일 실행

-- 1. contact_info JSONB 컬럼 추가 (NULL 허용)
-- JSONB는 JSON 데이터를 효율적으로 저장하고 인덱싱할 수 있습니다
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT NULL;

-- 2. 컬럼에 대한 주석 추가 (문서화)
COMMENT ON COLUMN profiles.contact_info IS '연락처 정보 (Q&A 답변 하단에 표시되는 정보) - JSON 형식:
{
  "enabled": true,
  "emoji": "🐾",
  "greeting": "상담요청은 언제나 환영합니다",
  "greeting2": "편하게 문의 주세요~~",
  "kakaoOpenChat": "https://open.kakao.com/o/...",
  "kakao1on1": "https://open.kakao.com/o/...",
  "phone": "010-2255-2513"
}';

-- 3. JSONB 인덱스 추가 (성능 최적화 - 선택사항)
-- enabled 필드로 빠르게 검색할 수 있도록 인덱스 추가
CREATE INDEX IF NOT EXISTS profiles_contact_info_enabled_idx 
ON profiles USING GIN ((contact_info -> 'enabled'));

-- 4. RLS 정책 확인
-- contact_info는 profiles 테이블의 일부이므로 기존 RLS 정책이 자동으로 적용됩니다.
-- 사용자는 자신의 contact_info만 조회/수정할 수 있고,
-- 관리자는 모든 사용자의 contact_info를 조회/수정할 수 있습니다.

-- ✅ 마이그레이션 완료!
-- 이제 contact_info 컬럼이 추가되었습니다.
-- 기존 프로필의 contact_info는 NULL로 설정되어 있으며, 
-- Q&A 생성기에서 설정하면 자동으로 저장됩니다.
