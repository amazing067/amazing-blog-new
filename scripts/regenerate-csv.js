const fs = require('fs');

console.log('📄 CSV 파일 재생성 (BOM 제거)\n');

// 기존 파일 읽기
const csvFiles = [
  'data/sheets/1_보험상품_마스터.csv',
  'data/sheets/2_보험료_비교_요약.csv',
  'data/sheets/3_질병분류표_주요.csv'
];

csvFiles.forEach(file => {
  console.log(`처리 중: ${file}`);
  
  // 읽기
  let content = fs.readFileSync(file, 'utf-8');
  
  // BOM 제거
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.substring(1);
    console.log('  ✓ BOM 제거');
  }
  
  // 다시 저장 (BOM 없이)
  fs.writeFileSync(file, content, 'utf-8');
  console.log('  ✓ 저장 완료\n');
});

console.log('✅ 완료! 다시 import 해보세요!');

