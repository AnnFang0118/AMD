// src/pages/Settings.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type User = { name: string; email: string }

export default function Settings() {
  const nav = useNavigate()
  const [user, setUser] = useState<User | null>(null)

  // 進到設定頁時讀取登入資料；沒有就導回登入頁
  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (saved) {
      try {
        setUser(JSON.parse(saved) as User)
      } catch {
        nav('/login', { replace: true })
      }
    } else {
      nav('/login', { replace: true })
    }
  }, [nav])

  const goLinkChild = () => nav('/settings/link-child')   // 綁定子女端
  const goAccount   = () => nav('/settings/account')      // 修改帳號/密碼

  const handleLogout = () => {
    // 清掉登入狀態
    localStorage.removeItem('user')
    // 若還有 token 等，也一起移除：
    // localStorage.removeItem('token')
    nav('/login', { replace: true })
  }

  return (
    <div className="settings-wrap">
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
      <button className="logout-btn" onClick={handleLogout}>
        🚪 登出
      </button>
    </div>
  )
}

