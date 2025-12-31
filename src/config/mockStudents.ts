// 실제 학생 데이터 (267명)
// 1학년: 121명 (4층 4A, 4B, 4C, 4D)
// 2학년: 146명 (3층 3A, 3B, 3C, 3D)

import { SEAT_LAYOUTS } from './seatLayouts'
import { PRE_ABSENCES } from './preAbsences'

export interface Student {
  studentId: string  // 5자리 학번
  name: string
  seatId: string
  preAbsence?: {
    reason: string
    startDate: string
    endDate: string
  }
}

// 1학년 학생 목록 (121명)
const GRADE1_STUDENTS: { studentId: string; name: string }[] = [
  { studentId: '10101', name: '강민재' },
  { studentId: '10102', name: '권민준' },
  { studentId: '10103', name: '길윤석' },
  { studentId: '10105', name: '김동훈' },
  { studentId: '10109', name: '김재현' },
  { studentId: '10112', name: '김진경' },
  { studentId: '10114', name: '김희현' },
  { studentId: '10117', name: '심초이' },
  { studentId: '10118', name: '우소윤' },
  { studentId: '10123', name: '이시호' },
  { studentId: '10125', name: '이지후' },
  { studentId: '10130', name: '정지희' },
  { studentId: '10201', name: '강수경' },
  { studentId: '10204', name: '김서이' },
  { studentId: '10209', name: '김은정' },
  { studentId: '10210', name: '김준연' },
  { studentId: '10212', name: '박서현' },
  { studentId: '10225', name: '이재호' },
  { studentId: '10227', name: '이혜윰' },
  { studentId: '10229', name: '정지유' },
  { studentId: '10230', name: '황근서' },
  { studentId: '10231', name: '황보상림' },
  { studentId: '10306', name: '김지윤' },
  { studentId: '10310', name: '박시원' },
  { studentId: '10316', name: '이보미' },
  { studentId: '10318', name: '이수린' },
  { studentId: '10320', name: '이용준' },
  { studentId: '10322', name: '이지호' },
  { studentId: '10330', name: '최은영' },
  { studentId: '10331', name: '최지윤' },
  { studentId: '10332', name: '홍석영' },
  { studentId: '10401', name: '강경빈' },
  { studentId: '10402', name: '곽수진' },
  { studentId: '10403', name: '김민서' },
  { studentId: '10406', name: '김수찬' },
  { studentId: '10409', name: '박신영' },
  { studentId: '10411', name: '박현준' },
  { studentId: '10413', name: '서정우' },
  { studentId: '10414', name: '송재연' },
  { studentId: '10418', name: '심미주' },
  { studentId: '10421', name: '이민준' },
  { studentId: '10422', name: '이소민' },
  { studentId: '10427', name: '장윤서' },
  { studentId: '10430', name: '천보경' },
  { studentId: '10505', name: '김도윤' },
  { studentId: '10507', name: '김민호' },
  { studentId: '10523', name: '연정원' },
  { studentId: '10526', name: '이도경' },
  { studentId: '10528', name: '이채은' },
  { studentId: '10602', name: '공효정' },
  { studentId: '10608', name: '남윤아' },
  { studentId: '10610', name: '변성민' },
  { studentId: '10611', name: '신예서' },
  { studentId: '10617', name: '윤정환' },
  { studentId: '10621', name: '이효민' },
  { studentId: '10627', name: '채민서' },
  { studentId: '10717', name: '송주성' },
  { studentId: '10719', name: '유가은' },
  { studentId: '10723', name: '이승현' },
  { studentId: '10724', name: '이율하' },
  { studentId: '10725', name: '임선우' },
  { studentId: '10730', name: '차유근' },
  { studentId: '10731', name: '최수연' },
  { studentId: '10801', name: '강연서' },
  { studentId: '10802', name: '고민주' },
  { studentId: '10804', name: '김건' },
  { studentId: '10806', name: '김도훈' },
  { studentId: '10807', name: '김민재' },
  { studentId: '10808', name: '김민정' },
  { studentId: '10810', name: '김유현' },
  { studentId: '10812', name: '김효린' },
  { studentId: '10819', name: '장서인' },
  { studentId: '10821', name: '정지후' },
  { studentId: '10822', name: '정채은' },
  { studentId: '10830', name: '황예원' },
  { studentId: '10831', name: '황인성' },
  { studentId: '10902', name: '구현영' },
  { studentId: '10904', name: '김나현' },
  { studentId: '10905', name: '김도연' },
  { studentId: '10907', name: '김소은' },
  { studentId: '10910', name: '김유경' },
  { studentId: '10911', name: '김지몽' },
  { studentId: '10913', name: '류재석' },
  { studentId: '10921', name: '이동현' },
  { studentId: '10923', name: '임예준' },
  { studentId: '10928', name: '채희서' },
  { studentId: '10930', name: '홍서우' },
  { studentId: '11009', name: '박수진' },
  { studentId: '11018', name: '신유경' },
  { studentId: '11027', name: '임예지' },
  { studentId: '11028', name: '조경준' },
  { studentId: '11103', name: '권하음' },
  { studentId: '11105', name: '김시은' },
  { studentId: '11108', name: '김의진' },
  { studentId: '11111', name: '배현우' },
  { studentId: '11115', name: '안서연' },
  { studentId: '11117', name: '왕영서' },
  { studentId: '11122', name: '이채원' },
  { studentId: '11125', name: '전서희' },
  { studentId: '11201', name: '강빛나' },
  { studentId: '11202', name: '강서진' },
  { studentId: '11203', name: '강태준' },
  { studentId: '11204', name: '김나래' },
  { studentId: '11206', name: '노하윤' },
  { studentId: '11209', name: '박소윤' },
  { studentId: '11210', name: '박소윤' },
  { studentId: '11212', name: '박준범' },
  { studentId: '11214', name: '신금비' },
  { studentId: '11215', name: '신민영' },
  { studentId: '11216', name: '신민정' },
  { studentId: '11217', name: '양민혁' },
  { studentId: '11218', name: '예진희' },
  { studentId: '11219', name: '이동휘' },
  { studentId: '11221', name: '이승채' },
  { studentId: '11222', name: '이은채' },
  { studentId: '11223', name: '이태헌' },
  { studentId: '11227', name: '최정후' },
  { studentId: '11228', name: '한정원' },
  { studentId: '11230', name: '허민영' },
  { studentId: '11231', name: '허재원' },
  { studentId: '11232', name: '허지윤' },
]

