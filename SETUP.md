# 어메이징사업부 - 보험 영업 지원 플랫폼

## 환경 설정

### 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. Supabase 데이터베이스 설정

Supabase 프로젝트의 SQL Editor에서 다음 쿼리를 실행하세요:

```sql
-- profiles 테이블 생성
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLS (Row Level Security) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 정책 생성: 사용자는 자신의 프로필만 볼 수 있음
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- 정책 생성: 회원가입 시 프로필 생성 가능
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 정책 생성: 사용자는 자신의 프로필을 수정할 수 있음
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX profiles_username_idx ON profiles(username);
CREATE INDEX profiles_email_idx ON profiles(email);
```

### 3. Supabase RLS(Row Level Security) 정책 추가

관리자가 모든 프로필을 조회하고 수정할 수 있도록 추가 정책을 설정합니다:

```sql
-- 정책 생성: 관리자는 모든 프로필을 볼 수 있음
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 정책 생성: 관리자는 모든 프로필을 수정할 수 있음
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
```

### 4. 첫 관리자 계정 생성

1. 일반 회원가입 프로세스를 통해 계정을 생성합니다.
2. Supabase Dashboard의 Table Editor에서 해당 계정의 `role`을 `'admin'`으로, `is_approved`를 `true`로 변경합니다.
3. 이제 해당 계정으로 로그인하면 관리자 대시보드(/admin/dashboard)로 이동합니다.

### 5. 개발 서버 실행

```bash
npm install
npm run dev
```

## 주요 기능

### 회원가입 (/signup)
- 아이디 중복확인 기능
- 실시간 유효성 검사
- 관리자 승인 대기 시스템
- Supabase Auth와 profiles 테이블에 동시 저장

### 로그인 (/login)
- 아이디(username)로 로그인
- 관리자 승인 확인
- 역할 기반 리다이렉트 (admin/user)

### 사용자 대시보드 (/dashboard)
- 인증된 사용자만 접근 가능
- 사용자 정보 표시
- 빠른 메뉴 제공
- 로그아웃 기능

### 관리자 대시보드 (/admin/dashboard)
- 관리자 권한 사용자만 접근 가능
- 승인 대기 중인 사용자 목록 조회
- 사용자 승인 기능
- 승인된 사용자 목록 관리

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth/DB**: Supabase (SSR Auth)
- **Icons**: Lucide React

## 디렉토리 구조

```
amazing-biz-blog/
├── app/
│   ├── admin/
│   │   └── dashboard/          # 관리자 대시보드
│   │       ├── ApprovalButton.tsx
│   │       └── page.tsx
│   ├── api/
│   │   └── auth/
│   │       └── signout/        # 로그아웃 API
│   │           └── route.ts
│   ├── dashboard/              # 사용자 대시보드
│   │   └── page.tsx
│   ├── login/                  # 로그인 페이지
│   │   └── page.tsx
│   ├── signup/                 # 회원가입 페이지
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx                # 홈 페이지
├── lib/
│   └── supabase/
│       ├── client.ts           # 클라이언트 사이드 Supabase
│       └── server.ts           # 서버 사이드 Supabase
├── types/
│   └── database.types.ts       # 데이터베이스 타입 정의
├── middleware.ts               # 인증 미들웨어
├── README.md
└── SETUP.md
```

## 보안 고려사항

1. **환경 변수**: `.env.local` 파일은 절대 git에 커밋하지 마세요.
2. **RLS 정책**: Supabase의 Row Level Security를 반드시 활성화하세요.
3. **비밀번호**: 최소 6자 이상으로 설정되어 있으며, 필요시 더 강력한 정책으로 변경 가능합니다.
4. **관리자 권한**: 관리자 계정은 신중하게 관리하세요.

## 추가 개발 가능 기능

- [ ] 비밀번호 재설정
- [ ] 이메일 인증
- [ ] 프로필 수정
- [ ] 관리자의 사용자 역할 변경
- [ ] 사용자 검색 및 필터링
- [ ] 활동 로그
- [ ] 대시보드 통계

