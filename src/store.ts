import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Staff, Shift, StoreData } from './types'
import { DEFAULT_WAGE } from './config'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Supabase 환경변수가 없으면 localStorage로 동작 (개발/미리보기용)
export const usingCloud = Boolean(supabaseUrl && supabaseKey)

const sb: SupabaseClient | null = usingCloud ? createClient(supabaseUrl!, supabaseKey!) : null

// ---------- localStorage 구현 ----------

const LS_KEY = 'br-calendar-data'

function lsLoad(): StoreData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      return {
        staff: d.staff ?? [],
        shifts: d.shifts ?? [],
        wage: typeof d.wage === 'number' ? d.wage : DEFAULT_WAGE,
      }
    }
  } catch {
    // 손상된 데이터는 무시하고 초기화
  }
  return { staff: [], shifts: [], wage: DEFAULT_WAGE }
}

function lsSave(data: StoreData) {
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

function lsMutate(fn: (d: StoreData) => void): StoreData {
  const d = lsLoad()
  fn(d)
  lsSave(d)
  return d
}

// ---------- 공용 스토어 인터페이스 ----------

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export const store = {
  async loadAll(): Promise<StoreData> {
    if (!sb) return lsLoad()
    const [staffRes, shiftRes, wageRes] = await Promise.all([
      sb.from('staff').select('*').order('created_at', { ascending: true }),
      sb.from('shifts').select('*'),
      sb.from('settings').select('value').eq('key', 'wage').maybeSingle(),
    ])
    fail(staffRes.error)
    fail(shiftRes.error)
    fail(wageRes.error)
    return {
      staff: (staffRes.data ?? []) as Staff[],
      shifts: (shiftRes.data ?? []) as Shift[],
      wage: wageRes.data ? Number(wageRes.data.value) : DEFAULT_WAGE,
    }
  },

  async addStaff(name: string, color: string): Promise<Staff> {
    if (!sb) {
      const s: Staff = { id: crypto.randomUUID(), name, color }
      lsMutate(d => d.staff.push(s))
      return s
    }
    const { data, error } = await sb.from('staff').insert({ name, color }).select().single()
    fail(error)
    return data as Staff
  },

  async deleteStaff(id: string): Promise<void> {
    if (!sb) {
      lsMutate(d => {
        d.staff = d.staff.filter(s => s.id !== id)
        d.shifts = d.shifts.filter(s => s.staff_id !== id)
      })
      return
    }
    // shifts는 FK cascade로 함께 삭제되지만 cascade 미설정 대비 명시 삭제
    fail((await sb.from('shifts').delete().eq('staff_id', id)).error)
    fail((await sb.from('staff').delete().eq('id', id)).error)
  },

  async addShift(input: Omit<Shift, 'id'>): Promise<Shift> {
    if (!sb) {
      const s: Shift = { id: crypto.randomUUID(), ...input }
      lsMutate(d => d.shifts.push(s))
      return s
    }
    const { data, error } = await sb.from('shifts').insert(input).select().single()
    fail(error)
    return data as Shift
  },

  async updateShift(shift: Shift): Promise<void> {
    if (!sb) {
      lsMutate(d => {
        d.shifts = d.shifts.map(s => (s.id === shift.id ? shift : s))
      })
      return
    }
    const { id, ...rest } = shift
    fail((await sb.from('shifts').update(rest).eq('id', id)).error)
  },

  async deleteShift(id: string): Promise<void> {
    if (!sb) {
      lsMutate(d => {
        d.shifts = d.shifts.filter(s => s.id !== id)
      })
      return
    }
    fail((await sb.from('shifts').delete().eq('id', id)).error)
  },

  async setWage(wage: number): Promise<void> {
    if (!sb) {
      lsMutate(d => {
        d.wage = wage
      })
      return
    }
    fail((await sb.from('settings').upsert({ key: 'wage', value: String(wage) })).error)
  },
}
