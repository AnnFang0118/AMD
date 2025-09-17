// src/pages/ChildSettings.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** ================= 可調整：你的後端位址 ================= */
const BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`

/** ================= 型別 ================= */
type User = { name?: string; email: string }
type Binding = { parentName: string; parentEmail?: string }

/** ================= 工具：Headers / fetchJSON / 正規化 ================= */
function buildHeaders(): Headers {
  const h = new Headers({ Accept: 'application/json' })
  try {
    const t = localStorage.getItem('token')
    if (t) h.set('Authorization', `Bearer ${t}`)
  } catch {}
  return h
}

async function fetchJSON(url: string, opts: RequestInit = {}, extSignal?: AbortSignal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, {
      credentials: 'include', // 支援 cookie-session
      headers: buildHeaders(),
      signal: extSignal ?? ctrl.signal,
      ...opts,
    })
    let data: any = null
    try { data = await res.json() } catch {}
    if (!res.ok) {
      const msg = data?.detail || data?.message || `HTTP ${res.status}`
      const err: any = new Error(msg); err.status = res.status; throw err
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

/** 優先嘗試子女端專用端點，失敗再 fallback 一般端點 */
async function fetchChildProfile(signal?: AbortSignal): Promise<User> {
  // 1) /child/profile
  try {
    const d = await fetchJSON(`${BASE_URL}/child/profile`, {}, signal)
    return normalizeUser(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 2) /child/me
  try {
    const d = await fetchJSON(`${BASE_URL}/child/me`, {}, signal)
    return normalizeUser(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 3) /me
  try {
    const d = await fetchJSON(`${BASE_URL}/me`, {}, signal)
    return normalizeUser(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 4) /profile
  const d4 = await fetchJSON(`${BASE_URL}/profile`, {}, signal)
  return normalizeUser(d4)
}

function normalizeUser(raw: any): User {
  const email = String(raw?.email ?? raw?.user?.email ?? '').trim()
  const name = String(raw?.name ?? raw?.user?.name ?? raw?.nickname ?? '').trim() || undefined
  if (!email) throw new Error('缺少使用者 Email')
  return { email, name }
}

async function fetchChildBinding(signal?: AbortSignal): Promise<Binding | null> {
  // 1) /child/binding
  try {
    const d = await fetchJSON(`${BASE_URL}/child/binding`, {}, signal)
    return normalizeBinding(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 2) /binding
  try {
    const d = await fetchJSON(`${BASE_URL}/binding`, {}, signal)
    return normalizeBinding(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 3) /child/link 或 /child/linked
  try {
    const d = await fetchJSON(`${BASE_URL}/child/link`, {}, signal)
    return normalizeBinding(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  try {
    const d = await fetchJSON(`${BASE_URL}/child/linked`, {}, signal)
    return normalizeBinding(d)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  return null
}

function normalizeBinding(raw: any): Binding | null {
  if (!raw) return null
  // 支援多種欄位名稱
  const name =
    raw?.parentName ??
    raw?.name ??
    raw?.parent?.name ??
    raw?.user?.name ??
    ''
  const email =
    raw?.parentEmail ??
    raw?.email ??
    raw?.parent?.email ??
    raw?.user?.email ??
    ''
  const parentName = String(name).trim()
  const parentEmail = String(email).trim() || undefined
  if (!parentName && !parentEmail) return null
  return { parentName: parentName || (parentEmail ?? '使用者'), parentEmail }
}

/** ================= 元件 ================= */
export default function ChildSettings() {
  const nav = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [binding, setBinding] = useState<Binding | null>(null)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Avatar：取 email 第一個字母（大寫）
  const avatarInitial = useMemo(() => {
    const ch = user?.email?.trim()?.[0]
    return ch ? ch.toUpperCase() : 'U'
  }, [user?.email])

  useEffect(() => {
    const ac = new AbortController()

    async function bootstrap() {
      setLoading(true); setErr(null)
      try {
        // 先試後端資料
        const [u, b] = await Promise.all([
          fetchChildProfile(ac.signal),
          fetchChildBinding(ac.signal).catch(() => null),
        ])
        setUser(u)
        setBinding(b)
        // 同步更新 localStorage（讓其它頁也能用）
        try { localStorage.setItem('user', JSON.stringify(u)) } catch {}
        if (b) try { localStorage.setItem('binding', JSON.stringify(b)) } catch {}
      } catch (e: any) {
        // 後端失敗 → fallback 用 localStorage（仍維持你原本邏輯）
        try {
          const saved = localStorage.getItem('user')
          if (saved) setUser(JSON.parse(saved) as User)
          else nav('/login', { replace: true })
          const b = localStorage.getItem('binding')
          if (b) setBinding(JSON.parse(b) as Binding)
        } catch {}
        setErr(e?.message || '載入失敗')
      } finally {
        setLoading(false)
      }
    }

    void bootstrap()
    return () => ac.abort()
  }, [nav])

  const goBoundInfo = () => nav('/child/bound-info')
  const goAccount   = () => nav('/child/account')

  const handleLogout = async () => {
    // 嘗試通知後端登出（忽略失敗）
    try {
      await fetchJSON(`${BASE_URL}/auth/logout`, { method: 'POST' })
    } catch {}
    // 清掉登入狀態
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    nav('/login', { replace: true })
  }

  return (
    <div className="settings-wrap">
      {/* 使用者資料卡（子女端登入者） */}
      <div className="settings-card profile">
        <div className="avatar">
          <div className="avatar-circle">{avatarInitial}</div>
        </div>
        <div className="profile-texts">
          <div className="profile-name">{user?.email || (loading ? '載入中…' : '未登入')}</div>
          <div className="profile-email">{user?.name ? `暱稱：${user.name}` : ''}</div>
        </div>
      </div>

      {/* 錯誤提示（可省略：只是提供重試） */}
      {err && (
        <div className="inline-alert" role="alert" style={{marginBottom:10}}>
          <div className="inline-alert-text">{err}</div>
          <button
            className="inline-alert-close"
            aria-label="重試"
            onClick={() => {
              // 重新觸發載入
              setErr(null); setLoading(true)
              const ac = new AbortController()
              Promise.all([
                fetchChildProfile(ac.signal),
                fetchChildBinding(ac.signal).catch(() => null),
              ])
                .then(([u, b]) => {
                  setUser(u); setBinding(b)
                  try { localStorage.setItem('user', JSON.stringify(u)) } catch {}
                  if (b) try { localStorage.setItem('binding', JSON.stringify(b)) } catch {}
                })
                .catch((e:any)=>setErr(e?.message || '載入失敗'))
                .finally(()=>setLoading(false))
            }}
          >↻</button>
        </div>
      )}

      {/* 功能列表 */}
      <div className="settings-list">
        <button className="settings-item" onClick={goBoundInfo} disabled={loading}>
          <div className="item-left">
            <span className="item-icon">🤝</span>
            <span className="item-title">
              {binding
                ? `已綁定：${binding.parentName}${binding.parentEmail ? `（${binding.parentEmail}）` : ''}`
                : loading ? '載入中…' : '尚未綁定對象'}
            </span>
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
      <button className="logout-btn" onClick={handleLogout} disabled={loading}>
        🚪 登出
      </button>
    </div>
  )
}
