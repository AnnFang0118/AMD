// src/pages/LinkChild.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

type LinkRequest = {
  id: string
  parentEmail: string
  childEmail: string
  childName?: string
  note?: string
  createdAt: number
  status: 'pending' | 'accepted' | 'rejected'
}

type LinkedChild = {
  childEmail: string
  childName?: string
  linkedAt: number
}

const REQ_KEY = 'link-requests' // 伺服器佇列（以 localStorage 模擬）
const LIST_KEY = (parentEmail: string) => `linked-children:${parentEmail}`

// ===== 模擬「子女端送出綁定請求」的函式 =====
// 真實情境應由子女端呼叫後端 API 建立請求。
// 你也可以把這段搬去子女端頁面，這裡只是方便你測試。
export function submitLinkRequestMock(params: {
  parentEmail: string
  childEmail: string
  childName?: string
  note?: string
}) {
  const list: LinkRequest[] = JSON.parse(localStorage.getItem(REQ_KEY) || '[]')
  const req: LinkRequest = {
    id: crypto.randomUUID(),
    parentEmail: params.parentEmail.trim().toLowerCase(),
    childEmail: params.childEmail.trim().toLowerCase(),
    childName: params.childName?.trim(),
    note: params.note?.trim(),
    createdAt: Date.now(),
    status: 'pending',
  }
  list.push(req)
  localStorage.setItem(REQ_KEY, JSON.stringify(list))
  return req
}

function loadRequests(): LinkRequest[] {
  try { return JSON.parse(localStorage.getItem(REQ_KEY) || '[]') } catch { return [] }
}
function saveRequests(reqs: LinkRequest[]) {
  localStorage.setItem(REQ_KEY, JSON.stringify(reqs))
}
function loadLinked(parentEmail: string): LinkedChild[] {
  try { return JSON.parse(localStorage.getItem(LIST_KEY(parentEmail)) || '[]') } catch { return [] }
}
function saveLinked(parentEmail: string, list: LinkedChild[]) {
  localStorage.setItem(LIST_KEY(parentEmail), JSON.stringify(list))
}

