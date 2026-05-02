'use client';
// 광고심의필 슬라이드 — 인스타 1:1 정사각 (1080×1080)
// 5개 영역(헤더 / 심의필 번호 / 준수문구 강조 / 경고 / 안내)을 flex 비율로 카드에 꽉 채움.
// 각 영역은 자체 박스로 텍스트 잘림 방지.

import type { ComplianceInfo } from '@/lib/content/types';

const containerStyle = { containerType: 'size' } as React.CSSProperties;

type Props = {
  compliance: ComplianceInfo;
  index: number;
  total: number;
};

export function ComplianceSlide({ compliance, index, total }: Props) {
  const c = compliance;
  const companyText = c.branch ? `${c.company} ${c.branch}` : c.company;
  const designer = c.designer || '○○○';
  const registration = c.registration || '00000000000000';
  const num = c.number || '제000000호';
  const start = c.start_date || '2026.00.00';
  const end = c.end_date || '2027.00.00';

  // 경고문구 포함 여부에 따라 비율 자동 분배 (총합 10)
  // 헤더 1.7 / 심의필 2.0 / 준수문구 1.6 / 경고 2.5 / 안내 2.2  (포함)
  // 헤더 2.0 / 심의필 2.5 / 준수문구 2.0 / 안내 3.5             (미포함)
  const showWarning = c.include_warning !== false;
  const ratio = showWarning
    ? { header: 1.7, num: 2.0, text: 1.6, warn: 2.5, list: 2.2 }
    : { header: 2.0, num: 2.5, text: 2.0, warn: 0,   list: 3.5 };

  return (
    <div style={containerStyle} className="relative w-full h-full bg-white rounded-2xl overflow-hidden shadow-xl">
      {/* 상단 그라디언트 액센트 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[1cqw] bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488] z-10" />

      {/* 페이지 번호 */}
      <div className="absolute top-[3.5%] right-[3.5%] z-10 inline-flex items-center justify-center w-[8.5%] h-[8.5%] rounded-full bg-slate-900 text-white text-[2.4cqw] font-extrabold">
        {index + 1}/{total}
      </div>

      {/* 본문 — 5 영역 비율 분배 */}
      <div className="relative h-full flex flex-col px-[4%] py-[3.5%] gap-[1.4cqw]">

        {/* 1. 헤더 */}
        <div className="flex items-center gap-[2.5cqw] pb-[1.2cqw] border-b-2 border-slate-100" style={{ flex: ratio.header }}>
          <img
            src="/primeAsset_ci_세로.png"
            alt="PRIME ASSET"
            className="object-contain flex-none"
            style={{ width: '13cqw', height: '13cqw' }}
            crossOrigin="anonymous"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-[5cqw] font-black bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488] bg-clip-text text-transparent leading-tight truncate">
              {companyText}
            </h2>
            <div className="text-[2.7cqw] text-slate-700 mt-[0.4cqw] truncate">
              설계사 <span className="font-bold text-slate-900">{designer}</span>
              <span className="ml-[1cqw]">· 등록번호 {registration}</span>
            </div>
          </div>
        </div>

        {/* 2. 심의필 번호 박스 */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 ring-2 ring-blue-200 px-[3.5%] py-[2.5%] flex flex-col items-center justify-center" style={{ flex: ratio.num }}>
          <div className="text-center text-[4.8cqw] font-extrabold text-[#1e40af] leading-tight">
            {c.company} 심의필 {num}
          </div>
          <div className="text-center text-[3.4cqw] font-bold text-[#1e40af] mt-[0.8cqw]">
            ({start} ~ {end})
          </div>
        </div>

        {/* 3. 준수문구 강조 영역 — 청록 그라디언트(브랜드 컬러) */}
        <div className="rounded-xl bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488] px-[3.5%] py-[2%] flex items-center justify-center shadow-md" style={{ flex: ratio.text }}>
          <div className="text-center text-[3.2cqw] font-bold text-white leading-snug">
            본 광고는 광고심의기준을 준수하였으며,<br />
            유효기간은 심의일로부터 1년입니다.
          </div>
        </div>

        {/* 4. 경고 (해지/신계약 불이익) — 옵션 */}
        {showWarning && (
          <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-[3.5%] py-[2%] flex gap-[1.5cqw] items-start" style={{ flex: ratio.warn }}>
            <span className="text-[#dc2626] text-[2.8cqw] font-black leading-none flex-none mt-[0.3cqw]">⚠</span>
            <div className="flex-1 break-keep">
              <div className="text-[2.6cqw] font-bold text-[#dc2626] mb-[0.6cqw] leading-snug">
                보험계약자가 기존 보험계약을 해지하고 새로운 보험계약을 체결하는 과정에서
              </div>
              <div className="text-[2.3cqw] text-[#991b1b] leading-[1.55]">
                ① 질병이력, 연령증가 등으로 가입이 거절되거나 보험료가 인상될 수 있습니다.<br />
                ② 가입 상품에 따라 새로운 면책기간 적용 및 보장 제한 등 기타 불이익이 발생할 수 있습니다.
              </div>
            </div>
          </div>
        )}

        {/* 5. 추가 안내 3가지 */}
        <ul className="flex flex-col justify-around text-[2.3cqw] text-slate-700 leading-[1.5] py-[0.5cqw]" style={{ flex: ratio.list }}>
          <li className="flex gap-[1cqw]">
            <span className="text-[#0d9488] font-black flex-none">•</span>
            <span>본 내용은 모집종사자 개인의 의견이며, 계약 체결에 따른 이익 또는 손실은 보험계약자 등에게 귀속됩니다.</span>
          </li>
          <li className="flex gap-[1cqw]">
            <span className="text-[#0d9488] font-black flex-none">•</span>
            <span>보험사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</span>
          </li>
          <li className="flex gap-[1cqw]">
            <span className="text-[#0d9488] font-black flex-none">•</span>
            <span>보험회사 상품별, 성별, 연령, 직업 등에 따라 가입가능한 담보와 가입금액, 보험료는 달라질 수 있습니다.</span>
          </li>
        </ul>
      </div>

      {/* 하단 그라디언트 라인 */}
      <div className="absolute bottom-0 left-0 right-0 h-[0.5cqw] bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488] z-10" />
    </div>
  );
}