// 2학년 학생 목록 (146명)
const GRADE2_STUDENTS: { studentId: string; name: string }[] = [
  { studentId: '20104', name: '김민서' },
  { studentId: '20105', name: '김성윤' },
  { studentId: '20109', name: '김지은' },
  { studentId: '20111', name: '박서현' },
  { studentId: '20116', name: '양우빈' },
  { studentId: '20122', name: '이재원' },
  { studentId: '20123', name: '이현진' },
  { studentId: '20126', name: '정여원' },
  { studentId: '20128', name: '조정연' },
  { studentId: '20202', name: '김나연' },
  { studentId: '20206', name: '김효민' },
  { studentId: '20208', name: '박동현' },
  { studentId: '20212', name: '석재언' },
  { studentId: '20214', name: '오민하' },
  { studentId: '20215', name: '오영재' },
  { studentId: '20221', name: '이주원' },
  { studentId: '20224', name: '이현준' },
  { studentId: '20229', name: '최서윤' },
  { studentId: '20303', name: '권상윤' },
  { studentId: '20305', name: '김다연' },
  { studentId: '20308', name: '김민우' },
  { studentId: '20310', name: '김서진' },
  { studentId: '20314', name: '박준용' },
  { studentId: '20317', name: '안예나' },
  { studentId: '20319', name: '유혜원' },
  { studentId: '20324', name: '전지영' },
  { studentId: '20326', name: '주서연' },
  { studentId: '20328', name: '최재영' },
  { studentId: '20329', name: '최현민' },
  { studentId: '20401', name: '강동우' },
  { studentId: '20404', name: '김동완' },
  { studentId: '20406', name: '김지후' },
  { studentId: '20407', name: '김효원' },
  { studentId: '20411', name: '박예진' },
  { studentId: '20412', name: '박지원' },
  { studentId: '20415', name: '송예나' },
  { studentId: '20417', name: '양은준' },
  { studentId: '20422', name: '이승윤' },
  { studentId: '20424', name: '이효찬' },
  { studentId: '20428', name: '정채은' },
  { studentId: '20501', name: '강리안' },
  { studentId: '20506', name: '김시현' },
  { studentId: '20511', name: '박태현' },
  { studentId: '20512', name: '배성훈' },
  { studentId: '20514', name: '복준서' },
  { studentId: '20517', name: '신유준' },
  { studentId: '20520', name: '염우진' },
  { studentId: '20521', name: '오우진' },
  { studentId: '20523', name: '이보람' },
  { studentId: '20525', name: '이준호' },
  { studentId: '20527', name: '이한율' },
  { studentId: '20531', name: '황성주' },
  { studentId: '20602', name: '권서진' },
  { studentId: '20607', name: '김채영' },
  { studentId: '20610', name: '민승빈' },
  { studentId: '20611', name: '박서진' },
  { studentId: '20612', name: '신승훈' },
  { studentId: '20613', name: '신찬식' },
  { studentId: '20616', name: '오윤석' },
  { studentId: '20618', name: '오준혁' },
  { studentId: '20619', name: '이윤경' },
  { studentId: '20623', name: '이하윤' },
  { studentId: '20624', name: '임진섭' },
  { studentId: '20630', name: '하정원' },
  { studentId: '20701', name: '강민주' },
  { studentId: '20703', name: '김민채' },
  { studentId: '20711', name: '노담결' },
  { studentId: '20712', name: '문주혁' },
  { studentId: '20722', name: '이지운' },
  { studentId: '20723', name: '이진후' },
  { studentId: '20726', name: '임은혁' },
  { studentId: '20802', name: '권시우' },
  { studentId: '20803', name: '김민서' },
  { studentId: '20807', name: '나현빈' },
  { studentId: '20808', name: '박예준' },
  { studentId: '20816', name: '이서윤' },
  { studentId: '20823', name: '장석현' },
  { studentId: '20826', name: '정지인' },
  { studentId: '20827', name: '진호윤' },
  { studentId: '20829', name: '홍은석' },
  { studentId: '20906', name: '김아름' },
  { studentId: '20907', name: '김은결' },
  { studentId: '20909', name: '김하을' },
  { studentId: '20912', name: '박준희' },
  { studentId: '20916', name: '오한별' },
  { studentId: '20920', name: '이예은' },
  { studentId: '20922', name: '이호연' },
  { studentId: '20923', name: '이훈' },
  { studentId: '20924', name: '장예진' },
  { studentId: '20926', name: '정서은' },
  { studentId: '20927', name: '조아영' },
  { studentId: '20929', name: '조현우' },
  { studentId: '20931', name: '최유빈' },
  { studentId: '20932', name: '최혜선' },
  { studentId: '20933', name: '한지은' },
  { studentId: '21002', name: '김동오' },
  { studentId: '21005', name: '김지유' },
  { studentId: '21006', name: '김찬결' },
  { studentId: '21009', name: '박린' },
  { studentId: '21010', name: '박서준' },
  { studentId: '21012', name: '서유진' },
  { studentId: '21019', name: '윤연서' },
  { studentId: '21020', name: '이시현' },
  { studentId: '21022', name: '이은채' },
  { studentId: '21023', name: '이지민' },
  { studentId: '21025', name: '임현섭' },
  { studentId: '21026', name: '정유진' },
  { studentId: '21029', name: '하은호' },
  { studentId: '21103', name: '김서율' },
  { studentId: '21106', name: '김지수' },
  { studentId: '21107', name: '김지원' },
  { studentId: '21108', name: '김지인' },
  { studentId: '21115', name: '신정인' },
  { studentId: '21116', name: '심예린' },
  { studentId: '21117', name: '심지윤' },
  { studentId: '21118', name: '안수진' },
  { studentId: '21120', name: '유혜림' },
  { studentId: '21124', name: '임진휘' },
  { studentId: '21125', name: '장윤실' },
  { studentId: '21128', name: '정은서' },
  { studentId: '21129', name: '정태양' },
  { studentId: '21130', name: '추예나' },
  { studentId: '21201', name: '구나예' },
  { studentId: '21202', name: '김민서' },
  { studentId: '21203', name: '김민준' },
  { studentId: '21204', name: '김승현' },
  { studentId: '21205', name: '김채영' },
  { studentId: '21206', name: '박재범' },
  { studentId: '21207', name: '반가은' },
  { studentId: '21208', name: '손예담' },
  { studentId: '21209', name: '손지윤' },
  { studentId: '21210', name: '신성윤' },
  { studentId: '21211', name: '양우혁' },
  { studentId: '21212', name: '오윤서' },
  { studentId: '21213', name: '윤지산' },
  { studentId: '21214', name: '이재훈' },
  { studentId: '21215', name: '이정우' },
  { studentId: '21216', name: '정성주' },
  { studentId: '21217', name: '정현지' },
  { studentId: '21218', name: '조윤서' },
  { studentId: '21219', name: '최담이' },
  { studentId: '21220', name: '최진성' },
  { studentId: '21221', name: '한서정' },
  { studentId: '21222', name: '허윤서' },
  { studentId: '21223', name: '홍서은' },
  { studentId: '21224', name: '홍예빈' },
]

