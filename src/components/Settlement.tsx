import { useMemo, useState } from 'react'
import { Shift, Staff } from '../types'
import { SETTLE_PASSWORD } from '../config'
import { fmtHours, fmtMoney } from '../util'

interface Props {
  staff: Staff[]
  shifts: Shift[]
  wage: number
  onSetWage: (wage: number) => void
  onDeleteStaff: (id: string) => void
  onBack: () => void
}

const AUTH_KEY = 'br-settle-auth'

export default function Settlement({ staff, shifts, wage, onSetWage, onDeleteStaff, onBack }: Props) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === '1')
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [cursor, setCursor] = useState(() => new Date())
  const [wageInput, setWageInput] = useState(String(wage))

  const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`

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
      sessionStorage.setItem(AUTH_KEY, '1')
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

  function deleteStaff(st: Staff) {
    if (
      confirm(`'${st.name}' 알바생을 삭제할까요?\n등록된 일정도 모두 함께 삭제돼요.`)
    ) {
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
          <button
            className="nav-btn"
            onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            aria-label="이전 달"
          >
            ‹
          </button>
          <div className="header-title">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월 정산
          </div>
          <button
            className="nav-btn"
            onClick={() => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
        <div className="header-row header-row2">
          <button className="btn btn-small" onClick={onBack}>
            ‹ 캘린더
          </button>
          <button
            className="btn btn-small"
            onClick={() => {
              sessionStorage.removeItem(AUTH_KEY)
              onBack()
            }}
          >
            잠그고 나가기
          </button>
        </div>
      </header>

      <section className="settle-section">
        <h3>알바생별 정산</h3>
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
                  <td>
                    <span className="dot" style={{ background: r.staff.color }} />
                    {r.staff.name}
                  </td>
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
        {staff.length === 0 ? (
          <p className="empty-text">캘린더에서 일정을 추가할 때 알바생을 등록할 수 있어요.</p>
        ) : (
          <ul className="staff-manage-list">
            {staff.map(st => (
              <li key={st.id}>
                <span className="dot" style={{ background: st.color }} />
                <span className="staff-name">{st.name}</span>
                <button className="btn btn-small btn-danger" onClick={() => deleteStaff(st)}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
