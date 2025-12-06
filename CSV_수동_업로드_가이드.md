# CSV 파일 수동 업로드 가이드

## ✅ CSV 파일 생성 완료!

`data/담보별_보험료.csv` 파일에 1960개의 데이터가 포함되어 있습니다.

---

## 📋 Google Sheets에 업로드 방법

### 방법 1: Google Sheets 가져오기 (권장)

1. Google Sheets 열기: https://docs.google.com/spreadsheets/d/1xLGmNw8JfgGk2Y01WAsSQ4cBOofynaXVmne165i_ly8/edit
2. "담보별_보험료" 시트 선택 (없으면 생성)
3. **파일** > **가져오기** > **업로드** 클릭
4. `data/담보별_보험료.csv` 파일 선택
5. **가져오기 위치**: "기존 시트 바꾸기" 선택
6. **완료** 클릭

### 방법 2: 복사 붙여넣기

1. `data/담보별_보험료.csv` 파일을 엑셀이나 메모장으로 열기
2. 전체 선택 (Ctrl+A) → 복사 (Ctrl+C)
3. Google Sheets의 "담보별_보험료" 시트에서 A1 셀 선택
4. 붙여넣기 (Ctrl+V)

---

## 🔄 자동 업로드를 원하시나요?

자동 업로드를 원하시면 **서비스 계정**을 설정하세요.

**서비스 계정 설정**: `GOOGLE_서비스계정_설정_가이드.md` 참고

설정 후:
1. 서비스 계정 JSON 파일 다운로드
2. `.env.local`에 경로 추가:
   ```
   GOOGLE_SERVICE_ACCOUNT_PATH=./google-service-account.json
   ```
3. Google Sheets에 서비스 계정 이메일 공유 (편집자 권한)
4. 스크립트 재실행 → 자동 업로드 성공!

---

## 💡 현재 상태

- ✅ **CSV 파일**: 정상 생성 (1960개 데이터)
- ⚠️ **자동 업로드**: 서비스 계정 필요
- ✅ **수동 업로드**: 지금 바로 가능!

