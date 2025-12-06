# OAuth 클라이언트 ID 설정 요약

## ✅ 최종 설정

### OAuth 클라이언트 ID 생성
- **애플리케이션 유형**: `웹 애플리케이션`
- **이름**: `blog_ai` (또는 원하는 이름)
- **승인된 JavaScript 원본**: **비워두기** (Node.js 스크립트이므로 불필요)
- **승인된 리디렉션 URI**: 
  ```
  http://localhost
  ```

### 클라이언트 ID 저장
생성 후 `.env.local`에 추가:
```env
GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
```

---

## 📝 사용 목적

**OAuth 클라이언트 ID는 Google Sheets 쓰기 전용입니다.**

- ✅ **사용 위치**: `scripts/upload-premium-data.ts` (엑셀 → Sheets 업로드)
- ❌ **사용 안 함**: 
  - 블로그 생성 API (`app/api/generate/route.ts`) - API Key 사용
  - Q&A 생성 API (`app/api/generate-qa/route.ts`) - API Key 사용
  - 제안서 분석 API (`app/api/analyze-design-sheet/route.ts`) - API Key 사용

---

## 💡 참고

**서비스 계정을 사용하는 것이 더 간단합니다!**
- OAuth는 사용자 인증이 필요하지만
- 서비스 계정은 자동 인증 (토큰 자동 갱신)

서비스 계정 설정 방법: `GOOGLE_서비스계정_설정_가이드.md` 참고

