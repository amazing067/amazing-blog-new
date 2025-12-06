# Google 서비스 계정 설정 가이드 (권장)

## 🎯 서비스 계정이 OAuth보다 나은 이유

- ✅ **사용자 로그인 불필요**: 서버/스크립트 환경에 완벽
- ✅ **자동 인증**: 토큰 만료 시 자동 갱신
- ✅ **보안**: 개인 계정과 분리된 전용 계정
- ✅ **로컬/프로덕션 동일**: 환경에 상관없이 동일하게 작동

---

## 📋 서비스 계정 생성 방법

### 1단계: 서비스 계정 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. **IAM 및 관리자** > **서비스 계정** 메뉴로 이동
3. **+ 서비스 계정 만들기** 클릭
4. 서비스 계정 정보 입력:
   - **이름**: `sheets-uploader` (또는 원하는 이름)
   - **설명**: `Google Sheets 자동 업로드용`
5. **만들기** 클릭

### 2단계: 역할 부여

1. **역할 선택** 드롭다운에서:
   - `Editor` 또는
   - `Google Sheets API` > `Google Sheets API Admin`
2. **완료** 클릭

### 3단계: 키 생성

1. 생성된 서비스 계정 클릭
2. **키** 탭으로 이동
3. **키 추가** > **새 키 만들기**
4. **키 유형**: `JSON` 선택
5. **만들기** 클릭

**중요**: JSON 파일이 자동으로 다운로드됩니다. 이 파일을 안전하게 보관하세요!

### 4단계: Google Sheets 공유

1. Google Sheets 파일 열기
2. **공유** 버튼 클릭
3. 서비스 계정 이메일 주소 추가 (예: `sheets-uploader@your-project.iam.gserviceaccount.com`)
4. **편집자** 권한 부여
5. **완료** 클릭

### 5단계: JSON 파일 설정

다운로드한 JSON 파일을 프로젝트에 저장:

```bash
# 프로젝트 루트에 저장 (보안상 .gitignore에 추가해야 함)
mv ~/Downloads/your-project-xxxxx.json ./google-service-account.json
```

`.env.local`에 경로 추가:
```env
GOOGLE_SERVICE_ACCOUNT_PATH=./google-service-account.json
```

---

## 🔄 OAuth vs 서비스 계정 비교

| 특징 | OAuth 클라이언트 ID | 서비스 계정 |
|------|-------------------|------------|
| 사용자 로그인 필요 | ✅ 예 | ❌ 아니오 |
| 서버 스크립트 적합 | ⚠️ 부적합 | ✅ 완벽 |
| 토큰 자동 갱신 | ❌ 수동 | ✅ 자동 |
| 여러 환경 지원 | ⚠️ 복잡 | ✅ 간단 |
| 설정 복잡도 | ⚠️ 복잡 | ✅ 간단 |

---

## 💡 결론

**서버/스크립트 환경에서는 서비스 계정을 강력히 권장합니다!**

