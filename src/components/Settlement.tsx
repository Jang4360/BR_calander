import { useMemo, useState } from 'react'
import { Shift, Staff } from '../types'
import { SETTLE_PASSWORD } from '../config'
import { fmtHours, fmtMoney } from '../util'

interface Props {
  staff: Staff[]
  shifts: Shift[]
  wage: number
  onSetWage: (wage: number) => void
  onAddStaff: (name: string) => Promise<Staff>
  onRenameStaff: (id: string, name: string) => void
  onDeleteStaff: (id: string) => void
  onBack: () => void
}

export default function Settlement({
  staff,
  shifts,
  wage,
  onSetWage,
  onAddStaff,
  onRenameStaff,
  onDeleteStaff,
  onBack,
}: Props) {
  // 인증 상태를 컴포넌트 안에만 두어, 캘린더로 돌아가면 자동으로 잠김
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1~12
  const [wageInput, setWageInput] = useState(String(wage))
  const [newStaffName, setNewStaffName] = useState('')
  const [addingStaff, setAddingStaff] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const ym = `${year}-${String(month).padStart(2, '0')}`

  const rows = useMemo(() => {
    const monthShifts = shifts.filter(s => s.date.startsWith(ym))
    return staff.map(st => {
      const mine = monthShifts.filter(s => s.staff_id === st.id)
      const minutes = mine.reduce((sum, s) => sum + (s.end_min - s.start_min), 0)
      return { staff: st, count: mine.length, minutes, pay: (minutes / 60) * wage }
    })
  }, [staff, shifts, ym, wage])

  const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0)
  const totalPay = rows.reduce((s, r) => s + r.pay, 0)

  function tryAuth() {
    if (pw === SETTLE_PASSWORD) {
      setAuthed(true)
      setPwError(false)
    } else {
      setPwError(true)
      setPw('')
    }
  }

  function saveWage() {
    const w = Number(wageInput.replace(/[^0-9]/g, ''))
    if (!w || w <= 0) {
      alert('올바른 시급을 입력해주세요.')
      return
    }
    onSetWage(w)
    alert('시급이 저장됐어요.')
  }

  async function addStaff() {
    const name = newStaffName.trim()
    if (!name || addingStaff) return
    if (staff.some(s => s.name === name)) {
      alert('이미 등록된 이름이에요.')
      return
    }
    setAddingStaff(true)
    try {
      await onAddStaff(name)
      setNewStaffName('')
    } catch (e) {
      alert(`등록에 실패했어요: ${e instanceof Error ? e.message : e}`)
    } finally {
      setAddingStaff(false)
    }
  }

  function startEdit(st: Staff) {
    setEditingId(st.id)
    setEditName(st.name)
  }

  function saveEdit() {
    const name = editName.trim()
    if (!name || !editingId) return
    if (staff.some(s => s.name === name && s.id !== editingId)) {
      alert('이미 등록된 이름이에요.')
      return
    }
    onRenameStaff(editingId, name)
    setEditingId(null)
  }

  function deleteStaff(st: Staff) {
    if (confirm(`'${st.name}' 알바생을 삭제할까요?\n등록된 일정도 모두 함께 삭제돼요.`)) {
      onDeleteStaff(st.id)
    }
  }

  if (!authed) {
    return (
      <div className="app">
        <div className="center-box">
          <h2>정산 페이지</h2>
          <p>비밀번호를 입력해주세요.</p>
          <input
            className="text-input pw-input"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryAuth()}
            placeholder="비밀번호"
          />
          {pwError && <p className="error-detail">비밀번호가 맞지 않아요.</p>}
          <button className="btn btn-primary btn-big" onClick={tryAuth}>
            확인
          </button>
          <button className="btn btn-big" onClick={onBack}>
            캘린더로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <button className="btn btn-small" onClick={onBack}>
            ‹ 캘린더
          </button>
          <div className="header-title">정산</div>
          <span className="header-spacer" />
        </div>
        <div className="header-row year-row">
          <button className="nav-btn" onClick={() => setYear(y => y - 1)} aria-label="이전 해">
            ‹
          </button>
          <div className="year-label">{year}년</div>
          <button className="nav-btn" onClick={() => setYear(y => y + 1)} aria-label="다음 해">
            ›
          </button>
        </div>
        <div className="settle-month-grid">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <button
              key={m}
              className={`month-btn ${m === month ? 'active' : ''}`}
              onClick={() => setMonth(m)}
            >
              {m}월
            </button>
          ))}
        </div>
      </header>

      <section className="settle-section">
        <h3>
          {year}년 {month}월 알바생별 정산
        </h3>
        {rows.length === 0 ? (
          <p className="empty-text">등록된 알바생이 없어요.</p>
        ) : (
          <table className="settle-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>근무</th>
                <th>시간</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.staff.id} className={r.minutes === 0 ? 'zero' : ''}>
                  <td>{r.staff.name}</td>
                  <td>{r.count}회</td>
                  <td>{fmtHours(r.minutes)}</td>
                  <td className="money">{fmtMoney(r.pay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>합계</td>
                <td>{rows.reduce((s, r) => s + r.count, 0)}회</td>
                <td>{fmtHours(totalMinutes)}</td>
                <td className="money">{fmtMoney(totalPay)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>

      <section className="settle-section">
        <h3>공통 시급</h3>
        <div className="wage-row">
          <input
            className="text-input"
            inputMode="numeric"
            value={wageInput}
            onChange={e => setWageInput(e.target.value)}
          />
          <span>원</span>
          <button className="btn btn-primary" onClick={saveWage}>
            저장
          </button>
        </div>
      </section>

      <section className="settle-section">
        <h3>알바생 관리</h3>
        <div className="new-staff-row">
          <input
            className="text-input"
            placeholder="새 알바생 이름"
            value={newStaffName}
            onChange={e => setNewStaffName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStaff()}
          />
          <button className="btn btn-primary" onClick={addStaff} disabled={addingStaff}>
            추가
          </button>
        </div>
        {staff.length > 0 && (
          <ul className="staff-manage-list">
            {staff.map(st => (
              <li key={st.id}>
                {editingId === st.id ? (
                  <>
                    <input
                      className="text-input staff-edit-input"
                      value={editName}
                      autoFocus
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                    />
                    <button className="btn btn-small btn-primary" onClick={saveEdit}>
                      저장
                    </button>
                    <button className="btn btn-small" onClick={() => setEditingId(null)}>
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <span className="staff-name">{st.name}</span>
                    <button className="btn btn-small" onClick={() => startEdit(st)}>
                      수정
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => deleteStaff(st)}>
                      삭제
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
