import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import { getStudentBySeatId, searchStudentByName, type StudentSearchResult } from '../config/mockStudents'
import BugReportModal, { type BugReport } from '../components/BugReportModal'
import { SEAT_LAYOUTS } from '../config/seatLayouts'
import { fetchTodayStaff, isTemporaryPeriod, type TodayStaff } from '../config/staffSchedule'
import type { AttendanceRecord } from '../types'

interface ZoneSummary {
  zoneId: string
  zoneName: string
  grade: number
  present: number
  absent: number
  unchecked: number
  total: number
  completionRate: number
  hasTempSave: boolean
  recordedBy?: string
}

interface AttendanceDetail {
  seatId: string
  studentId: string
  studentName: string
  status: 'present' | 'absent' | 'unchecked'
  hasPreAbsence: boolean
  preAbsenceReason?: string
}

// 구역 설정
const ZONES = [
  { id: '4A', name: '4층 A구역', grade: 1 },
  { id: '4B', name: '4층 B구역', grade: 1 },
  { id: '4C', name: '4층 C구역', grade: 1 },
  { id: '4D', name: '4층 D구역', grade: 1 },
  { id: '3A', name: '3층 A구역', grade: 2 },
  { id: '3B', name: '3층 B구역', grade: 2 },
  { id: '3C', name: '3층 C구역', grade: 2 },
  { id: '3D', name: '3층 D구역', grade: 2 },
]

// 임시 데이터 기간 (2025년 12월 22일 ~ 2026년 1월 2일, 주말 제외)
const TEMP_STAFF_SCHEDULE: Record<string, { grade1: [string, string], grade2: [string, string] }> = {
  '2025-12-22': { grade1: ['김종규', '이건우'], grade2: ['조민경', '노예원'] },
  '2025-12-23': { grade1: ['이예진', '홍선영'], grade2: ['장보경', '김솔'] },
  '2025-12-24': { grade1: ['홍승민', '조현정'], grade2: ['강현수', '민수정'] },
  '2025-12-25': { grade1: ['박한비', '서률지'], grade2: ['정수빈', '김종규'] },
  '2025-12-26': { grade1: ['이건우', '조민경'], grade2: ['노예원', '이예진'] },
  // 12/27(토), 12/28(일) 주말 제외
  '2025-12-29': { grade1: ['서률지', '정수빈'], grade2: ['김종규', '이건우'] },
  '2025-12-30': { grade1: ['조민경', '노예원'], grade2: ['이예진', '홍선영'] },
  '2025-12-31': { grade1: ['장보경', '김솔'], grade2: ['홍승민', '조현정'] },
  '2026-01-01': { grade1: ['강현수', '민수정'], grade2: ['박한비', '서률지'] },
  '2026-01-02': { grade1: ['정수빈', '김종규'], grade2: ['이건우', '조민경'] },
}

// 고정된 담당자 스케줄 (2026년 1월 7일 ~ 2월 3일, 주말 제외)
const FIXED_STAFF_SCHEDULE: Record<string, { grade1: [string, string], grade2: [string, string] }> = {
  '2026-01-07': { grade1: ['이예진', '조현정'], grade2: ['강현수', '김종규'] },
  '2026-01-08': { grade1: ['홍선영', '홍승민'], grade2: ['민수정', '정수빈'] },
  '2026-01-09': { grade1: ['장보경', '김솔'], grade2: ['박한비', '서률지'] },
  '2026-01-12': { grade1: ['노예원', '조민경'], grade2: ['홍선영', '강현수'] },
  '2026-01-13': { grade1: ['이건우', '장보경'], grade2: ['김솔', '박한비'] },
  '2026-01-14': { grade1: ['이예진', '조현정'], grade2: ['민수정', '홍승민'] },
  '2026-01-15': { grade1: ['서률지', '정수빈'], grade2: ['김종규', '이건우'] },
  '2026-01-16': { grade1: ['홍승민', '홍선영'], grade2: ['조민경', '노예원'] },
  '2026-01-19': { grade1: ['장보경', '박한비'], grade2: ['서률지', '이예진'] },
  '2026-01-20': { grade1: ['이건우', '김종규'], grade2: ['김솔', '조현정'] },
  '2026-01-21': { grade1: ['강현수', '민수정'], grade2: ['홍선영', '장보경'] },
  '2026-01-22': { grade1: ['정수빈', '조현정'], grade2: ['노예원', '조민경'] },
  '2026-01-23': { grade1: ['김솔', '강현수'], grade2: ['이예진', '서률지'] },
  '2026-01-26': { grade1: ['민수정', '김종규'], grade2: ['홍승민', '정수빈'] },
  '2026-01-27': { grade1: ['박한비', '홍선영'], grade2: ['조민경', '노예원'] },
  '2026-01-28': { grade1: ['이예진', '서률지'], grade2: ['장보경', '김솔'] },
  '2026-01-29': { grade1: ['노예원', '조현정'], grade2: ['강현수', '민수정'] },
  '2026-01-30': { grade1: ['김종규', '이건우'], grade2: ['정수빈', '박한비'] },
  '2026-02-02': { grade1: ['홍승민', '조민경'], grade2: ['서률지', '강현수'] },
  '2026-02-03': { grade1: ['민수정', '박한비'], grade2: ['정수빈', '이건우'] },
}

