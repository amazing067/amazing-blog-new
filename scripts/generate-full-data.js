const XLSX = require('xlsx');
const fs = require('fs');

console.log('🔄 전체 보험료 데이터 생성 (TOP 3 아님, 전부!)\n');

const insuranceFiles = [
  { path: 'data/홍길동_30세 남 한장보험료비교_20251204.xlsx', age: 30, gender: '남' },
  { path: 'data/홍길동_30세 여 한장보험료비교_20251204.xlsx', age: 30, gender: '여' },
  { path: 'data/홍길동_40세 남 한장보험료비교_20251204.xlsx', age: 40, gender: '남' },
  { path: 'data/홍길동_40세 여 한장보험료비교_20251204.xlsx', age: 40, gender: '여' },
  { path: 'data/홍길동_50세 남 한장보험료비교_20251204.xlsx', age: 50, gender: '남' },
  { path: 'data/홍길동_50세 여 한장보험료비교_20251204.xlsx', age: 50, gender: '여' },
];

function parsePremium(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// 전체 보험료 데이터
console.log('📋 전체 보험료 데이터 생성 중...');
const allData = [['연령', '성별', '보험사', '상품명', '총보험료', '순위', '가성비등급']];

insuranceFiles.forEach(file => {
  console.log(`  처리 중: ${file.age}세 ${file.gender}`);
  
  const wb = XLSX.readFile(file.path);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const fileData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  
  const fileHeaders = fileData[1];
  const fileProducts = fileData[2];
  const lastRow = fileData[fileData.length - 1];
  
  if (lastRow && lastRow[0] && String(lastRow[0]).includes('합계')) {
    const premiums = [];
    
    // 모든 보험사 추출
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
    
    console.log(`    추출: ${premiums.length}개 보험사`);
    
    if (premiums.length > 0) {
      // 보험료 순으로 정렬
      premiums.sort((a, b) => a.premium - b.premium);
      
      // 모든 보험사 추가 (TOP 3 아님!)
      premiums.forEach((item, idx) => {
        let grade = '';
        if (idx === 0) grade = 'S등급 (최저가)';
        else if (idx === 1) grade = 'A등급';
        else if (idx === 2) grade = 'B등급';
        else if (idx <= 4) grade = 'C등급';
        else grade = 'D등급';
        
        allData.push([
          file.age,
          file.gender,
          item.company,
          item.product,
          Math.round(item.premium),
          idx + 1,
          grade
        ]);
      });
      
      console.log(`    ✓ ${premiums.length}개 전부 추가 (최저가: ${Math.round(premiums[0].premium).toLocaleString()}원)`);
    }
  }
});

console.log(`\n✅ 총 ${allData.length - 1}개 보험사 데이터 추출\n`);

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

fs.writeFileSync(`${csvDir}/2_보험료_전체_비교.csv`, arrayToCSV(allData), 'utf-8');

console.log('💾 CSV 파일 저장 완료!');
console.log(`   📁 ${csvDir}/2_보험료_전체_비교.csv\n`);

// 미리보기
console.log('📊 미리보기 (처음 20개):');
console.log('─'.repeat(100));
allData.slice(0, 21).forEach((row, idx) => {
  if (idx === 0) {
    console.log(`\n${row.join(' | ')}\n${'─'.repeat(100)}`);
  } else {
    console.log(row.join(' | '));
  }
});

console.log('\n\n✅ 완료! 이제 모든 보험사 비교 가능!');

