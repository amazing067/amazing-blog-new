const XLSX = require('xlsx');

// 30세 남성 파일 상세 분석
const workbook = XLSX.readFile('data/홍길동_30세 남 한장보험료비교_20251204.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`총 행 수: ${data.length}\n`);
console.log('마지막 10개 행 확인:\n');

for (let i = Math.max(0, data.length - 10); i < data.length; i++) {
  const row = data[i];
  console.log(`행 ${i + 1}: ${JSON.stringify(row[0])} | ${typeof row[2]} | ${row[2]}`);
}

