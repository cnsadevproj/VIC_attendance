/**
 * VIC 출결 - 결석자 내보내기 Apps Script
 *
 * 사용법:
 * 1. Google Sheets에서 확장 프로그램 > Apps Script 클릭
 * 2. 이 코드를 붙여넣기
 * 3. 배포 > 새 배포 > 웹 앱 선택
 * 4. 실행 권한: 나, 액세스 권한: 모든 사용자
 * 5. 배포 후 웹 앱 URL 복사
 * 6. 아래 ALLOWED_ORIGINS에 프론트엔드 URL 추가 (선택)
 */

// CORS 허용 도메인 (보안을 위해 설정)
const ALLOWED_ORIGINS = [
  'https://vic-attendance.web.app',
  'https://vic-attendance.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173'
];

// 템플릿 시트 ID (복사할 시트)
const TEMPLATE_SHEET_NAME = '템플릿'; // 또는 기존 시트 이름

/**
 * GET 요청 처리 (테스트용)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'VIC Attendance Export API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST 요청 처리 (결석자 데이터 저장)
 */
function doPost(e) {
  try {
    // CORS 헤더
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);

    // 요청 데이터 파싱
    const data = JSON.parse(e.postData.contents);
    const { date, displayDate, sheetName, grade1Students, grade2Students } = data;

    if (!date || !sheetName) {
      return output.setContent(JSON.stringify({
        success: false,
        message: '필수 데이터가 없습니다 (date, sheetName)'
      }));
    }

    // 스프레드시트 가져오기
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 시트 찾기 또는 생성
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // 템플릿 시트 복사 또는 새 시트 생성
      const templateSheet = ss.getSheetByName(TEMPLATE_SHEET_NAME);
      if (templateSheet) {
        sheet = templateSheet.copyTo(ss);
        sheet.setName(sheetName);
        // 숨김 해제 (템플릿이 숨겨져 있어도 새 시트는 보이게)
        sheet.showSheet();
        // 맨 앞으로 이동
        ss.setActiveSheet(sheet);
        ss.moveActiveSheet(1);
      } else {
        // 템플릿이 없으면 새 시트 생성
        sheet = ss.insertSheet(sheetName, 0);
        setupNewSheet(sheet);
      }
    } else {
      // 기존 시트가 있으면 데이터 영역만 클리어
      clearDataArea(sheet);
      // 숨겨져 있으면 보이게
      sheet.showSheet();
    }

    // B2: 날짜 입력
    sheet.getRange('B2').setValue(displayDate);

    // 1학년 결석자 입력 (B8부터)
    if (grade1Students && grade1Students.length > 0) {
      const grade1Data = grade1Students.map(s => [s.seatId, s.name, s.note]);
      sheet.getRange(8, 2, grade1Data.length, 3).setValues(grade1Data);
    }

    // 2학년 결석자 입력 (G8부터)
    if (grade2Students && grade2Students.length > 0) {
      const grade2Data = grade2Students.map(s => [s.seatId, s.name, s.note]);
      sheet.getRange(8, 7, grade2Data.length, 3).setValues(grade2Data);
    }

    // 결과 반환
    const totalCount = (grade1Students?.length || 0) + (grade2Students?.length || 0);
    return output.setContent(JSON.stringify({
      success: true,
      message: `${sheetName} 시트에 결석자 ${totalCount}명 저장 완료`,
      sheetUrl: ss.getUrl() + '#gid=' + sheet.getSheetId()
    }));

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: '오류: ' + error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 새 시트 기본 설정
 */
function setupNewSheet(sheet) {
  // 헤더 설정
  sheet.getRange('B1').setValue('1학년 결석자');
  sheet.getRange('B3').setValue('좌석');
  sheet.getRange('C3').setValue('이름');
  sheet.getRange('D3').setValue('비고');

  sheet.getRange('G1').setValue('2학년 결석자');
  sheet.getRange('G3').setValue('좌석');
  sheet.getRange('H3').setValue('이름');
  sheet.getRange('I3').setValue('비고');

  // 스타일 적용
  sheet.getRange('B1:D1').merge().setBackground('#e3f2fd').setFontWeight('bold');
  sheet.getRange('G1:I1').merge().setBackground('#e8f5e9').setFontWeight('bold');
  sheet.getRange('B3:D3').setBackground('#f5f5f5').setFontWeight('bold');
  sheet.getRange('G3:I3').setBackground('#f5f5f5').setFontWeight('bold');

  // 열 너비 조정
  sheet.setColumnWidth(2, 80);  // B: 좌석
  sheet.setColumnWidth(3, 80);  // C: 이름
  sheet.setColumnWidth(4, 150); // D: 비고
  sheet.setColumnWidth(7, 80);  // G: 좌석
  sheet.setColumnWidth(8, 80);  // H: 이름
  sheet.setColumnWidth(9, 150); // I: 비고
}

/**
 * 데이터 영역만 클리어 (헤더 유지)
 */
function clearDataArea(sheet) {
  // 1학년 데이터 영역 (B8:D100)
  sheet.getRange('B8:D100').clearContent();
  // 2학년 데이터 영역 (G8:I100)
  sheet.getRange('G8:I100').clearContent();
}

/**
 * 테스트 함수
 */
function testExport() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        date: '2025-12-26',
        displayDate: '12월 26일(목)',
        sheetName: '251226',
        grade1Students: [
          { seatId: '4A101', name: '테스트1', note: '[사전] 병원' },
          { seatId: '4B205', name: '테스트2', note: '' }
        ],
        grade2Students: [
          { seatId: '3A103', name: '테스트3', note: '조퇴' }
        ]
      })
    }
  };

  const result = doPost(testData);
  Logger.log(result.getContent());
}
