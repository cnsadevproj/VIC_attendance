import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/layout/Header'
import { getStudentBySeatId, searchStudentByName, type StudentSearchResult } from '../config/mockStudents'
import BugReportModal, { type BugReport } from '../components/BugReportModal'
import { SEAT_LAYOUTS } from '../config/seatLayouts'
import { fetchTodayStaff, isTemporaryPeriod, type TodayStaff } from '../config/staffSchedule'
import { exportToClipboard, exportToGoogleSheets, isAppsScriptConfigured, getSheetName, type AbsentStudent, type StudentWithNote } from '../services/googleSheets'
import { sendDiscordReport } from '../services/discordService'
import { usePreAbsences } from '../hooks/usePreAbsences'
import { getTodayKST } from '../utils/date'
import { zoneAttendanceService, type ZoneAttendanceData } from '../services/zoneAttendanceService'
import { noticeService } from '../services/noticeService'
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

const TEMP_STAFF_SCHEDULE: Record<string, { grade1: [string, string], grade2: [string, string] }> = {
  '2025-12-22': { grade1: ['김종규', '이건우'], grade2: ['조민경', '노예원'] },
  '2025-12-23': { grade1: ['이예진', '홍선영'], grade2: ['장보경', '김솔'] },
  '2025-12-24': { grade1: ['홍승민', '조현정'], grade2: ['강현수', '민수정'] },
  '2025-12-25': { grade1: ['박한비', '서률지'], grade2: ['정수빈', '김종규'] },
  '2025-12-26': { grade1: ['이건우', '조민경'], grade2: ['노예원', '이예진'] },
  '2025-12-29': { grade1: ['서률지', '정수빈'], grade2: ['김종규', '이건우'] },
  '2025-12-30': { grade1: ['조민경', '노예원'], grade2: ['이예진', '홍선영'] },
  '2025-12-31': { grade1: ['장보경', '김솔'], grade2: ['홍승민', '조현정'] },
  '2026-01-01': { grade1: ['강현수', '민수정'], grade2: ['박한비', '서률지'] },
  '2026-01-02': { grade1: ['정수빈', '김종규'], grade2: ['이건우', '조민경'] },
}

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
  '2026-01-28': { grade1: ['이예진', '서률지'], grade2: ['장보경', '박한비'] },
  '2026-01-29': { grade1: ['노예원', '김종규'], grade2: ['강현수', '이건우'] },
  '2026-01-30': { grade1: ['민수정', '조현정'], grade2: ['정수빈', '박한비'] },
  '2026-02-02': { grade1: ['홍승민', '조민경'], grade2: ['서률지', '강현수'] },
  '2026-02-03': { grade1: ['민수정', '김솔'], grade2: ['정수빈', '이건우'] },
}

const DATE_STAFF_SCHEDULE: Record<string, { grade1: [string, string], grade2: [string, string] }> = {
  ...TEMP_STAFF_SCHEDULE,
  ...FIXED_STAFF_SCHEDULE,
}

const OPERATING_DATES = Object.keys(DATE_STAFF_SCHEDULE).sort()

function generateCompletionRates(): Record<string, Record<string, number>> {
  const rates: Record<string, Record<string, number>> = {}
  const today = getTodayKST()

  OPERATING_DATES.forEach((dateStr) => {
    if (dateStr < today) {
      rates[dateStr] = {
        '4A': 1.0, '4B': 1.0, '4C': 1.0, '4D': 1.0,
        '3A': 1.0, '3B': 1.0, '3C': 1.0, '3D': 1.0,
      }
    } else if (dateStr === today) {
      rates[dateStr] = {
        '4A': 0.0, '4B': 0.0, '4C': 0.0, '4D': 0.0,
        '3A': 0.0, '3B': 0.0, '3C': 0.0, '3D': 0.0,
      }
    } else {
      rates[dateStr] = {
        '4A': 0.0, '4B': 0.0, '4C': 0.0, '4D': 0.0,
        '3A': 0.0, '3B': 0.0, '3C': 0.0, '3D': 0.0,
      }
    }
  })

  return rates
}

const DATE_COMPLETION_RATES = generateCompletionRates()

