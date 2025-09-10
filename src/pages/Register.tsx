import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import TermsModal from './TermsModal' // ✅ 新增：使用條款彈窗

type Role = 'user' | 'child'
type FieldKey = 'name' | 'email' | 'pwd' | 'pwd2' | 'agree'

export default function Register() {
  const nav = useNavigate()
  const [role, setRole] = useState<Role>('user')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [agree, setAgree] = useState(false)
  const [loading, setLoading] = useState(false)

  // 欄位錯誤（只用來控制紅框）
  const [fieldErrs, setFieldErrs] = useState<Partial<Record<FieldKey, string>>>({})

  // 頂部錯誤（依欄位優先級排序後顯示）
  const [topErrors, setTopErrors] = useState<string[]>([])
  // 是否已手動關閉 alert（不影響欄位紅框）
  const [dismissed, setDismissed] = useState(false)
  const alertRef = useRef<HTMLDivElement | null>(null)

  // ✅ 角色導覽 Modal
  const [showIntro, setShowIntro] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const introOkBtnRef = useRef<HTMLButtonElement | null>(null)

  // ✅ 使用條款 Modal
  const [showTerms, setShowTerms] = useState(false)

  const validateEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

  // 欄位優先順序：姓名 → 電子郵件 → 密碼 → 確認密碼 → 同意條款
  const FIELD_ORDER: FieldKey[] = ['name', 'email', 'pwd', 'pwd2', 'agree']
  const rank = (f: FieldKey) => FIELD_ORDER.indexOf(f)

  function validateAll() {
    const fe: Partial<Record<FieldKey, string>> = {}
    const errs: Array<{ field: FieldKey; msg: string }> = []

    if (!name.trim()) { fe.name = '請輸入姓名'; errs.push({ field: 'name',  msg: '請輸入姓名' }) }

    if (!email.trim()) {
      fe.email = '請輸入 Email'
      errs.push({ field: 'email', msg: '請輸入 Email' })
    } else if (!validateEmail(email)) {
      fe.email = 'Email 格式不正確'
      errs.push({ field: 'email', msg: 'Email 格式不正確' })
    }

    if (!pwd) {
      fe.pwd = '請輸入密碼'
      errs.push({ field: 'pwd',   msg: '請輸入密碼' })
    } else if (pwd.length < 6) {
      fe.pwd = '密碼至少 6 碼'
      errs.push({ field: 'pwd',   msg: '密碼至少 6 碼' })
    }

    if (!pwd2) {
      fe.pwd2 = '請再輸入一次密碼'
      errs.push({ field: 'pwd2',  msg: '請再輸入一次密碼' })
    } else if (pwd !== pwd2) {
      fe.pwd2 = '兩次密碼不一致'
      errs.push({ field: 'pwd2',  msg: '兩次密碼不一致' })
    }

    if (!agree) {
      fe.agree = '請勾選同意條款'
      errs.push({ field: 'agree', msg: '請勾選同意條款' })
    }

    errs.sort((a, b) => rank(a.field) - rank(b.field))

    setFieldErrs(fe)
    setTopErrors(errs.map(e => e.msg))
    return errs.length === 0
  }

  // 有新的錯誤 => 重新顯示 alert 並捲到它
  useEffect(() => {
    if (topErrors.length) {
      setDismissed(false)
      if (alertRef.current) {
        alertRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        alertRef.current.focus()
      }
    }
  }, [topErrors.length])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateAll()) return
    try {
      setLoading(true)
      // TODO: 換成你的後端 API
      await new Promise(r => setTimeout(r, 600))
      nav('/login', { replace: true, state: { justRegistered: true, email } })
    } finally {
      setLoading(false)
    }
  }

  const themeClass = role === 'user' ? 'theme-user' : 'theme-child'
  const hideInlineErrors = Object.keys(fieldErrs).length > 0

  // ===== 角色導覽：內容設定 =====
  const introContent = role === 'user'
    ? {
        title: '使用者端是做什麼的？',
        bullets: [
          '用語音一鍵記錄每天的生活與心情',
          '自動轉文字、支援台語/國語混講',
          '可查看自己的日記、情緒趨勢與標籤'
        ]
      }
    : {
        title: '子女端是做什麼的？',
        bullets: [
          '綁定家中長者帳號後可查看其日記摘要',
          '即時掌握情緒趨勢與異常提醒',
          '促進跨城市/跨國的日常關懷'
        ]
      }

  const INTRO_KEY = (r: Role) => `intro_shown_${r}` // ✅ 修正模板字串

  // 初次載入 & 每次切換角色：若尚未看過該角色導覽，顯示 Modal
  useEffect(() => {
    try {
      const seen = localStorage.getItem(INTRO_KEY(role))
      if (!seen) {
        setDontShowAgain(false)
        setShowIntro(true)
      }
    } catch {
      // 若無法使用 localStorage，仍可顯示一次
      setDontShowAgain(false)
      setShowIntro(true)
    }
  }, [role])

  // Modal 打開時把焦點移到「我知道了」按鈕（可近用）
  useEffect(() => {
    if (showIntro && introOkBtnRef.current) {
      introOkBtnRef.current.focus()
    }
  }, [showIntro])

  const closeIntro = () => {
    try {
      if (dontShowAgain) {
        localStorage.setItem(INTRO_KEY(role), '1')
      }
    } catch { /* 忽略 */ }
    setShowIntro(false)
  }

  return (
    <div className={`phone-wrap ${themeClass}`}> {/* ✅ 修正模板字串 */}
      <div className="phone">
        <div className="screen">
          <div className="appbar"
               style={{ background:'var(--login-appbar-bg)', color:'var(--login-appbar-fg)' }}>
            註冊
            {/* 右上角小問號：隨時查看說明 */}
            <button
              className="appbar-help"
              aria-label="角色說明"
              onClick={() => { setDontShowAgain(false); setShowIntro(true) }}
              title="角色說明"
            >
              ?
            </button>
          </div>

          <div className="content login-layout">
            <div className="login-card" style={{ borderColor:'var(--login-card-border)' }}>
              <div className="login-brand">
                <div className="title" style={{ color:'var(--login-title)', textAlign:'center', fontSize:22, fontWeight:700 }}>
                  建立帳號
                </div>
              </div>

              {/* 角色切換 */}
              <div className="role-tabs">
                <button
                  type="button"
                  className={`role-tab ${role==='user'?'active':''}`} // ✅ 修正模板字串
                  onClick={()=>setRole('user')}
                >使用者</button>
                <button
                  type="button"
                  className={`role-tab ${role==='child'?'active':''}`} // ✅ 修正模板字串
                  onClick={()=>setRole('child')}
                >子女端</button>
              </div>

              {/* 表單內第一個欄位上方的 Alert 條（只顯示第一條） */}
              {topErrors.length > 0 && !dismissed && (
                <div
                  ref={alertRef}
                  className="inline-alert"
                  tabIndex={-1}
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <div className="inline-alert-text">{topErrors[0]}</div>
                  <button
                    className="inline-alert-close"
                    onClick={() => setDismissed(true)}
                    aria-label="關閉"
                  >×</button>
                </div>
              )}

              <form onSubmit={onSubmit} className="login-form" noValidate>
                <label className="field">
                  <span className="label">使用者名稱</span>
                  <input
                    value={name}
                    onChange={e=>setName(e.target.value)}
                    aria-invalid={!!fieldErrs.name}
                  />
                  {!hideInlineErrors && fieldErrs.name && <div className="error">{fieldErrs.name}</div>}
                </label>

                <label className="field">
                  <span className="label">Email</span>
                  <input
                    value={email}
                    onChange={e=>setEmail(e.target.value)}
                    inputMode="email"
                    aria-invalid={!!fieldErrs.email}
                  />
                  {!hideInlineErrors && fieldErrs.email && <div className="error">{fieldErrs.email}</div>}
                </label>

                <label className="field">
                  <span className="label">密碼</span>
                  <input
                    type="password"
                    value={pwd}
                    onChange={e=>setPwd(e.target.value)}
                    aria-invalid={!!fieldErrs.pwd}
                  />
                  {!hideInlineErrors && fieldErrs.pwd && <div className="error">{fieldErrs.pwd}</div>}
                </label>

                <label className="field">
                  <span className="label">確認密碼</span>
                  <input
                    type="password"
                    value={pwd2}
                    onChange={e=>setPwd2(e.target.value)}
                    aria-invalid={!!fieldErrs.pwd2}
                  />
                  {!hideInlineErrors && fieldErrs.pwd2 && <div className="error">{fieldErrs.pwd2}</div>}
                </label>

                {/* ✅ 勾選 + 按鈕開啟「使用條款」彈窗；按「同意並關閉」會自動勾選 */}
                <label className="field" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={e=>setAgree(e.target.checked)}
                    aria-invalid={!!fieldErrs.agree}
                  />
                  <span className="meta">
                    我已閱讀並同意
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      style={{
                        background:'none', border:0, padding:0, marginLeft:4,
                        color:'var(--login-btn-bg)', textDecoration:'underline', cursor:'pointer'
                      }}
                    >
                      使用條款
                    </button>
                    與隱私政策
                  </span>
                </label>
                {!hideInlineErrors && fieldErrs.agree && <div className="error">{fieldErrs.agree}</div>}

                <button className="btn-primary" disabled={loading}
                        style={{ background:'var(--login-btn-bg)' }}>
                  {loading ? '建立中…' : '建立帳號'}
                </button>
              </form>

              <div className="help">
                已有帳號？<Link to="/login">前往登入</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 角色導覽 Modal ===== */}
      {showIntro && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="intro-title">
          <div className="modal">
            <div className="modal-header">
              <h3 id="intro-title">{introContent.title}</h3>
              <button className="modal-close" aria-label="關閉" onClick={closeIntro}>×</button>
            </div>
            <div className="modal-body">
              <ul className="modal-list">
                {introContent.bullets.map((b, i) => (<li key={i}>{b}</li>))}
              </ul>
              <label className="modal-check">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                />
                <span>下次不再顯示</span>
              </label>
            </div>
            <div className="modal-footer">
              <button
                ref={introOkBtnRef}
                className="btn-primary"
                onClick={closeIntro}
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 使用條款 Modal ===== */}
      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onAgree={() => {
          setAgree(true)        // ✅ 一鍵同意
          setShowTerms(false)
        }}
      />
    </div>
  )
}
