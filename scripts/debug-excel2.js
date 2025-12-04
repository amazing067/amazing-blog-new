const XLSX = require('xlsx');

const workbook = XLSX.readFile('data/홍길동_30세 남 한장보험료비교_20251204.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('41행 (마지막 행) 전체 내용:\n');
console.log(data[40]);  // 40 = 41행 (0-based)

console.log('\n\n모든 데이터 타입 확인:');
data[40].forEach((cell, idx) => {
  console.log(`  [${idx}] ${typeof cell}: ${cell}`);
});

