const XLSX = require('xlsx');
const fs = require('fs');

// 모든 보험료 파일 읽기
const files = [
  { path: 'data/홍길동_30세 남 한장보험료비교_20251204.xlsx', age: 30, gender: '남' },
  { path: 'data/홍길동_30세 여 한장보험료비교_20251204.xlsx', age: 30, gender: '여' },
  { path: 'data/홍길동_40세 남 한장보험료비교_20251204.xlsx', age: 40, gender: '남' },
  { path: 'data/홍길동_40세 여 한장보험료비교_20251204.xlsx', age: 40, gender: '여' },
  { path: 'data/홍길동_50세 남 한장보험료비교_20251204.xlsx', age: 50, gender: '남' },
  { path: 'data/홍길동_50세 여 한장보험료비교_20251204.xlsx', age: 50, gender: '여' },
];

console.log('📊 보험료 데이터 통합 분석\n');

// 30세 남성 파일 상세 분석
const sampleFile = files[0];
console.log(`🔍 샘플 분석: ${sampleFile.age}세 ${sampleFile.gender}\n`);

const workbook = XLSX.readFile(sampleFile.path);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// 헤더 행 (2행)
const headers = data[1];
console.log('📋 보험사 목록:');
headers.slice(2).forEach((company, idx) => {
  console.log(`  ${idx + 1}. ${company}`);
});

// 상품명 (3행)
const products = data[2];
console.log('\n📦 상품명:');
products.slice(2).forEach((product, idx) => {
  console.log(`  ${headers[idx + 2]}: ${product}`);
});

// 담보 및 보험료 (4행부터)
console.log('\n💰 담보 및 보험료 샘플 (첫 10개):');
for (let i = 3; i < Math.min(13, data.length); i++) {
  const row = data[i];
  if (row[0]) {  // 담보명이 있는 경우
    console.log(`\n담보: ${row[0]}`);
    console.log(`가입금액: ${row[1] || 'N/A'}`);
    
    // 첫 3개 보험사 보험료만 출력
    for (let j = 2; j < Math.min(5, row.length); j++) {
      if (row[j] && row[j] !== '-' && row[j] !== 0) {
        console.log(`  ${headers[j]}: ${row[j]}원`);
      }
    }
  }
}

// 마지막 행 (총 보험료)
console.log('\n\n💵 총 보험료:');
const lastRow = data[data.length - 1];
if (lastRow[0] && lastRow[0].includes('합계')) {
  for (let j = 2; j < headers.length; j++) {
    if (lastRow[j]) {
      console.log(`  ${headers[j]}: ${lastRow[j]}원`);
    }
  }
}

console.log('\n✅ 분석 완료!');

