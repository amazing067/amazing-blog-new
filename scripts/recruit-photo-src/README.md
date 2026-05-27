# 리쿠르팅 듀오톤 사진 큐레이션 가이드

여기에 떨군 원본 사진을 `node scripts/bake-recruit-duotone.mjs`가 **듀오톤 JPG**로 구워
`public/recruit-photos/<slot>/`에 넣고, `lib/content/recruit-image-pool.json`(POOL)을 자동 갱신한다.

## 폴더 구조

```
scripts/recruit-photo-src/
  cover/          ← 1번 커버 카드 (틴트 블루 #1E5BFF)
    all/          ← 전 기둥 공통(국적-중립 장면 대부분 여기)
    P3-income/    ← (선택) 특정 기둥 전용 사진만 따로
  breakthrough/   ← 3번 통념깨기 카드 (틴트 틸 #0E9AA7)
    all/
  evidence/       ← 5번 증거·사람 카드 (틴트 딥블루 #14307A)
    all/
```

- 하위 폴더명 = `all`(전 기둥 공통) 또는 기둥 슬러그(`P1-empathy` `P2-system` `P3-income` `P4-lifestyle` `P5-story`).
- **대부분 `all`에 넣으면 됨.** 특정 기둥에 어울리는 컷만 기둥 폴더에 따로 둔다.
- 슬롯당 고유 사진 **3~5장** 권장(세트마다 랜덤 선택 → 변주).

## 사진 고르는 기준 (스펙 §11)

- **무료 상업이용 + 출처표기 불필요**: Unsplash, Pexels (라이선스 확인).
- **국적이 안 드러나는 장면**: 노트북·책상·손·키보드·카페·창가·도시 야경·뒷모습.
- **얼굴 없는 컷 위주**(가짜 인물 후기 리스크 회피). 손·뒷모습·사물 OK.
- 가로/세로 무관 — 스크립트가 1080×1080 attention crop + 듀오톤 처리.

## 굽기

```
node scripts/bake-recruit-duotone.mjs
```

- 매 실행마다 `public/recruit-photos/<slot>/`를 **싹 비우고 다시 구움**(POOL과 100% 동기화).
- 출력 파일명: `<bucket>__<원본이름>.jpg` (예: `all__laptop-desk.jpg`).
- 끝나면 어드민 🎯 리쿠르팅 탭에서 새 카드 생성 → 1·3·5 슬롯에 듀오톤 사진 확인.

> 듀오톤은 굽는 시점에 JPG에 완전히 박힌다(런타임 CSS blend 금지 — 캡처 안정성).
> 원본 사진(이 폴더)은 리포에 커밋하지 않아도 됨. 구운 결과(`public/recruit-photos/`)만 커밋.