function getZoneRecordersForDate(dateStr: string): Record<string, string> {
  const schedule = DATE_STAFF_SCHEDULE[dateStr]
  if (!schedule) return {}

  const completionRates = DATE_COMPLETION_RATES[dateStr] || {}
  const recorders: Record<string, string> = {}

  if (completionRates['4A'] > 0) recorders['4A'] = schedule.grade1[0]
  if (completionRates['4B'] > 0) recorders['4B'] = schedule.grade1[0]
  if (completionRates['4C'] > 0) recorders['4C'] = schedule.grade1[1]
  if (completionRates['4D'] > 0) recorders['4D'] = schedule.grade1[1]

  if (completionRates['3A'] > 0) recorders['3A'] = schedule.grade2[0]
  if (completionRates['3B'] > 0) recorders['3B'] = schedule.grade2[0]
  if (completionRates['3C'] > 0) recorders['3C'] = schedule.grade2[1]
  if (completionRates['3D'] > 0) recorders['3D'] = schedule.grade2[1]

  return recorders
}

function generateSampleDataForDate(dateStr: string): Map<string, Map<string, AttendanceRecord>> {
  const allData = new Map<string, Map<string, AttendanceRecord>>()
  const completionRates = DATE_COMPLETION_RATES[dateStr] || {}

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

const ALL_SAMPLE_DATA: Record<string, Map<string, Map<string, AttendanceRecord>>> = {}
Object.keys(DATE_COMPLETION_RATES).forEach(dateStr => {
  ALL_SAMPLE_DATA[dateStr] = generateSampleDataForDate(dateStr)
})

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
  const [isAuthenticated] = useState(() => {
    return sessionStorage.getItem('adminAuth') === 'true'
  })
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [date, setDate] = useState(() => {
    const savedDate = sessionStorage.getItem('adminSelectedDate')
    return savedDate || getTodayKST()
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
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isSendingDiscord, setIsSendingDiscord] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [showSmsModal, setShowSmsModal] = useState(false)
  const [excludePreAbsence, setExcludePreAbsence] = useState(false)

  const { getPreAbsenceInfo } = usePreAbsences()

  const [supabaseData, setSupabaseData] = useState<Map<string, Map<string, AttendanceRecord>>>(new Map())
  const [supabaseRecorders, setSupabaseRecorders] = useState<Map<string, string>>(new Map())
  const [supabaseNotes, setSupabaseNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadSupabaseData = async () => {
      try {
        const allData = await zoneAttendanceService.getAllByDate(date)
        console.log('[AdminDashboard] Supabase data loaded:', allData.length, 'zones')

        const dataMap = new Map<string, Map<string, AttendanceRecord>>()
        const recordersMap = new Map<string, string>()
        let allNotes: Record<string, string> = {}

        allData.forEach((zoneData: ZoneAttendanceData) => {
          if (zoneData.data && Array.isArray(zoneData.data)) {
            dataMap.set(zoneData.zone_id, new Map(zoneData.data))
          }
          if (zoneData.recorded_by) {
            recordersMap.set(zoneData.zone_id, zoneData.recorded_by)
          }
          if (zoneData.notes) {
            allNotes = { ...allNotes, ...zoneData.notes }
          }
        })

        setSupabaseData(dataMap)
        setSupabaseRecorders(recordersMap)
        setSupabaseNotes(allNotes)
      } catch (err) {
        console.error('[AdminDashboard] Supabase load error:', err)
      }
    }

    loadSupabaseData()

    const unsubscribe = zoneAttendanceService.subscribeToDate(date, (allData) => {
      console.log('[AdminDashboard] Realtime update:', allData.length, 'zones')

      const dataMap = new Map<string, Map<string, AttendanceRecord>>()
      const recordersMap = new Map<string, string>()
      let allNotes: Record<string, string> = {}

      allData.forEach((zoneData: ZoneAttendanceData) => {
        if (zoneData.data && Array.isArray(zoneData.data)) {
          dataMap.set(zoneData.zone_id, new Map(zoneData.data))
        }
        if (zoneData.recorded_by) {
          recordersMap.set(zoneData.zone_id, zoneData.recorded_by)
        }
        if (zoneData.notes) {
          allNotes = { ...allNotes, ...zoneData.notes }
        }
      })

      setSupabaseData(dataMap)
      setSupabaseRecorders(recordersMap)
      setSupabaseNotes(allNotes)
    })

    return () => {
      unsubscribe()
    }
  }, [date])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.length >= 1) {
      const results = searchStudentByName(query)
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }

  const selectedDateData = useMemo(() => {
    try {
      const todayKey = getTodayKST()
      const result = new Map<string, Map<string, AttendanceRecord>>()

      ZONES.forEach((zone) => {
        try {
          if (supabaseData.has(zone.id)) {
            result.set(zone.id, supabaseData.get(zone.id) || new Map())
            return
          }

          if (date === todayKey) {
            const savedData = localStorage.getItem(`attendance_saved_${zone.id}_${date}`)
            if (savedData) {
              try {
                const parsed = JSON.parse(savedData) as [string, AttendanceRecord][]
                if (Array.isArray(parsed)) {
                  result.set(zone.id, new Map(parsed))
                  return
                }
              } catch {
                localStorage.removeItem(`attendance_saved_${zone.id}_${date}`)
              }
            }

            const tempData = localStorage.getItem(`attendance_temp_${zone.id}_${date}`)
            if (tempData) {
              try {
                const parsed = JSON.parse(tempData) as [string, AttendanceRecord][]
                if (Array.isArray(parsed)) {
                  result.set(zone.id, new Map(parsed))
                  return
                }
              } catch {
                localStorage.removeItem(`attendance_temp_${zone.id}_${date}`)
              }
            }
          }

          const sampleData = ALL_SAMPLE_DATA[date]
          if (sampleData && sampleData.get) {
            result.set(zone.id, sampleData.get(zone.id) || new Map())
          } else {
            result.set(zone.id, new Map())
          }
        } catch {
          result.set(zone.id, new Map())
        }
      })

      return result
    } catch (e) {
      console.error('selectedDateData 계산 오류:', e)
      return new Map<string, Map<string, AttendanceRecord>>()
    }
  }, [date, supabaseData])

  const selectedDateTempZones = useMemo(() => {
    try {
      const todayKey = getTodayKST()

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
          }
        })
        return tempZones
      }

      return getTempSaveZonesForDate(date)
    } catch {
      return []
    }
  }, [date])

  const selectedDateRecorders = useMemo(() => {
    try {
      const todayKey = getTodayKST()
      const recorders = getZoneRecordersForDate(date) || {}

      supabaseRecorders.forEach((recorder, zoneId) => {
        recorders[zoneId] = recorder
      })

      if (date === todayKey) {
        ZONES.forEach((zone) => {
          try {
            if (!supabaseRecorders.has(zone.id)) {
              const savedRecorder = localStorage.getItem(`attendance_recorder_${zone.id}_${date}`)
              if (savedRecorder) {
                recorders[zone.id] = savedRecorder
              }
            }
          } catch {
          }
        })
      }

      return recorders
    } catch {
      return {}
    }
  }, [date, supabaseRecorders])

  const getAttendanceStatus = (seatId: string, zoneId: string): 'present' | 'absent' | 'unchecked' => {
    const zoneRecords = selectedDateData.get(zoneId)
    if (!zoneRecords) return 'unchecked'
    const record = zoneRecords.get(seatId)
    return record?.status || 'unchecked'
  }

  useEffect(() => {
    fetchTodayStaff().then(setTodayStaff)
  }, [])

  useEffect(() => {
    sessionStorage.setItem('adminSelectedDate', date)
  }, [date])

  useEffect(() => {
    const loadNotice = async () => {
      try {
        const notice = await noticeService.get(date)
        setNoticeText(notice)
      } catch (error) {
        console.error('[AdminDashboard] Failed to load notice:', error)
        const savedNotice = localStorage.getItem(`admin_notice_${date}`)
        setNoticeText(savedNotice || '')
      }
    }
    loadNotice()
    setShowNoticeInput(false)

    const unsubscribe = noticeService.subscribeToDate(date, (notice) => {
      setNoticeText(notice)
    })

    return () => {
      unsubscribe()
    }
  }, [date])

  const handleSaveNotice = async () => {
    try {
      if (noticeText.trim()) {
        await noticeService.save(date, noticeText.trim())
        localStorage.setItem(`admin_notice_${date}`, noticeText.trim())
      } else {
        await noticeService.delete(date)
        localStorage.removeItem(`admin_notice_${date}`)
      }
    } catch (error) {
      console.error('[AdminDashboard] Failed to save notice:', error)
      if (noticeText.trim()) {
        localStorage.setItem(`admin_notice_${date}`, noticeText.trim())
      } else {
        localStorage.removeItem(`admin_notice_${date}`)
      }
    }
    setShowNoticeInput(false)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true')
      window.location.reload()
    } else {
      setPasswordError(true)
      setPassword('')
    }
  }

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

  const zoneSummaries = useMemo(() => {
    try {
      return ZONES.map((zone) => {
        try {
          const layout = SEAT_LAYOUTS[zone.id]
          if (!layout) return null

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

          const records = selectedDateData.get(zone.id) || new Map()
          let present = 0
          let absent = 0

          records.forEach((record, seatId) => {
            const student = getStudentBySeatId(seatId)
            if (!student) return
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
            unchecked: Math.max(0, unchecked),
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

  const filteredSummaries = selectedGrade
    ? zoneSummaries.filter((z) => z.grade === selectedGrade)
    : zoneSummaries

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
            const preAbsInfo = getPreAbsenceInfo(student.studentId, date)
            details.push({
              seatId,
              studentId: student.studentId,
              studentName: student.name,
              status: record?.status || 'unchecked',
              hasPreAbsence: !!preAbsInfo,
              preAbsenceReason: preAbsInfo?.reason,
            })
          }
        }
      })
    })

    return details
  }, [selectedZone, selectedDateData, date, getPreAbsenceInfo])

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
              const preAbsInfo = getPreAbsenceInfo(student.studentId, date)
              students.push({
                seatId,
                studentId: student.studentId,
                studentName: student.name,
                status: record?.status || 'unchecked',
                zoneId: zoneSummary.zoneId,
                zoneName: zoneSummary.zoneName,
                hasPreAbsence: !!preAbsInfo,
                preAbsenceReason: preAbsInfo?.reason,
              })
            }
          }
        })
      })
    })

    return students
  }, [filteredSummaries, selectedDateData, date, getPreAbsenceInfo])

  const filteredStudentsList = useMemo(() => {
    if (!selectedStatusFilter) return []
    if (selectedStatusFilter === 'all') return allStudentsByStatus
    return allStudentsByStatus.filter(s => s.status === selectedStatusFilter)
  }, [selectedStatusFilter, allStudentsByStatus])

  const grade1Zones = filteredSummaries.filter((z) => z.grade === 1)
  const grade2Zones = filteredSummaries.filter((z) => z.grade === 2)

  const studentNotes = useMemo(() => {
    let notes: Record<string, string> = {}

    try {
      const notesData = localStorage.getItem(`student_notes_${date}`)
      if (notesData) {
        notes = JSON.parse(notesData) as Record<string, string>
      }
    } catch {
    }

    if (Object.keys(supabaseNotes).length > 0) {
      notes = { ...notes, ...supabaseNotes }
    }

    return notes
  }, [date, supabaseNotes])

  const absentStudentsForExport = useMemo(() => {
    const result: AbsentStudent[] = []

    ZONES.forEach((zone) => {
      const layout = SEAT_LAYOUTS[zone.id]
      if (!layout) return

      const records = selectedDateData.get(zone.id) || new Map()

      layout.forEach((row) => {
        if (row[0] === 'br') return
        row.forEach((cell) => {
          if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
            const seatId = cell as string
            const student = getStudentBySeatId(seatId)
            if (student) {
              const record = records.get(seatId)
              if (record?.status === 'absent') {
                const parts: string[] = []

                const preAbsInfo = getPreAbsenceInfo(student.studentId, date)
                if (preAbsInfo) {
                  if (preAbsInfo.reason) {
                    parts.push(`[${preAbsInfo.type}] ${preAbsInfo.reason}`)
                  } else {
                    parts.push(`[${preAbsInfo.type}]`)
                  }
                }

                const studentNote = studentNotes[seatId]
                if (studentNote) {
                  parts.push(studentNote)
                }

                if (record.note) {
                  parts.push(record.note)
                }

                result.push({
                  seatId,
                  name: student.name,
                  note: parts.join(' / '),
                  grade: zone.grade,
                })
              }
            }
          }
        })
      })
    })

    result.sort((a, b) => a.seatId.localeCompare(b.seatId))

    return result
  }, [selectedDateData, studentNotes, getPreAbsenceInfo, date])

  const studentsWithNotes = useMemo(() => {
    const result: (StudentWithNote & { status: 'present' | 'absent' | 'unchecked' })[] = []

    ZONES.forEach((zone) => {
      const layout = SEAT_LAYOUTS[zone.id]
      if (!layout) return

      const records = selectedDateData.get(zone.id) || new Map()

      layout.forEach((row) => {
        if (row[0] === 'br') return
        row.forEach((cell) => {
          if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
            const seatId = cell as string
            const student = getStudentBySeatId(seatId)
            if (student) {
              const record = records.get(seatId)
              const note = studentNotes[seatId] || record?.note
              if (note) {
                result.push({
                  seatId,
                  name: student.name,
                  note,
                  grade: zone.grade,
                  status: record?.status || 'unchecked',
                })
              }
            }
          }
        })
      })
    })

    result.sort((a, b) => a.seatId.localeCompare(b.seatId))

    return result
  }, [selectedDateData, studentNotes])

  const handleExportToClipboard = async () => {
    const text = exportToClipboard(date, absentStudentsForExport)
    try {
      await navigator.clipboard.writeText(text)
      setExportMessage('클립보드에 복사되었습니다!')
    } catch {
      setExportMessage('복사 실패. 수동으로 복사해주세요.')
    }
  }

  const handleExportToSheets = async () => {
    setIsExporting(true)
    setExportMessage(null)

    try {
      const result = await exportToGoogleSheets(date, absentStudentsForExport, studentsWithNotes)
      setExportMessage(result.message)

      if (result.success && result.sheetUrl) {
        setTimeout(() => {
          window.open(result.sheetUrl, '_blank')
        }, 500)
      }
    } catch (error) {
      setExportMessage('내보내기 중 오류가 발생했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

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

      <div className="bg-white border-b px-4 py-3 flex flex-wrap gap-3 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        />
        <span className="text-sm text-gray-500">08:30~08:50 출결</span>
        <button
          onClick={() => setShowExportModal(true)}
          className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          내보내기
        </button>
        <button
          onClick={() => setShowSmsModal(true)}
          className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          결석자 문자
        </button>
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
                onClick={async () => {
                  setNoticeText('')
                  try {
                    await noticeService.delete(date)
                  } catch (error) {
                    console.error('[AdminDashboard] Failed to delete notice:', error)
                  }
                  localStorage.removeItem(`admin_notice_${date}`)
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

      <div className="px-4 py-4 overflow-auto flex-1">
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
          <div className="grid grid-cols-5 gap-2 text-center text-sm">
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
            <button
              onClick={() => setShowNotesModal(true)}
              className="p-2 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <div className="text-purple-600">특이사항</div>
              <div className="font-bold text-purple-600">{studentsWithNotes.length}</div>
            </button>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-3">구역별 현황</h2>

        {grade1Zones.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-500 mb-2">1학년 (4층)</div>
            <div className="grid grid-cols-4 gap-2">
              {grade1Zones.map((zone) => {
                const isEmpty = zone.total === 0
                return (
                  <div
                    key={zone.zoneId}
                    className={`bg-white rounded-xl shadow-sm p-3 transition-shadow ${
                      isEmpty ? 'opacity-50' : 'cursor-pointer hover:shadow-md'
                    }`}
                    onClick={() => !isEmpty && setSelectedZone(zone.zoneId)}
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
                      {isEmpty ? (
                        <span>0석</span>
                      ) : (
                        <>
                          <span className="text-green-600">{zone.present}</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-600">{zone.absent}</span>
                          <span className="mx-1">/</span>
                          <span>{zone.unchecked}</span>
                        </>
                      )}
                    </div>
                    {isEmpty ? (
                      <div className="text-xs text-gray-400">미배정 교실</div>
                    ) : zone.recordedBy ? (
                      <div className="text-xs text-blue-500 truncate">{zone.recordedBy}</div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {grade2Zones.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-gray-500 mb-2">2학년 (3층)</div>
            <div className="grid grid-cols-4 gap-2">
              {grade2Zones.map((zone) => {
                const isEmpty = zone.total === 0
                return (
                  <div
                    key={zone.zoneId}
                    className={`bg-white rounded-xl shadow-sm p-3 transition-shadow ${
                      isEmpty ? 'opacity-50' : 'cursor-pointer hover:shadow-md'
                    }`}
                    onClick={() => !isEmpty && setSelectedZone(zone.zoneId)}
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
                      {isEmpty ? (
                        <span>0석</span>
                      ) : (
                        <>
                          <span className="text-green-600">{zone.present}</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-600">{zone.absent}</span>
                          <span className="mx-1">/</span>
                          <span>{zone.unchecked}</span>
                        </>
                      )}
                    </div>
                    {isEmpty ? (
                      <div className="text-xs text-gray-400">미배정 교실</div>
                    ) : zone.recordedBy ? (
                      <div className="text-xs text-green-500 truncate">{zone.recordedBy}</div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

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
                    const preAbsInfo = getPreAbsenceInfo(result.student.studentId, date)
                    const statusStyles = {
                      present: 'bg-green-100 text-green-700',
                      absent: preAbsInfo ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700',
                      unchecked: 'bg-gray-100 text-gray-500',
                    }
                    const statusLabels = {
                      present: '출석',
                      absent: preAbsInfo ? (preAbsInfo.type === '외박' ? '외박' : '사전결석') : '결석',
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
                        {preAbsInfo && (
                          <div className={`mt-2 text-sm px-2 py-1 rounded ${
                            preAbsInfo.type === '외박' ? 'text-indigo-600 bg-indigo-50' : 'text-purple-600 bg-purple-50'
                          }`}>
                            {preAbsInfo.type === '외박' ? '외박' : '사전 결석'}: {preAbsInfo.reason}
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

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="bg-emerald-500 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">결석자 내보내기</h2>
              <button
                onClick={() => {
                  setShowExportModal(false)
                  setExportMessage(null)
                }}
                className="text-white/80 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">선택된 날짜</div>
                <div className="font-bold text-lg">
                  {new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </div>
              </div>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500 mb-2">결석자 현황</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-blue-600 font-semibold">1학년:</span>{' '}
                    {absentStudentsForExport.filter(s => s.grade === 1).length}명
                  </div>
                  <div>
                    <span className="text-green-600 font-semibold">2학년:</span>{' '}
                    {absentStudentsForExport.filter(s => s.grade === 2).length}명
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  총 {absentStudentsForExport.length}명
                </div>
              </div>

              {absentStudentsForExport.length > 0 && (
                <div className="mb-4 max-h-48 overflow-y-auto">
                  <div className="text-sm text-gray-500 mb-2">결석자 목록</div>
                  <div className="space-y-1">
                    {absentStudentsForExport.map((student) => (
                      <div
                        key={student.seatId}
                        className="flex items-center gap-2 text-sm p-2 bg-red-50 rounded"
                      >
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          student.grade === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {student.grade}학년
                        </span>
                        <span className="font-mono text-gray-600">{student.seatId}</span>
                        <span className="font-medium">{student.name}</span>
                        {student.note && (
                          <span className="text-xs text-purple-600 truncate flex-1">{student.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exportMessage && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  exportMessage.includes('실패') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {exportMessage}
                </div>
              )}

              <div className="space-y-2">
                {isAppsScriptConfigured() ? (
                  <button
                    onClick={handleExportToSheets}
                    disabled={isExporting || absentStudentsForExport.length === 0}
                    className={`w-full py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2
                      ${isExporting || absentStudentsForExport.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600'
                      }`}
                  >
                    {isExporting ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        내보내는 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        시트에 바로 저장 ({getSheetName(date)})
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                    <div className="font-semibold mb-1">⚠️ Apps Script 미설정</div>
                    <div className="text-xs">시트 자동 저장을 사용하려면 Apps Script를 설정하세요.</div>
                  </div>
                )}

                <button
                  onClick={async () => {
                    const dateObj = new Date(date + 'T00:00:00')
                    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
                    const month = dateObj.getMonth() + 1
                    const day = dateObj.getDate()
                    const weekday = weekdays[dateObj.getDay()]
                    const totalAbsent = absentStudentsForExport.length
                    const displayDate = `${month}월 ${day}일(${weekday})`

                    const reportMessage = `안녕하세요, 이현경 부장님.
${displayDate} 겨울방학 방과후학교 조간면학 출결현황 보내드립니다.
총 ${totalAbsent}명의 학생 및 학부모님께 알림 발송 완료했습니다.
[VIC 조간면학일지 스프레드시트] https://docs.google.com/spreadsheets/d/1gVFE9dxJ-tl6f4KFqe5z2XDZ2B5mVgzpFAj7s-XrLAs/edit?usp=sharing
감사합니다.`

                    try {
                      await navigator.clipboard.writeText(reportMessage)
                    } catch {
                      console.error('클립보드 복사 실패')
                    }

                    setIsSendingDiscord(true)
                    try {
                      const result = await sendDiscordReport({
                        message: reportMessage,
                        displayDate,
                        absentStudents: absentStudentsForExport,
                        noticeText
                      })
                      if (result.success) {
                        setExportMessage('✅ Discord 전송 완료! (테이블 이미지 포함) 메시지가 클립보드에 복사되었습니다.')
                      } else {
                        setExportMessage(`❌ Discord 전송 실패: ${result.error}`)
                      }
                    } catch (err) {
                      setExportMessage(`❌ Discord 전송 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
                    } finally {
                      setIsSendingDiscord(false)
                    }
                  }}
                  disabled={isSendingDiscord}
                  className={`w-full py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2
                    ${isSendingDiscord
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                >
                  {isSendingDiscord ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Discord 전송 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      Discord로 보고 (+ 클립보드 복사)
                    </>
                  )}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-400">또는</span>
                  </div>
                </div>

                <button
                  onClick={handleExportToClipboard}
                  className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  클립보드에 복사
                </button>
                <a
                  href="https://docs.google.com/spreadsheets/d/1gVFE9dxJ-tl6f4KFqe5z2XDZ2B5mVgzpFAj7s-XrLAs/edit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-2 text-blue-600 font-medium rounded-xl hover:bg-blue-50 transition-colors text-center text-sm"
                >
                  Google 스프레드시트 열기 →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />

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


      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-purple-500 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">특이사항 학생 ({studentsWithNotes.length}명)</h2>
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-white/80 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {studentsWithNotes.length > 0 ? (
                <div className="space-y-2">
                  {studentsWithNotes.map((student) => (
                    <div
                      key={student.seatId}
                      className="p-3 bg-purple-50 rounded-lg border border-purple-100"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          student.grade === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {student.grade}학년
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          student.status === 'present' ? 'bg-green-100 text-green-700' :
                          student.status === 'absent' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {student.status === 'present' ? '출석' : student.status === 'absent' ? '결석' : '미체크'}
                        </span>
                        <span className="font-mono text-gray-600 text-sm">{student.seatId}</span>
                        <span className="font-medium">{student.name}</span>
                      </div>
                      <div className="text-sm text-purple-700 bg-purple-100 p-2 rounded">
                        {student.note}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  특이사항이 기재된 학생이 없습니다
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <button
                onClick={() => setShowNotesModal(false)}
                className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {showSmsModal && (() => {
        const commuteAbsent: { studentId: string; name: string; seatId: string; isPreAbsence: boolean }[] = []
        const dormOvernightAbsent: { studentId: string; name: string; seatId: string }[] = []
        const dormNoOvernightAbsent: { studentId: string; name: string; seatId: string; isPreAbsence: boolean }[] = []

        absentStudentsForExport.forEach((s) => {
          const student = getStudentBySeatId(s.seatId)
          if (!student) return

          const preAbsInfo = getPreAbsenceInfo(student.studentId, date)
          const isPreAbsence = !!preAbsInfo

          if (student.residenceType === 'commute') {
            commuteAbsent.push({ studentId: student.studentId, name: student.name, seatId: s.seatId, isPreAbsence })
          } else {
            if (preAbsInfo && preAbsInfo.type === '외박') {
              dormOvernightAbsent.push({ studentId: student.studentId, name: student.name, seatId: s.seatId })
            } else {
              dormNoOvernightAbsent.push({ studentId: student.studentId, name: student.name, seatId: s.seatId, isPreAbsence })
            }
          }
        })

        const filteredCommute = excludePreAbsence
          ? commuteAbsent.filter(s => !s.isPreAbsence)
          : commuteAbsent
        const filteredDormNoOvernight = excludePreAbsence
          ? dormNoOvernightAbsent.filter(s => !s.isPreAbsence)
          : dormNoOvernightAbsent

        const copyCategory = async (students: { studentId: string; name: string }[], label: string) => {
          const text = students.map(s => `${s.studentId} ${s.name}`).join('\n')
          try {
            await navigator.clipboard.writeText(text)
            alert(`${label} ${students.length}명 복사 완료`)
          } catch {
            alert('복사 실패')
          }
        }

        const copyAll = async () => {
          const lines: string[] = []
          if (filteredCommute.length > 0) {
            lines.push('[통학생 - 학생+학부모]')
            filteredCommute.forEach(s => lines.push(`${s.studentId} ${s.name}`))
            lines.push('')
          }
          if (dormOvernightAbsent.length > 0) {
            lines.push('[기숙사 외박 - 학부모만]')
            dormOvernightAbsent.forEach(s => lines.push(`${s.studentId} ${s.name}`))
            lines.push('')
          }
          if (filteredDormNoOvernight.length > 0) {
            lines.push('[기숙사 외박X - 학생만]')
            filteredDormNoOvernight.forEach(s => lines.push(`${s.studentId} ${s.name}`))
          }
          try {
            await navigator.clipboard.writeText(lines.join('\n'))
            alert('전체 복사 완료')
          } catch {
            alert('복사 실패')
          }
        }

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
              <div className="bg-blue-500 text-white p-4 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold">결석자 알림 발송</h2>
                <button
                  onClick={() => setShowSmsModal(false)}
                  className="text-white/80 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                <div className="mb-4 text-center">
                  <div className="text-sm text-gray-500">선택된 날짜</div>
                  <div className="font-bold">
                    {new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
                    })}
                  </div>
                </div>

                <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludePreAbsence}
                      onChange={(e) => setExcludePreAbsence(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm text-amber-800">사전결석 신청자 제외</span>
                    {excludePreAbsence && (
                      <span className="text-xs text-amber-600">
                        (통학 {commuteAbsent.filter(s => s.isPreAbsence).length}명, 기숙 {dormNoOvernightAbsent.filter(s => s.isPreAbsence).length}명 제외)
                      </span>
                    )}
                  </label>
                </div>

                <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-blue-700">1. 통학생</span>
                      <span className="ml-2 text-sm text-blue-600">({filteredCommute.length}명)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">학생+학부모</span>
                      {filteredCommute.length > 0 && (
                        <button
                          onClick={() => copyCategory(filteredCommute, '통학생')}
                          className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded hover:bg-blue-300"
                        >
                          복사
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredCommute.length > 0 ? (
                    <div className="text-xs text-gray-600 bg-white p-2 rounded max-h-24 overflow-y-auto font-mono">
                      {filteredCommute.map(s => `${s.studentId} ${s.name}`).join(', ')}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-2">해당 없음</div>
                  )}
                </div>

                <div className="mb-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-indigo-700">2. 기숙사 (외박 신청)</span>
                      <span className="ml-2 text-sm text-indigo-600">({dormOvernightAbsent.length}명)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">학부모만</span>
                      {dormOvernightAbsent.length > 0 && (
                        <button
                          onClick={() => copyCategory(dormOvernightAbsent, '기숙 외박')}
                          className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded hover:bg-indigo-300"
                        >
                          복사
                        </button>
                      )}
                    </div>
                  </div>
                  {dormOvernightAbsent.length > 0 ? (
                    <div className="text-xs text-gray-600 bg-white p-2 rounded max-h-24 overflow-y-auto font-mono">
                      {dormOvernightAbsent.map(s => `${s.studentId} ${s.name}`).join(', ')}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-2">해당 없음</div>
                  )}
                </div>

                <div className="mb-4 p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-purple-700">3. 기숙사 (외박 미신청)</span>
                      <span className="ml-2 text-sm text-purple-600">({filteredDormNoOvernight.length}명)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">학생만</span>
                      {filteredDormNoOvernight.length > 0 && (
                        <button
                          onClick={() => copyCategory(filteredDormNoOvernight, '기숙 외박X')}
                          className="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded hover:bg-purple-300"
                        >
                          복사
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredDormNoOvernight.length > 0 ? (
                    <div className="text-xs text-gray-600 bg-white p-2 rounded max-h-24 overflow-y-auto font-mono">
                      {filteredDormNoOvernight.map(s => `${s.studentId} ${s.name}`).join(', ')}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-2">해당 없음</div>
                  )}
                </div>

                {(filteredCommute.length > 0 || dormOvernightAbsent.length > 0 || filteredDormNoOvernight.length > 0) && (
                  <button
                    onClick={copyAll}
                    className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors"
                  >
                    전체 복사 (총 {filteredCommute.length + dormOvernightAbsent.length + filteredDormNoOvernight.length}명)
                  </button>
                )}
              </div>

              <div className="p-4 border-t flex-shrink-0">
                <button
                  onClick={() => setShowSmsModal(false)}
                  className="w-full py-2 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
