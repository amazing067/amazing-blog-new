'use client';
// 광고심의필 슬라이드 — 인스타 1:1 정사각 (1080×1080)
// 블로그 BlogGenerator의 ApprovalGenerator 디자인을 카드뉴스 비율에 맞춰 재구성.

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

  return (
    <div style={containerStyle} className="relative w-full h-full bg-white rounded-2xl overflow-hidden shadow-xl">
      {/* 상단 그라디언트 액센트 라인 */}
      <div className="absolute top-0 left-0 right-0 h-[1.5cqw] bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488]" />

      {/* 페이지 번호 */}
      <div className="absolute top-[5%] right-[5%] inline-flex items-center justify-center w-[10%] h-[10%] rounded-full bg-slate-900 text-white text-[2.6cqw] font-extrabold">
        {index + 1}/{total}
      </div>

      <div className="relative h-full flex flex-col px-[6%] py-[7%]">
        {/* PRIME ASSET 로고 */}
        <div className="flex items-center justify-center mb-[5%]">
          <div className="text-center">
            <div className="inline-flex items-baseline gap-[0.5cqw] text-[8cqw] font-black leading-none tracking-tight">
              <span className="text-slate-900">PR</span>
              <span className="inline-block w-[1.2cqw] h-[7cqw] bg-[#84cc16] mx-[0.5cqw]" />
              <span className="text-slate-900">ME</span>
            </div>
            <div className="text-[5cqw] font-black tracking-[0.3em] text-slate-900 mt-[1cqw]">ASSET</div>
          </div>
        </div>

        {/* 회사명 + 지점명 (그라디언트) */}
        <div className="text-center mb-[2cqw]">
          <h2 className="inline-block text-[5.2cqw] font-black bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488] bg-clip-text text-transparent">
            {companyText}
          </h2>
          <div className="mx-auto mt-[0.5cqw] h-[0.4cqw] w-[35%] bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488] rounded-full" />
        </div>

        {/* 설계사명 + 등록번호 */}
        <div className="text-center text-slate-900 mb-[4%]">
          <div className="text-[3.2cqw] font-bold mb-[0.6cqw]">설계사 {designer}</div>
          <div className="text-[2.7cqw] font-medium text-slate-700">손·생보 협회 등록번호 {registration}</div>
        </div>

        {/* 심의필 정보 강조 박스 */}
        <div className="mx-[2cqw] mb-[3%] rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 ring-1 ring-blue-200 px-[4%] py-[3%]">
          <div className="text-center text-[3.4cqw] font-extrabold text-[#1e40af] leading-tight">
            {c.company} 심의필 {num}
          </div>
          <div className="text-center text-[2.8cqw] font-bold text-[#1e40af] mt-[0.5cqw]">
            ({start}~{end})
          </div>
        </div>

        {/* 준수 문구 */}
        <div className="text-center text-[2.6cqw] font-bold text-slate-900 mb-[3%]">
          본 광고는 광고심의기준을 준수하였으며, 유효기간은 심의일로부터 1년입니다.
        </div>

        {/* 경고 (해지/신계약 불이익) */}
        {c.include_warning && (
          <>
            <div className="text-center text-[2.5cqw] font-bold text-[#dc2626] mb-[1cqw]">
              보험계약자가 기존 보험계약을 해지하고 새로운 보험계약을 체결하는 과정에서
            </div>
            <div className="text-center text-[2.3cqw] text-[#991b1b] leading-[1.5] mb-[3%]">
              ① 질병이력, 연령증가 등으로 가입이 거절되거나 보험료가 인상될 수 있습니다.<br />
              ② 가입 상품에 따라 새로운 면책기간 적용 및 보장 제한 등 기타 불이익이 발생할 수 있습니다.
            </div>
          </>
        )}

        {/* 추가 안내 (3가지) */}
        <ul className="mt-auto space-y-[1.2cqw] text-[2.2cqw] font-medium text-slate-800 leading-[1.5]">
          <li className="flex gap-[1.5cqw]">
            <span className="text-[#0d9488] font-black">•</span>
            <span>본 내용은 모집종사자 개인의 의견이며, 계약 체결에 따른 이익 또는 손실은 보험계약자 등에게 귀속됩니다.</span>
          </li>
          <li className="flex gap-[1.5cqw]">
            <span className="text-[#0d9488] font-black">•</span>
            <span>보험사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</span>
          </li>
          <li className="flex gap-[1.5cqw]">
            <span className="text-[#0d9488] font-black">•</span>
            <span>보험회사 상품별, 성별, 연령, 직업 등에 따라 가입가능한 담보와 가입금액, 보험료는 달라질 수 있습니다.</span>
          </li>
        </ul>
      </div>

      {/* 하단 그라디언트 라인 */}
      <div className="absolute bottom-0 left-0 right-0 h-[0.6cqw] bg-gradient-to-r from-[#0d9488] via-[#14b8a6] to-[#0d9488]" />
    </div>
  );
}
