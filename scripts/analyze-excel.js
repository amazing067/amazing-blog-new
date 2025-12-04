const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 엑셀 파일 분석
function analyzeExcel(filePath) {
  console.log(`\n📊 분석 중: ${path.basename(filePath)}`);
  console.log('='.repeat(60));
  
  const workbook = XLSX.readFile(filePath);
  
  console.log(`\n시트 목록: ${workbook.SheetNames.join(', ')}`);
  
  // 첫 번째 시트 분석
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // JSON으로 변환 (헤더 포함)
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  console.log(`\n총 행 수: ${data.length}`);
  
  // 헤더 (첫 번째 행)
  console.log('\n📋 컬럼 헤더:');
  if (data.length > 0) {
    data[0].forEach((header, index) => {
      console.log(`  ${index + 1}. ${header}`);
    });
  }
  
  // 샘플 데이터 (첫 3행)
  console.log('\n📝 샘플 데이터 (첫 3행):');
  for (let i = 0; i < Math.min(3, data.length); i++) {
    console.log(`\n행 ${i + 1}:`, JSON.stringify(data[i], null, 2));
  }
  
  console.log('\n' + '='.repeat(60));
}

// 보험료 비교 파일 분석
const insuranceFiles = [
  'data/홍길동_30세 남 한장보험료비교_20251204.xlsx',
];

console.log('🔍 엑셀 파일 구조 분석 시작\n');

insuranceFiles.forEach(file => {
  if (fs.existsSync(file)) {
    analyzeExcel(file);
  } else {
    console.log(`❌ 파일 없음: ${file}`);
  }
});

console.log('\n✅ 분석 완료!');

