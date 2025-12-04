const XLSX = require('xlsx');
const fs = require('fs');

console.log('🔄 Google Sheets용 데이터 생성 시작\n');

// 보험료 파일 목록
const insuranceFiles = [
  { path: 'data/홍길동_30세 남 한장보험료비교_20251204.xlsx', age: 30, gender: '남' },
  { path: 'data/홍길동_30세 여 한장보험료비교_20251204.xlsx', age: 30, gender: '여' },
  { path: 'data/홍길동_40세 남 한장보험료비교_20251204.xlsx', age: 40, gender: '남' },
  { path: 'data/홍길동_40세 여 한장보험료비교_20251204.xlsx', age: 40, gender: '여' },
  { path: 'data/홍길동_50세 남 한장보험료비교_20251204.xlsx', age: 50, gender: '남' },
  { path: 'data/홍길동_50세 여 한장보험료비교_20251204.xlsx', age: 50, gender: '여' },
];

// Sheet 1: 보험상품_마스터
const productsData = [];
productsData.push(['보험사', '상품명', '특징', '업데이트일자']);

// 첫 번째 파일에서 상품 정보 추출
const firstFile = insuranceFiles[0];
const workbook = XLSX.readFile(firstFile.path);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

const headers = data[1];
const products = data[2];

// 보험사별 상품 정보
for (let i = 2; i < headers.length; i++) {
  const company = headers[i];
  const productName = products[i] || '';
  
  productsData.push([
    company,
    productName,
    '종합보험 상품',
    '2024-12-04'
  ]);
}

console.log('✅ Sheet 1: 보험상품_마스터 생성 완료');
console.log(`   ${productsData.length - 1}개 상품\n`);

// Sheet 2: 보험료_비교_요약
const comparisonData = [];
comparisonData.push(['연령', '성별', '보험사', '상품명', '총보험료', '순위', '특징']);

// 각 파일 처리
insuranceFiles.forEach(file => {
  const wb = XLSX.readFile(file.path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const fileData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const fileHeaders = fileData[1];
  const fileProducts = fileData[2];
  const lastRow = fileData[fileData.length - 1];
  
  // 총 보험료가 있는 행 찾기
  if (lastRow[0] && lastRow[0].includes('합계')) {
    const premiums = [];
    
    for (let i = 2; i < fileHeaders.length; i++) {
      if (lastRow[i] && typeof lastRow[i] === 'number') {
        premiums.push({
          company: fileHeaders[i],
          product: fileProducts[i] || '',
          premium: lastRow[i],
          rank: 0
        });
      }
    }
    
    // 보험료 순으로 정렬 & 순위 부여
    premiums.sort((a, b) => a.premium - b.premium);
    premiums.forEach((item, idx) => {
      item.rank = idx + 1;
      
      // TOP 3만 추가
      if (idx < 3) {
        let feature = '';
        if (idx === 0) feature = '최저가 ⭐';
        else if (idx === 1) feature = '2순위';
        else if (idx === 2) feature = '3순위';
        
        comparisonData.push([
          file.age,
          file.gender,
          item.company,
          item.product,
          item.premium,
          item.rank,
          feature
        ]);
      }
    });
  }
});

console.log('✅ Sheet 2: 보험료_비교_요약 생성 완료');
console.log(`   ${comparisonData.length - 1}개 비교 데이터\n`);

// Sheet 3: 담보별_보험료 (상세)
const coverageData = [];
coverageData.push(['연령', '성별', '담보명', '가입금액', '보험사', '보험료']);

// 30세 남성 파일에서 주요 담보 추출
const mainFile = insuranceFiles[0];
const mainWb = XLSX.readFile(mainFile.path);
const mainWs = mainWb.Sheets[mainWb.SheetNames[0]];
const mainData = XLSX.utils.sheet_to_json(mainWs, { header: 1 });

const mainHeaders = mainData[1];

// 주요 담보만 선택 (암진단비, 질병사망, 상해사망 등)
const importantCoverages = ['암진단비', '질병사망', '상해사망', '뇌혈관', '허혈성심장'];

for (let i = 3; i < mainData.length - 1; i++) {
  const row = mainData[i];
  const coverageName = row[0];
  
  if (coverageName && importantCoverages.some(keyword => coverageName.includes(keyword))) {
    const amount = row[1] || '';
    
    // 각 보험사 보험료
    for (let j = 2; j < Math.min(5, row.length); j++) {  // 처음 3개 보험사만
      if (row[j] && typeof row[j] === 'number') {
        coverageData.push([
          mainFile.age,
          mainFile.gender,
          coverageName,
          amount,
          mainHeaders[j],
          row[j]
        ]);
      }
    }
  }
}

console.log('✅ Sheet 3: 담보별_보험료 생성 완료');
console.log(`   ${coverageData.length - 1}개 담보 데이터\n`);

// CSV 파일로 저장
function arrayToCSV(data) {
  return data.map(row => 
    row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n'))) {
        return `"${cell}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
}

// 파일 저장
fs.writeFileSync('data/보험상품_마스터.csv', arrayToCSV(productsData), 'utf-8');
fs.writeFileSync('data/보험료_비교_요약.csv', arrayToCSV(comparisonData), 'utf-8');
fs.writeFileSync('data/담보별_보험료.csv', arrayToCSV(coverageData), 'utf-8');

console.log('💾 CSV 파일 생성 완료!');
console.log('   📄 data/보험상품_마스터.csv');
console.log('   📄 data/보험료_비교_요약.csv');
console.log('   📄 data/담보별_보험료.csv\n');

// 미리보기 출력
console.log('📊 Sheet 2 미리보기 (보험료_비교_요약):');
console.log('─'.repeat(80));
comparisonData.slice(0, 10).forEach(row => {
  console.log(row.join(' | '));
});

console.log('\n✅ 완료! 이제 Google Sheets에 import 하세요!');

