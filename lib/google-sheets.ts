import { google } from 'googleapis';

// Google Sheets 공개 API (API 키 사용)
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

export interface InsuranceProduct {
  company: string;
  productName: string;
  feature: string;
  updatedAt: string;
}

export interface InsuranceComparison {
  age: number;
  gender: string;
  company: string;
  productName: string;
  totalPremium: number;
  rank: number;
  feature: string;
}

export interface DiseaseCode {
  code: string;
  korName: string;
  engName: string;
  category: string;
}

export interface SheetsData {
  products: InsuranceProduct[];
  comparisons: InsuranceComparison[];
  diseaseCodes: DiseaseCode[];
}

/**
 * Google Sheets에서 데이터 가져오기
 */
export async function fetchSheetsData(): Promise<SheetsData> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: GOOGLE_API_KEY });

    // 2개 시트 동시에 읽기
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: GOOGLE_SHEETS_ID,
      ranges: [
        '보험료_전체_비교!A2:G',  // 헤더 제외
        '질병분류표_주요!A2:D'
      ],
    });

    const [comparisonsRange, diseaseCodesRange] = response.data.valueRanges || [];

    // 보험료 비교 파싱 (전체 데이터)
    const comparisons: InsuranceComparison[] = (comparisonsRange?.values || []).map(row => ({
      age: parseInt(row[0]) || 0,
      gender: row[1] || '',
      company: row[2] || '',
      productName: row[3] || '',
      totalPremium: parseInt(String(row[4]).replace(/,/g, '')) || 0,
      rank: parseInt(row[5]) || 0,
      feature: row[6] || '',
    }));

    // 보험상품 목록 추출 (comparisons에서)
    const productsMap = new Map<string, InsuranceProduct>();
    comparisons.forEach(comp => {
      if (!productsMap.has(comp.company)) {
        productsMap.set(comp.company, {
          company: comp.company,
          productName: comp.productName,
          feature: comp.feature,
          updatedAt: '2024-12-04'
        });
      }
    });
    const products = Array.from(productsMap.values());

    // 질병 코드 파싱
    const diseaseCodes: DiseaseCode[] = (diseaseCodesRange?.values || []).map(row => ({
      code: row[0] || '',
      korName: row[1] || '',
      engName: row[2] || '',
      category: row[3] || '',
    }));

    return {
      products,
      comparisons,
      diseaseCodes,
    };
  } catch (error) {
    console.error('Google Sheets 읽기 오류:', error);
    
    // 폴백: 빈 데이터 반환
    return {
      products: [],
      comparisons: [],
      diseaseCodes: [],
    };
  }
}

/**
 * 나이/성별에 맞는 보험료 TOP 3 가져오기
 */
export function getTopInsurance(
  comparisons: InsuranceComparison[],
  age: number,
  gender: string
): InsuranceComparison[] {
  return comparisons
    .filter(c => c.age === age && c.gender === gender)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);
}

/**
 * 카테고리별 질병 코드 가져오기
 */
export function getDiseasesByCategory(
  diseaseCodes: DiseaseCode[],
  category: string
): DiseaseCode[] {
  return diseaseCodes
    .filter(d => d.category === category)
    .slice(0, 10);  // 상위 10개만
}

