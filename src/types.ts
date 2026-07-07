export interface Staff {
  id: string
  name: string
  // false면 이전 근무자. 컬럼 추가 전 데이터는 undefined일 수 있어 undefined는 현재 근무로 취급
  active?: boolean
}

export interface Shift {
  id: string
  staff_id: string
  date: string // YYYY-MM-DD
  start_min: number // minutes from midnight
  end_min: number
}

export interface StoreData {
  staff: Staff[]
  shifts: Shift[]
  wage: number
}
