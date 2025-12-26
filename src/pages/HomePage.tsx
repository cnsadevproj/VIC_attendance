import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from '../components/layout/Header'
import BugReportModal from '../components/BugReportModal'
import { searchStudentByName, getStudentBySeatId, type StudentSearchResult } from '../config/mockStudents'
import { SEAT_LAYOUTS } from '../config/seatLayouts'
import type { AttendanceRecord } from '../types'

interface CurrentStaff {
  name: string
  grade: number
  date: string
}

interface ZoneStatus {
  total: number
  present: number
  absent: number
  unchecked: number
  isComplete: boolean
}

// Zone configuration based on legacy code
const GRADES = [
  {
    grade: 1,
    name: '1학년 (4층)',
    zones: [
      { id: '4A', name: '4A', color: 'bg-pink-200' },
      { id: '4B', name: '4B', color: 'bg-gray-300' },
      { id: '4C', name: '4C', color: 'bg-sky-200' },
      { id: '4D', name: '4D', color: 'bg-orange-200' },
    ],
  },
  {
    grade: 2,
    name: '2학년 (3층)',
    zones: [
      { id: '3A', name: '3A', color: 'bg-pink-200' },
      { id: '3B', name: '3B', color: 'bg-gray-300' },
      { id: '3C', name: '3C', color: 'bg-sky-200' },
      { id: '3D', name: '3D', color: 'bg-orange-200' },
    ],
  },
]

// 구역별 출결 상태 계산
function getZoneStatus(zoneId: string, todayKey: string): ZoneStatus {
  const layout = SEAT_LAYOUTS[zoneId]
  if (!layout) return { total: 0, present: 0, absent: 0, unchecked: 0, isComplete: false }

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

  // localStorage에서 출결 데이터 읽기 (저장된 데이터 또는 임시저장)
  let records = new Map<string, AttendanceRecord>()

  const savedData = localStorage.getItem(`attendance_saved_${zoneId}_${todayKey}`)
  if (savedData) {
    try {
      const parsed = JSON.parse(savedData) as [string, AttendanceRecord][]
      records = new Map(parsed)
    } catch {
      // ignore
    }
  } else {
    const tempData = localStorage.getItem(`attendance_temp_${zoneId}_${todayKey}`)
    if (tempData) {
      try {
        const parsed = JSON.parse(tempData) as [string, AttendanceRecord][]
        records = new Map(parsed)
      } catch {
        // ignore
      }
    }
  }

  let present = 0
  let absent = 0
  records.forEach((record) => {
    if (record.status === 'present') present++
    else if (record.status === 'absent') absent++
  })

  const unchecked = totalStudents - present - absent
  const isComplete = unchecked === 0 && totalStudents > 0

  return { total: totalStudents, present, absent, unchecked, isComplete }
}

