// 통계 출처 기관 → 공식 도메인 + 홈페이지 매핑.
// AI(Claude Haiku)가 카드뉴스 생성 시 자체 deep-link URL을 만들어내지만 환각 404가 잦고,
// 또 기관 메인페이지로만 보내면 검수자가 실제 보고서를 찾기 어려워서,
// 보고서 제목(name)이 있으면 Google `site:domain ...` 검색 URL로 보내 첫 결과가 실제 문서가 되도록 한다.
// 매칭되지 않는 기관이면 url 생략 (가짜 링크보다 안전).

type Entry = {
  aliases: string[];
  domain: string;       // Google site: 검색에 쓸 eTLD+1
  homepage: string;     // name이 없을 때만 fallback
};

const REGISTRY: Entry[] = [
  // 공공기관 — 통계·보건
  { aliases: ['국립암센터', 'NCC', 'National Cancer Center'], domain: 'ncc.re.kr', homepage: 'https://www.ncc.re.kr' },
  { aliases: ['보건복지부', '복지부'], domain: 'mohw.go.kr', homepage: 'https://www.mohw.go.kr' },
  { aliases: ['통계청', 'KOSTAT'], domain: 'kostat.go.kr', homepage: 'https://kostat.go.kr' },
  { aliases: ['KOSIS', '국가통계포털'], domain: 'kosis.kr', homepage: 'https://kosis.kr' },
  { aliases: ['건강보험심사평가원', '심평원', 'HIRA'], domain: 'hira.or.kr', homepage: 'https://www.hira.or.kr' },
  { aliases: ['국민건강보험공단', '건보공단', 'NHIS'], domain: 'nhis.or.kr', homepage: 'https://www.nhis.or.kr' },
  { aliases: ['질병관리청', '질병청', 'KDCA'], domain: 'kdca.go.kr', homepage: 'https://www.kdca.go.kr' },
  { aliases: ['식품의약품안전처', '식약처'], domain: 'mfds.go.kr', homepage: 'https://www.mfds.go.kr' },

  // 금융 공공
  { aliases: ['금융감독원', '금감원', 'FSS'], domain: 'fss.or.kr', homepage: 'https://www.fss.or.kr' },
  { aliases: ['금융위원회', '금융위'], domain: 'fsc.go.kr', homepage: 'https://www.fsc.go.kr' },
  { aliases: ['보험연구원', 'KIRI'], domain: 'kiri.or.kr', homepage: 'https://www.kiri.or.kr' },
  { aliases: ['손해보험협회', '손보협회', 'KNIA'], domain: 'knia.or.kr', homepage: 'https://www.knia.or.kr' },
  { aliases: ['생명보험협회', '생보협회', 'KLIA'], domain: 'klia.or.kr', homepage: 'https://www.klia.or.kr' },
  { aliases: ['보험개발원', 'KIDI'], domain: 'kidi.or.kr', homepage: 'https://www.kidi.or.kr' },

  // 의학 학회
  { aliases: ['대한의학회', 'KAMS'], domain: 'kams.or.kr', homepage: 'https://www.kams.or.kr' },
  { aliases: ['대한암학회'], domain: 'cancer.or.kr', homepage: 'https://www.cancer.or.kr' },
  { aliases: ['대한심장학회'], domain: 'circulation.or.kr', homepage: 'https://www.circulation.or.kr' },
  { aliases: ['대한당뇨병학회'], domain: 'diabetes.or.kr', homepage: 'https://www.diabetes.or.kr' },
  { aliases: ['대한신경과학회'], domain: 'neuro.or.kr', homepage: 'https://new.neuro.or.kr' },
  { aliases: ['대한치매학회'], domain: 'dementia.or.kr', homepage: 'https://www.dementia.or.kr' },
  { aliases: ['대한노인병학회'], domain: 'geriatrics.or.kr', homepage: 'https://www.geriatrics.or.kr' },
  { aliases: ['대한산부인과학회'], domain: 'ksog.org', homepage: 'https://www.ksog.org' },
  { aliases: ['대한소아청소년과학회'], domain: 'pediatrics.or.kr', homepage: 'https://www.pediatrics.or.kr' },

  // 상급종합병원 / 대학병원
  { aliases: ['서울대학교병원', '서울대병원', 'SNUH'], domain: 'snuh.org', homepage: 'https://www.snuh.org' },
  { aliases: ['세브란스병원', '세브란스', '연세의료원', '연세대학교의료원'], domain: 'severance.healthcare', homepage: 'https://sev.severance.healthcare' },
  { aliases: ['삼성서울병원', 'SMC'], domain: 'samsunghospital.com', homepage: 'http://www.samsunghospital.com' },
  { aliases: ['서울아산병원', '아산병원', 'AMC'], domain: 'amc.seoul.kr', homepage: 'https://www.amc.seoul.kr' },
  { aliases: ['가톨릭대학교 서울성모병원', '서울성모병원', '성모병원'], domain: 'cmcseoul.or.kr', homepage: 'https://www.cmcseoul.or.kr' },
  { aliases: ['고려대학교병원', '고대병원', 'KUMC'], domain: 'kumc.or.kr', homepage: 'https://www.kumc.or.kr' },
  { aliases: ['한양대학교병원', '한양대병원'], domain: 'hyumc.com', homepage: 'https://seoul.hyumc.com' },
  { aliases: ['경희대학교병원', '경희의료원'], domain: 'khmc.or.kr', homepage: 'https://www.khmc.or.kr' },
  { aliases: ['이화여자대학교목동병원', '이대목동병원'], domain: 'eumc.ac.kr', homepage: 'https://mokdong.eumc.ac.kr' },
  { aliases: ['중앙대학교병원', '중앙대병원'], domain: 'cauhs.or.kr', homepage: 'https://ch.cauhs.or.kr' },
  { aliases: ['분당서울대학교병원', '분당서울대병원'], domain: 'snubh.org', homepage: 'https://www.snubh.org' },
  { aliases: ['아주대학교병원', '아주대병원'], domain: 'ajoumc.or.kr', homepage: 'https://hosp.ajoumc.or.kr' },
  { aliases: ['인하대학교병원', '인하대병원'], domain: 'inha.com', homepage: 'https://www.inha.com' },

  // 국제 기관
  { aliases: ['WHO', 'World Health Organization', '세계보건기구'], domain: 'who.int', homepage: 'https://www.who.int' },
  { aliases: ['OECD', 'OECD Health Statistics'], domain: 'oecd.org', homepage: 'https://www.oecd.org/health' },
  { aliases: ['IARC', 'International Agency for Research on Cancer'], domain: 'iarc.who.int', homepage: 'https://www.iarc.who.int' },
];

