import { describe, it, expect } from 'vitest';
import { parseRSSXml } from './rss-fetcher';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>한국보험신문</title>
  <item>
    <title><![CDATA[자동차보험 손해율 발표]]></title>
    <link>https://example.com/a/1</link>
    <pubDate>Sat, 02 May 2026 09:00:00 +0900</pubDate>
    <description><![CDATA[<p>금감원이 발표한...</p>]]></description>
  </item>
  <item>
    <title>실손보험 약관 개정</title>
    <link>https://example.com/a/2</link>
    <pubDate>Sat, 02 May 2026 10:00:00 +0900</pubDate>
    <description>실손보험 4세대 약관이...</description>
  </item>
</channel></rss>`;

describe('parseRSSXml', () => {
  it('parses CDATA + HTML descriptions', () => {
    const items = parseRSSXml(SAMPLE, '한국보험신문');
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('자동차보험 손해율 발표');
    expect(items[0].source).toBe('한국보험신문');
    expect(items[0].description).toContain('금감원');
  });
  it('returns empty on malformed', () => {
    expect(parseRSSXml('<not-xml', 'X')).toEqual([]);
  });
});
