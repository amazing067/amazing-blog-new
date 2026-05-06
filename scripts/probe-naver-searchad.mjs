// 네이버 검색광고 API 살아있는지 진단.
// 1) 환경 변수 존재/형식 확인
// 2) 실제 keywordstool 호출
// 3) 응답 status·에러 메시지 출력
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const CID = env.NAVER_SEARCHAD_CUSTOMER_ID;
const KEY = env.NAVER_SEARCHAD_ACCESS_LICENSE;
const SEC = env.NAVER_SEARCHAD_SECRET_KEY;

console.log('━━━ 환경변수 ━━━');
console.log(`  CUSTOMER_ID    : ${CID ? `${CID.slice(0, 4)}...(len=${CID.length})` : '❌ 없음'}`);
console.log(`  ACCESS_LICENSE : ${KEY ? `${KEY.slice(0, 8)}...(len=${KEY.length})` : '❌ 없음'}`);
console.log(`  SECRET_KEY     : ${SEC ? `${SEC.slice(0, 8)}...(len=${SEC.length})` : '❌ 없음'}`);

if (!CID || !KEY || !SEC) {
  console.log('\n환경변수 누락 → API 호출 불가. 검색광고 관리자센터에서 발급 후 .env.local에 등록 필요.');
  process.exit(1);
}

const BASE = 'https://api.searchad.naver.com';
const path = '/keywordstool';
const ts = String(Date.now());
const message = `${ts}.GET.${path}`;
const keyBuf = SEC.includes('base64:')
  ? Buffer.from(SEC.replace(/^base64:/, ''), 'base64')
  : Buffer.from(SEC, 'utf8');
const sig = crypto.createHmac('sha256', keyBuf).update(message, 'utf8').digest('base64');

const q = new URLSearchParams();
q.set('hintKeywords', '실손보험');
q.set('showDetail', '1');
q.set('includeHintKeywords', '1');

const url = `${BASE}${path}?${q.toString()}`;
console.log('\n━━━ 호출 ━━━');
console.log(`  URL: ${url}`);

let res;
try {
  res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Timestamp': ts,
      'X-API-KEY': KEY,
      'X-Customer': CID,
      'X-Signature': sig,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });
} catch (e) {
  console.error(`  ❌ 네트워크 실패: ${e.message}`);
  process.exit(2);
}

const body = await res.text();
console.log(`  status: ${res.status} ${res.statusText}`);
console.log(`  body  : ${body.slice(0, 800)}`);

if (res.status === 200) {
  const json = JSON.parse(body);
  const n = json.keywordList?.length ?? 0;
  console.log(`\n✅ 성공 — keywordList ${n}개 수신`);
  if (n > 0) {
    const sample = json.keywordList.slice(0, 3);
    sample.forEach(k => console.log(`    · ${k.relKeyword} : pc=${k.monthlyPcQcCnt}, mo=${k.monthlyMobileQcCnt}`));
  }
} else {
  console.log(`\n❌ 실패 — body 메시지로 원인 추정:`);
  if (body.includes('signature') || body.includes('Signature')) console.log('   서명 오류 (X-Signature). secret 키 인코딩(base64 vs utf8) 점검.');
  if (body.includes('TIMESTAMP') || body.includes('timestamp')) console.log('   타임스탬프 오류 (X-Timestamp). 서버 시각 차이 또는 헤더 누락.');
  if (body.includes('Customer') || body.includes('customer')) console.log('   고객사 ID 오류 (X-Customer). 잘못된 ID이거나 비활성화.');
  if (body.includes('API-KEY') || body.includes('LICENSE')) console.log('   액세스 라이선스 오류 (X-API-KEY). 만료/회수됐을 가능성.');
  if (res.status === 401) console.log('   401: 인증 실패 (서명/키/타임스탬프 중 하나).');
  if (res.status === 403) console.log('   403: 접근 금지. IP 화이트리스트 또는 권한.');
  if (res.status === 429) console.log('   429: 쿼터 초과. 일일 호출 한도 도달.');
  if (res.status >= 500) console.log('   5xx: 네이버 측 일시 장애.');
}
