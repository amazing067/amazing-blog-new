# Gemini 할당량 문제 해결 가이드

## 🔴 현재 문제

이미지에서 확인한 내용:
- **Free Trial 크레딧**이 활성 상태 (94% 남음)
- 새 프로젝트를 만들었는데도 여전히 **Free Trial 크레딧**을 사용 중
- **429 Too Many Requests** 에러 발생

## ⚠️ 문제 원인

### 1. Free Trial 크레딧의 제한사항

**Free Trial 크레딧은 API 할당량 제한이 매우 엄격합니다:**

- **RPM (Requests Per Minute)**: 분당 요청 수 제한이 매우 낮음
- **TPM (Tokens Per Minute)**: 분당 토큰 수 제한이 매우 낮음
- **일일 할당량**: 하루 사용량 제한이 있음
- **프로젝트별 제한**: Free Trial은 프로젝트별로도 제한이 있음

**새 프로젝트를 만들어도:**
- 같은 결제 계정을 사용하면 → **Free Trial 크레딧이 자동으로 적용됨**
- 프로젝트가 Free Trial 상태이면 → **동일한 제한을 받음**

### 2. 유료 계정으로 전환되지 않음

새 프로젝트를 만들었지만:
- 결제 계정이 **Free Trial 상태**로 연결됨
- 유료 계정으로 **업그레이드되지 않음**

---

## ✅ 해결 방법

### 방법 1: 결제 계정을 유료로 업그레이드 (권장)

1. **Google Cloud Console** 접속
   - https://console.cloud.google.com/billing

2. **결제 계정 확인**
   - 현재 사용 중인 결제 계정 확인
   - "Free Trial" 상태인지 확인

3. **유료 계정으로 업그레이드**
   - 결제 계정 설정 → **"업그레이드"** 클릭
   - 결제 정보 입력 (신용카드 등)
   - **Free Trial → 유료 계정 전환**

4. **프로젝트에 유료 계정 연결**
   - 프로젝트 선택 → **"결제"** 메뉴
   - 유료 결제 계정 선택
   - **Free Trial 크레딧 제거**

### 방법 2: 새 결제 계정 생성 (유료)

1. **새 결제 계정 생성**
   - Google Cloud Console → **"결제"** 메뉴
   - **"결제 계정 만들기"** 클릭
   - 결제 정보 입력 (신용카드 등)
   - **처음부터 유료 계정으로 생성**

2. **프로젝트에 새 결제 계정 연결**
   - 프로젝트 선택 → **"결제"** 메뉴
   - 새로 만든 **유료 결제 계정** 선택
   - **Free Trial 크레딧 제거**

### 방법 3: Free Trial 크레딧 비활성화

1. **크레딧 페이지 접속**
   - https://console.cloud.google.com/credits

2. **Free Trial 크레딧 확인**
   - 활성 상태인 "Free Trial" 크레딧 확인

3. **프로젝트에서 크레딧 제거**
   - 프로젝트 설정 → **"결제"** 메뉴
   - Free Trial 크레딧이 자동 적용되지 않도록 설정

---

## 🔍 확인 사항

### 1. 현재 프로젝트의 결제 상태 확인

```bash
# Google Cloud Console에서 확인
1. 프로젝트 선택
2. "결제" 메뉴 클릭
3. 연결된 결제 계정 확인
4. "Free Trial" 여부 확인
```

### 2. API 키가 올바른 프로젝트의 것인지 확인

현재 사용 중인 API 키:
- `.env.local` 파일의 `GEMINI_API_KEY` 확인
- 이 API 키가 **어떤 프로젝트**에서 발급되었는지 확인
- **새 프로젝트의 API 키**인지 확인

### 3. 할당량 확인

Google Cloud Console → **"API 및 서비스"** → **"할당량"**:
- **Generative Language API** 선택
- **RPM (Requests Per Minute)** 확인
- **TPM (Tokens Per Minute)** 확인
- **Free Trial 제한**인지 **유료 계정 제한**인지 확인

---

## 📊 Free Trial vs 유료 계정 비교

| 항목 | Free Trial | 유료 계정 |
|------|-----------|----------|
| **RPM (gemini-2.5-pro)** | 매우 낮음 (예: 2-5 RPM) | 높음 (예: 100+ RPM) |
| **TPM (gemini-2.5-pro)** | 매우 낮음 (예: 10,000 TPM) | 높음 (예: 1,000,000+ TPM) |
| **일일 할당량** | 제한 있음 | 제한 없음 (사용량만큼 과금) |
| **429 에러 발생** | 자주 발생 | 거의 발생 안 함 |

---

## 🎯 권장 조치

### 즉시 조치

1. **결제 계정을 유료로 업그레이드**
   - Free Trial → 유료 계정 전환
   - 결제 정보 입력

2. **프로젝트에 유료 계정 연결**
   - 새 프로젝트 → 유료 결제 계정 연결
   - Free Trial 크레딧 제거

3. **API 키 재발급 (필요 시)**
   - 새 프로젝트의 API 키 사용
   - `.env.local` 업데이트
   - Vercel 환경 변수 업데이트

### 장기 조치

1. **할당량 모니터링**
   - Google Cloud Console → 할당량 페이지
   - 사용량 추적
   - 필요 시 할당량 증가 요청

2. **Fallback 로직 유지**
   - 현재 구현된 Gemini → GPT 폴백 로직 유지
   - 할당량 초과 시 자동으로 GPT로 전환

---

## ⚠️ 주의사항

1. **Free Trial 크레딧은 프로젝트별로 적용됨**
   - 새 프로젝트를 만들어도 같은 결제 계정을 사용하면 Free Trial 제한을 받음

2. **크레딧 잔액 ≠ 할당량**
   - 크레딧이 94% 남아있어도 **할당량 제한**은 별도로 적용됨
   - Free Trial 크레딧은 **할당량 제한이 매우 엄격함**

3. **유료 계정으로 전환해야 함**
   - 새 프로젝트만으로는 해결되지 않음
   - **결제 계정을 유료로 업그레이드**해야 함

---

## 📝 체크리스트

- [ ] Google Cloud Console에서 결제 계정 상태 확인
- [ ] Free Trial → 유료 계정 업그레이드
- [ ] 새 프로젝트에 유료 결제 계정 연결
- [ ] API 키가 새 프로젝트의 것인지 확인
- [ ] `.env.local` 파일의 `GEMINI_API_KEY` 확인
- [ ] Vercel 환경 변수 업데이트 (프로덕션)
- [ ] 할당량 페이지에서 RPM/TPM 확인
- [ ] 테스트 실행하여 429 에러 해결 확인

---

## 🔗 참고 링크

- [Google Cloud 결제 계정 관리](https://console.cloud.google.com/billing)
- [Generative Language API 할당량](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
- [Gemini API 할당량 가이드](https://ai.google.dev/pricing)

