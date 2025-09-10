import { NavLink, Outlet } from 'react-router-dom'

function BubbleIcon(){return(<svg viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/></svg>)}
function CalIcon(){return(<svg viewBox="0 0 24 24"><path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V2Zm12 8H5v10h14V10Z"/></svg>)}
function GearIcon(){return(<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm9 4a7.1 7.1 0 0 0-.09-1l2-1.55-1.9-3.29-2.38 1a6.92 6.92 0 0 0-1.73-1L15.5 2h-3L11.1 5.16a6.92 6.92 0 0 0-1.73 1l-2.38-1L5.1 8.45l2 1.55a7.1 7.1 0 0 0 0 2L5.1 13.55l1.9 3.29 2.38-1a6.92 6.92 0 0 0 1.73 1L12.5 22h3l1.4-3.16a6.92 6.92 0 0 0 1.73-1l2.38 1 1.9-3.29-2-1.55c.06-.33.09-.66.09-1Z"/></svg>)}

export default function AppLayoutChild(){
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="screen">
          <div className="appbar" />
          <div className="content"><Outlet/></div>
          <nav className="bottom-nav">
            <NavLink to="/child/childfeed" className={({isActive})=>isActive?'active':''}>
              <span className="pill"></span><BubbleIcon/>
            </NavLink>
            <NavLink to="/child/childcalendar" end className={({isActive})=>isActive?'active':''}>
              <span className="pill"></span><CalIcon/>
            </NavLink>
            <NavLink to="/child/childsetting" className={({isActive})=>isActive?'active':''}>
              <span className="pill"></span><GearIcon/>
            </NavLink>
          </nav>
        </div>
      </div>
    </div>
  )
}

