# n8n 워크플로우 설정 가이드

## 1. n8n 서버 실행

**새 터미널에서:**

```bash
npx n8n
```

서버가 시작되면:
- 주소: `http://localhost:5678`
- 브라우저에서 자동으로 열림

---

## 2. 워크플로우 Import

### 방법 1: 파일로 Import

1. n8n 웹 인터페이스 (`http://localhost:5678`) 접속
2. 왼쪽 메뉴에서 **"Workflows"** 클릭
3. **"Import from File"** 버튼 클릭
4. `어메이징 블로그 자동화 (11).json` 파일 선택
5. 업로드 완료!

### 방법 2: 직접 생성

1. **"Create Workflow"** 클릭
2. **Webhook 노드** 추가:
   - Method: POST
   - Path: `blog-generate`
3. **Gemini AI 노드** 추가
4. **Function 노드** 추가 (HTML 정리용)
5. 노드들 연결

---

## 3. Webhook URL 확인

워크플로우에서:
1. **Webhook 노드** 클릭
2. **"Test URL"** 또는 **"Production URL"** 복사
3. 예: `http://localhost:5678/webhook/blog-generate`

---

## 4. Next.js 환경 변수 설정

`.env.local` 파일에 추가:

```env
N8N_WEBHOOK_URL=http://localhost:5678/webhook/blog-generate
```

**서버 재시작 필수!** (Ctrl+C → npm run dev)

---

## 5. 워크플로우 활성화

n8n에서:
1. 워크플로우 열기
2. 오른쪽 위 **토글 스위치 ON** (활성화)
3. **"Save"** 버튼 클릭

---

## 6. 테스트

1. Next.js 앱에서 블로그 생성 시도
2. n8n 워크플로우 실행 확인
3. **"Executions"** 탭에서 로그 확인

---

## 🎯 워크플로우 구조 (예시)

```
1. Webhook (POST 요청 받기)
   ↓
2. Set Variables (데이터 정리)
   ↓
3. Gemini AI (프롬프트로 글 생성)
   ↓
4. Function (HTML 정리/검증)
   ↓
5. Response (HTML 반환)
```

---

## 🔧 트러블슈팅

### n8n이 안 열려요
- 포트 충돌 확인 (5678 포트)
- 방화벽 설정 확인

### Webhook이 404 에러
- URL 경로 확인 (`/webhook/blog-generate`)
- 워크플로우 활성화 확인

### Gemini API 키 오류
- n8n Credentials에 API 키 등록
- 환경 변수 설정 확인

---

## 💡 Pro Tips

1. **개발/운영 분리:**
   - 개발: `http://localhost:5678`
   - 운영: n8n.cloud 또는 도커 배포

2. **에러 핸들링:**
   - n8n의 "Error Trigger" 노드 활용
   - 재시도 로직 추가

3. **성능 최적화:**
   - 캐싱 추가
   - 병렬 처리 (이미지 + 텍스트 동시 생성)

---

## 📚 참고 자료

- n8n 공식 문서: https://docs.n8n.io
- Gemini API: https://ai.google.dev
- Webhook 가이드: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