// 전체 스케줄 (임시 + 정규)
const DATE_STAFF_SCHEDULE: Record<string, { grade1: [string, string], grade2: [string, string] }> = {
  ...TEMP_STAFF_SCHEDULE,
  ...FIXED_STAFF_SCHEDULE,
}

// 운영 날짜 목록
const OPERATING_DATES = Object.keys(DATE_STAFF_SCHEDULE).sort()

// 날짜별 구역 완료율 동적 생성 (과거 날짜는 100% 완료)
function generateCompletionRates(): Record<string, Record<string, number>> {
  const rates: Record<string, Record<string, number>> = {}
  const today = new Date().toISOString().split('T')[0]

  OPERATING_DATES.forEach((dateStr) => {
    if (dateStr < today) {
      // 과거 날짜: 100% 완료
      rates[dateStr] = {
        '4A': 1.0, '4B': 1.0, '4C': 1.0, '4D': 1.0,
        '3A': 1.0, '3B': 1.0, '3C': 1.0, '3D': 1.0,
      }
    } else if (dateStr === today) {
      // 오늘: 부분 완료 (실제 데이터는 localStorage에서)
      rates[dateStr] = {
        '4A': 0.0, '4B': 0.0, '4C': 0.0, '4D': 0.0,
        '3A': 0.0, '3B': 0.0, '3C': 0.0, '3D': 0.0,
      }
    } else {
      // 미래 날짜: 0%
      rates[dateStr] = {
        '4A': 0.0, '4B': 0.0, '4C': 0.0, '4D': 0.0,
        '3A': 0.0, '3B': 0.0, '3C': 0.0, '3D': 0.0,
      }
    }
  })

  return rates
}

const DATE_COMPLETION_RATES = generateCompletionRates()

// 날짜별 구역 기록자 매핑 생성
function getZoneRecordersForDate(dateStr: string): Record<string, string> {
  const schedule = DATE_STAFF_SCHEDULE[dateStr]
  if (!schedule) return {}

  const completionRates = DATE_COMPLETION_RATES[dateStr] || {}
  const recorders: Record<string, string> = {}

  // 1학년 (4층): 첫번째 담당자가 A,B / 두번째 담당자가 C,D
  if (completionRates['4A'] > 0) recorders['4A'] = schedule.grade1[0]
  if (completionRates['4B'] > 0) recorders['4B'] = schedule.grade1[0]
  if (completionRates['4C'] > 0) recorders['4C'] = schedule.grade1[1]
  if (completionRates['4D'] > 0) recorders['4D'] = schedule.grade1[1]

  // 2학년 (3층): 첫번째 담당자가 A,B / 두번째 담당자가 C,D
  if (completionRates['3A'] > 0) recorders['3A'] = schedule.grade2[0]
  if (completionRates['3B'] > 0) recorders['3B'] = schedule.grade2[0]
  if (completionRates['3C'] > 0) recorders['3C'] = schedule.grade2[1]
  if (completionRates['3D'] > 0) recorders['3D'] = schedule.grade2[1]

  return recorders
}

// 날짜별 샘플 출결 데이터 생성
function generateSampleDataForDate(dateStr: string): Map<string, Map<string, AttendanceRecord>> {
  const allData = new Map<string, Map<string, AttendanceRecord>>()
  const completionRates = DATE_COMPLETION_RATES[dateStr] || {}

  // 날짜 기반 시드 생성
  const dateSeed = dateStr.split('-').reduce((acc, val) => acc + parseInt(val), 0)
  let seed = dateSeed * 12345
  const seededRandom = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }

  ZONES.forEach((zone) => {
    const zoneRecords = new Map<string, AttendanceRecord>()
    const layout = SEAT_LAYOUTS[zone.id]
    if (!layout) return

    const completionRate = completionRates[zone.id] || 0

    layout.forEach((row) => {
      if (row[0] === 'br') return
      row.forEach((cell) => {
        if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
          const seatId = cell as string
          const student = getStudentBySeatId(seatId)
          if (student) {
            if (seededRandom() < completionRate) {
              const status = seededRandom() < 0.9 ? 'present' : 'absent'
              zoneRecords.set(seatId, {
                studentId: seatId,
                status,
                isModified: true,
              })
            }
          }
        }
      })
    })

    allData.set(zone.id, zoneRecords)
  })

  return allData
}