// 구역에서 모든 좌석 ID 추출 (숫자 순으로 정렬)
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

  // 좌석 번호 순으로 정렬 (4A001, 4A002, ...)
  return seatIds.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''))
    const numB = parseInt(b.replace(/\D/g, ''))
    return numA - numB
  })
}

// 좌석 수 비율에 따라 학생 수 분배
function distributeStudentsByRatio(
  students: { studentId: string; name: string }[],
  zones: string[]
): Map<string, number> {
  const zoneSeatCounts = zones.map(zone => ({
    zone,
    seatCount: getAllSeatIds(zone).length
  }))
  const totalSeats = zoneSeatCounts.reduce((sum, z) => sum + z.seatCount, 0)
  const totalStudents = students.length

  const distribution = new Map<string, number>()
  let assignedTotal = 0

  zoneSeatCounts.forEach(({ zone, seatCount }, index) => {
    if (index === zoneSeatCounts.length - 1) {
      // 마지막 구역은 나머지 학생 전부 배정
      distribution.set(zone, totalStudents - assignedTotal)
    } else {
      // 비율에 따라 배정
      const count = Math.round((seatCount / totalSeats) * totalStudents)
      distribution.set(zone, count)
      assignedTotal += count
    }
  })

  return distribution
}

// 학생을 좌석에 배치 (미배치 좌석은 null) - 4개 교실에 분산
function assignStudentsToSeats(): Map<string, Student | null> {
  const studentMap = new Map<string, Student | null>()

  // 1학년 구역 (4층) - 비율에 따라 분산
  const grade1Zones = ['4A', '4B', '4C', '4D']
  const grade1Distribution = distributeStudentsByRatio(GRADE1_STUDENTS, grade1Zones)
  let grade1StudentIndex = 0

  grade1Zones.forEach((zoneId) => {
    const seatIds = getAllSeatIds(zoneId)
    const studentsForZone = grade1Distribution.get(zoneId) || 0
    let zoneStudentCount = 0

    seatIds.forEach((seatId) => {
      if (zoneStudentCount < studentsForZone && grade1StudentIndex < GRADE1_STUDENTS.length) {
        const studentData = GRADE1_STUDENTS[grade1StudentIndex]
        const preAbsence = PRE_ABSENCES[studentData.studentId]
        studentMap.set(seatId, {
          studentId: studentData.studentId,
          name: studentData.name,
          seatId,
          ...(preAbsence && { preAbsence }),
        })
        grade1StudentIndex++
        zoneStudentCount++
      } else {
        // 미배치 좌석
        studentMap.set(seatId, null)
      }
    })
  })

  // 2학년 구역 (3층) - 비율에 따라 분산
  const grade2Zones = ['3A', '3B', '3C', '3D']
  const grade2Distribution = distributeStudentsByRatio(GRADE2_STUDENTS, grade2Zones)
  let grade2StudentIndex = 0

  grade2Zones.forEach((zoneId) => {
    const seatIds = getAllSeatIds(zoneId)
    const studentsForZone = grade2Distribution.get(zoneId) || 0
    let zoneStudentCount = 0

    seatIds.forEach((seatId) => {
      if (zoneStudentCount < studentsForZone && grade2StudentIndex < GRADE2_STUDENTS.length) {
        const studentData = GRADE2_STUDENTS[grade2StudentIndex]
        const preAbsence = PRE_ABSENCES[studentData.studentId]
        studentMap.set(seatId, {
          studentId: studentData.studentId,
          name: studentData.name,
          seatId,
          ...(preAbsence && { preAbsence }),
        })
        grade2StudentIndex++
        zoneStudentCount++
      } else {
        // 미배치 좌석
        studentMap.set(seatId, null)
      }
    })
  })

  // 기타 구역 (C407, C409, C306, C307, C309)은 모두 미배치
  const otherZones = ['C407', 'C409', 'C306', 'C307', 'C309']
  otherZones.forEach((zoneId) => {
    const seatIds = getAllSeatIds(zoneId)
    seatIds.forEach((seatId) => {
      studentMap.set(seatId, null)
    })
  })

  return studentMap
}