export default function LinkChild(){
  // 假登入使用者（你登入時已把 user 存在 localStorage）
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') as { email: string; name?: string } | null } catch { return null }
  }, [])

  const [searchParams] = useSearchParams()
  const [requests, setRequests] = useState<LinkRequest[]>([])
  const [linked, setLinked] = useState<LinkedChild[]>([])
  const [picked, setPicked] = useState<LinkRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  // 初始載入：拉 pending 佇列 + 已綁定清單
  useEffect(() => {
    if (!currentUser?.email) return
    const email = currentUser.email.toLowerCase()
    const all = loadRequests()
    setRequests(all.filter(r => r.parentEmail === email && r.status === 'pending')
                  .sort((a,b)=>b.createdAt - a.createdAt))
    setLinked(loadLinked(email).sort((a,b)=>b.linkedAt - a.linkedAt))
  }, [currentUser?.email])

  // 支援 ?rid=xxx 直接彈出審核視窗
  useEffect(() => {
    if (!currentUser?.email) return
    const rid = searchParams.get('rid')
    if (!rid) return
    const all = loadRequests()
    const target = all.find(r => r.id === rid && r.parentEmail === currentUser.email.toLowerCase())
    if (target && target.status === 'pending') {
      setPicked(target)
    }
  }, [searchParams, currentUser?.email])

  function showToast(msg: string){
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(()=>setToast(null), 1800)
  }

  function approve(req: LinkRequest){
    const email = currentUser!.email.toLowerCase()
    // 1) 更新請求狀態
    const all = loadRequests()
    const idx = all.findIndex(r => r.id === req.id)
    if (idx >= 0) {
      all[idx].status = 'accepted'
      saveRequests(all)
    }
    // 2) 寫入已綁定名單
    const list = loadLinked(email)
    list.push({ childEmail: req.childEmail, childName: req.childName, linkedAt: Date.now() })
    saveLinked(email, list)
    // 3) 刷新畫面
    setRequests(prev => prev.filter(r => r.id !== req.id))
    setLinked(loadLinked(email).sort((a,b)=>b.linkedAt - a.linkedAt))
    setPicked(null)
    showToast('已同意綁定')
  }

  function reject(req: LinkRequest){
    const all = loadRequests()
    const idx = all.findIndex(r => r.id === req.id)
    if (idx >= 0) {
      all[idx].status = 'rejected'
      saveRequests(all)
    }
    setRequests(prev => prev.filter(r => r.id !== req.id))
    setPicked(null)
    showToast('已拒絕綁定')
  }

  // 測試：快速新增一筆 pending（等你有子女端頁面就不需要這顆）
  function addDemoRequest(){
    if (!currentUser?.email) return
    const req = submitLinkRequestMock({
      parentEmail: currentUser.email,
      childEmail: `kid${Math.floor(Math.random()*100)}@example.com`,
      childName: '小明',
      note: '請求查看日記',
    })
    setRequests(prev => [req, ...prev])
    showToast('已新增一筆測試請求')
  }

  if (!currentUser?.email) {
    return (
      <div className="card" style={{padding:16}}>
        <b>請先登入</b>
        <div className="meta">需登入後才能審核綁定請求。</div>
      </div>
    )
  }

  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {/* 頁首說明 */}
      <div className="card" style={{padding:16}}>
        <b>綁定子女使用端</b>
        <div className="meta" style={{marginTop:6}}>
          子女需要在「子女端 App」輸入你的 Email（{currentUser.email}）送出綁定請求。
          你在這裡可以同意或拒絕。支援從訊息點擊連結 <code>?rid=…</code> 直接打開審核視窗。
        </div>
      </div>

      {/* 待審核請求清單 */}
      <div className="card" style={{padding:0}}>
        <div style={{padding:'12px 16px', borderBottom:'1px solid #eee', fontWeight:700}}>待審核</div>
        {requests.length === 0 ? (
          <div style={{padding:16, color:'#666'}}>目前沒有新的綁定請求。</div>
        ) : (
          <div style={{display:'flex', flexDirection:'column'}}>
            {requests.map(r => (
              <button
                key={r.id}
                className="row-item"
                style={{display:'flex', gap:10, alignItems:'center', padding:'12px 16px', borderBottom:'1px solid #eee', background:'transparent', textAlign:'left', cursor:'pointer'}}
                onClick={()=>setPicked(r)}
                title="點擊查看與同意/拒絕"
              >
                <div style={{width:38, height:38, borderRadius:10, background:'#e9efff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>👤</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:14}}>
                    {r.childName || r.childEmail}
                  </div>
                  <div className="meta" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {r.childEmail} ・ 申請於 {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="meta">查看</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 已綁定名單 */}
      <div className="card" style={{padding:0}}>
        <div style={{padding:'12px 16px', borderBottom:'1px solid #eee', fontWeight:700}}>已綁定</div>
        {linked.length === 0 ? (
          <div style={{padding:16, color:'#666'}}>尚未綁定任何子女帳號。</div>
        ) : (
          <div style={{display:'flex', flexDirection:'column'}}>
            {linked.map((c, i) => (
              <div key={c.childEmail + i} style={{display:'flex', gap:10, alignItems:'center', padding:'12px 16px', borderBottom:'1px solid #eee'}}>
                <div style={{width:38, height:38, borderRadius:10, background:'#eef6ee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>👪</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:14}}>{c.childName || c.childEmail}</div>
                  <div className="meta">{c.childEmail} ・ 綁定於 {new Date(c.linkedAt).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 測試快捷 */}
      <button className="card" onClick={addDemoRequest} style={{border:'none', cursor:'pointer'}}>
        新增一筆測試請求（開發用）
      </button>

      {/* 審核 Modal */}
      {picked && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="link-title">
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-header">
              <h3 id="link-title">確認綁定</h3>
              <button className="modal-close" aria-label="關閉" onClick={()=>setPicked(null)}>×</button>
            </div>
            <div className="modal-body" style={{display:'grid', gap:8}}>
              <div><b>子女名稱：</b>{picked.childName || '（未提供）'}</div>
              <div><b>子女信箱：</b>{picked.childEmail}</div>
              {picked.note && <div><b>附註：</b>{picked.note}</div>}
              <div className="meta" style={{marginTop:6}}>送出時間：{new Date(picked.createdAt).toLocaleString()}</div>
            </div>
            <div className="modal-footer" style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button onClick={()=>reject(picked)} style={{border:'1px solid #ddd', background:'#fff', borderRadius:10, padding:'6px 12px', cursor:'pointer'}}>拒絕</button>
              <button onClick={()=>approve(picked)} className="btn-primary">同意綁定</button>
            </div>
          </div>
        </div>
      )}

      {/* 簡易 Toast */}
      {toast && (
        <div className="toast-wrap" style={{position:'fixed', bottom:16, left:0, right:0, display:'flex', justifyContent:'center', pointerEvents:'none'}}>
          <div className="toast" role="status" aria-live="polite" style={{pointerEvents:'auto'}}>
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}

