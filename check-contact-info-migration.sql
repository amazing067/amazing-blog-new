-- ⭐ 연락처 정보 마이그레이션 확인 쿼리
-- 실행 방법: Supabase SQL Editor에서 + New query → 전체 복사 → RUN
-- 
-- ⚠️ 이 파일은 확인용입니다. add-contact-info-to-profiles.sql 실행 후 확인할 때 사용하세요.

-- 1. 컬럼이 추가되었는지 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'contact_info';

-- 2. 기존 데이터 확인 (contact_info가 NULL인지 확인)
SELECT id, username, full_name, contact_info 
FROM profiles 
LIMIT 5;

-- 3. 테스트: 본인의 user_id로 연락처 정보 업데이트 (선택사항)
-- ⚠️ 주의: 아래 'YOUR-USER-ID-HERE' 부분을 본인의 실제 user_id(UUID)로 변경해야 합니다!
-- user_id 확인 방법: 
--   SELECT id, username FROM profiles WHERE username = 'your-username';
/*
UPDATE profiles 
SET contact_info = '{
  "enabled": true,
  "emoji": "🐾",
  "greeting": "상담요청은 언제나 환영합니다",
  "greeting2": "편하게 문의 주세요~~",
  "kakaoOpenChat": "https://open.kakao.com/o/sunbMhxh",
  "kakao1on1": "https://open.kakao.com/o/sunbMhxh",
  "phone": "010-2255-2513"
}'::jsonb
WHERE id = 'YOUR-USER-ID-HERE';  -- ⚠️ 반드시 본인의 실제 UUID로 변경하세요!
*/
