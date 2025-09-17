import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ================= 可調整區（依你們後端改這裡） =================
const BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`
const API_ME = '/account/me'                     // 取得個人資料
const API_UPDATE_PROFILE = '/account/profile'    // 更新姓名/Email（PUT/PATCH）
const API_UPDATE_PASSWORD = '/account/password'  // 更新密碼（PUT/PATCH）

// ====== 小工具 ======
function getAuthHeader(): Record<string, string> {
  try { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {} } catch { return {} }
}

async function fetchJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController(); const to = setTimeout(()=>ctrl.abort(), 10000)
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json', ...getAuthHeader(), ...(init.headers as any) } as HeadersInit,
      signal: ctrl.signal,
      ...init,
    })
    let data: any = null; try { data = await res.json() } catch {}
    if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`)
    return data as T
  } finally { clearTimeout(to) }
}

function normalizeUser(raw: any){
  return {
    name: raw?.name ?? raw?.full_name ?? raw?.username ?? '',
    email: raw?.email ?? raw?.mail ?? '',
    role: raw?.role === 'child' ? 'child' : 'user',
  } as { name: string; email: string; role?: 'user'|'child' }
}

export default function AccountSettings() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let stop = false
    async function run(){
      try{
        const me = await fetchJSON<any>(`${BASE_URL}${API_ME}`)
        const u = normalizeUser(me)
        if (!stop){ setName(u.name || ''); setEmail(u.email || '') }
      }catch(e:any){
        // 401/403 視為未登入，導回登入
        if (/401|403/.test(e?.message || '')){
          try { localStorage.removeItem('user'); localStorage.removeItem('token') } catch {}
          nav('/login', { replace: true })
        }
      }
    }
    void run()
    return () => { stop = true }
  }, [nav])

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)

    if (!name.trim()) return setError('請輸入姓名')
    if (!validateEmail(email)) return setError('請輸入有效的電子郵件')

    if (pwd || confirmPwd){
      if (pwd.length < 6) return setError('密碼至少要 6 個字')
      if (pwd !== confirmPwd) return setError('兩次輸入的密碼不一致')
    }

    setLoading(true)
    try{
      // 先更新姓名/Email
      await fetchJSON(`${BASE_URL}${API_UPDATE_PROFILE}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' } as HeadersInit,
        body: JSON.stringify({ name, email }),
      })

      // 更新本地 user（若存在）
      try {
        const saved = localStorage.getItem('user')
        const u = saved ? JSON.parse(saved) : {}
        localStorage.setItem('user', JSON.stringify({ ...u, name, email }))
      } catch {}

      // 再更新密碼（若有填）
      if (pwd) {
        await fetchJSON(`${BASE_URL}${API_UPDATE_PASSWORD}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' } as HeadersInit,
          body: JSON.stringify({ password: pwd }),
        })
      }

      setSuccess(pwd ? '資料與密碼已成功更新 ✅' : '資料已成功更新 ✅')
      setPwd(''); setConfirmPwd('')
    }catch(e:any){
      const msg = e?.message || '更新失敗，請稍後再試'
      // 常見情況：Email 重複
      if (/409|已存在|taken|duplicate|已被使用/.test(msg))
        setError('此 Email 已被使用，請更換另一個')
      else
        setError(msg)
    }finally{
      setLoading(false)
    }
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
            placeholder="至少 6 個字（不修改可留空）"
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

        {error && <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>}
        {success && <div style={{ color: '#15803d', fontSize: 14 }}>{success}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: '#4f46e5',
            color: 'white',
            fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '儲存中…' : '💾 儲存變更'}
        </button>
      </form>
    </div>
  )
}
