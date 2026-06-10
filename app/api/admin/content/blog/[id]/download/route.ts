import { requireContentAccess, adminClient } from '@/lib/admin/guard';
import type { ComplianceInfo } from '@/lib/content/types';
import { complianceFooterHtml } from '@/lib/content/compliance-footer';

// 간단한 마크다운 → HTML (블로그 게시용)
// 카카오·네이버 블로그 에디터에 붙여넣기 가능한 표준 HTML.
function mdToHtml(md: string): string {
  let html = md;
  // code blocks (간단 처리)
  html = html.replace(/```[\s\S]*?```/g, m => `<pre><code>${m.replace(/```\w*\n?|```$/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`);
  // headings (가장 큰 것부터)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // bold + italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // mark·u tags 그대로 두기
  // tables — 간단 처리: |로 시작하는 라인을 행으로
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (block) => {
    const lines = block.trim().split('\n');
    const rows = lines.filter(l => !/^\|[\s|:-]+\|$/.test(l));
    const head = rows[0];
    const body = rows.slice(1);
    const headHtml = '<tr>' + head.split('|').slice(1, -1).map(c => `<th>${c.trim()}</th>`).join('') + '</tr>';
    const bodyHtml = body.map(r => '<tr>' + r.split('|').slice(1, -1).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>').join('');
    return `<table border="1" cellpadding="8" cellspacing="0"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
  });
  // blockquote — 콜아웃 처리
  html = html.replace(/((?:^>\s.+\n?)+)/gm, (block) => {
    const inner = block.split('\n').map(l => l.replace(/^>\s?/, '')).join('<br/>');
    return `<blockquote style="border-left:4px solid #14b8a6;background:#ecfdf5;padding:12px 16px;margin:16px 0;border-radius:8px;">${inner}</blockquote>`;
  });
  // unordered list
  html = html.replace(/((?:^[-*]\s.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[-*]\s/, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  // ordered list
  html = html.replace(/((?:^\d+\.\s.+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });
  // paragraphs (남은 빈 줄로 구분된 단락)
  html = html.split(/\n{2,}/).map(b => {
    if (/^<(h\d|ul|ol|table|blockquote|pre|p|div)/.test(b.trim())) return b;
    if (!b.trim()) return '';
    return `<p>${b.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');
  return html;
}

function complianceFooterMd(c: ComplianceInfo | null): string {
  if (!c || !c.number) return '';
  const company = c.company || '프라임에셋';
  const num = c.number;
  const start = c.start_date || '';
  const end = c.end_date || '';
  const designer = c.designer || '';
  const reg = c.registration || '';
  const warn = c.include_warning !== false;
  return `

---

**${company}${c.branch ? ' ' + c.branch : ''}**
${designer ? `설계사 **${designer}**` : ''}
${reg ? `손·생보 협회 등록번호 ${reg}` : ''}

**${company} 심의필 ${num}** (${start} ~ ${end})

**본 광고는 광고심의기준을 준수하였으며, 유효기간은 심의일로부터 1년입니다.**

${warn ? `⚠ **보험계약자가 기존 보험계약을 해지하고 새로운 보험계약을 체결하는 과정에서**
① 질병이력, 연령증가 등으로 가입이 거절되거나 보험료가 인상될 수 있습니다.
② 가입 상품에 따라 새로운 면책기간 적용 및 보장 제한 등 기타 불이익이 발생할 수 있습니다.
` : ''}

- 본 내용은 모집종사자 개인의 의견이며, 계약 체결에 따른 이익 또는 손실은 보험계약자 등에게 귀속됩니다.
- 보험사 및 상품별로 상이할 수 있으므로, 관련한 세부사항은 반드시 해당 약관을 참조하시기 바랍니다.
- 보험회사 상품별, 성별, 연령, 직업 등에 따라 가입가능한 담보와 가입금액, 보험료는 달라질 수 있습니다.
`;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireContentAccess();
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'html';
  const dl = searchParams.get('dl') === '1';

  const { data: item } = await adminClient()
    .from('content_items').select('title, body_md, meta_description, compliance').eq('id', id).single();
  if (!item) return new Response('not found', { status: 404 });

  const c = item.compliance as ComplianceInfo | null;

  if (format === 'md') {
    const md = `# ${item.title}\n\n${item.body_md ?? ''}\n\n${complianceFooterMd(c)}`;
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        ...(dl ? { 'Content-Disposition': `attachment; filename="blog-${id}.md"` } : {}),
      },
    });
  }

  // HTML
  const bodyHtml = mdToHtml(item.body_md ?? '');
  const fullHtml = `<h1>${item.title}</h1>\n${item.meta_description ? `<p style="color:#64748b;font-size:14px;font-style:italic;">${item.meta_description}</p>` : ''}\n${bodyHtml}\n${complianceFooterHtml(c)}`;
  return new Response(fullHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(dl ? { 'Content-Disposition': `attachment; filename="blog-${id}.html"` } : {}),
    },
  });
}
