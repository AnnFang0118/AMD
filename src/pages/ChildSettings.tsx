import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type User = { name: string; email: string }
type Binding = { parentName: string; parentEmail?: string } // 與哪位使用者綁定

export default function ChildSettings() {
  const nav = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [binding, setBinding] = useState<Binding | null>(null)

  // 便利函式：從 email 取第一個字母（大寫），沒有就回傳 'U'
  const avatarInitial = useMemo(() => {
    const ch = user?.email?.trim()?.[0]
    return ch ? ch.toUpperCase() : 'U'
  }, [user?.email])

  useEffect(() => {
    // 讀登入者資料
    const saved = localStorage.getItem('user')
    if (saved) {
      try { setUser(JSON.parse(saved) as User) } catch {}
    } else {
      // 未登入就回登入
      nav('/login', { replace: true })
      return
    }

    // 讀綁定資訊（示意：你之後可改從後端拉資料）
    const b = localStorage.getItem('binding')
    if (b) {
      try { setBinding(JSON.parse(b) as Binding) } catch {}
    }
  }, [nav])

  const goBoundInfo = () => nav('/child/bound-info')       // 顯示與誰綁定
  const goAccount    = () => nav('/child/account')          // 修改帳號/密碼（子女端）
  const handleLogout = () => {
    localStorage.removeItem('user')
    // 若有綁定/權杖也可清：
    // localStorage.removeItem('token')
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
          {/* ✅ 顯示 email 當作最上方的用戶名稱 */}
          <div className="profile-name">{user?.email || '未登入'}</div>
          {/* 次行可放暱稱或留白；想隱藏可留空字串 */}
          <div className="profile-email">{user?.name ? `暱稱：${user.name}` : ''}</div>
        </div>
      </div>

      {/* 功能列表（子女端：沒有「綁定子女端」，改為顯示已綁定對象） */}
      <div className="settings-list">
        <button className="settings-item" onClick={goBoundInfo}>
          <div className="item-left">
            <span className="item-icon">🤝</span>
            <span className="item-title">
              {binding
                ? `已綁定：${binding.parentName}${binding.parentEmail ? `（${binding.parentEmail}）` : ''}`
                : '尚未綁定對象'}
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
      <button className="logout-btn" onClick={handleLogout}>
        🚪 登出
      </button>
    </div>
  )
}
