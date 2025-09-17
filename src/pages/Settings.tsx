// src/pages/Settings.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ============ 可調整區（依你們後端改這裡） ============
const BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`
const API_ME = '/account/me'        // 取得個人資料（例如 GET /account/me 或 /users/me 或 /auth/me）
const API_LOGOUT = '/enroll/logout' // 登出端點（如果沒有，純前端清除即可）

// 依你們登入實作，若是 Bearer token 就放在 localStorage.token
function getAuthHeader(): Record<string, string> {
  try { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {} } catch { return {} }
}

async function fetchJSON<T>(url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 10000)
  try{
    const res = await fetch(url, {
      credentials: 'include', // 若後端用 cookie-session，需要開 CORS+Credentials
      headers: { Accept: 'application/json', ...getAuthHeader(), ...(init.headers as any) } as HeadersInit,
      signal: ctrl.signal,
      ...init,
    })
    let data: any = null; try { data = await res.json() } catch {}
    if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`)
    return data as T
  } finally { clearTimeout(to) }
}

// 後端回傳不一定同名，做一次映射
function normalizeUser(raw: any){
  const name = raw?.name ?? raw?.full_name ?? raw?.username ?? ''
  const email = raw?.email ?? raw?.mail ?? ''
  const role = raw?.role === 'child' ? 'child' : 'user'
  return { name, email, role } as { name: string; email: string; role?: 'user'|'child' }
}

type User = { name: string; email: string; role?: 'user'|'child' }

export default function Settings() {
  const nav = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // 進到設定頁：向後端讀取個人資料；401 就導回登入
  useEffect(() => {
    let stop = false
    async function run(){
      setErr(null); setLoading(true)
      try {
        const data = await fetchJSON<any>(`${BASE_URL}${API_ME}`)
        const u = normalizeUser(data)
        if (!stop) {
          setUser(u)
          try { localStorage.setItem('user', JSON.stringify(u)) } catch {}
        }
      } catch (e: any) {
        if (!stop) {
          const msg = e?.message || '載入失敗'
          setErr(msg)
          // 401/403：視為未登入
          if (/401|403/.test(msg)) {
            try { localStorage.removeItem('user'); localStorage.removeItem('token') } catch {}
            nav('/login', { replace: true })
          }
        }
      } finally { if (!stop) setLoading(false) }
    }
    void run()
    return () => { stop = true }
  }, [nav])

  const goLinkChild = () => nav('/settings/link-child')   // 綁定子女端
  const goAccount   = () => nav('/settings/account')      // 修改帳號/密碼

  const handleLogout = async () => {
    setLoading(true)
    try {
      // 若有後端登出端點就呼叫；沒有也不影響
      await fetchJSON(`${BASE_URL}${API_LOGOUT}`, { method: 'POST' }).catch(() => {})
    } finally {
      try { localStorage.removeItem('user'); localStorage.removeItem('token') } catch {}
      nav('/login', { replace: true })
    }
  }

  if (loading && !user) {
    return (
      <div className="settings-wrap">
        <div className="settings-card profile skeleton" />
        <div className="settings-list skeleton" />
      </div>
    )
  }

  return (
    <div className="settings-wrap">
      {/* 錯誤訊息（可選） */}
      {err && (
        <div className="inline-alert" role="alert" style={{marginBottom:10}}>
          <div className="inline-alert-text">{err}</div>
          <button className="inline-alert-close" aria-label="重新整理" onClick={() => window.location.reload()}>↻</button>
        </div>
      )}

      {/* 使用者資料卡 */}
      <div className="settings-card profile">
        <div className="avatar">
          <div className="avatar-circle">{user?.name?.[0] || 'U'}</div>
        </div>
        <div className="profile-texts">
          <div className="profile-name">{user?.name || '未登入'}</div>
          <div className="profile-email">{user?.email || ''}</div>
        </div>
      </div>

      {/* 功能列表 */}
      <div className="settings-list">
        <button className="settings-item" onClick={goLinkChild}>
          <div className="item-left">
            <span className="item-icon">👨‍👩‍👧</span>
            <span className="item-title">綁定子女使用端</span>
          </div>
          <span className="item-arrow">›</span>
        </button>

        <button className="settings-item" onClick={goAccount}>
          <div className="item-left">
            <span className="item-icon">🔐</span>
            <span className="item-title">修改帳號 / 密碼</span>
          </div>
          <span className="item-arrow">›</span>
        </button>
      </div>

      {/* 登出 */}
      <button className="logout-btn" onClick={handleLogout} disabled={loading}>🚪 登出</button>
    </div>
  )
}
