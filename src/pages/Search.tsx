import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'

type Item = {
  date: string      // YYYY-MM-DD
  title: string
  text: string
  hasImage?: boolean
  hasVideo?: boolean
}

// ================= 可調整區（後端位址 / API 路徑） =================
const BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`
const API_SEARCH = '/diary/search'   // 例如：GET /diary/search?q=keyword  → Item[] 或 { items: Item[] }
const API_RECENT = '/diary/recent'   // 例如：GET /diary/recent           → Item[] 或 { items: Item[] }

const RECENT_KEY = 'voice-diary.recent-searches'

// ===== Spotlight 導覽相關 =====
type Rect = { top: number; left: number; width: number; height: number }
const TOUR_KEY = 'tour_search_v1'
const MAX_TRIES = 10
const forceTour =
  typeof window !== 'undefined' && /(?:\?|&)tour=1(?:&|$)/.test(window.location.search)

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
function getRect(el: HTMLElement | null, pad = 10): Rect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: Math.max(8, r.top - pad), left: Math.max(8, r.left - pad), width: Math.min(window.innerWidth - 16, r.width + pad * 2), height: Math.min(window.innerHeight - 16, r.height + pad * 2) }
}
// 取得「手機畫面」容器邊界（優先 .screen，其次 .phone，再不行用整個視窗）
function getHostRect(anchor?: HTMLElement | null): DOMRect {
  const fromClosest = (anchor?.closest('.screen') as HTMLElement | null) || (anchor?.closest('.phone') as HTMLElement | null)
  const el = fromClosest || (document.querySelector('.phone .screen') as HTMLElement | null) || (document.querySelector('.phone') as HTMLElement | null)
  return (el || document.body).getBoundingClientRect()
}

function getAuthHeader(): Record<string, string> {
  try { const t = localStorage.getItem('token'); return t ? { Authorization: `Bearer ${t}` } : {} } catch { return {} }
}

async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...getAuthHeader() } as HeadersInit, signal: signal || ctrl.signal })
    let data: any = null; try { data = await res.json() } catch {}
    if (!res.ok) throw new Error(data?.detail || data?.message || `讀取失敗（HTTP ${res.status}）`)
    return (data as T)
  } finally {
    clearTimeout(timeout)
  }
}

function normalizeItems(raw: any): Item[] {
  const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : [])
  const items: Item[] = []
  for (const v of arr){
    // 盡量容錯：後端欄位不同也能映射
    const date = (v?.date || v?.day || v?.created_at || v?.createdAt || '').toString().slice(0,10)
    if (!/\d{4}-\d{2}-\d{2}/.test(date)) continue
    const title = (v?.title || `${date} 的日記`).toString()
    const text = (v?.text || v?.content || v?.summary || '').toString()
    items.push({
      date,
      title,
      text,
      hasImage: !!(v?.hasImage ?? v?.images?.length),
      hasVideo: !!(v?.hasVideo ?? v?.videos?.length),
    })
  }
  return items
}

export default function SearchPage() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const timerRef = useRef<number | null>(null)

  const [results, setResults] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // 讀取最近搜尋（可選）
  useEffect(() => {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return
    try {
      const arr = JSON.parse(raw) as string[]
      if (arr?.[0]) setQ(arr[0])
    } catch {}
  }, [])

  // debounce
  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setDebouncedQ(q.trim()), 250)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [q])

  // 查詢 or 讀取最近
  useEffect(() => {
    let stop = false
    async function run(){
      setErr(null); setLoading(true)
      try {
        const url = `${BASE_URL}${debouncedQ ? `${API_SEARCH}?q=${encodeURIComponent(debouncedQ)}` : API_RECENT}`
        const raw = await fetchJSON<any>(url)
        const items = normalizeItems(raw)
        if (!stop) setResults(items)
        // 記錄最近搜尋字詞
        if (debouncedQ){
          try {
            const raw = localStorage.getItem(RECENT_KEY)
            const arr = raw ? (JSON.parse(raw) as string[]) : []
            const next = [debouncedQ, ...arr.filter(s => s !== debouncedQ)].slice(0, 10)
            localStorage.setItem(RECENT_KEY, JSON.stringify(next))
          } catch {}
        }
      } catch(e:any) {
        if (!stop) { setErr(e?.message || '讀取失敗'); setResults([]) }
      } finally { if (!stop) setLoading(false) }
    }
    void run()
    return () => { stop = true }
  }, [debouncedQ])

  function openDiary(date: string) { nav(`/diary1/${date}`) }

  // ===== Spotlight：refs & 狀態 =====
  const barRef = useRef<HTMLDivElement | null>(null)       // 搜尋列容器
  const micRef = useRef<HTMLButtonElement | null>(null)    // 右側語音按鈕
  const listRef = useRef<HTMLDivElement | null>(null)      // 結果列表容器

  const [showTour, setShowTour] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const triesRef = useRef(0)

  // 找到第一筆結果的元素（如果沒有，退回搜尋列）
  const getFirstItemEl = () =>
    (listRef.current?.querySelector('.search-item') as HTMLElement | null) || barRef.current

  const steps = [
    { title: '關鍵字搜尋', desc: '在這裡輸入關鍵字即可即時過濾日記。', getEl: () => barRef.current, pad: 8 },
    { title: '語音搜尋', desc: '點擊麥克風即可用語音輸入。', getEl: () => micRef.current, pad: 10 },
    { title: '查看結果', desc: '點第一筆結果即可打開該日的日記詳情。', getEl: getFirstItemEl, pad: 10 },
  ]

  // 首次自動開啟（或 ?tour=1 強制）
  useLayoutEffect(() => {
    if (forceTour) { setShowTour(true); return }
    try {
      const seen = localStorage.getItem(TOUR_KEY)
      if (!seen) setShowTour(true)
    } catch {
      setShowTour(true)
    }
  }, [])

  // 量測 spotlight 位置：rAF + 重試（避免初次渲染拿不到尺寸）
  const updateRect = () => {
    if (!showTour) return
    const s = steps[stepIndex]
    const doMeasure = () => {
      const r = getRect(s.getEl(), s.pad)
      if (r) { setRect(r); triesRef.current = 0 }
      else if (triesRef.current < MAX_TRIES) { triesRef.current += 1; requestAnimationFrame(doMeasure) }
    }
    requestAnimationFrame(doMeasure)
  }

  // 任何會影響排版/內容的變化都重新量一次
  useEffect(() => { updateRect() }, [showTour, stepIndex])
  useEffect(() => { if (showTour) updateRect() }, [debouncedQ, results.length])

  useEffect(() => {
    if (!showTour) return
    const onResize = () => updateRect()
    const onScroll = () => updateRect()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive:true })
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [showTour])

  // 鍵盤導覽
  useEffect(() => {
    if (!showTour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(true)
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showTour, stepIndex])

  function next(){ if (stepIndex < steps.length - 1) setStepIndex(i => i + 1); else finish() }
  function finish(skip = false){ try { if (dontShowAgain || !skip) localStorage.setItem(TOUR_KEY, '1') } catch {} setShowTour(false); setStepIndex(0); setRect(null); triesRef.current = 0 }

  // 提示卡：限制在「手機容器」內
  const tipLayout = (() => {
    if (!rect) return null
    const host = getHostRect(barRef.current)
    const MARGIN = 12, EST_H = 190, GAP = 12
    const usableW = Math.max(240, host.width - MARGIN * 2)
    const width = Math.min(320, usableW)
    const below = rect.top + rect.height + GAP + EST_H < host.bottom - MARGIN
    const top = below ? clamp(rect.top + rect.height + GAP, host.top + MARGIN, host.bottom - EST_H - MARGIN)
                      : clamp(rect.top - (EST_H + GAP),      host.top + MARGIN, host.bottom - EST_H - MARGIN)
    const left = clamp(rect.left, host.left + MARGIN, host.right - width - MARGIN)
    const maxHeight = Math.max(140, host.height - MARGIN * 2)
    return { top, left, width, maxHeight }
  })()

  // 圓形聚光燈
  const spotlight = (() => {
    if (!rect) return null
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const baseR = Math.sqrt((rect.width/2)**2 + (rect.height/2)**2)
    const radius = Math.ceil(baseR + 12)
    return { cx, cy, radius }
  })()

  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      {/* 搜尋列（圓角 + 右側麥克風） */}
      <div ref={barRef} className="search-bar">
        <input
          className="search-input"
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="搜尋日記"
        />
        <button
          ref={micRef}
          type="button"
          className="mic-btn-small"
          title="語音搜尋"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor"
              d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21H9v2h6v-2h-2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
        </button>
      </div>

      {/* 錯誤提示（可重試） */}
      {err && (
        <div className="inline-alert" role="alert">
          <div className="inline-alert-text">{err}</div>
          <button
            className="inline-alert-close"
            aria-label="重試"
            onClick={() => setDebouncedQ(q.trim())}
          >↻</button>
        </div>
      )}

      {/* 結果列表 */}
      <div ref={listRef} className={`search-list ${loading ? 'loading' : ''}`} aria-busy={loading}>
        {(!loading && results.length === 0) && (
          <div className="search-empty">沒有符合的日記</div>
        )}
        {results.map(it => (
          <button
            key={it.date}
            className="search-item"
            onClick={() => openDiary(it.date)}
            title={`開啟 ${it.date} 的日記`}
          >
            <div className="item-title">{it.title}</div>
            <div className="item-text">{it.text}</div>
          </button>
        ))}
      </div>

      {/* ===== 聚光燈導覽（Portal 到 body） ===== */}
      {showTour && rect && spotlight && tipLayout && createPortal(
        <>
          {/* 圓形聚光燈 */}
          <div aria-hidden style={{ position:'fixed', top: spotlight.cy - spotlight.radius, left: spotlight.cx - spotlight.radius, width: spotlight.radius * 2, height: spotlight.radius * 2, borderRadius: '50%', boxShadow: '0 0 0 9999px rgba(0,0,0,.55)', transition: 'all .25s', zIndex: 2147483646, pointerEvents: 'none' }} />
          <div aria-hidden style={{ position:'fixed', top: spotlight.cy - spotlight.radius, left: spotlight.cx - spotlight.radius, width: spotlight.radius * 2, height: spotlight.radius * 2, borderRadius: '50%', outline: '2px solid rgba(108,99,255,.85)', transition: 'all .25s', zIndex: 2147483647, pointerEvents: 'none' }} />

          {/* 提示卡（限制在手機容器內） */}
          <div style={{ position:'fixed', top: tipLayout.top, left: tipLayout.left, width: tipLayout.width, maxWidth: tipLayout.width, maxHeight: tipLayout.maxHeight, overflowY: 'auto', background:'#fff', color:'#111', borderRadius:12, boxShadow:'0 12px 36px rgba(0,0,0,.25)', padding:'12px 14px', zIndex:2147483647, wordBreak:'break-word' }}>
            <div style={{fontWeight:700, fontSize:16, marginBottom:6}}>{steps[stepIndex].title}</div>
            <div style={{fontSize:14, lineHeight:1.6, opacity:.9}}>{steps[stepIndex].desc}</div>
            <label style={{display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:13}}>
              <input type="checkbox" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} />
              <span>下次不再顯示</span>
            </label>
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:10}}>
              <button onClick={() => finish(true)} style={{border:'1px solid #ddd', background:'#fff', borderRadius:10, padding:'6px 10px', cursor:'pointer'}}>跳過</button>
              <button onClick={() => { if (stepIndex < steps.length - 1) setStepIndex(i => i + 1); else finish() }} style={{border:0, background:'var(--login-btn-bg, #6C63FF)', color:'#fff', borderRadius:10, padding:'6px 12px', cursor:'pointer', fontWeight:600}}>{stepIndex < steps.length - 1 ? '下一步' : '完成'}</button>
            </div>
            <div style={{fontSize:12, opacity:.65, marginTop:6}}>提示：Enter/空白鍵/→ 前進，Esc 關閉</div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}