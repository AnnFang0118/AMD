import { NavLink, Outlet } from 'react-router-dom'


function SearchIcon(){return(<svg viewBox="0 0 24 24"><path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm8.71 14.29-3.4-3.39a9 9 0 1 0-1.41 1.41l3.4 3.4a1 1 0 0 0 1.41-1.42Z"/></svg>)}
function CalIcon(){return(<svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm12 8H5v10h14V10Z"/></svg>)}
function GearIcon(){return(<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm9 4a7.1 7.1 0 0 0-.09-1l2-1.55-1.9-3.29-2.38 1a6.92 6.92 0 0 0-1.73-1L15.5 2h-3L11.1 5.16a6.92 6.92 0 0 0-1.73 1l-2.38-1L5.1 8.45l2 1.55a7.1 7.1 0 0 0 0 2L5.1 13.55l1.9 3.29 2.38-1a6.92 6.92 0 0 0 1.73 1L12.5 22h3l1.4-3.16a6.92 6.92 0 0 0 1.73-1l2.38 1 1.9-3.29-2-1.55c.06-.33.09-.66.09-1Z"/></svg>)}
function MicIcon(){return(<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21H9v2h6v-2h-2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>)}

export default function AppLayout(){
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="screen">
          <div className="appbar">{/* Home 不顯標題，保留空白即可 */}</div>

          <div className="content">
            <Outlet/>
          </div>

          <nav className="bottom-nav">
            <NavLink to="/search" className={({isActive})=>isActive?'active':''}>
                <span className="pill"></span><SearchIcon/>
            </NavLink>
            <NavLink to="/calendar" className={({isActive})=>isActive?'active':''}>
                <span className="pill"></span><CalIcon/>
            </NavLink>
            {/* ⬇️ 原本是 to="/"，改成 /home */}
            <NavLink to="/home" className={({isActive})=>isActive?'active':''}>
                <span className="pill"></span><MicIcon/>
            </NavLink>
            <NavLink to="/settings" className={({isActive})=>isActive?'active':''}>
                <span className="pill"></span><GearIcon/>
            </NavLink>
        </nav>

        </div>
      </div>
    </div>
  )
}
