# Free Trial 크레딧 제거 가이드

## 🎯 목표

Free Trial 크레딧을 제거하여 **Paid tier 할당량**을 사용할 수 있도록 설정

---

## 📋 방법 1: 크레딧 페이지에서 제거 (권장)

### Step 1: 크레딧 페이지 접속

1. **Google Cloud Console** 접속
   - https://console.cloud.google.com

2. **프로젝트 선택**
   - 상단에서 `amazing-biz-blog` 프로젝트 선택

3. **크레딧 페이지로 이동**
   - 왼쪽 메뉴: **"결제"** → **"크레딧"**
   - 또는 직접 링크: https://console.cloud.google.com/credits

### Step 2: Free Trial 크레딧 확인

1. **"발급된 크레딧" (Issued Credits)** 탭 확인
2. **활성 상태인 "Free Trial" 크레딧 확인**
   - 상태: "사용 가능" (Available)
   - 남은 비율: 94% 등

### Step 3: 크레딧 제거 (선택사항)

**참고**: 크레딧 자체를 삭제할 수는 없지만, 프로젝트에서 크레딧이 자동 적용되지 않도록 설정할 수 있습니다.

---

## 📋 방법 2: 프로젝트 결제 설정 변경 (실제 해결책)

### Step 1: 프로젝트 결제 설정 확인

1. **프로젝트 선택**
   - 상단에서 `amazing-biz-blog` 프로젝트 선택

2. **프로젝트 설정** 접속
   - 왼쪽 메뉴: **"IAM 및 관리자"** → **"설정"**
   - 또는 직접 링크: https://console.cloud.google.com/iam-admin/settings

3. **결제 계정 확인**
   - "결제 계정" 섹션 확인
   - 연결된 결제 계정 확인

### Step 2: 결제 계정 변경

1. **결제 페이지** 접속
   - https://console.cloud.google.com/billing

2. **결제 계정 목록 확인**
   - 유료 결제 계정이 있는지 확인
   - Free Trial 결제 계정이 아닌지 확인

3. **프로젝트에 유료 결제 계정 연결**
   - 프로젝트 선택
   - "결제" 메뉴 클릭
   - 유료 결제 계정 선택
   - "저장" 클릭

---

## 📋 방법 3: 크레딧 만료 대기

### 방법

1. **크레딧 페이지** 접속
   - https://console.cloud.google.com/credits

2. **Free Trial 크레딧 만료일 확인**
   - 크레딧이 만료되면 자동으로 제거됨
   - 만료 후 Paid tier 할당량 사용 가능

3. **단점**
   - 시간이 걸림
   - 만료일까지 기다려야 함

---

## 📋 방법 4: 새 프로젝트 생성 (크레딧 없이)

### Step 1: 새 프로젝트 생성

1. **프로젝트 생성** 페이지 접속
   - https://console.cloud.google.com/projectcreate

2. **프로젝트 정보 입력**
   - 프로젝트 이름: 예) `amazing-biz-blog-v2`
   - 조직: 선택 (또는 없음)

3. **프로젝트 생성**
   - "만들기" 클릭

### Step 2: 유료 결제 계정 연결

1. **프로젝트 선택**
   - 새로 만든 프로젝트 선택

2. **결제 계정 연결**
   - 프로젝트 설정 → "결제" 메뉴
   - **유료 결제 계정** 선택
   - **Free Trial 크레딧이 없는 결제 계정** 선택

3. **API 활성화**
   - Generative Language API 활성화
   - Google Custom Search API 활성화
   - Google Sheets API 활성화

4. **API 키 재발급**
   - 새 프로젝트의 API 키 생성
   - `.env.local` 업데이트
   - Vercel 환경 변수 업데이트

---

## 🎯 가장 효과적인 방법

### 방법 2: 프로젝트 결제 설정 변경 (권장)

**이유:**
- 가장 빠른 해결책
- 기존 프로젝트 유지 가능
- 즉시 Paid tier 할당량 사용 가능

**단계:**
1. 결제 페이지에서 유료 결제 계정 확인
2. 프로젝트에 유료 결제 계정 연결
3. Free Trial 크레딧이 자동 적용되지 않도록 설정

---

## ⚠️ 주의사항

### 1. 크레딧 자체는 삭제할 수 없음
- 크레딧은 만료될 때까지 남아있음
- 하지만 프로젝트에서 크레딧이 적용되지 않도록 설정 가능

### 2. 결제 계정 변경 시
- 기존 API 키는 그대로 사용 가능
- 할당량만 변경됨

### 3. 새 프로젝트 생성 시
- API 키 재발급 필요
- 환경 변수 업데이트 필요
- Vercel 환경 변수도 업데이트 필요

---

## 📋 체크리스트

### 방법 2 (권장) 사용 시:
- [ ] 결제 페이지 접속
- [ ] 유료 결제 계정 확인
- [ ] 프로젝트 선택
- [ ] "결제" 메뉴 클릭
- [ ] 유료 결제 계정 선택
- [ ] "저장" 클릭
- [ ] 할당량 페이지에서 Paid tier 할당량 확인
- [ ] 429 에러 해결 확인

### 방법 4 (새 프로젝트) 사용 시:
- [ ] 새 프로젝트 생성
- [ ] 유료 결제 계정 연결
- [ ] API 활성화
- [ ] API 키 재발급
- [ ] `.env.local` 업데이트
- [ ] Vercel 환경 변수 업데이트
- [ ] 테스트 실행

---

## 🔗 참고 링크

- [크레딧 관리](https://console.cloud.google.com/credits)
- [결제 계정 관리](https://console.cloud.google.com/billing)
- [프로젝트 설정](https://console.cloud.google.com/iam-admin/settings)
- [프로젝트 생성](https://console.cloud.google.com/projectcreate)

---

## 💡 추가 팁

### 할당량 확인

결제 계정 변경 후:
1. 할당량 페이지 접속
2. "Request limit per model per minute" 확인
3. `gemini-2.5-pro`의 값 확인:
   - **0** = 아직 Free tier (변경 필요)
   - **150+** = Paid tier (성공!)

### 문제 해결

여전히 Free tier 할당량이면:
1. 프로젝트 재시작 (몇 분 대기)
2. 할당량 페이지 새로고침
3. 결제 계정 연결 재확인

