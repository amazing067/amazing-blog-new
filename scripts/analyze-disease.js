const XLSX = require('xlsx');
const fs = require('fs');

console.log('🔍 질병분류표 KCD-9 분석\n');

const workbook = XLSX.readFile('data/질병분류표 KCD-9 DB masterfile_250701_20250701010653.xlsx');

console.log(`시트 목록: ${workbook.SheetNames.join(', ')}\n`);

// 두 번째 시트 분석 (KCD-8 DB Masterfile)
const sheetName = workbook.SheetNames[1];  // 두 번째 시트
console.log(`분석 시트: ${sheetName}\n`);

const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`총 행 수: ${data.length.toLocaleString()}개\n`);

// 헤더 확인
console.log('📋 컬럼 헤더:');
if (data.length > 0) {
  data[0].forEach((header, index) => {
    console.log(`  ${index + 1}. ${header}`);
  });
}

// 샘플 데이터 (첫 10개)
console.log('\n📝 샘플 데이터 (첫 10개):');
console.log('─'.repeat(80));
for (let i = 1; i < Math.min(11, data.length); i++) {
  const row = data[i];
  console.log(`${row[0]} | ${row[1]} | ${row[2] || ''}`);
}

// 주요 질병 코드 찾기 (암, 뇌혈관, 심장)
console.log('\n🔍 주요 질병 코드 검색:');
console.log('─'.repeat(80));

const keywords = ['암', '뇌혈관', '심장', '뇌경색', '뇌출혈'];
const importantCodes = [];

for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const code = row[0];
  const name = row[1];
  
  if (name && keywords.some(keyword => name.includes(keyword))) {
    importantCodes.push({
      code: code,
      name: name,
      detail: row[2] || ''
    });
    
    if (importantCodes.length <= 20) {  // 처음 20개만 출력
      console.log(`${code} | ${name}`);
    }
  }
}

console.log(`\n✅ 주요 질병 ${importantCodes.length}개 발견`);

// CSV로 저장 (주요 질병만)
const csvData = [['질병코드', '질병명', '상세설명', '카테고리']];

importantCodes.forEach(item => {
  let category = '';
  if (item.name.includes('암')) category = '암';
  else if (item.name.includes('뇌')) category = '뇌혈관';
  else if (item.name.includes('심장')) category = '심장';
  
  csvData.push([item.code, item.name, item.detail, category]);
});

function arrayToCSV(data) {
  return data.map(row => 
    row.map(cell => {
      const str = String(cell || '');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
}

const csvDir = 'data/sheets';
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir, { recursive: true });
}

fs.writeFileSync(`${csvDir}/3_질병분류표_주요.csv`, '\uFEFF' + arrayToCSV(csvData), 'utf-8');

console.log(`\n💾 CSV 저장 완료: ${csvDir}/3_질병분류표_주요.csv`);
console.log(`   ${csvData.length - 1}개 주요 질병 코드\n`);

console.log('✅ 분석 완료!');

