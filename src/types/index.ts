export type { Database, AttendanceStatus, UserRole } from './database.types'

// Seat layout cell types
export type SeatLayoutCell = string | 'sp' | 'empty' | 'br'
export type SeatLayoutRow = SeatLayoutCell[]
export type SeatLayout = SeatLayoutRow[]

// Student with seat info
export interface Student {
  id: string
  studentId: string
  name: string
  hr: string
  grade: number
  zoneId: string
  seatNumber: string
  email?: string | null
  parentPhone?: string | null
}

// Attendance record for UI
export interface AttendanceRecord {
  studentId: string
  status: 'present' | 'absent' | 'unchecked'
  note?: string
  isModified?: boolean
  staffName?: string
}

// Current staff info stored in sessionStorage
export interface CurrentStaff {
  name: string
  grade: number
  date: string
}

// Zone config
export interface Zone {
  id: string
  grade: number
  zoneId: string
  name: string
  seatLayout: SeatLayout
  isActive: boolean
}

// Time slots
export type TimeSlot = 'ET' | 'EP1' | 'EP2'

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  ET: 'ET (16:50~18:10)',
  EP1: 'EP1 (19:20~20:50)',
  EP2: 'EP2 (21:10~22:30)',
}

// Status config
export const STATUS_CONFIG = {
  present: {
    label: '출석',
    color: 'green',
    bgClass: 'seat-present',
  },
  absent: {
    label: '결석',
    color: 'red',
    bgClass: 'seat-absent',
  },
  unchecked: {
    label: '미체크',
    color: 'gray',
    bgClass: 'seat-unchecked',
  },
} as const
