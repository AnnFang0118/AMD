import { useState } from 'react'

export default function AccountSettings() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!name.trim()) {
      setError('請輸入姓名')
      return
    }
    if (!validateEmail(email)) {
      setError('請輸入有效的電子郵件')
      return
    }
    if (pwd.length < 6) {
      setError('密碼至少要 6 個字')
      return
    }
    if (pwd !== confirmPwd) {
      setError('兩次輸入的密碼不一致')
      return
    }

    // TODO: 串接後端 API 更新資料
    setSuccess('資料已成功更新 ✅')
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <b style={{ fontSize: 18 }}>修改帳號 / 密碼</b>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        <label>
          <div className="label">姓名</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="輸入姓名"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </label>

        <label>
          <div className="label">電子郵件</div>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </label>

        <label>
          <div className="label">新密碼</div>
          <input
            type="password"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            placeholder="至少 6 個字"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </label>

        <label>
          <div className="label">確認新密碼</div>
          <input
            type="password"
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="再次輸入密碼"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </label>

        {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}
        {success && <div style={{ color: 'green', fontSize: 14 }}>{success}</div>}

        <button
          type="submit"
          style={{
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: '#4f46e5',
            color: 'white',
            fontSize: 16,
            cursor: 'pointer'
          }}
        >
          💾 儲存變更
        </button>
      </form>
    </div>
  )
}