// 모든 날짜에 대한 샘플 데이터 생성 (과거 날짜 조회용, localStorage에 저장하지 않음)
const ALL_SAMPLE_DATA: Record<string, Map<string, Map<string, AttendanceRecord>>> = {}
Object.keys(DATE_COMPLETION_RATES).forEach(dateStr => {
  ALL_SAMPLE_DATA[dateStr] = generateSampleDataForDate(dateStr)
})

// 임시저장 구역 판별 함수
function getTempSaveZonesForDate(dateStr: string): string[] {
  const rates = DATE_COMPLETION_RATES[dateStr] || {}
  return Object.entries(rates)
    .filter(([_, rate]) => rate > 0 && rate < 1.0)
    .map(([zoneId]) => zoneId)
}

function getCompletionColor(rate: number): string {
  if (rate >= 100) return 'bg-green-500'
  if (rate >= 50) return 'bg-amber-500'
  if (rate > 0) return 'bg-orange-500'
  return 'bg-gray-300'
}

function getCompletionTextColor(rate: number): string {
  if (rate >= 100) return 'text-green-600'
  if (rate >= 50) return 'text-amber-600'
  if (rate > 0) return 'text-orange-600'
  return 'text-gray-500'
}

function getStatusBadge(status: string, hasPreAbsence: boolean) {
  const styles: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    absent: hasPreAbsence ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700',
    unchecked: 'bg-gray-100 text-gray-500',
  }
  const labels: Record<string, string> = {
    present: '출석',
    absent: hasPreAbsence ? '사전결석' : '결석',
    unchecked: '미체크',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

const ADMIN_PASSWORD = '3028'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // 세션 동안 인증 상태 유지
    return sessionStorage.getItem('adminAuth') === 'true'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [date, setDate] = useState(() => {
    // 세션에 저장된 날짜가 있으면 그걸 사용
    const savedDate = sessionStorage.getItem('adminSelectedDate')
    return savedDate || new Date().toISOString().split('T')[0]
  })
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [, setTodayStaff] = useState<TodayStaff>({ grade1: null, grade2: null })
  const [noticeText, setNoticeText] = useState('')
  const [showNoticeInput, setShowNoticeInput] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([])
  const [showBugReport, setShowBugReport] = useState(false)
  const [showBugReports, setShowBugReports] = useState(false)
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'present' | 'absent' | 'unchecked' | null>(null)

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.length >= 1) {
      // 1, 2학년 전체 검색 (필터링 없음)
      const results = searchStudentByName(query)
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }

  // 선택된 날짜의 출결 데이터 (localStorage 우선, 없으면 샘플 데이터 사용)
  const selectedDateData = useMemo(() => {
    try {
      const todayKey = new Date().toISOString().split('T')[0]
      const result = new Map<string, Map<string, AttendanceRecord>>()

      ZONES.forEach((zone) => {
        try {
          // 오늘 날짜인 경우 localStorage에서 실제 데이터 읽기
          if (date === todayKey) {
            // 먼저 저장된 데이터 확인
            const savedData = localStorage.getItem(`attendance_saved_${zone.id}_${date}`)
            if (savedData) {
              try {
                const parsed = JSON.parse(savedData) as [string, AttendanceRecord][]
                if (Array.isArray(parsed)) {
                  result.set(zone.id, new Map(parsed))
                  return
                }
              } catch {
                // 파싱 실패 시 해당 데이터 삭제
                localStorage.removeItem(`attendance_saved_${zone.id}_${date}`)
              }
            }

            // 임시저장 데이터 확인
            const tempData = localStorage.getItem(`attendance_temp_${zone.id}_${date}`)
            if (tempData) {
              try {
                const parsed = JSON.parse(tempData) as [string, AttendanceRecord][]
                if (Array.isArray(parsed)) {
                  result.set(zone.id, new Map(parsed))
                  return
                }
              } catch {
                // 파싱 실패 시 해당 데이터 삭제
                localStorage.removeItem(`attendance_temp_${zone.id}_${date}`)
              }
            }
          }

          // localStorage에 데이터가 없으면 샘플 데이터 사용
          const sampleData = ALL_SAMPLE_DATA[date]
          if (sampleData && sampleData.get) {
            result.set(zone.id, sampleData.get(zone.id) || new Map())
          } else {
            result.set(zone.id, new Map())
          }
        } catch {
          // 개별 zone 처리 실패 시 빈 Map 설정
          result.set(zone.id, new Map())
        }
      })

      return result
    } catch (e) {
      console.error('selectedDateData 계산 오류:', e)
      return new Map<string, Map<string, AttendanceRecord>>()
    }
  }, [date])

  // 실제 임시저장 구역 판별 (오늘 날짜인 경우 localStorage 확인)
  const selectedDateTempZones = useMemo(() => {
    try {
      const todayKey = new Date().toISOString().split('T')[0]

      if (date === todayKey) {
        const tempZones: string[] = []
        ZONES.forEach((zone) => {
          try {
            const hasSaved = localStorage.getItem(`attendance_saved_${zone.id}_${date}`)
            const hasTemp = localStorage.getItem(`attendance_temp_${zone.id}_${date}`)
            if (!hasSaved && hasTemp) {
              tempZones.push(zone.id)
            }
          } catch {
            // ignore
          }
        })
        return tempZones
      }

      return getTempSaveZonesForDate(date)
    } catch {
      return []
    }
  }, [date])

  // 기록자 정보 (오늘 날짜인 경우 localStorage에서 실제 기록자 읽기)
  const selectedDateRecorders = useMemo(() => {
    try {
      const todayKey = new Date().toISOString().split('T')[0]
      const recorders = getZoneRecordersForDate(date) || {}

      // 오늘 날짜인 경우 localStorage에서 실제 기록자 덮어쓰기
      if (date === todayKey) {
        ZONES.forEach((zone) => {
          try {
            const savedRecorder = localStorage.getItem(`attendance_recorder_${zone.id}_${date}`)
            if (savedRecorder) {
              recorders[zone.id] = savedRecorder
            }
          } catch {
            // ignore
          }
        })
      }

      return recorders
    } catch {
      return {}
    }
  }, [date])

  // 검색 결과에 출결 상태 추가
  const getAttendanceStatus = (seatId: string, zoneId: string): 'present' | 'absent' | 'unchecked' => {
    const zoneRecords = selectedDateData.get(zoneId)
    if (!zoneRecords) return 'unchecked'
    const record = zoneRecords.get(seatId)
    return record?.status || 'unchecked'
  }

  // 선택한 날짜에 따른 특이사항 키
  const noticeStorageKey = `admin_notice_${date}`

  // 금일 담당자 불러오기
  useEffect(() => {
    fetchTodayStaff().then(setTodayStaff)
  }, [])

  // 선택한 날짜 세션에 저장
  useEffect(() => {
    sessionStorage.setItem('adminSelectedDate', date)
  }, [date])

  // 선택한 날짜의 특이사항 불러오기
  useEffect(() => {
    const savedNotice = localStorage.getItem(noticeStorageKey)
    if (savedNotice) {
      setNoticeText(savedNotice)
    } else {
      // 샘플 특이사항 데이터
      const sampleNotices: Record<string, string> = {
        '2025-12-24': '과학경시대회 참가자 불참 예정',
        '2025-12-25': '크리스마스 - 면학실 단축 운영',
        '2025-12-26': '정상 운영',
        '2025-12-27': '겨울방학 시작 전 마지막 면학',
      }
      setNoticeText(sampleNotices[date] || '')
    }
    setShowNoticeInput(false)
  }, [date, noticeStorageKey])

  const handleSaveNotice = () => {
    if (noticeText.trim()) {
      localStorage.setItem(noticeStorageKey, noticeText.trim())
    } else {
      localStorage.removeItem(noticeStorageKey)
    }
    setShowNoticeInput(false)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsLoading(true)
      sessionStorage.setItem('adminAuth', 'true')
      setPasswordError(false)
      // 약간의 딜레이 후 인증 완료 (렌더링 안정화)
      setTimeout(() => {
        setIsAuthenticated(true)
        setIsLoading(false)
      }, 100)
    } else {
      setPasswordError(true)
      setPassword('')
    }
  }

  // 로딩 화면
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 비밀번호 입력 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            관리자 로그인
          </h1>
          <p className="text-center text-gray-500 mb-6">
            비밀번호를 입력하세요
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(false)
              }}
              placeholder="비밀번호"
              className={`w-full px-4 py-3 border-2 rounded-xl text-center text-xl tracking-widest
                ${passwordError ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                focus:outline-none focus:border-primary-500`}
              autoFocus
            />
            {passwordError && (
              <p className="text-red-500 text-sm text-center mt-2">
                비밀번호가 올바르지 않습니다
              </p>
            )}
            <button
              type="submit"
              className="w-full mt-4 py-3 bg-primary-500 text-white font-semibold rounded-xl
                         hover:bg-primary-600 transition-colors"
            >
              로그인
            </button>
          </form>
          <button
            onClick={() => navigate('/')}
            className="w-full mt-3 py-3 bg-gray-100 text-gray-600 font-medium rounded-xl
                       hover:bg-gray-200 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  // 구역별 요약 계산
  const zoneSummaries = useMemo(() => {
    try {
      return ZONES.map((zone) => {
        try {
          const layout = SEAT_LAYOUTS[zone.id]
          if (!layout) return null

          // 배정된 학생 수 계산
          let totalStudents = 0
          layout.forEach((row) => {
            if (row[0] === 'br') return
            row.forEach((cell) => {
              if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
                const student = getStudentBySeatId(cell as string)
                if (student) totalStudents++
              }
            })
          })

          // 출결 기록 (선택된 날짜 데이터 사용)
          const records = selectedDateData.get(zone.id) || new Map()
          let present = 0
          let absent = 0

          // 실제 배정된 학생에 대해서만 출결 카운트
          records.forEach((record, seatId) => {
            const student = getStudentBySeatId(seatId)
            if (!student) return // 학생이 없는 좌석은 무시
            if (record.status === 'present') present++
            else if (record.status === 'absent') absent++
          })

          const unchecked = totalStudents - present - absent
          const completionRate = totalStudents > 0
            ? Math.round(((present + absent) / totalStudents) * 100)
            : 0

          return {
            zoneId: zone.id,
            zoneName: zone.name,
            grade: zone.grade,
            present,
            absent,
            unchecked: Math.max(0, unchecked), // 음수 방지
            total: totalStudents,
            completionRate,
            hasTempSave: selectedDateTempZones.includes(zone.id),
            recordedBy: selectedDateRecorders[zone.id] || undefined,
          } as ZoneSummary
        } catch {
          return null
        }
      }).filter(Boolean) as ZoneSummary[]
    } catch {
      return []
    }
  }, [date, selectedDateData, selectedDateTempZones, selectedDateRecorders])

  // 학년 필터링
  const filteredSummaries = selectedGrade
    ? zoneSummaries.filter((z) => z.grade === selectedGrade)
    : zoneSummaries

  // 전체 통계
  const overallStats = filteredSummaries.reduce(
    (acc, zone) => ({
      totalStudents: acc.totalStudents + zone.total,
      present: acc.present + zone.present,
      absent: acc.absent + zone.absent,
      unchecked: acc.unchecked + zone.unchecked,
    }),
    { totalStudents: 0, present: 0, absent: 0, unchecked: 0 }
  )

  const overallCompletionRate = overallStats.totalStudents > 0
    ? Math.round(((overallStats.present + overallStats.absent) / overallStats.totalStudents) * 100)
    : 0

  // 출결 상세 데이터
  const attendanceDetails = useMemo(() => {
    if (!selectedZone) return []

    const layout = SEAT_LAYOUTS[selectedZone]
    if (!layout) return []

    const records = selectedDateData.get(selectedZone) || new Map()
    const details: AttendanceDetail[] = []

    layout.forEach((row) => {
      if (row[0] === 'br') return
      row.forEach((cell) => {
        if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
          const seatId = cell as string
          const student = getStudentBySeatId(seatId)
          if (student) {
            const record = records.get(seatId)
            details.push({
              seatId,
              studentId: student.studentId,
              studentName: student.name,
              status: record?.status || 'unchecked',
              hasPreAbsence: !!student.preAbsence,
              preAbsenceReason: student.preAbsence?.reason,
            })
          }
        }
      })
    })

    return details
  }, [selectedZone, selectedDateData])

  // 전체 학생 목록 (필터별)
  const allStudentsByStatus = useMemo(() => {
    const students: {
      seatId: string
      studentId: string
      studentName: string
      status: 'present' | 'absent' | 'unchecked'
      zoneId: string
      zoneName: string
      hasPreAbsence: boolean
      preAbsenceReason?: string
    }[] = []

    // 필터링된 구역들 (선택된 학년 기준)
    filteredSummaries.forEach((zoneSummary) => {
      const layout = SEAT_LAYOUTS[zoneSummary.zoneId]
      if (!layout) return

      const records = selectedDateData.get(zoneSummary.zoneId) || new Map()

      layout.forEach((row) => {
        if (row[0] === 'br') return
        row.forEach((cell) => {
          if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
            const seatId = cell as string
            const student = getStudentBySeatId(seatId)
            if (student) {
              const record = records.get(seatId)
              students.push({
                seatId,
                studentId: student.studentId,
                studentName: student.name,
                status: record?.status || 'unchecked',
                zoneId: zoneSummary.zoneId,
                zoneName: zoneSummary.zoneName,
                hasPreAbsence: !!student.preAbsence,
                preAbsenceReason: student.preAbsence?.reason,
              })
            }
          }
        })
      })
    })

    return students
  }, [filteredSummaries, selectedDateData])

  // 선택된 필터에 따른 학생 목록
  const filteredStudentsList = useMemo(() => {
    if (!selectedStatusFilter) return []
    if (selectedStatusFilter === 'all') return allStudentsByStatus
    return allStudentsByStatus.filter(s => s.status === selectedStatusFilter)
  }, [selectedStatusFilter, allStudentsByStatus])

  // 층별로 구역 분리
  const grade1Zones = filteredSummaries.filter((z) => z.grade === 1)
  const grade2Zones = filteredSummaries.filter((z) => z.grade === 2)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        title="관리자 대시보드"
        rightAction={
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              학생 검색
            </button>
            <button
              onClick={() => {
                const reports = localStorage.getItem('bug_reports')
                if (reports) {
                  try {
                    setBugReports(JSON.parse(reports))
                  } catch {
                    setBugReports([])
                  }
                } else {
                  setBugReports([])
                }
                setShowBugReports(true)
              }}
              className="px-3 py-1 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 relative"
            >
              버그 보고
              {(() => {
                const reports = localStorage.getItem('bug_reports')
                if (reports) {
                  try {
                    const parsed = JSON.parse(reports) as BugReport[]
                    const unreadCount = parsed.filter(r => !r.isRead).length
                    if (unreadCount > 0) {
                      return (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )
                    }
                  } catch {
                    return null
                  }
                }
                return null
              })()}
            </button>
          </div>
        }
      />

      {/* Date Filter */}
      <div className="bg-white border-b px-4 py-3 flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <span className="text-sm text-gray-500">08:30~08:50 출결</span>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setSelectedGrade(null)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedGrade === null
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {[1, 2].map((grade) => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedGrade === grade
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {grade}학년
            </button>
          ))}
        </div>
      </div>

      {/* 임시 데이터 기간 안내 */}
      {isTemporaryPeriod(date) && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-orange-500">⚠️</span>
            <span className="text-sm text-orange-700 font-semibold">
              2025 VIC가 아직 시작되지 않았습니다. 해당 데이터는 임시 데이터입니다.
            </span>
          </div>
        </div>
      )}

      {/* 선택된 날짜 담당자 */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">1학년 (4층) 담당</div>
            <div className="font-semibold text-blue-600">
              {DATE_STAFF_SCHEDULE[date]?.grade1?.join(', ') || '-'}
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">2학년 (3층) 담당</div>
            <div className="font-semibold text-green-600">
              {DATE_STAFF_SCHEDULE[date]?.grade2?.join(', ') || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* 특이사항 - 선택한 날짜 기준 */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 font-semibold">📢 특이사항</span>
            <span className="text-xs text-amber-500 bg-amber-100 px-2 py-0.5 rounded">
              {new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
            </span>
          </div>
          <button
            onClick={() => setShowNoticeInput(!showNoticeInput)}
            className="text-sm text-amber-700 hover:text-amber-800 font-medium"
          >
            {showNoticeInput ? '취소' : (noticeText ? '수정' : '작성')}
          </button>
        </div>
        {showNoticeInput ? (
          <div className="space-y-2">
            <textarea
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="예: 오늘 3학년 수능 모의고사로 면학실 미운영&#10;예: 1반 학급 행사로 단체 불참&#10;예: 과학경시대회 참가자 불참 예정"
              className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm resize-none focus:outline-none focus:border-amber-500"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveNotice}
                className="px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setNoticeText('')
                  localStorage.removeItem(noticeStorageKey)
                  setShowNoticeInput(false)
                }}
                className="px-4 py-1.5 bg-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-300"
              >
                삭제
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-amber-800">
            {noticeText || <span className="text-amber-400 italic">등록된 특이사항 없음</span>}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 overflow-auto flex-1">
        {/* Overall Summary */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">전체 현황</h2>
            <span className={`text-2xl font-bold ${getCompletionTextColor(overallCompletionRate)}`}>
              {overallCompletionRate}%
            </span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full ${getCompletionColor(overallCompletionRate)} transition-all duration-500`}
              style={{ width: `${overallCompletionRate}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <button
              onClick={() => setSelectedStatusFilter('all')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="text-gray-500">전체</div>
              <div className="font-bold text-gray-800">{overallStats.totalStudents}</div>
            </button>
            <button
              onClick={() => setSelectedStatusFilter('present')}
              className="p-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              <div className="text-green-600">출석</div>
              <div className="font-bold text-green-600">{overallStats.present}</div>
            </button>
            <button
              onClick={() => setSelectedStatusFilter('absent')}
              className="p-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <div className="text-red-600">결석</div>
              <div className="font-bold text-red-600">{overallStats.absent}</div>
            </button>
            <button
              onClick={() => setSelectedStatusFilter('unchecked')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="text-gray-500">미체크</div>
              <div className="font-bold text-gray-500">{overallStats.unchecked}</div>
            </button>
          </div>
        </div>

        {/* Zone Status - 층별로 분리 */}
        <h2 className="text-lg font-bold text-gray-800 mb-3">구역별 현황</h2>

        {/* 1학년 (4층) */}
        {grade1Zones.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-500 mb-2">1학년 (4층)</div>
            <div className="grid grid-cols-4 gap-2">
              {grade1Zones.map((zone) => (
                <div
                  key={zone.zoneId}
                  className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedZone(zone.zoneId)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800">{zone.zoneId}</span>
                    {zone.hasTempSave && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">임시</span>
                    )}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${getCompletionColor(zone.completionRate)}`}
                      style={{ width: `${zone.completionRate}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    <span className="text-green-600">{zone.present}</span>
                    <span className="mx-1">/</span>
                    <span className="text-red-600">{zone.absent}</span>
                    <span className="mx-1">/</span>
                    <span>{zone.unchecked}</span>
                  </div>
                  {zone.recordedBy && (
                    <div className="text-xs text-blue-500 truncate">{zone.recordedBy}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2학년 (3층) */}
        {grade2Zones.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-500 mb-2">2학년 (3층)</div>
            <div className="grid grid-cols-4 gap-2">
              {grade2Zones.map((zone) => (
                <div
                  key={zone.zoneId}
                  className="bg-white rounded-xl shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedZone(zone.zoneId)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800">{zone.zoneId}</span>
                    {zone.hasTempSave && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">임시</span>
                    )}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${getCompletionColor(zone.completionRate)}`}
                      style={{ width: `${zone.completionRate}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    <span className="text-green-600">{zone.present}</span>
                    <span className="mx-1">/</span>
                    <span className="text-red-600">{zone.absent}</span>
                    <span className="mx-1">/</span>
                    <span>{zone.unchecked}</span>
                  </div>
                  {zone.recordedBy && (
                    <div className="text-xs text-green-500 truncate">{zone.recordedBy}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attendance Detail Modal */}
      {selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-800">{selectedZone} 출결 상세</h3>
              <button
                onClick={() => setSelectedZone(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {attendanceDetails.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">좌석</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">이름</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {attendanceDetails.map((detail) => (
                      <tr key={detail.seatId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-800 text-sm">{detail.seatId}</td>
                        <td className="px-4 py-2 text-gray-600 text-sm">
                          <div>{detail.studentName}</div>
                          <div className="text-xs text-gray-400">{detail.studentId}</div>
                          {detail.preAbsenceReason && (
                            <div className="text-xs text-purple-500 mt-1">{detail.preAbsenceReason}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {getStatusBadge(detail.status, detail.hasPreAbsence && detail.status === 'absent')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  아직 입력된 출결 데이터가 없습니다.
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  const recorder = selectedDateRecorders[selectedZone]
                  // 선택한 날짜의 출결 데이터를 navigation state로 전달
                  const zoneData = selectedDateData.get(selectedZone)
                  const viewData = zoneData && zoneData.size > 0
                    ? Array.from(zoneData.entries())
                    : []
                  navigate(`/attendance/${selectedZone}`, {
                    state: {
                      fromAdmin: true,
                      recordedBy: recorder || undefined,
                      viewDate: date,
                      viewData: viewData
                    }
                  })
                }}
                className="flex-1 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600"
              >
                출결 입력 화면으로
              </button>
              <button
                onClick={() => setSelectedZone(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학생 검색 모달 */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold">학생 검색 (전체)</h2>
                <button
                  onClick={() => {
                    setShowSearch(false)
                    setSearchQuery('')
                    setSearchResults([])
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="학생 이름을 입력하세요"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-4">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => {
                    const status = getAttendanceStatus(result.student.seatId, result.zoneId)
                    const statusStyles = {
                      present: 'bg-green-100 text-green-700',
                      absent: result.student.preAbsence ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700',
                      unchecked: 'bg-gray-100 text-gray-500',
                    }
                    const statusLabels = {
                      present: '출석',
                      absent: result.student.preAbsence ? '사전결석' : '결석',
                      unchecked: '미체크',
                    }
                    return (
                      <div
                        key={result.student.seatId}
                        className="p-4 bg-gray-50 rounded-xl"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-lg">{result.student.name}</span>
                            <span className="text-gray-500 ml-2">({result.student.studentId})</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[status]}`}>
                            {statusLabels[status]}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="text-primary-600 font-semibold">{result.zoneName}</span>
                          <span className="mx-2">|</span>
                          <span>좌석: {result.student.seatId}</span>
                        </div>
                        {result.student.preAbsence && (
                          <div className="mt-2 text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                            사전 결석: {result.student.preAbsence.reason}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : searchQuery.length > 0 ? (
                <div className="text-center text-gray-500 py-8">
                  검색 결과가 없습니다
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  학생 이름을 입력하면 1, 2학년 전체에서 검색합니다
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상태별 학생 목록 모달 */}
      {selectedStatusFilter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${
              selectedStatusFilter === 'present' ? 'bg-green-500 text-white' :
              selectedStatusFilter === 'absent' ? 'bg-red-500 text-white' :
              selectedStatusFilter === 'unchecked' ? 'bg-gray-500 text-white' :
              'bg-blue-500 text-white'
            }`}>
              <h3 className="text-lg font-bold">
                {selectedStatusFilter === 'all' && '전체 학생'}
                {selectedStatusFilter === 'present' && '출석 학생'}
                {selectedStatusFilter === 'absent' && '결석 학생'}
                {selectedStatusFilter === 'unchecked' && '미체크 학생'}
                {' '}({filteredStudentsList.length}명)
              </h3>
              <button
                onClick={() => setSelectedStatusFilter(null)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredStudentsList.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">구역</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">좌석</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">이름</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-500">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStudentsList.map((student) => (
                      <tr key={student.seatId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-primary-600 text-sm">{student.zoneId}</td>
                        <td className="px-4 py-2 text-gray-600 text-sm">{student.seatId}</td>
                        <td className="px-4 py-2 text-sm">
                          <div className="font-medium text-gray-800">{student.studentName}</div>
                          <div className="text-xs text-gray-400">{student.studentId}</div>
                          {student.preAbsenceReason && (
                            <div className="text-xs text-purple-500 mt-1">{student.preAbsenceReason}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {getStatusBadge(student.status, student.hasPreAbsence && student.status === 'absent')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  해당하는 학생이 없습니다.
                </div>
              )}
            </div>
            <div className="p-4 border-t flex-shrink-0">
              <button
                onClick={() => setSelectedStatusFilter(null)}
                className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 버그 보고 작성 모달 */}
      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />

      {/* 버그 보고 목록 모달 */}
      {showBugReports && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-orange-500 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">버그 보고 목록 ({bugReports.length}건)</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowBugReports(false)
                    setShowBugReport(true)
                  }}
                  className="px-3 py-1 text-sm bg-white/20 rounded-lg hover:bg-white/30"
                >
                  새 보고
                </button>
                <button
                  onClick={() => setShowBugReports(false)}
                  className="text-white/80 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {bugReports.length > 0 ? (
                <div className="space-y-3">
                  {bugReports.map((report) => (
                    <div
                      key={report.id}
                      className={`p-4 rounded-xl border ${report.isRead ? 'bg-gray-50 border-gray-200' : 'bg-orange-50 border-orange-200'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm text-gray-500">
                          {new Date(report.timestamp).toLocaleString('ko-KR')}
                        </div>
                        {!report.isRead && (
                          <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">NEW</span>
                        )}
                      </div>
                      <div className="font-medium text-gray-800 mb-2">{report.description}</div>
                      {report.errorInfo !== '(오류 정보 없음)' && (
                        <div className="bg-gray-100 p-2 rounded text-xs font-mono text-gray-600 max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {report.errorInfo}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-gray-400 truncate">
                        {report.url}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            const updatedReports = bugReports.map(r =>
                              r.id === report.id ? { ...r, isRead: true } : r
                            )
                            setBugReports(updatedReports)
                            localStorage.setItem('bug_reports', JSON.stringify(updatedReports))
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          읽음 표시
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('이 보고를 삭제하시겠습니까?')) {
                              const updatedReports = bugReports.filter(r => r.id !== report.id)
                              setBugReports(updatedReports)
                              localStorage.setItem('bug_reports', JSON.stringify(updatedReports))
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  아직 접수된 버그 보고가 없습니다
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2">
              {bugReports.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('모든 보고를 삭제하시겠습니까?')) {
                      setBugReports([])
                      localStorage.removeItem('bug_reports')
                    }
                  }}
                  className="px-4 py-2 text-red-600 text-sm font-medium hover:bg-red-50 rounded-lg"
                >
                  전체 삭제
                </button>
              )}
              <button
                onClick={() => setShowBugReports(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
