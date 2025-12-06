/**
 * Google Sheets에서 엑셀 데이터를 자동으로 변환하는 스크립트
 * 
 * 사용 방법:
 * 1. Google Sheets에서 "확장 프로그램" > "Apps Script" 열기
 * 2. 이 스크립트를 붙여넣기
 * 3. 함수 이름 지정 (예: convertPremiumData)
 * 4. 실행
 */

/**
 * 현재 시트의 가로형 데이터를 세로형으로 변환
 * 원본 데이터 구조:
 * - A열: 담보명
 * - B열: 가입금액
 * - C열 이후: 각 보험사별 보험료
 * 
 * 변환 후 구조:
 * - 연령 | 성별 | 담보명 | 가입금액 | 보험사 | 보험료
 */
function convertPremiumData() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // 헤더 행 찾기 (보험사 이름이 있는 행)
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(5, data.length); i++) {
    if (data[i][0] === '담보명' || data[i][0] === '담보') {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    SpreadsheetApp.getUi().alert('헤더 행을 찾을 수 없습니다. "담보명" 열을 확인하세요.');
    return;
  }
  
  const headerRow = data[headerRowIndex];
  const insuranceCompanies = [];
  
  // 보험사 이름 추출 (B열 이후, "가입금액" 다음부터)
  for (let col = 2; col < headerRow.length; col++) {
    if (headerRow[col] && headerRow[col] !== '합계' && headerRow[col] !== '') {
      insuranceCompanies.push({
        name: headerRow[col],
        colIndex: col
      });
    }
  }
  
  if (insuranceCompanies.length === 0) {
    SpreadsheetApp.getUi().alert('보험사 이름을 찾을 수 없습니다.');
    return;
  }
  
  // 연령과 성별 입력받기
  const ui = SpreadsheetApp.getUi();
  const ageResponse = ui.prompt('연령을 입력하세요', '예: 30', ui.ButtonSet.OK_CANCEL);
  if (ageResponse.getSelectedButton() !== ui.Button.OK) return;
  const age = ageResponse.getResponseText().trim();
  
  const genderResponse = ui.prompt('성별을 입력하세요', '남 또는 여', ui.ButtonSet.OK_CANCEL);
  if (genderResponse.getSelectedButton() !== ui.Button.OK) return;
  const gender = genderResponse.getResponseText().trim();
  
  // 변환된 데이터 저장할 배열
  const convertedData = [];
  convertedData.push(['연령', '성별', '담보명', '가입금액', '보험사', '보험료']); // 헤더
  
  // 데이터 변환 (헤더 다음 행부터 시작)
  for (let row = headerRowIndex + 1; row < data.length; row++) {
    const coverageName = data[row][0]; // 담보명
    const subscriptionAmount = data[row][1]; // 가입금액
    
    // "합계" 행은 건너뛰기
    if (!coverageName || coverageName === '합계' || coverageName === '') continue;
    
    // 각 보험사별로 데이터 변환
    for (const company of insuranceCompanies) {
      const premium = data[row][company.colIndex];
      if (premium && premium !== '' && premium !== 0) {
        // 숫자로 변환 (문자열이면 쉼표 제거)
        const premiumValue = typeof premium === 'string' 
          ? parseInt(premium.replace(/,/g, '')) 
          : premium;
        
        if (premiumValue && premiumValue > 0) {
          convertedData.push([
            age,
            gender,
            coverageName,
            subscriptionAmount,
            company.name,
            premiumValue
          ]);
        }
      }
    }
  }
  
  // 새 시트 생성
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const newSheetName = `담보별_보험료_${age}세_${gender}`;
  let newSheet = ss.getSheetByName(newSheetName);
  
  if (newSheet) {
    // 기존 시트가 있으면 삭제하고 새로 생성
    ss.deleteSheet(newSheet);
  }
  
  newSheet = ss.insertSheet(newSheetName);
  newSheet.getRange(1, 1, convertedData.length, 6).setValues(convertedData);
  
  SpreadsheetApp.getUi().alert(`변환 완료! ${convertedData.length - 1}개의 데이터가 생성되었습니다.`);
}

/**
 * 여러 시트의 데이터를 하나로 합치는 함수
 * "담보별_보험료_30세_남", "담보별_보험료_30세_여" 등을 합침
 */
function mergePremiumData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  // 담보별_보험료로 시작하는 시트 찾기
  const premiumSheets = sheets.filter(sheet => 
    sheet.getName().startsWith('담보별_보험료_')
  );
  
  if (premiumSheets.length === 0) {
    SpreadsheetApp.getUi().alert('변환된 시트를 찾을 수 없습니다.');
    return;
  }
  
  // 최종 통합 데이터
  const allData = [];
  allData.push(['연령', '성별', '담보명', '가입금액', '보험사', '보험료']); // 헤더
  
  // 각 시트의 데이터 합치기
  premiumSheets.forEach(sheet => {
    const data = sheet.getDataRange().getValues();
    // 헤더 제외하고 추가
    for (let i = 1; i < data.length; i++) {
      allData.push(data[i]);
    }
  });
  
  // 통합 시트 생성
  let mergedSheet = ss.getSheetByName('담보별_보험료');
  if (mergedSheet) {
    ss.deleteSheet(mergedSheet);
  }
  
  mergedSheet = ss.insertSheet('담보별_보험료');
  mergedSheet.getRange(1, 1, allData.length, 6).setValues(allData);
  
  SpreadsheetApp.getUi().alert(`통합 완료! 총 ${allData.length - 1}개의 데이터가 생성되었습니다.`);
}