function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

function findEntry(organization: string): Entry | undefined {
  const norm = normalize(organization);
  if (!norm) return undefined;
  // 1) 정확 일치
  for (const entry of REGISTRY) {
    for (const alias of entry.aliases) {
      if (normalize(alias) === norm) return entry;
    }
  }
  // 2) 부분 포함 (양방향)
  for (const entry of REGISTRY) {
    for (const alias of entry.aliases) {
      const a = normalize(alias);
      if (norm.includes(a) || a.includes(norm)) return entry;
    }
  }
  return undefined;
}

// organization과 자료명을 받아 검수자가 클릭했을 때 실제 자료에 가장 빨리 도달할 수 있는 URL을 반환.
// - name이 있으면 Google `site:domain` 검색 (첫 결과가 곧 그 보도자료/보고서가 되게).
// - name이 비었으면 기관 홈페이지.
// - 레지스트리에 없는 기관이면 undefined (텍스트만 노출).
export function resolveSourceUrl(
  organization: string | null | undefined,
  name?: string | null,
): string | undefined {
  if (!organization) return undefined;
  const entry = findEntry(organization);
  if (!entry) return undefined;

  const trimmedName = (name ?? '').trim();
  if (trimmedName) {
    const q = encodeURIComponent(`site:${entry.domain} ${trimmedName}`);
    return `https://www.google.com/search?q=${q}`;
  }
  return entry.homepage;
}
