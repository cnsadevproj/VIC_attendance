import { useMemo } from 'react'
import Seat from './Seat'
import type { AttendanceRecord } from '../../types'
import { SEAT_LAYOUTS } from '../../config/seatLayouts'
import { getStudentBySeatId } from '../../config/mockStudents'
import { isPreAbsentOnDate } from '../../config/preAbsences'

interface SeatMapProps {
  zoneId: string
  attendanceRecords: Map<string, AttendanceRecord>
  studentNotes?: Record<string, string>  // 학생별 특이사항
  dateKey?: string  // 현재 날짜 (YYYY-MM-DD)
  onSeatClick: (seatId: string) => void
  onSeatLongPress?: (seatId: string) => void
}

export default function SeatMap({
  zoneId,
  attendanceRecords,
  studentNotes = {},
  dateKey,
  onSeatClick,
  onSeatLongPress,
}: SeatMapProps) {
  // 현재 날짜 (dateKey가 없으면 오늘 날짜)
  const currentDate = dateKey || new Date().toISOString().split('T')[0]
  const layout = useMemo(() => {
    return SEAT_LAYOUTS[zoneId] || []
  }, [zoneId])

  if (layout.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        좌석 배치 정보를 불러오는 중...
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 overflow-x-auto">
      <div className="inline-block">
        {layout.map((row, rowIndex) => {
          // Handle line break
          if (row[0] === 'br') {
            return <div key={`br-${rowIndex}`} className="h-6" />
          }

          return (
            <div key={rowIndex} className="seat-row">
              {row.map((cell, cellIndex) => {
                // Handle spacer
                if (cell === 'sp') {
                  return <div key={`sp-${cellIndex}`} className="seat-spacer" />
                }

                // Handle empty seat
                if (cell === 'empty') {
                  return <div key={`empty-${cellIndex}`} className="seat-empty" />
                }

                // Regular seat
                const seatId = cell as string
                const student = getStudentBySeatId(seatId)
                const isAssigned = student !== null

                // Use seatId for record lookup
                const record = attendanceRecords.get(seatId)
                const hasNote = !!studentNotes[seatId]
                // 현재 날짜에 사전결석인지 확인
                const hasPreAbsence = student ? isPreAbsentOnDate(student.studentId, currentDate) : false

                return (
                  <Seat
                    key={seatId}
                    seatId={seatId}
                    studentName={student?.name}
                    studentId={student?.studentId}
                    isAssigned={isAssigned}
                    status={record?.status || 'unchecked'}
                    hasPreAbsence={hasPreAbsence}
                    hasNote={hasNote}
                    onClick={() => onSeatClick(seatId)}
                    onLongPress={isAssigned ? () => onSeatLongPress?.(seatId) : undefined}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
