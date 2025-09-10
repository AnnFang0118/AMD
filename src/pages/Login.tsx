import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'

type RegState = { justRegistered?: boolean; email?: string } | undefined

export default function Login(){
  const nav = useNavigate()
  const location = useLocation()
  const regState = (location.state as RegState) || {}

  const [role, setRole] = useState<'user'|'child'>('user')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (regState?.justRegistered) {
      setEmail(regState.email || '')
      setOk('註冊成功，請使用剛才的 Email 登入')
      setErr(null)
      nav('/login', { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    setErr(null); setOk(null)
    if(!email || !pwd){ setErr('請輸入 Email 與密碼'); return }
    try{
      setLoading(true)
      await new Promise(r => setTimeout(r, 500)) // demo

      const fakeUser = {
        name: role === 'user' ? 'Emily Wu' : 'Child User',
        email
      }
      localStorage.setItem("user", JSON.stringify(fakeUser))
      nav(role === 'user' ? '/home' : '/child', { replace: true })
    }catch(e:any){
      setErr(e?.message || '登入失敗，請再試一次')
    }finally{
      setLoading(false)
    }
  }

  // 依角色套不同主題 class
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
                <div className="card"
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
                >
                  使用者
                </button>
                <button
                  type="button"
                  className={`role-tab ${role==='child'?'active':''}`}
                  onClick={()=>setRole('child')}
                >
                  子女端
                </button>
              </div>

              <form onSubmit={onSubmit} className="login-form">
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    placeholder="you@example.com"
                    inputMode="email"
                  />
                </label>

                <label className="field">
                  <span className="label">密碼</span>
                  <input
                    type="password"
                    value={pwd}
                    onChange={e=>setPwd(e.target.value)}
                    placeholder="********"
                  />
                </label>

                {err && <div className="error">{err}</div>}

                <button className="btn-primary" disabled={loading} style={{background:'var(--login-btn-bg)'}}>
                  {loading ? '登入中…' : '登入'}
                </button>
              </form>

              <div className="help" style={{display:'flex', justifyContent:'space-between', marginTop:10}}>
                <span>登入角色：<b>{role==='user' ? '使用者' : '子女端'}</b></span>
                <span>還沒有帳號？<Link to="/register">前往註冊</Link></span>
              </div>

              {/* 使用條款連結（新增） */}
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
