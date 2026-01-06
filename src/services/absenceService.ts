// 사전결석/외박 데이터 스프레드시트 연동 서비스

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwDYX0zgyCDNHZmqSVslgjQ-_Q42NyIiq-uE8wCXJ1phlqJil-pnMkLUJAS8dVfGwrv1Q/exec'

export interface AbsenceEntry {
  studentId: string
  name: string
  type: '사전결석' | '외박'
  startDate: string
  endDate: string
  reason: string
}

// 날짜 문자열을 YYYY-MM-DD 형식으로 변환
function normalizeDate(dateStr: string): string {
  if (!dateStr) return ''

  // 이미 YYYY-MM-DD 형식이면 그대로 반환
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // "Wed Jan 07 2026 00:00:00 GMT+0900 (한국 표준시)" 형식 처리
  // 한글 괄호 부분 제거 후 파싱
  const cleanedDateStr = dateStr.replace(/\s*\([^)]*\)\s*$/, '')

  // Date 객체로 파싱 후 YYYY-MM-DD로 변환
  try {
    const date = new Date(cleanedDateStr)
    if (isNaN(date.getTime())) {
      console.error('[normalizeDate] Failed to parse:', dateStr)
      return ''
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (e) {
    console.error('[normalizeDate] Error:', e, dateStr)
    return ''
  }
}

export interface PreAbsenceInfo {
  reason: string
  startDate: string
  endDate: string
  type: '사전결석' | '외박'
}

// 캐시 (5분간 유지)
let cachedData: AbsenceEntry[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5분

// 스프레드시트에서 데이터 불러오기
export async function fetchAbsenceData(): Promise<AbsenceEntry[]> {
  const now = Date.now()

  // 캐시가 유효하면 캐시 반환
  if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedData
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL)
    if (!response.ok) {
      throw new Error('Failed to fetch absence data')
    }

    const rawData = await response.json() as AbsenceEntry[]

    // 날짜 형식 정규화
    const data = rawData.map(entry => ({
      ...entry,
      startDate: normalizeDate(entry.startDate),
      endDate: normalizeDate(entry.endDate)
    }))

    // 캐시 업데이트
    cachedData = data
    cacheTimestamp = now

    console.log(`[AbsenceService] Loaded ${data.length} entries from spreadsheet`)
    return data
  } catch (error) {
    console.error('[AbsenceService] Error fetching data:', error)
    // 캐시가 있으면 오래된 캐시라도 반환
    if (cachedData) {
      return cachedData
    }
    return []
  }
}

// PRE_ABSENCES 형식으로 변환
export async function getPreAbsencesMap(): Promise<Record<string, PreAbsenceInfo>> {
  const entries = await fetchAbsenceData()
  const result: Record<string, PreAbsenceInfo> = {}

  entries.forEach(entry => {
    // 학번을 키로 사용
    result[entry.studentId] = {
      reason: entry.type === '외박'
        ? (entry.reason ? `외박 (${entry.reason})` : '외박')
        : entry.reason,
      startDate: entry.startDate,
      endDate: entry.endDate,
      type: entry.type
    }
  })

  return result
}

// 특정 날짜에 사전결석/외박인 학생 목록
export async function getAbsentStudentsOnDate(dateStr: string): Promise<AbsenceEntry[]> {
  const entries = await fetchAbsenceData()
  return entries.filter(entry =>
    dateStr >= entry.startDate && dateStr <= entry.endDate
  )
}

// 특정 학생이 특정 날짜에 외박인지 확인
export async function isOvernightLeaveOnDate(studentId: string, dateStr: string): Promise<boolean> {
  const entries = await fetchAbsenceData()
  const entry = entries.find(e =>
    e.studentId === studentId &&
    e.type === '외박' &&
    dateStr >= e.startDate &&
    dateStr <= e.endDate
  )
  return !!entry
}

// 캐시 강제 새로고침
export function refreshCache(): void {
  cachedData = null
  cacheTimestamp = 0
}
