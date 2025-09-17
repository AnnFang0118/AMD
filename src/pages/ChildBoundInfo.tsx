// src/pages/ChildBoundInfo.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'

type LinkRequest = {
  id: string
  parentEmail: string
  childEmail: string
  childName?: string
  note?: string
  createdAt: number
  status: 'pending' | 'accepted' | 'rejected'
}

type Binding = { parentName: string; parentEmail?: string }

const REQ_KEY = 'link-requests'   // 與家長端共用的佇列 key（本機模擬）
const BINDING_KEY = 'binding'     // 子女端本機綁定資訊
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function loadRequests(): LinkRequest[] {
  try { return JSON.parse(localStorage.getItem(REQ_KEY) || '[]') as LinkRequest[] } catch { return [] }
}
function saveRequests(reqs: LinkRequest[]) {
  localStorage.setItem(REQ_KEY, JSON.stringify(reqs))
}
function submitLinkRequestMock(params: {
  parentEmail: string
  childEmail: string
  childName?: string
  note?: string
}) {
  const list: LinkRequest[] = loadRequests()
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
  saveRequests(list)
  return req
}

export default function ChildBoundInfo(){
  // 目前登入的「子女端」使用者（你登入時會把 user 存在 localStorage）
  const currentChild = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') as { email?: string; name?: string } | null } catch { return null }
  }, [])

  // 綁定資訊（子女本機）
  const [binding, setBinding] = useState<Binding | null>(() => {
    const raw = localStorage.getItem(BINDING_KEY)
    return raw ? (JSON.parse(raw) as Binding) : null
  })

  // 表單
  const [parentEmail, setParentEmail] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // 我的請求清單（只顯示這個子女信箱的）
  const [myReqs, setMyReqs] = useState<LinkRequest[]>([])

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(()=>setToast(null), 1800)
  }, [])

  // 抓我的請求（包在 useCallback，供多處呼叫）
  const refreshMyRequests = useCallback(async () => {
    const email = (currentChild?.email || '').toLowerCase()
    if (!email) return
    const list = loadRequests()
      .filter(r => r.childEmail === email)
      .sort((a,b)=>b.createdAt - a.createdAt)
    setMyReqs(list)
  }, [currentChild?.email])

  // 初始載入：抓我的請求
  useEffect(() => {
    void refreshMyRequests()
  }, [refreshMyRequests])

  // 送出綁定請求（由子女端發）
  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    setErr(null)
    const pe = parentEmail.trim().toLowerCase()
    if (!pe) { setErr('請輸入家長 Email'); return }
    if (!EMAIL_RE.test(pe)) { setErr('Email 格式不正確'); return }
    if (!currentChild?.email) { setErr('尚未登入，無法送出'); return }

    try {
      setSending(true)
      const req = submitLinkRequestMock({
        parentEmail: pe,
        childEmail: currentChild.email,
        childName: currentChild.name || '子女',
        note: note.trim() || undefined
      })
      // 更新畫面
      setParentEmail('')
      setNote('')
      await refreshMyRequests()
      showToast('已送出綁定請求')

      // 方便分享：複製家長審核連結
      try {
        const url = `${window.location.origin}/link-child?rid=${req.id}`
        await navigator.clipboard.writeText(url)
        showToast('同意連結已複製，貼給家長即可審核')
      } catch { /* 忽略剪貼簿錯誤 */ }
    } finally {
      setSending(false)
    }
  }

  // 同步綁定：找到「已同意」的請求，把家長 Email 寫進子女本機 binding
  const syncBinding = useCallback(() => {
    const accepted = myReqs.find(r => r.status === 'accepted')
    if (!accepted) { showToast('尚未有已同意的請求'); return }
    const b: Binding = { parentName: '已綁定家長', parentEmail: accepted.parentEmail }
    localStorage.setItem(BINDING_KEY, JSON.stringify(b))
    setBinding(b)
    showToast('綁定已同步')
  }, [myReqs, showToast])

  const unbind = useCallback(() => {
    localStorage.removeItem(BINDING_KEY)
    setBinding(null)
    showToast('已解除綁定（僅清除此裝置）')
  }, [showToast])

  // === 重要：onClick 型別修正（包一層 MouseEventHandler） ===
  const handleRefreshClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    void refreshMyRequests()
  }
  const handleSyncBindingClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    syncBinding()
  }
  const handleUnbindClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    unbind()
  }

  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {/* 綁定資訊 */}
      <div className="card" style={{padding:16}}>
        <b>綁定資訊</b>
        {binding ? (
          <>
            <div className="meta" style={{marginTop:8}}>
              目前綁定對象：<b>{binding.parentName}</b>
              {binding.parentEmail ? `（${binding.parentEmail}）` : ''}
            </div>
            <div style={{marginTop:10, display:'flex', gap:8}}>
              <button onClick={handleUnbindClick} style={{border:'1px solid #ddd', background:'#fff', borderRadius:10, padding:'6px 10px', cursor:'pointer'}}>解除綁定</button>
              <button onClick={handleRefreshClick} style={{border:'1px solid #ddd', background:'#fff', borderRadius:10, padding:'6px 10px', cursor:'pointer'}}>刷新請求狀態</button>
            </div>
          </>
        ) : (
          <div className="meta" style={{marginTop:8}}>尚未綁定任何對象</div>
        )}
      </div>

      {/* 送出綁定（子女端動作） */}
      <div className="card" style={{padding:16}}>
        <b>向家長提出綁定</b>
        <form onSubmit={onSubmit} style={{display:'grid', gap:10, marginTop:8}}>
          <label className="field">
            <span className="label">家長 Email</span>
            <input
              value={parentEmail}
              onChange={e=>setParentEmail(e.target.value)}
              inputMode="email"
              placeholder="parent@example.com"
              aria-invalid={!!err}
            />
          </label>
          <label className="field">
            <span className="label">附註（選填）</span>
            <input
              value={note}
              onChange={e=>setNote(e.target.value)}
              placeholder="想關心您的日記～"
            />
          </label>
          {err && <div className="error">{err}</div>}
          <button className="btn-primary" disabled={sending} style={{alignSelf:'start'}}>
            {sending ? '送出中…' : '送出綁定請求'}
          </button>
          <div className="meta">
            送出後可將「同意連結」貼給家長：系統會自動複製
            <code style={{margin: '0 4px'}}>/link-child?rid=…</code>
            的審核連結。
          </div>
        </form>
      </div>

      {/* 我的請求清單 */}
      <div className="card" style={{padding:0}}>
        <div style={{padding:'12px 16px', borderBottom:'1px solid #eee', fontWeight:700}}>
          我的綁定請求
          <button onClick={handleRefreshClick} style={{marginLeft:8, border:'1px solid #eee', background:'#fff', borderRadius:8, padding:'2px 8px', fontSize:12, cursor:'pointer'}}>刷新</button>
          <button onClick={handleSyncBindingClick} style={{marginLeft:8, border:'1px solid #eee', background:'#fff', borderRadius:8, padding:'2px 8px', fontSize:12, cursor:'pointer'}}>同步綁定</button>
        </div>
        {myReqs.length === 0 ? (
          <div style={{padding:16, color:'#666'}}>尚未送出任何請求。</div>
        ) : (
          <div style={{display:'flex', flexDirection:'column'}}>
            {myReqs.map(r => (
              <div key={r.id} style={{display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid #eee'}}>
                <div style={{width:38, height:38, borderRadius:10, background:'#e9efff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>📩</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:14}}>{r.parentEmail}</div>
                  <div className="meta" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    申請於 {new Date(r.createdAt).toLocaleString()}
                    {r.note ? ` ・ 附註：${r.note}` : ''}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
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

function StatusBadge({ status }: { status: LinkRequest['status'] }){
  const map = {
    pending: { text:'待審核', bg:'#fff7e6', fg:'#ad6800', border:'#ffe7ba' },
    accepted:{ text:'已同意', bg:'#f6ffed', fg:'#237804', border:'#b7eb8f' },
    rejected:{ text:'已拒絕', bg:'#fff1f0', fg:'#a8071a', border:'#ffa39e' },
  } as const
  const s = map[status]
  return (
    <span style={{
      background:s.bg, color:s.fg, border:`1px solid ${s.border}`,
      padding:'4px 8px', borderRadius:999, fontSize:12, flex:'0 0 auto'
    }}>
      {s.text}
    </span>
  )
}
