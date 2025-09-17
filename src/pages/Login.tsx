import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'

// =============== 可調整區：後端位址與 API Path ==================
const BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const API_LOGIN = '/auth/login'

// 後端回傳格式（可依你們實際回傳調整）
type LoginResponse = {
  success?: boolean
  email?: string
  name?: string
  token?: string
  detail?: string
  message?: string
}

type RegState = { justRegistered?: boolean; email?: string } | undefined

type Role = 'user' | 'child'

export default function Login(){
  const nav = useNavigate()
  const location = useLocation()
  const regState = (location.state as RegState) || {}

  const [role, setRole] = useState<Role>('user')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 註冊導回帶入 Email 的提示
  useEffect(() => {
    if (regState?.justRegistered) {
      setEmail(regState.email || '')
      setOk('註冊成功，請使用剛才的 Email 登入')
      setErr(null)
      nav('/login', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 共用：呼叫後端登入 API（含逾時與錯誤處理）
  async function loginRequest(payload: { email: string; password: string; role: Role }): Promise<LoginResponse> {
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 8000) // 8s 逾時

    try {
      const res = await fetch(`${BASE_URL}${API_LOGIN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 若後端使用 Cookie Session，請同時打開下行，並在後端 CORS 設定 allow-credentials
        // credentials: 'include',
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      })

      let data: LoginResponse | null = null
      try { data = await res.json() } catch { /* 可能是空 body/非 JSON，略過 */ }

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || `登入失敗（HTTP ${res.status}）`)
      }

      return data || {}
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    setErr(null); setOk(null)

    if (!email || !pwd) { setErr('請輸入 Email 與密碼'); return }

    try {
      setLoading(true)

      const data = await loginRequest({ email, password: pwd, role })

      // 儲存登入資訊：依你們實際回傳調整
      if (data?.token) localStorage.setItem('token', data.token)

      const user = {
        name: data?.name || (role === 'user' ? '使用者' : '子女端'),
        email: data?.email || email,
        role,
      }
      localStorage.setItem('user', JSON.stringify(user))

      setOk('登入成功！')

      // 跳轉（依角色）
      nav(role === 'user' ? '/home' : '/child', { replace: true })
    } catch (e: any) {
      if (e?.name === 'AbortError') setErr('連線逾時，請稍後重試')
      else setErr(e?.message || '登入失敗，請再試一次')
    } finally {
      setLoading(false)
    }
  }

  // 依角色套不同主題 class（延用你的樣式）
  const themeClass = role === 'user' ? 'theme-user' : 'theme-child'

  return (
    <div className={`phone-wrap ${themeClass}`}>
      <div className="phone">
        <div className="screen">
          <div className="appbar" style={{background:'var(--login-appbar-bg)', color:'var(--login-appbar-fg)'}}>
            登入
          </div>

          <div className="content login-layout">
            <div className="login-card" style={{borderColor:'var(--login-card-border)'}}>
              <div className="login-brand">
                <div className="logo" style={{background:'var(--login-logo-bg)'}}>🎙️</div>
                <div className="title" style={{color:'var(--login-title)'}}>語音日記</div>
                <div className="subtitle" style={{color:'var(--login-subtitle)'}}>請先登入以繼續</div>
              </div>

              {ok && (
                <div
                  className="card"
                  role="status"
                  aria-live="polite"
                  style={{background:'var(--ok-bg)', border:'1px solid var(--ok-border)', color:'var(--ok-fg)', padding:'10px 12px', borderRadius:10, margin:'6px 0'}}>
                  {ok}
                </div>
              )}

              {/* 角色切換 */}
              <div className="role-tabs">
                <button
                  type="button"
                  className={`role-tab ${role==='user'?'active':''}`}
                  onClick={()=>setRole('user')}
                  disabled={loading}
                >
                  使用者
                </button>
                <button
                  type="button"
                  className={`role-tab ${role==='child'?'active':''}`}
                  onClick={()=>setRole('child')}
                  disabled={loading}
                >
                  子女端
                </button>
              </div>

              <form onSubmit={onSubmit} className="login-form" noValidate>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    placeholder="you@example.com"
                    inputMode="email"
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </label>

                <label className="field">
                  <span className="label">密碼</span>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={pwd}
                      onChange={e=>setPwd(e.target.value)}
                      placeholder="********"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={()=>setShowPwd(s=>!s)}
                      aria-label={showPwd? '隱藏密碼' : '顯示密碼'}
                      disabled={loading}
                      style={{padding:'6px 10px'}}
                    >{showPwd ? '🙈' : '👁️'}</button>
                  </div>
                </label>

                {err && (
                  <div className="error" role="alert" aria-live="assertive">
                    {err}
                  </div>
                )}

                <button className="btn-primary" disabled={loading} style={{background:'var(--login-btn-bg)'}}>
                  {loading ? '登入中…' : '登入'}
                </button>
              </form>

              <div className="help" style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                <span>登入角色：<b>{role==='user' ? '使用者' : '子女端'}</b></span>
                <span>還沒有帳號？<Link to="/register">前往註冊</Link></span>
              </div>

              {/* 使用條款連結 */}
              <div className="terms-note" style={{marginTop:8, textAlign:'center', fontSize:12, opacity:.85}}>
                使用本服務即代表同意 <Link to="/terms">使用條款</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
