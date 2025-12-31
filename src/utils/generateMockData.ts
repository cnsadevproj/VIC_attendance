// 임시 출결 데이터 생성 유틸리티
// 12월 22일 ~ 31일까지의 테스트 데이터 생성

import { SEAT_LAYOUTS } from '../config/seatLayouts'
import { getStudentBySeatId } from '../config/mockStudents'
import { isPreAbsentOnDate } from '../config/preAbsences'

// 구역에서 배정된 좌석 ID 목록 가져오기
function getAssignedSeats(zoneId: string): string[] {
  const layout = SEAT_LAYOUTS[zoneId]
  if (!layout) return []

  const seats: string[] = []
  layout.forEach((row) => {
    if (row[0] === 'br') return
    row.forEach((cell) => {
      if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
        const seatId = cell as string
        const student = getStudentBySeatId(seatId)
        if (student) {
          seats.push(seatId)
        }
      }
    })
  })
  return seats
}

// 특정 날짜의 출결 데이터 생성
interface AttendanceRecord {
  studentId: string
  status: 'present' | 'absent'
  isModified: boolean
  staffName?: string
}

function generateDayData(
  dateKey: string,
  options: {
    completeRate: number  // 출결 완료 비율 (0~1)
    preAbsenceAbsentRate: number  // 사전결석자 중 결석 비율 (0~1)
    normalAbsentRate: number  // 일반 학생 결석 비율 (0~1)
  }
): void {
  const zones = ['4A', '4B', '4C', '4D', '3A', '3B', '3C', '3D']
  const staffNames = ['이예진', '조현정', '강현수', '김종규', '장보경', '민수정']

  zones.forEach((zoneId) => {
    const savedKey = `attendance_saved_${zoneId}_${dateKey}`

    // 이미 데이터가 있으면 건너뛰기
    if (localStorage.getItem(savedKey)) return

    const seats = getAssignedSeats(zoneId)
    const records: [string, AttendanceRecord][] = []
    const staffName = staffNames[Math.floor(Math.random() * staffNames.length)]

    // 완료 여부 결정
    const shouldComplete = Math.random() < options.completeRate

    seats.forEach((seatId) => {
      const student = getStudentBySeatId(seatId)
      if (!student) return

      const isPreAbsent = isPreAbsentOnDate(student.studentId, dateKey)
      let status: 'present' | 'absent'

      if (isPreAbsent) {
        // 사전결석자: 높은 확률로 결석
        status = Math.random() < options.preAbsenceAbsentRate ? 'absent' : 'present'
      } else {
        // 일반 학생: 낮은 확률로 결석
        status = Math.random() < options.normalAbsentRate ? 'absent' : 'present'
      }

      if (shouldComplete) {
        records.push([seatId, {
          studentId: seatId,
          status,
          isModified: true,
          staffName,
        }])
      }
    })

    if (records.length > 0) {
      localStorage.setItem(savedKey, JSON.stringify(records))
      localStorage.setItem(`attendance_saved_time_${zoneId}_${dateKey}`, new Date().toISOString())
      localStorage.setItem(`attendance_recorder_${zoneId}_${dateKey}`, staffName)
    }
  })
}

// 임시 데이터 초기화 (12월 22일 ~ 31일)
export function initializeMockData(): void {
  // 12월 22일 ~ 29일: 100% 완료, 사전결석자 95% 결석, 일반 5% 결석
  const dec22to29 = [
    '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-26',
    '2025-12-27', '2025-12-29'  // 주말 제외
  ]

  dec22to29.forEach((dateKey) => {
    generateDayData(dateKey, {
      completeRate: 1.0,
      preAbsenceAbsentRate: 0.97,  // 사전결석자 97% 결석
      normalAbsentRate: 0.05,      // 일반 학생 5% 결석
    })
  })

  // 12월 30일: 100% 완료
  generateDayData('2025-12-30', {
    completeRate: 1.0,
    preAbsenceAbsentRate: 0.97,
    normalAbsentRate: 0.05,
  })

  // 12월 31일: 사전결석자만 결석 처리 (나머지는 미체크 상태)
  // 별도 처리: 사전결석자만 결석으로 표시
  const zones = ['4A', '4B', '4C', '4D', '3A', '3B', '3C', '3D']
  const dateKey = '2025-12-31'
  const staffNames = ['이예진', '조현정', '강현수', '김종규', '장보경', '민수정']

  zones.forEach((zoneId) => {
    const savedKey = `attendance_saved_${zoneId}_${dateKey}`

    // 이미 데이터가 있으면 건너뛰기
    if (localStorage.getItem(savedKey)) return

    const seats = getAssignedSeats(zoneId)
    const records: [string, AttendanceRecord][] = []
    const staffName = staffNames[Math.floor(Math.random() * staffNames.length)]

    seats.forEach((seatId) => {
      const student = getStudentBySeatId(seatId)
      if (!student) return

      const isPreAbsent = isPreAbsentOnDate(student.studentId, dateKey)

      // 사전결석자만 결석 처리, 나머지는 데이터에 포함하지 않음 (미체크)
      if (isPreAbsent) {
        records.push([seatId, {
          studentId: seatId,
          status: 'absent',
          isModified: true,
          staffName,
        }])
      }
    })

    // 12월 31일은 완료되지 않은 상태이므로 저장하지 않음
    // 대신 임시저장으로 처리
    if (records.length > 0) {
      const tempKey = `attendance_temp_${zoneId}_${dateKey}`
      localStorage.setItem(tempKey, JSON.stringify(records))
    }
  })

  console.log('Mock data initialized for 2025-12-22 ~ 2025-12-31')
}

// 임시 데이터 초기화 여부 확인
export function isMockDataInitialized(): boolean {
  // 12월 30일 4A 데이터가 있으면 초기화된 것으로 판단
  return !!localStorage.getItem('attendance_saved_4A_2025-12-30')
}
