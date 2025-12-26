// Staff schedule types and utilities
// Actual data is stored in Supabase staff_schedule table

import { supabase } from './supabase'

export interface StaffSchedule {
  schedule_date: string
  grade: number
  staff_name_1: string
  staff_name_2: string
}

export interface TodayStaff {
  grade1: [string, string] | null
  grade2: [string, string] | null
}

// ============================================
// Mock data for testing (12/19 ~ 12/31)
// Remove this section when using real database
// ============================================
const MOCK_STAFF_SCHEDULE: Record<string, TodayStaff> = {
  '2025-12-19': { grade1: ['김종규', '이건우'], grade2: ['조민경', '노예원'] },
  '2025-12-20': { grade1: ['이예진', '홍선영'], grade2: ['장보경', '김솔'] },
  '2025-12-21': { grade1: ['홍승민', '조현정'], grade2: ['강현수', '민수정'] },
  '2025-12-22': { grade1: ['박한비', '서률지'], grade2: ['정수빈', '김종규'] },
  '2025-12-23': { grade1: ['이건우', '조민경'], grade2: ['노예원', '이예진'] },
  '2025-12-24': { grade1: ['홍선영', '장보경'], grade2: ['김솔', '홍승민'] },
  '2025-12-25': { grade1: ['조현정', '강현수'], grade2: ['민수정', '박한비'] },
  '2025-12-26': { grade1: ['서률지', '정수빈'], grade2: ['김종규', '이건우'] },
  '2025-12-27': { grade1: ['조민경', '노예원'], grade2: ['이예진', '홍선영'] },
  '2025-12-28': { grade1: ['장보경', '김솔'], grade2: ['홍승민', '조현정'] },
  '2025-12-29': { grade1: ['강현수', '민수정'], grade2: ['박한비', '서률지'] },
  '2025-12-30': { grade1: ['정수빈', '김종규'], grade2: ['이건우', '조민경'] },
  '2025-12-31': { grade1: ['노예원', '이예진'], grade2: ['홍선영', '장보경'] },
}

// Use mock data for development/testing
const USE_MOCK_DATA = true

// Fetch today's staff assignments from database
export async function fetchTodayStaff(): Promise<TodayStaff> {
  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD format

  // Use mock data for testing
  if (USE_MOCK_DATA) {
    const mockData = MOCK_STAFF_SCHEDULE[today]
    if (mockData) {
      return mockData
    }
  }

  const { data, error } = await supabase
    .from('staff_schedule')
    .select('grade, staff_name_1, staff_name_2')
    .eq('schedule_date', today)

  if (error) {
    console.error('Error fetching staff schedule:', error)
    // Fallback to mock data on error
    return MOCK_STAFF_SCHEDULE[today] || { grade1: null, grade2: null }
  }

  // If no data from DB, use mock data
  if (!data || data.length === 0) {
    return MOCK_STAFF_SCHEDULE[today] || { grade1: null, grade2: null }
  }

  const result: TodayStaff = { grade1: null, grade2: null }

  data?.forEach((row) => {
    if (row.grade === 1) {
      result.grade1 = [row.staff_name_1, row.staff_name_2]
    } else if (row.grade === 2) {
      result.grade2 = [row.staff_name_1, row.staff_name_2]
    }
  })

  return result
}

// Fetch staff for a specific date
export async function fetchStaffForDate(date: Date): Promise<TodayStaff> {
  const dateStr = date.toISOString().split('T')[0]

  // Use mock data for testing
  if (USE_MOCK_DATA) {
    const mockData = MOCK_STAFF_SCHEDULE[dateStr]
    if (mockData) {
      return mockData
    }
  }

  const { data, error } = await supabase
    .from('staff_schedule')
    .select('grade, staff_name_1, staff_name_2')
    .eq('schedule_date', dateStr)

  if (error) {
    console.error('Error fetching staff schedule:', error)
    return MOCK_STAFF_SCHEDULE[dateStr] || { grade1: null, grade2: null }
  }

  if (!data || data.length === 0) {
    return MOCK_STAFF_SCHEDULE[dateStr] || { grade1: null, grade2: null }
  }

  const result: TodayStaff = { grade1: null, grade2: null }

  data?.forEach((row) => {
    if (row.grade === 1) {
      result.grade1 = [row.staff_name_1, row.staff_name_2]
    } else if (row.grade === 2) {
      result.grade2 = [row.staff_name_1, row.staff_name_2]
    }
  })

  return result
}
