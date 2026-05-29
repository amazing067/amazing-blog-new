import type { ComplianceInfo } from './types';

// 광고심의 푸터(HTML) — 블로그 다운로드·네이버 복사·PDF가 동일하게 사용.
// number(심의번호)가 없으면 빈 문자열(푸터 생략).
export function complianceFooterHtml(c: ComplianceInfo | null): string {
  if (!c || !c.number) return '';
  const company = c.company || '프라임에셋';
  const designer = c.designer || '';
  const reg = c.registration || '';
  const num = c.number;
  const start = c.start_date || '';
  const end = c.end_date || '';
  const warn = c.include_warning !== false;

  return `
<hr/>
<div style="margin-top:40px;padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-family:Arial,sans-serif;color:#1e293b;">
  <p style="text-align:center;margin:0 0 8px;font-weight:bold;font-size:18px;color:#0d9488;">${company}${c.branch ? ' ' + c.branch : ''}</p>
  ${designer ? `<p style="text-align:center;margin:0 0 4px;font-size:14px;">설계사 <strong>${designer}</strong></p>` : ''}
  ${reg ? `<p style="text-align:center;margin:0 0 12px;font-size:13px;color:#475569;">손·생보 협회 등록번호 ${reg}</p>` : ''}
  <p style="text-align:center;margin:12px 0 4px;font-weight:bold;color:#1e40af;font-size:15px;">${company} 심의필 ${num}</p>
  <p style="text-align:center;margin:0 0 12px;font-weight:bold;color:#1e40af;font-size:13px;">(${start} ~ ${end})</p>
  <p style="text-align:center;margin:0 0 16px;font-size:13px;font-weight:bold;">본 광고는 광고심의기준을 준수하였으며, 유효기간은 심의일로부터 1년입니다.</p>
  ${warn ? `
  <p style="margin:16px 0 4px;font-size:13px;font-weight:bold;color:#dc2626;">⚠ 보험계약자가 기존 보험계약을 해지하고 새로운 보험계약을 체결하는 과정에서</p>
  <p style="margin:0 0 4px;font-size:12px;color:#991b1b;">① 질병이력, 연령증가 등으로 가입이 거절되거나 보험료가 인상될 수 있습니다.</p>
  <p style="margin:0 0 16px;font-size:12px;color:#991b1b;">② 가입 상품에 따라 새로운 면책기간 적용 및 보장 제한 등 기타 불이익이 발생할 수 있습니다.</p>
  ` : ''}
  <ul style="margin:0;padding-left:20px;font-size:12px;color:#475569;line-height:1.6;">
    <li>본 내용은 모집종사자 개인의 의견이며, 계약 체결에 따른 이익 또는 손실은 보험계약자 등에게 귀속됩니다.</li>
    <li>보험사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.</li>
    <li>보험회사 상품별, 성별, 연령, 직업 등에 따라 가입가능한 담보와 가입금액, 보험료는 달라질 수 있습니다.</li>
  </ul>
</div>
`;
}
