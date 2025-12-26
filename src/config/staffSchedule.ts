// Staff schedule types and utilities

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
// 고정 담당자 스케줄 (2026년 1월 7일 ~ 2월 3일)
// ============================================
const FIXED_STAFF_SCHEDULE: Record<string, TodayStaff> = {
  '2026-01-07': { grade1: ['이예진', '조현정'], grade2: ['강현수', '김종규'] },
  '2026-01-08': { grade1: ['홍선영', '홍승민'], grade2: ['민수정', '정수빈'] },
  '2026-01-09': { grade1: ['장보경', '김솔'], grade2: ['박한비', '서률지'] },
  '2026-01-10': { grade1: ['이건우', '노예원'], grade2: ['조민경', '이예진'] },
  '2026-01-13': { grade1: ['조현정', '강현수'], grade2: ['김종규', '홍선영'] },
  '2026-01-14': { grade1: ['홍승민', '민수정'], grade2: ['정수빈', '장보경'] },
  '2026-01-15': { grade1: ['김솔', '박한비'], grade2: ['서률지', '이건우'] },
  '2026-01-16': { grade1: ['노예원', '조민경'], grade2: ['이예진', '조현정'] },
  '2026-01-17': { grade1: ['강현수', '김종규'], grade2: ['홍선영', '홍승민'] },
  '2026-01-20': { grade1: ['민수정', '정수빈'], grade2: ['장보경', '김솔'] },
  '2026-01-21': { grade1: ['박한비', '서률지'], grade2: ['이건우', '노예원'] },
  '2026-01-22': { grade1: ['조민경', '이예진'], grade2: ['조현정', '강현수'] },
  '2026-01-23': { grade1: ['김종규', '홍선영'], grade2: ['홍승민', '민수정'] },
  '2026-01-27': { grade1: ['정수빈', '장보경'], grade2: ['김솔', '박한비'] },
  '2026-01-28': { grade1: ['서률지', '이건우'], grade2: ['노예원', '조민경'] },
  '2026-01-29': { grade1: ['이예진', '조현정'], grade2: ['강현수', '김종규'] },
  '2026-01-30': { grade1: ['홍선영', '홍승민'], grade2: ['민수정', '정수빈'] },
  '2026-01-31': { grade1: ['장보경', '김솔'], grade2: ['박한비', '서률지'] },
  '2026-02-01': { grade1: ['이건우', '노예원'], grade2: ['조민경', '이예진'] },
  '2026-02-03': { grade1: ['민수정', '박한비'], grade2: ['정수빈', '이건우'] },
}

// 고정 스케줄 사용 (Supabase 대신)
// Fetch today's staff assignments
export async function fetchTodayStaff(): Promise<TodayStaff> {
  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD format
  return FIXED_STAFF_SCHEDULE[today] || { grade1: null, grade2: null }
}

// Fetch staff for a specific date
export async function fetchStaffForDate(date: Date): Promise<TodayStaff> {
  const dateStr = date.toISOString().split('T')[0]
  return FIXED_STAFF_SCHEDULE[dateStr] || { grade1: null, grade2: null }
}

// Get operating dates list
export function getOperatingDates(): string[] {
  return Object.keys(FIXED_STAFF_SCHEDULE).sort()
}
