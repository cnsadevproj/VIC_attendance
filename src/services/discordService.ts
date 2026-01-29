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

async function renderTablePng(
  title: string,
  grade1Rows: string[][],
  grade2Rows: string[][]
): Promise<Blob> {
  const fontSize = 15
  const titleFontSize = 17
  const padding = { x: 12, y: 8 }
  const borderColor = '#aaaaaa'
  const font = `${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  const boldFont = `bold ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  const titleFont = `bold ${titleFontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`

  const subHeaders = ['좌석', '이름', '비고']
  const colCount = subHeaders.length

  const allCells = [
    ...subHeaders,
    ...grade1Rows.flat(),
    ...grade2Rows.flat()
  ]

  const measureCanvas = document.createElement('canvas')
  const mCtx = measureCanvas.getContext('2d')!
  mCtx.font = boldFont

  const colWidths = new Array(colCount).fill(0)
  for (let i = 0; i < allCells.length; i++) {
    const colIdx = i % colCount
    const w = mCtx.measureText(allCells[i]).width
    colWidths[colIdx] = Math.max(colWidths[colIdx], w + padding.x * 2)
  }
  colWidths.forEach((w, i) => { colWidths[i] = Math.max(w, 60) })

  const sectionWidth = colWidths.reduce((s, w) => s + w, 0)
  const gapWidth = 4
  const rowHeight = fontSize + padding.y * 2
  const titleHeight = titleFontSize + padding.y * 2 + 4
  const gradeHeaderHeight = rowHeight
  const maxRows = Math.max(grade1Rows.length, grade2Rows.length)
  const totalWidth = Math.ceil(sectionWidth * 2 + gapWidth) + 2
  const totalHeight = Math.ceil(
    titleHeight + gradeHeaderHeight + rowHeight + rowHeight * maxRows
  ) + 2

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = totalWidth * dpr
  canvas.height = totalHeight * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  let y = 1

  ctx.fillStyle = '#374151'
  ctx.fillRect(1, y, totalWidth - 2, titleHeight)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1
  ctx.strokeRect(1, y, totalWidth - 2, titleHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = titleFont
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, totalWidth / 2, y + titleHeight / 2)
  y += titleHeight

  function drawMergedCell(
    x: number, cy: number, w: number, h: number,
    text: string, bg: string, fg: string, f: string
  ) {
    ctx.fillStyle = bg
    ctx.fillRect(x, cy, w, h)
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.strokeRect(x, cy, w, h)
    ctx.fillStyle = fg
    ctx.font = f
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + w / 2, cy + h / 2)
  }

  function drawCell(
    x: number, cy: number, colIdx: number,
    text: string, bg: string, fg: string, f: string
  ) {
    const w = Math.ceil(colWidths[colIdx])
    drawMergedCell(x, cy, w, Math.ceil(rowHeight), text, bg, fg, f)
  }

  const section1X = 1
  const section2X = 1 + Math.ceil(sectionWidth) + gapWidth

  drawMergedCell(section1X, y, Math.ceil(sectionWidth), Math.ceil(gradeHeaderHeight),
    '1학년', '#3d4777', '#ffffff', boldFont)
  drawMergedCell(section2X, y, Math.ceil(sectionWidth), Math.ceil(gradeHeaderHeight),
    '2학년', '#3d4777', '#ffffff', boldFont)
  y += Math.ceil(gradeHeaderHeight)

  let x1 = section1X
  let x2 = section2X
  for (let c = 0; c < colCount; c++) {
    drawCell(x1, y, c, subHeaders[c], '#4a5490', '#ffffff', boldFont)
    drawCell(x2, y, c, subHeaders[c], '#4a5490', '#ffffff', boldFont)
    x1 += Math.ceil(colWidths[c])
    x2 += Math.ceil(colWidths[c])
  }
  y += Math.ceil(rowHeight)

  for (let r = 0; r < maxRows; r++) {
    const bg1 = r % 2 === 0 ? '#e8edff' : '#ffffff'
    const bg2 = r % 2 === 0 ? '#e8ffed' : '#ffffff'

    x1 = section1X
    x2 = section2X
    for (let c = 0; c < colCount; c++) {
      const t1 = r < grade1Rows.length ? grade1Rows[r][c] || '' : ''
      const t2 = r < grade2Rows.length ? grade2Rows[r][c] || '' : ''
      const emptyBg = '#f5f5f5'
      drawCell(x1, y, c, t1, r < grade1Rows.length ? bg1 : emptyBg, '#111111', font)
      drawCell(x2, y, c, t2, r < grade2Rows.length ? bg2 : emptyBg, '#111111', font)
      x1 += Math.ceil(colWidths[c])
      x2 += Math.ceil(colWidths[c])
    }
    y += Math.ceil(rowHeight)
  }

  return canvasToBlob(canvas)
}

export async function sendDiscordReport(params: DiscordReportParams): Promise<DiscordReportResult> {
  const { message, displayDate, absentStudents } = params

  const grade1 = absentStudents.filter(s => s.grade === 1)
  const grade2 = absentStudents.filter(s => s.grade === 2)

  const grade1Rows = grade1.map(s => [s.seatId, s.name, s.note || ''])
  const grade2Rows = grade2.map(s => [s.seatId, s.name, s.note || ''])

  try {
    const formData = new FormData()

    if (grade1Rows.length > 0 || grade2Rows.length > 0) {
      const title = `VIC 조간면학 출결현황 - ${displayDate}`
      const pngBlob = await renderTablePng(title, grade1Rows, grade2Rows)

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