export default function HomePage() {
  const navigate = useNavigate()
  const [currentStaff, setCurrentStaff] = useState<CurrentStaff | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([])
  const [adminNotice, setAdminNotice] = useState<string | null>(null)
  const [showBugReport, setShowBugReport] = useState(false)
  const [zoneStatuses, setZoneStatuses] = useState<Record<string, ZoneStatus>>({})

  // 오늘 날짜 키
  const todayKey = new Date().toISOString().split('T')[0]

  // 관리자 특이사항 불러오기
  useEffect(() => {
    const notice = localStorage.getItem(`admin_notice_${todayKey}`)
    setAdminNotice(notice)
  }, [todayKey])

  // 구역별 출결 상태 불러오기
  useEffect(() => {
    const loadZoneStatuses = () => {
      const statuses: Record<string, ZoneStatus> = {}
      GRADES.forEach((gradeInfo) => {
        gradeInfo.zones.forEach((zone) => {
          statuses[zone.id] = getZoneStatus(zone.id, todayKey)
        })
      })
      setZoneStatuses(statuses)
    }

    loadZoneStatuses()

    // 페이지 포커스 시 다시 로드
    const handleFocus = () => loadZoneStatuses()
    window.addEventListener('focus', handleFocus)

    return () => window.removeEventListener('focus', handleFocus)
  }, [todayKey])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.length >= 1) {
      let results = searchStudentByName(query)
      // 담당자 학년에 따라 필터링
      if (currentStaff) {
        results = results.filter((result) => {
          // 1학년 담당자: 4층(4A,4B,4C,4D)만
          // 2학년 담당자: 3층(3A,3B,3C,3D)만
          const floor = result.zoneId.startsWith('4') ? 1 : 2
          return floor === currentStaff.grade
        })
      }
      setSearchResults(results)
    } else {
      setSearchResults([])
    }
  }

  useEffect(() => {
    // Check for current staff in sessionStorage
    const staffData = sessionStorage.getItem('currentStaff')
    if (staffData) {
      const staff = JSON.parse(staffData) as CurrentStaff
      // Check if it's still today's date
      const today = new Date().toISOString().split('T')[0]
      if (staff.date === today) {
        setCurrentStaff(staff)
      } else {
        // Clear outdated staff data
        sessionStorage.removeItem('currentStaff')
      }
    }
  }, [])

  const handleZoneClick = (zoneId: string) => {
    navigate(`/attendance/${zoneId}`)
  }

  const handleChangeStaff = () => {
    sessionStorage.removeItem('currentStaff')
    navigate('/start')
  }

  // Get today's date in Korean format
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="면학실 선택"
        rightAction={
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              학생 검색
            </button>
            <button
              onClick={() => setShowBugReport(true)}
              className="px-3 py-1 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              버그 보고
            </button>
          </div>
        }
      />

      {/* Current staff info bar */}
      <div className="bg-primary-500 text-white px-4 py-3">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <span className="text-sm opacity-80">{today}</span>
            {currentStaff ? (
              <p className="font-semibold">
                담당자: {currentStaff.name} ({currentStaff.grade}학년)
              </p>
            ) : (
              <p className="font-semibold text-yellow-200">
                담당자 미선택
              </p>
            )}
          </div>
          <button
            onClick={handleChangeStaff}
            className="px-3 py-1 text-sm bg-white/20 rounded-lg hover:bg-white/30"
          >
            {currentStaff ? '담당자 변경' : '담당자 선택'}
          </button>
        </div>
      </div>

      {/* 관리자 특이사항 */}
      {adminNotice && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="container mx-auto">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-lg">📢</span>
              <div>
                <span className="text-xs text-amber-600 font-semibold">오늘의 특이사항</span>
                <p className="text-sm text-amber-800 whitespace-pre-line">{adminNotice}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6 space-y-8">
        {GRADES
          .filter((gradeInfo) => {
            // 담당자가 선택되었으면 해당 학년만 표시
            if (currentStaff) {
              return gradeInfo.grade === currentStaff.grade
            }
            // 담당자 미선택 시 모든 학년 표시
            return true
          })
          .map((gradeInfo) => (
          <section key={gradeInfo.grade} className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {gradeInfo.name}
            </h2>

            {/* Main zones grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {gradeInfo.zones.map((zone) => {
                const status = zoneStatuses[zone.id]
                const isComplete = status?.isComplete

                return (
                  <button
                    key={zone.id}
                    onClick={() => handleZoneClick(zone.id)}
                    className={`${zone.color} p-6 rounded-xl border-2
                               ${isComplete ? 'border-green-500 ring-2 ring-green-300' : 'border-gray-300'}
                               hover:scale-105 hover:shadow-lg transition-all duration-200
                               flex flex-col items-center justify-center min-h-[120px]`}
                  >
                    <span className="text-3xl font-bold text-gray-800">{zone.name}</span>

                    {status && status.total > 0 ? (
                      <div className="mt-2 text-center">
                        <div className="text-sm text-gray-600">
                          {status.total}석
                        </div>
                        {isComplete && (
                          <div className="mt-1 text-sm font-semibold text-green-600">
                            출결입력 완료
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-600 mt-2">로딩중...</span>
                    )}
                  </button>
                )
              })}
            </div>

          </section>
        ))}
      </main>

      {/* 학생 검색 모달 */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-xl font-bold">학생 검색</h2>
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
                  {searchResults.map((result) => (
                    <button
                      key={result.student.seatId}
                      onClick={() => {
                        navigate(`/attendance/${result.zoneId}`)
                        setShowSearch(false)
                      }}
                      className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-left transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-lg">{result.student.name}</span>
                          <span className="text-gray-500 ml-2">({result.student.studentId})</span>
                        </div>
                        <div className="text-right">
                          <div className="text-primary-600 font-semibold">{result.zoneName}</div>
                          <div className="text-sm text-gray-500">좌석: {result.student.seatId}</div>
                        </div>
                      </div>
                      {result.student.preAbsence && (
                        <div className="mt-2 text-sm text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          사전 결석: {result.student.preAbsence.reason}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : searchQuery.length > 0 ? (
                <div className="text-center text-gray-500 py-8">
                  검색 결과가 없습니다
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  학생 이름을 입력하면 좌석 정보를 확인할 수 있습니다
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 버그 보고 모달 */}
      <BugReportModal
        isOpen={showBugReport}
        onClose={() => setShowBugReport(false)}
      />
    </div>
  )
}
