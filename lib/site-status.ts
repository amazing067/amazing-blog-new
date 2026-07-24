// ─────────────────────────────────────────────────────────────
// 사이트 개폐 스위치
// blog.어메이징사업부.com 서비스를 어메이징사업부 통합 사이트로 이전하면서 임시 폐쇄한다.
// 코드/로직은 전부 보존한 채, 이 스위치가 켜져 있는 동안만:
//   · 모든 페이지  → /site-closed 안내 페이지로 리라이트
//   · 모든 /api   → 503 (제미나이·앤트로픽·OpenAI·Imagen 등 유료 호출 전면 차단 = 과금 0)
//
// ▶ 다시 열려면: 아래 SITE_CLOSED 를 false 로 바꾸고 배포.
//   (배포 없이 잠깐 열려면 Vercel 환경변수 SITE_OPEN=1 설정 → 즉시 오픈, 지우면 다시 폐쇄)
// ─────────────────────────────────────────────────────────────
export const SITE_CLOSED = process.env.SITE_OPEN === '1' ? false : true;

// 이전 대상(통합 사이트)
export const SITE_REDIRECT_URL = 'https://어메이징사업부.com';
// 브라우저 이동/헤더용 punycode 형태(한글 도메인 인코딩)
export const SITE_REDIRECT_URL_ASCII = 'https://xn--h32b21du9cf7grcy2k20f.com';
