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

  const px = { x: 10, y: 6 }
  const border = '#bbbbbb'
  const fs = 13
  const titleFs = 22
  const subFs = 12
  const ff = (s: number, bold = false) =>
    `${bold ? 'bold ' : ''}${s}px "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif`

  const headers = ['순번', '좌석번호', '이름', '비고']
  const colCount = headers.length

  const mc = document.createElement('canvas')
  const mx = mc.getContext('2d')!

  const cw = new Array(colCount).fill(0)
  mx.font = ff(fs, true)
  headers.forEach((h, i) => { cw[i] = mx.measureText(h).width + px.x * 2 })

  mx.font = ff(fs)
  for (const row of [...grade1Rows, ...grade2Rows]) {
    for (let i = 0; i < colCount; i++) {
      const w = mx.measureText(String(row[i] || '')).width + px.x * 2
      cw[i] = Math.max(cw[i], w)
    }
  }
  cw[0] = Math.max(cw[0], 42)
  cw[1] = Math.max(cw[1], 65)
  cw[2] = Math.max(cw[2], 50)
  cw[3] = Math.max(cw[3], 100)

  const secW = cw.reduce((a, b) => a + b, 0)
  const gapW = 8
  const rh = fs + px.y * 2
  const maxR = Math.max(grade1Rows.length, grade2Rows.length, 1)

  const titleH = titleFs + 14
  const dateH = subFs + 10
  const descH = subFs + 10
  const spacerH = 4

  mx.font = ff(subFs)
  const noticeLines = noticeText ? noticeText.split('\n') : []
  const noticeLineH = subFs + 4

  const leftW = secW
  const rightW = secW + gapW
  const totalW = Math.ceil(secW * 2 + gapW) + 2
  const topBlockH = titleH + dateH + descH + spacerH
  const noticeBlockH = Math.max(topBlockH, noticeLines.length > 0 ? (subFs + 8) + noticeLines.length * noticeLineH + 8 : topBlockH)

  const totalH = Math.ceil(noticeBlockH + rh + rh + rh * maxR) + 2

  const dpr = 2
  const canvas = document.createElement('canvas')
  canvas.width = totalW * dpr
  canvas.height = totalH * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalW, totalH)

  const drawRect = (x: number, y: number, w: number, h: number, bg: string) => {
    ctx.fillStyle = bg
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = border
    ctx.lineWidth = 0.5
    ctx.strokeRect(x, y, w, h)
  }

  const drawText = (
    text: string, x: number, y: number, w: number, h: number,
    font: string, color: string, align: CanvasTextAlign = 'center'
  ) => {
    ctx.fillStyle = color
    ctx.font = font
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    const tx = align === 'left' ? x + px.x : align === 'right' ? x + w - px.x : x + w / 2
    ctx.fillText(text, tx, y + h / 2)
  }

  let y = 1

  drawRect(1, y, leftW, titleH, '#ffffff')
  drawText('2025-W VIC 조간면학 출결현황', 1, y, leftW, titleH, ff(titleFs, true), '#000000', 'left')

  drawRect(1 + leftW, y, rightW, noticeBlockH, '#ffffff')
  ctx.strokeStyle = '#999999'
  ctx.lineWidth = 1
  ctx.strokeRect(1 + leftW, y, rightW, noticeBlockH)
  drawText('[특이사항]', 1 + leftW, y, rightW, subFs + 8, ff(subFs, true), '#000000', 'left')
  if (noticeLines.length > 0) {
    ctx.fillStyle = '#333333'
    ctx.font = ff(subFs)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (let i = 0; i < noticeLines.length; i++) {
      ctx.fillText(noticeLines[i], 1 + leftW + px.x, y + (subFs + 8) + 4 + i * noticeLineH)
    }
  }

  y += titleH
  drawRect(1, y, leftW, dateH, '#ffffff')
  drawText(`날짜 :   ${displayDate}`, 1, y, leftW, dateH, ff(subFs, true), '#000000', 'left')
  y += dateH

  y += spacerH

  drawRect(1, y, leftW, descH, '#ffffff')
  drawText('※ 결석한 학생의 면학실 좌석번호/이름 명단입니다.', 1, y, leftW, descH, ff(subFs), '#000000', 'left')
  y += descH

  y = 1 + noticeBlockH

  const s1x = 1
  const s2x = 1 + Math.ceil(secW) + gapW

  drawRect(s1x, y, Math.ceil(secW), rh, '#fff9c4')
  drawText('1학년', s1x, y, Math.ceil(secW), rh, ff(fs, true), '#000000')
  drawRect(s2x, y, Math.ceil(secW), rh, '#fce4ec')
  drawText('2학년', s2x, y, Math.ceil(secW), rh, ff(fs, true), '#000000')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(s1x + Math.ceil(secW), y, gapW, rh)

  y += rh

  let x1 = s1x, x2 = s2x
  for (let c = 0; c < colCount; c++) {
    const w = Math.ceil(cw[c])
    drawRect(x1, y, w, rh, '#e8e8e8')
    drawText(headers[c], x1, y, w, rh, ff(fs, true), '#000000')
    drawRect(x2, y, w, rh, '#e8e8e8')
    drawText(headers[c], x2, y, w, rh, ff(fs, true), '#000000')
    x1 += w
    x2 += w
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(s1x + Math.ceil(secW), y, gapW, rh)
  y += rh

  for (let r = 0; r < maxR; r++) {
    x1 = s1x
    x2 = s2x
    for (let c = 0; c < colCount; c++) {
      const w = Math.ceil(cw[c])
      const t1 = r < grade1Rows.length ? grade1Rows[r][c] || '' : ''
      const t2 = r < grade2Rows.length ? grade2Rows[r][c] || '' : ''
      const align: CanvasTextAlign = c === 3 ? 'left' : 'center'

      drawRect(x1, y, w, rh, '#ffffff')
      if (t1) drawText(t1, x1, y, w, rh, ff(fs), '#000000', align)
      drawRect(x2, y, w, rh, '#ffffff')
      if (t2) drawText(t2, x2, y, w, rh, ff(fs), '#000000', align)

      x1 += w
      x2 += w
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(s1x + Math.ceil(secW), y, gapW, rh)
    y += rh
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