// 학생 데이터 (고정)
export const STUDENTS = assignStudentsToSeats()

// 좌석 ID로 학생 찾기 (null이면 미배치)
export function getStudentBySeatId(seatId: string): Student | null {
  return STUDENTS.get(seatId) ?? null
}

// 학생 이름으로 검색
export interface StudentSearchResult {
  student: Student
  zoneId: string
  zoneName: string
}

const ZONE_NAMES: Record<string, string> = {
  '4A': '4층 A구역',
  '4B': '4층 B구역',
  '4C': '4층 C구역',
  '4D': '4층 D구역',
  '3A': '3층 A구역',
  '3B': '3층 B구역',
  '3C': '3층 C구역',
  '3D': '3층 D구역',
  'C407': 'C407',
  'C409': 'C409',
  'C306': 'C306',
  'C307': 'C307',
  'C309': 'C309',
}

export function searchStudentByName(name: string): StudentSearchResult[] {
  const results: StudentSearchResult[] = []

  STUDENTS.forEach((student, seatId) => {
    if (student && student.name.includes(name)) {
      const zoneId = seatId.match(/^[34][A-D]|C\d{3}/)?.[0] || ''
      results.push({
        student,
        zoneId,
        zoneName: ZONE_NAMES[zoneId] || zoneId,
      })
    }
  })

  return results
}

// 학번으로 학생 찾기
export function getStudentByStudentId(studentId: string): Student | null {
  for (const student of STUDENTS.values()) {
    if (student && student.studentId === studentId) {
      return student
    }
  }
  return null
}

// 구역별 배정된 학생 수 반환
export function getStudentCountByZone(zoneId: string): number {
  const seatIds = getAllSeatIds(zoneId)
  let count = 0
  seatIds.forEach((seatId) => {
    if (STUDENTS.get(seatId)) count++
  })
  return count
}

// 전체 학생 목록 (배정된 학생만)
export function getAllStudents(): Student[] {
  const students: Student[] = []
  STUDENTS.forEach((student) => {
    if (student) students.push(student)
  })
  return students
}

// 학년별 학생 목록
export function getStudentsByGrade(grade: 1 | 2): Student[] {
  const prefix = grade === 1 ? '4' : '3'
  const students: Student[] = []
  STUDENTS.forEach((student, seatId) => {
    if (student && seatId.startsWith(prefix)) {
      students.push(student)
    }
  })
  return students
}

// MockStudent 타입 호환성을 위한 alias
export type MockStudent = Student
export const MOCK_STUDENTS = STUDENTS
