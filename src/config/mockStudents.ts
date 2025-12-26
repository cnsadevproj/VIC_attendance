// Mock student data for testing
// 80% of seats have students, 20% are unassigned

import { SEAT_LAYOUTS } from './seatLayouts'

export interface MockStudent {
  studentId: string  // 5-digit student number
  name: string
  seatId: string
  preAbsence?: {
    reason: string
    startDate: string
    endDate: string
  }
}

// Korean surnames and given names for generating random names
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍']
const GIVEN_NAMES = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '서연', '서윤', '지우', '서현', '민서', '하은', '하윤', '윤서', '지민', '채원', '수빈', '지원', '다은', '은서', '예은', '수아', '지아', '소율', '예린', '시은']

// 사전 결석 사유 목록
const PRE_ABSENCE_REASONS = [
  '가족 여행 (12/26~12/28)',
  '병원 진료 예정',
  '교외 체험학습 신청',
  '경조사 (조부모 칠순)',
  '대학 면접 일정',
  '해외 출국 (12/26~1/2)',
  '수술 예정',
  '교환학생 프로그램',
  '가정 사정',
  '체육대회 참가',
]

// Generate a random Korean name
function generateRandomName(): string {
  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)]
  const givenName = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)]
  return surname + givenName
}

// Generate a 5-digit student ID based on grade, class, and number
function generateStudentId(grade: number, classNum: number, studentNum: number): string {
  return `${grade}${String(classNum).padStart(2, '0')}${String(studentNum).padStart(2, '0')}`
}

// Seed for reproducible random (simple seeded random)
let seed = 12345
function seededRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

// Get all seat IDs from a zone
function getAllSeatIds(zoneId: string): string[] {
  const layout = SEAT_LAYOUTS[zoneId]
  if (!layout) return []

  const seatIds: string[] = []
  layout.forEach(row => {
    if (row[0] === 'br') return
    row.forEach(cell => {
      if (cell !== 'sp' && cell !== 'empty' && cell !== 'br') {
        seatIds.push(cell as string)
      }
    })
  })
  return seatIds
}

// Generate mock students for all zones
function generateMockStudents(): Map<string, MockStudent | null> {
  const studentMap = new Map<string, MockStudent | null>()

  // Grade 1 zones (4th floor) - 특별교실 제외
  const grade1Zones = ['4A', '4B', '4C', '4D']
  // Grade 2 zones (3rd floor) - 특별교실 제외
  const grade2Zones = ['3A', '3B', '3C', '3D']

  let studentCounter = 1

  // Process Grade 1
  grade1Zones.forEach((zoneId, zoneIndex) => {
    const seatIds = getAllSeatIds(zoneId)
    seatIds.forEach((seatId) => {
      // 80% chance of having a student
      if (seededRandom() < 0.80) {
        const classNum = (zoneIndex % 10) + 1
        const studentId = generateStudentId(1, classNum, studentCounter % 40 + 1)
        const student: MockStudent = {
          studentId,
          name: generateRandomName(),
          seatId,
        }
        // 10% 확률로 사전 결석 정보 추가
        if (seededRandom() < 0.10) {
          const reasonIndex = Math.floor(seededRandom() * PRE_ABSENCE_REASONS.length)
          student.preAbsence = {
            reason: PRE_ABSENCE_REASONS[reasonIndex],
            startDate: '2024-12-26',
            endDate: '2024-12-28',
          }
        }
        studentMap.set(seatId, student)
        studentCounter++
      } else {
        // Unassigned seat
        studentMap.set(seatId, null)
      }
    })
  })

  // Process Grade 2
  studentCounter = 1
  grade2Zones.forEach((zoneId, zoneIndex) => {
    const seatIds = getAllSeatIds(zoneId)
    seatIds.forEach((seatId) => {
      // 80% chance of having a student
      if (seededRandom() < 0.80) {
        const classNum = (zoneIndex % 10) + 1
        const studentId = generateStudentId(2, classNum, studentCounter % 40 + 1)
        const student: MockStudent = {
          studentId,
          name: generateRandomName(),
          seatId,
        }
        // 10% 확률로 사전 결석 정보 추가
        if (seededRandom() < 0.10) {
          const reasonIndex = Math.floor(seededRandom() * PRE_ABSENCE_REASONS.length)
          student.preAbsence = {
            reason: PRE_ABSENCE_REASONS[reasonIndex],
            startDate: '2024-12-26',
            endDate: '2024-12-28',
          }
        }
        studentMap.set(seatId, student)
        studentCounter++
      } else {
        // Unassigned seat
        studentMap.set(seatId, null)
      }
    })
  })

  return studentMap
}

// Export the generated mock student data
export const MOCK_STUDENTS = generateMockStudents()

// Helper function to get student by seat ID
export function getStudentBySeatId(seatId: string): MockStudent | null {
  return MOCK_STUDENTS.get(seatId) ?? null
}

// 학생 이름으로 검색 (좌석번호, 교실 정보 반환)
export interface StudentSearchResult {
  student: MockStudent
  zoneId: string
  zoneName: string
}

export function searchStudentByName(name: string): StudentSearchResult[] {
  const results: StudentSearchResult[] = []

  // Zone ID to Zone Name mapping
  const zoneNames: Record<string, string> = {
    '4A': '4층 A구역',
    '4B': '4층 B구역',
    '4C': '4층 C구역',
    '4D': '4층 D구역',
    '3A': '3층 A구역',
    '3B': '3층 B구역',
    '3C': '3층 C구역',
    '3D': '3층 D구역',
  }

  MOCK_STUDENTS.forEach((student) => {
    if (student && student.name.includes(name)) {
      // seatId에서 zone 추출 (예: 4A001 -> 4A, 3B123 -> 3B)
      const zoneId = student.seatId.match(/^[34][A-D]/)?.[0] || ''
      results.push({
        student,
        zoneId,
        zoneName: zoneNames[zoneId] || zoneId,
      })
    }
  })

  return results
}
