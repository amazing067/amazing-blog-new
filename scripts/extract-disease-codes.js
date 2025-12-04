const XLSX = require('xlsx');
const fs = require('fs');

console.log('🔍 질병분류표 KCD-9 주요 코드 추출\n');

const workbook = XLSX.readFile('data/질병분류표 KCD-9 DB masterfile_250701_20250701010653.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[1]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`총 행 수: ${data.length.toLocaleString()}개\n`);

// 주요 질병 키워드
const categories = {
  '암': ['암', '악성신생물', 'cancer', 'carcinoma', 'malignant'],
  '뇌혈관': ['뇌혈관', '뇌경색', '뇌출혈', 'cerebrovascular', 'stroke', 'cerebral'],
  '심장': ['심장', '심근경색', '협심증', 'cardiac', 'myocardial', 'heart'],
  '당뇨': ['당뇨', 'diabetes'],
  '고혈압': ['고혈압', 'hypertension'],
};

const diseaseCodes = [];

// 헤더는 3행 (인덱스 2)
// 데이터는 4행부터 (인덱스 3)
for (let i = 3; i < data.length; i++) {
  const row = data[i];
  
  // 질병코드가 있는 행만 처리
  const code = row[2];
  const korName = row[5];
  const engName = row[6];
  
  if (code && korName && String(code).match(/^[A-Z]\d/)) {
    // 주요 질병 카테고리 매칭
    for (const [category, keywords] of Object.entries(categories)) {
      const matchKor = keywords.some(k => korName.toLowerCase().includes(k.toLowerCase()));
      const matchEng = engName && keywords.some(k => engName.toLowerCase().includes(k.toLowerCase()));
      
      if (matchKor || matchEng) {
        diseaseCodes.push({
          code: code,
          korName: korName,
          engName: engName || '',
          category: category
        });
        break;  // 첫 번째 매칭된 카테고리만 사용
      }
    }
  }
}

console.log('📊 카테고리별 추출 결과:');
console.log('─'.repeat(60));
Object.keys(categories).forEach(cat => {
  const count = diseaseCodes.filter(d => d.category === cat).length;
  console.log(`  ${cat}: ${count}개`);
});
console.log(`  총합: ${diseaseCodes.length}개\n`);

// 각 카테고리별 샘플 출력
console.log('📝 카테고리별 샘플:');
console.log('─'.repeat(80));
Object.keys(categories).forEach(cat => {
  console.log(`\n[${cat}]`);
  const samples = diseaseCodes.filter(d => d.category === cat).slice(0, 5);
  samples.forEach(d => {
    console.log(`  ${d.code} | ${d.korName}`);
  });
});

// CSV 저장
const csvData = [['질병코드', '한글명', '영문명', '카테고리']];
diseaseCodes.forEach(item => {
  csvData.push([item.code, item.korName, item.engName, item.category]);
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

console.log(`\n\n💾 CSV 저장 완료!`);
console.log(`   📁 ${csvDir}/3_질병분류표_주요.csv`);
console.log(`   ${csvData.length - 1}개 질병 코드\n`);

console.log('✅ 질병분류표 추출 완료!');

