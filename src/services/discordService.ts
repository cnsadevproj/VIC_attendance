// Discord 알림 서비스
const API_URL = 'https://vic-sms-server-236744560712.asia-northeast3.run.app'

export interface DiscordReportParams {
  date: string
  sheetName: string
  grade1Count: number
  grade2Count: number
  message?: string
}

export interface DiscordReportResult {
  success: boolean
  message: string
  sheetName: string
  hasScreenshot: boolean
}

// Discord로 출결 리포트 전송
export async function sendDiscordReport(params: DiscordReportParams): Promise<DiscordReportResult> {
  const response = await fetch(`${API_URL}/api/send-discord-report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Discord 전송 실패')
  }

  return response.json()
}
