const XLSX = require('xlsx');
const fs = require('fs');

console.log('🔄 Google Sheets용 데이터 생성 (최종)\n');

// 보험료 파일 목록
const insuranceFiles = [
  { path: 'data/홍길동_30세 남 한장보험료비교_20251204.xlsx', age: 30, gender: '남' },
  { path: 'data/홍길동_30세 여 한장보험료비교_20251204.xlsx', age: 30, gender: '여' },
  { path: 'data/홍길동_40세 남 한장보험료비교_20251204.xlsx', age: 40, gender: '남' },
  { path: 'data/홍길동_40세 여 한장보험료비교_20251204.xlsx', age: 40, gender: '여' },
  { path: 'data/홍길동_50세 남 한장보험료비교_20251204.xlsx', age: 50, gender: '남' },
  { path: 'data/홍길동_50세 여 한장보험료비교_20251204.xlsx', age: 50, gender: '여' },
];

// 문자열 보험료를 숫자로 변환
function parsePremium(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // 쉼표 제거 후 숫자로 변환
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Sheet 1: 보험상품_마스터
console.log('📋 Sheet 1: 보험상품_마스터 생성 중...');
const productsData = [['보험사', '상품명', '특징', '업데이트일자']];

const firstWorkbook = XLSX.readFile(insuranceFiles[0].path);
const firstWorksheet = firstWorkbook.Sheets[firstWorkbook.SheetNames[0]];
const firstData = XLSX.utils.sheet_to_json(firstWorksheet, { header: 1 });

const headers = firstData[1];
const products = firstData[2];

for (let i = 2; i < headers.length; i++) {
  productsData.push([
    headers[i],
    products[i] || '',
    '종합보험 상품',
    '2024-12-04'
  ]);
}

console.log(`✅ ${productsData.length - 1}개 상품 추출\n`);

// Sheet 2: 보험료_비교_요약
console.log('📋 Sheet 2: 보험료_비교_요약 생성 중...');
const comparisonData = [['연령', '성별', '보험사', '상품명', '총보험료', '순위', '특징']];

insuranceFiles.forEach(file => {
  console.log(`  처리 중: ${file.age}세 ${file.gender}`);
  
  const wb = XLSX.readFile(file.path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const fileData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const fileHeaders = fileData[1];
  const fileProducts = fileData[2];
  
  // 마지막 행 (합계)
  const lastRow = fileData[fileData.length - 1];
  
  if (lastRow && lastRow[0] && String(lastRow[0]).includes('합계')) {
    const premiums = [];
    
    for (let i = 2; i < fileHeaders.length; i++) {
      const premiumValue = parsePremium(lastRow[i]);
      
      if (premiumValue > 0) {
        premiums.push({
          company: fileHeaders[i],
          product: fileProducts[i] || '',
          premium: premiumValue
        });
      }
    }
    
    console.log(`    추출된 보험사: ${premiums.length}개`);
    
    if (premiums.length > 0) {
      // 보험료 순으로 정렬
      premiums.sort((a, b) => a.premium - b.premium);
      
      // TOP 3 추가
      premiums.slice(0, 3).forEach((item, idx) => {
        let feature = '';
        if (idx === 0) feature = '최저가 ⭐';
        else if (idx === 1) feature = '가성비 👍';
        else if (idx === 2) feature = '안정형 ✓';
        
        comparisonData.push([
          file.age,
          file.gender,
          item.company,
          item.product,
          Math.round(item.premium),  // 반올림
          idx + 1,
          feature
        ]);
      });
      
      console.log(`    ✓ TOP 3 추출 완료 (최저가: ${Math.round(premiums[0].premium).toLocaleString()}원)`);
    }
  } else {
    console.log(`    ⚠️  합계 행 없음`);
  }
});

console.log(`\n✅ ${comparisonData.length - 1}개 비교 데이터 추출\n`);

// CSV 저장
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

fs.writeFileSync(`${csvDir}/1_보험상품_마스터.csv`, '\uFEFF' + arrayToCSV(productsData), 'utf-8');
fs.writeFileSync(`${csvDir}/2_보험료_비교_요약.csv`, '\uFEFF' + arrayToCSV(comparisonData), 'utf-8');

console.log('💾 CSV 파일 저장 완료!');
console.log(`   📁 ${csvDir}/1_보험상품_마스터.csv`);
console.log(`   📁 ${csvDir}/2_보험료_비교_요약.csv\n`);

// 미리보기
console.log('📊 미리보기: 보험료_비교_요약');
console.log('─'.repeat(100));
comparisonData.slice(0, 20).forEach((row, idx) => {
  if (idx === 0) {
    console.log(`\n${row.join(' | ')}\n${'─'.repeat(100)}`);
  } else {
    console.log(row.join(' | '));
  }
});

console.log('\n\n✅ 완료! Google Sheets에 import 하세요!');
console.log('\n📖 사용 방법:');
console.log('1. Google Sheets 새로 만들기');
console.log('2. 파일 → 가져오기 → 업로드');
console.log('3. CSV 파일 2개 업로드');
console.log('4. 각각 새 시트로 import');

