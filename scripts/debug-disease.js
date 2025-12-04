const XLSX = require('xlsx');

const workbook = XLSX.readFile('data/질병분류표 KCD-9 DB masterfile_250701_20250701010653.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[1]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('첫 10행 상세 분석:\n');

for (let i = 0; i < Math.min(10, data.length); i++) {
  console.log(`\n행 ${i + 1}:`);
  const row = data[i];
  row.forEach((cell, idx) => {
    if (cell !== undefined) {
      console.log(`  [${idx}] ${cell}`);
    }
  });
}

// 헤더 찾기 (질병코드가 포함된 행)
console.log('\n\n질병코드가 있는 첫 행 찾기:');
for (let i = 0; i < Math.min(50, data.length); i++) {
  const row = data[i];
  const hasCode = row.some(cell => cell && (cell === 'A00.0' || cell === 'I63' || String(cell).match(/^[A-Z]\d/)));
  
  if (hasCode) {
    console.log(`\n행 ${i + 1}:`, row.slice(0, 10));
    break;
  }
}

