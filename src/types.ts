export interface Staff {
  id: string
  name: string
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
