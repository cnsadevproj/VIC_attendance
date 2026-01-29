const ALLOWED_ORIGINS = [
  'https://vic-attendance.web.app',
  'https://vic-attendance.firebaseapp.com',
  'http://localhost:3000',
  'http://localhost:5173'
];

const TEMPLATE_SHEET_NAME = '템플릿';

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'VIC Attendance Export API' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);

    const data = JSON.parse(e.postData.contents);
    const { date, displayDate, sheetName, grade1Students, grade2Students, notesText } = data;

    if (!date || !sheetName) {
      return output.setContent(JSON.stringify({
        success: false,
        message: '필수 데이터가 없습니다 (date, sheetName)'
      }));
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      const templateSheet = ss.getSheetByName(TEMPLATE_SHEET_NAME);
      if (templateSheet) {
        sheet = templateSheet.copyTo(ss);
        sheet.setName(sheetName);
        sheet.showSheet();
        ss.setActiveSheet(sheet);
        ss.moveActiveSheet(1);
      } else {
        sheet = ss.insertSheet(sheetName, 0);
        setupNewSheet(sheet);
      }
    } else {
      clearDataArea(sheet);
      sheet.showSheet();
    }

    sheet.getRange('B2').setValue(displayDate);

    if (grade1Students && grade1Students.length > 0) {
      const grade1Data = grade1Students.map(s => [s.seatId, s.name, s.note]);
      sheet.getRange(8, 2, grade1Data.length, 3).setValues(grade1Data);
    }

    if (grade2Students && grade2Students.length > 0) {
      const grade2Data = grade2Students.map(s => [s.seatId, s.name, s.note]);
      sheet.getRange(8, 7, grade2Data.length, 3).setValues(grade2Data);
    }

    if (notesText) {
      sheet.getRange('K1').setValue('[특이사항]').setFontWeight('bold');
      var notesLines = notesText.split('\n');
      for (var i = 0; i < notesLines.length; i++) {
        sheet.getRange(2 + i, 11).setValue(notesLines[i]);
      }
      sheet.setColumnWidth(11, 250);
    }

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

function setupNewSheet(sheet) {
  sheet.getRange('B1').setValue('1학년 결석자');
  sheet.getRange('B3').setValue('좌석');
  sheet.getRange('C3').setValue('이름');
  sheet.getRange('D3').setValue('비고');

  sheet.getRange('G1').setValue('2학년 결석자');
  sheet.getRange('G3').setValue('좌석');
  sheet.getRange('H3').setValue('이름');
  sheet.getRange('I3').setValue('비고');

  sheet.getRange('B1:D1').merge().setBackground('#e3f2fd').setFontWeight('bold');
  sheet.getRange('G1:I1').merge().setBackground('#e8f5e9').setFontWeight('bold');
  sheet.getRange('B3:D3').setBackground('#f5f5f5').setFontWeight('bold');
  sheet.getRange('G3:I3').setBackground('#f5f5f5').setFontWeight('bold');

  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(7, 80);
  sheet.setColumnWidth(8, 80);
  sheet.setColumnWidth(9, 150);
  sheet.setColumnWidth(11, 250);
}

function clearDataArea(sheet) {
  sheet.getRange('B8:D100').clearContent();
  sheet.getRange('G8:I100').clearContent();
  sheet.getRange('K1:K50').clearContent();
}

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
