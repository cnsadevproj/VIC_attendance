const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1414838907299692626/JFA44m5Pf_iw3BILrS1rgY9vs0Mg_ajZDrMODKtScpjqmyz3znEFxr7hXbOPoKYGilig'

export interface AbsentStudentForDiscord {
  seatId: string
  name: string
  note: string
  grade: number
}

export interface DiscordReportParams {
  message: string
  displayDate: string
  absentStudents: AbsentStudentForDiscord[]
  noticeText?: string
}

export interface DiscordReportResult {
  success: boolean
  message?: string
  error?: string
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas → Blob 변환 실패'))
    }, 'image/png')
  })
}

interface RenderParams {
  displayDate: string
  grade1Rows: string[][]
  grade2Rows: string[][]
  noticeText: string
}

async function renderTablePng(params: RenderParams): Promise<Blob> {
  const { displayDate, grade1Rows, grade2Rows, noticeText } = params

  const fontSize = 14
  const titleFontSize = 16
  const subtitleFontSize = 12
  const padding = { x: 10, y: 7 }
  const borderColor = '#999999'
  const font = `${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  const boldFont = `bold ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  const titleFont = `bold ${titleFontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  const subtitleFont = `${subtitleFontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`

  const subHeaders = ['순번', '좌석번호', '이름', '비고']
  const sectionColCount = subHeaders.length

  const maxRows = Math.max(grade1Rows.length, grade2Rows.length, 1)

  const measureCanvas = document.createElement('canvas')
  const mCtx = measureCanvas.getContext('2d')!

  const colWidths = new Array(sectionColCount).fill(0)
  mCtx.font = boldFont
  for (let i = 0; i < sectionColCount; i++) {
    colWidths[i] = mCtx.measureText(subHeaders[i]).width + padding.x * 2
  }

  mCtx.font = font
  const allDataRows = [...grade1Rows, ...grade2Rows]
  for (const row of allDataRows) {
    for (let i = 0; i < sectionColCount; i++) {
      const text = String(row[i] || '')
      const w = mCtx.measureText(text).width + padding.x * 2
      colWidths[i] = Math.max(colWidths[i], w)
    }
  }
  colWidths[0] = Math.max(colWidths[0], 45)
  colWidths[1] = Math.max(colWidths[1], 70)
  colWidths[2] = Math.max(colWidths[2], 55)
  colWidths[3] = Math.max(colWidths[3], 80)

  const sectionWidth = colWidths.reduce((s, w) => s + w, 0)

  mCtx.font = boldFont
  const noticeLabel = '[특이사항]'
  const noticeLabelWidth = mCtx.measureText(noticeLabel).width + padding.x * 2
  let noticeColWidth = Math.max(noticeLabelWidth, 75)

  if (noticeText) {
    mCtx.font = subtitleFont
    const lines = noticeText.split('\n')
    for (const line of lines) {
      const w = mCtx.measureText(line).width + padding.x * 2
      noticeColWidth = Math.max(noticeColWidth, Math.min(w, 200))
    }
  }

  const rowHeight = fontSize + padding.y * 2
  const titleHeight = titleFontSize + padding.y * 2 + 6
  const subtitleHeight = subtitleFontSize + padding.y * 2
  const gradeHeaderHeight = rowHeight
  const totalWidth = Math.ceil(sectionWidth * 2 + noticeColWidth) + 2
  const totalHeight = Math.ceil(
    titleHeight + subtitleHeight + gradeHeaderHeight + rowHeight + rowHeight * maxRows
  ) + 2

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = totalWidth * dpr
  canvas.height = totalHeight * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  function drawCell(
    x: number, cy: number, w: number, h: number,
    text: string, bg: string, fg: string, f: string,
    align: CanvasTextAlign = 'center'
  ) {
    ctx.fillStyle = bg
    ctx.fillRect(x, cy, w, h)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.strokeRect(x, cy, w, h)
    ctx.fillStyle = fg
    ctx.font = f
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    if (align === 'left') {
      ctx.fillText(text, x + padding.x, cy + h / 2)
    } else {
      ctx.fillText(text, x + w / 2, cy + h / 2)
    }
  }

  let y = 1

  drawCell(1, y, totalWidth - 2, titleHeight,
    'VIC 조간면학 출결현황', '#1a237e', '#ffffff', titleFont)
  y += titleHeight

  const subtitleLeft = `날짜 : ${displayDate}`
  const subtitleRight = '※ 결석한 학생의 면학실 좌석번호/이름 명단입니다.'
  const halfWidth = (totalWidth - 2) / 2
  drawCell(1, y, halfWidth, subtitleHeight,
    subtitleLeft, '#e8eaf6', '#1a237e', boldFont, 'left')
  drawCell(1 + halfWidth, y, halfWidth, subtitleHeight,
    subtitleRight, '#e8eaf6', '#555555', subtitleFont)
  y += subtitleHeight

  const section1X = 1
  const noticeX = 1 + Math.ceil(sectionWidth)
  const section2X = noticeX + Math.ceil(noticeColWidth)

  drawCell(section1X, y, Math.ceil(sectionWidth), gradeHeaderHeight,
    `1학년 (${grade1Rows.length}명)`, '#1565c0', '#ffffff', boldFont)
  drawCell(noticeX, y, Math.ceil(noticeColWidth), gradeHeaderHeight,
    noticeLabel, '#f57f17', '#ffffff', boldFont)
  drawCell(section2X, y, Math.ceil(sectionWidth), gradeHeaderHeight,
    `2학년 (${grade2Rows.length}명)`, '#2e7d32', '#ffffff', boldFont)
  y += gradeHeaderHeight

  let x1 = section1X
  let x2 = section2X
  for (let c = 0; c < sectionColCount; c++) {
    const w = Math.ceil(colWidths[c])
    drawCell(x1, y, w, rowHeight, subHeaders[c], '#37474f', '#ffffff', boldFont)
    drawCell(x2, y, w, rowHeight, subHeaders[c], '#37474f', '#ffffff', boldFont)
    x1 += w
    x2 += w
  }

  const noticeDataHeight = rowHeight * maxRows
  ctx.fillStyle = '#fffde7'
  ctx.fillRect(noticeX, y, Math.ceil(noticeColWidth), rowHeight + noticeDataHeight)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1
  ctx.strokeRect(noticeX, y, Math.ceil(noticeColWidth), rowHeight + noticeDataHeight)

  if (noticeText) {
    ctx.fillStyle = '#333333'
    ctx.font = subtitleFont
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const lines = noticeText.split('\n')
    const lineHeight = subtitleFontSize + 4
    const startY = y + padding.y
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], noticeX + padding.x, startY + i * lineHeight)
    }
  } else {
    ctx.fillStyle = '#aaaaaa'
    ctx.font = subtitleFont
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('없음', noticeX + Math.ceil(noticeColWidth) / 2, y + (rowHeight + noticeDataHeight) / 2)
  }
  y += rowHeight

  for (let r = 0; r < maxRows; r++) {
    const bgEven = '#f5f5f5'
    const bgOdd = '#ffffff'
    const bg = r % 2 === 0 ? bgEven : bgOdd

    x1 = section1X
    x2 = section2X
    for (let c = 0; c < sectionColCount; c++) {
      const w = Math.ceil(colWidths[c])
      const t1 = r < grade1Rows.length ? grade1Rows[r][c] || '' : ''
      const t2 = r < grade2Rows.length ? grade2Rows[r][c] || '' : ''
      const emptyBg = '#eeeeee'
      const align: CanvasTextAlign = c === 3 ? 'left' : 'center'
      drawCell(x1, y, w, rowHeight, t1, r < grade1Rows.length ? bg : emptyBg, '#111111', font, align)
      drawCell(x2, y, w, rowHeight, t2, r < grade2Rows.length ? bg : emptyBg, '#111111', font, align)
      x1 += w
      x2 += w
    }
    y += rowHeight
  }

  return canvasToBlob(canvas)
}

export async function sendDiscordReport(params: DiscordReportParams): Promise<DiscordReportResult> {
  const { message, displayDate, absentStudents, noticeText } = params

  const grade1 = absentStudents.filter(s => s.grade === 1)
  const grade2 = absentStudents.filter(s => s.grade === 2)

  const grade1Rows = grade1.map((s, i) => [String(i + 1), s.seatId, s.name, s.note || ''])
  const grade2Rows = grade2.map((s, i) => [String(i + 1), s.seatId, s.name, s.note || ''])

  try {
    const formData = new FormData()

    if (grade1Rows.length > 0 || grade2Rows.length > 0) {
      const pngBlob = await renderTablePng({
        displayDate,
        grade1Rows,
        grade2Rows,
        noticeText: noticeText || ''
      })

      formData.append('payload_json', JSON.stringify({ content: message }))
      formData.append('files[0]', pngBlob, 'attendance_report.png')
    } else {
      formData.append('payload_json', JSON.stringify({ content: message }))
    }

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: formData
    })

    return { success: true, message: 'Discord 전송 요청 완료' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '네트워크 오류'
    }
  }
}
