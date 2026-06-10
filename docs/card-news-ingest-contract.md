# 카드뉴스 → 설계사방(영업자료실) 전송 계약 (Ingest Contract)

블로그 운영툴(`amazing-biz-blog`)에서 **심의완료된 카드뉴스**를 어메이징사업부 서버
(`amazing-biz-server`, OCI VPS `129.153.105.227`, PM2 프로세스 `amazing-biz-server`)의
**영업자료실**로 보낼 때 쓰는 규약. 받는 쪽(server) 구현·표시 기준 문서.

---

## 1. 엔드포인트 / 인증

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `{AMAZING_INGEST_URL}` → 자동으로 `/api/card-news/ingest` 보정 |
| 인증 헤더 | `x-ingest-key: {INGEST_API_KEY}` |
| Content-Type | `application/json` |

- 블로그 측 환경변수: `AMAZING_INGEST_URL`, `INGEST_API_KEY` (Vercel 프로덕션에 설정됨).
- 서버는 `x-ingest-key`가 일치할 때만 수락. 키 불일치 → 401/403로 거절.

## 2. 요청 본문(payload) 스키마

```jsonc
{
  "title": "string",            // 카드 제목 (content_items.title)
  "category": "string | null",  // 보험 카테고리 (없으면 null)
  "source_id": "content_items_{uuid}", // 멱등 키 — 재전송 시 같은 값
  "review": {
    "number":     "string",     // 광고심의번호 (예: 제2026-1234호). 없으면 ""
    "company":    "string",     // 회사명 — 항상 "프라임에셋"
    "designer":   "",           // ⚠ 항상 빈 문자열 (아래 3절 참고)
    "start_date": "string",     // 심의 시작일 YYYY-MM-DD, 없으면 ""
    "end_date":   "string"      // 심의 종료일 YYYY-MM-DD, 없으면 ""
  },
  "image_urls": [               // 슬라이드 PNG public URL 배열(순서 = 카드 순서)
    "https://...supabase.../cardnews/{id}/slide-01.png?v={ts}",
    "https://...supabase.../cardnews/{id}/slide-02.png?v={ts}"
    // ... 본문 N장 + 마지막 1장 = 심의필 슬라이드
  ]
}
```

### 응답
- 성공: `200` + `{ "ok": true }` (또는 `ok` 필드 없이 2xx)
- 실패: 2xx가 아니거나 `{ "ok": false, "error": "..." }` → 블로그가 에러로 처리.

## 3. ⚠ 설계사·지점 정보는 비워서 보낸다 (2026-06 변경)

핵심: **한 번 심의받은 카드를 여러 설계사가 공용으로 쓰는 운영**이라,
전송본에는 특정 설계사·지점을 넣지 않는다.

- `review.designer` = **항상 `""`**. (`review.company`는 "프라임에셋"만 유지)
- **마지막 심의필 슬라이드 이미지**도 동일하게 처리됨:
  - 헤더의 **회사명·지점명("프라임에셋 광진2지점")은 제거**, 왼쪽 프라임에셋 로고만 남김.
  - 그 자리에 `설계사 ____ / 연락처 ____ / 등록번호 ____` **빈 기입란**만 그려서 보냄.
  - 심의 인증 문구(`프라임에셋 심의필 제○○호`, 유효기간, 경고·안내 문구)는 그대로 유지.
- **받는 설계사가 본인 정보(이름·연락처·협회등록번호)를 직접 채워** 사용한다.

→ **서버/영업자료실 표시 시 주의**: `review.designer`가 비어 있는 게 정상이다.
"설계사 미지정"으로 에러 처리하지 말고, 빈 값을 그대로 허용할 것.
설계사명을 화면에 굳이 노출할 필요 없음(이미지 안에 빈 기입란이 이미 있음).

## 4. 이미지 처리

- 이미지는 블로그가 캡처해 **Supabase Storage 공개 버킷**(`content-images`)의
  `cardnews/{id}/slide-NN.png` 경로에 **upsert** 업로드 후 public URL을 넘긴다.
- **재전송 시 같은 경로 덮어쓰기** + URL 뒤 `?v={timestamp}` 캐시버스트가 붙는다.
  → 서버는 URL을 **그대로 저장/표시**만 하면 됨. 이전 이미지가 캐시로 남지 않게 매번 새 `?v=` 사용.
- 포맷은 PNG (1080×1080 정사각).

## 5. 멱등성 (재전송)

- `source_id`(`content_items_{uuid}`)가 같으면 **같은 자료의 갱신**으로 처리할 것(중복 생성 금지, upsert).
- 블로그는 전송 성공 시 `content_items.sent_to_server_at`를 기록한다(재전송 가능).

---

### 참고 (블로그 측 구현 위치)
- 전송 API: `app/api/admin/content/cards/[id]/send-to-server/route.ts`
- 전송용 심의필 렌더(빈 기입란): `app/admin/content/card-preview/ComplianceSlide.tsx` (`shareBlank` 모드)
