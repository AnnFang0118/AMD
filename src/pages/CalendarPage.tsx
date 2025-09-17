import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'

dayjs.locale('zh-tw')

// ================= 可調整區（後端位址 / API 路徑） =================
const BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`
const API_MONTH_SUMMARY = '/diary/summary' // GET /diary/summary?month=YYYY-MM → { "2025-09-01": { count:2, hasAudio:true, ... } }

function buildMonthGrid(base: dayjs.Dayjs){
  const start = base.startOf('month').startOf('week')
  return Array.from({length:42}, (_,i)=>start.add(i,'day'))
}

type Rect = { top: number; left: number; width: number; height: number }

type DaySummary = {
  count?: number
  hasAudio?: boolean
  hasImage?: boolean
  hasVideo?: boolean
}
type MonthSummary = Record<string, DaySummary> // key: YYYY-MM-DD

const TOUR_KEY = 'tour_calendar_v1'
const MAX_TRIES = 10
const forceTour = typeof window !== 'undefined' && /(?:\?|&)tour=1(?:&|$)/.test(window.location.search)

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
function getRect(el: HTMLElement | null, pad = 10): Rect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: Math.max(8, r.top - pad), left: Math.max(8, r.left - pad), width: Math.min(window.innerWidth - 16, r.width + pad * 2), height: Math.min(window.innerHeight - 16, r.height + pad * 2) }
}
// 取得「手機畫面」容器邊界（優先 .screen，其次 .phone）
function getHostRect(anchor?: HTMLElement | null): DOMRect {
  const fromClosest = (anchor?.closest('.screen') as HTMLElement | null) || (anchor?.closest('.phone') as HTMLElement | null)
  const el = fromClosest || (document.querySelector('.phone .screen') as HTMLElement | null) || (document.querySelector('.phone') as HTMLElement | null)
  return (el || document.body).getBoundingClientRect()
}

export default function CalendarPage(){
  const [focus,setFocus]=useState(dayjs())
  const cells = useMemo(()=>buildMonthGrid(focus),[focus])
  const nav = useNavigate()

  // ====== 後端：月份摘要（不改你原本畫面） ======
  const [summary, setSummary] = useState<MonthSummary>({})
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const cacheRef = useRef<Record<string, MonthSummary>>({})

  function getAuthHeader(): Record<string, string> {
    try {
      const t = localStorage.getItem('token')
      return t ? { Authorization: `Bearer ${t}` } : {}
    } catch {
      return {}
    }
  }

  async function fetchMonthSummary(month: string){
    // 有快取就直接用，畫面維持原樣
    if (cacheRef.current[month]){ setSummary(cacheRef.current[month]); return }
    setLoading(true); setLoadErr(null)
    const ctrl = new AbortController(); const to = setTimeout(()=>ctrl.abort(), 10000)
    try{
      const res = await fetch(`${BASE_URL}${API_MONTH_SUMMARY}?month=${encodeURIComponent(month)}`, {
        headers: { Accept: 'application/json', ...getAuthHeader() } as HeadersInit,
        signal: ctrl.signal,
      })
      clearTimeout(to)
      let data: any = null; try{ data = await res.json() } catch{}
      if (!res.ok) throw new Error(data?.detail || data?.message || `讀取失敗（HTTP ${res.status}）`)
      const map: MonthSummary = {}
      if (data && typeof data === 'object'){
        for (const [k, v] of Object.entries<any>(data)){
          if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
            map[k] = {
              count: typeof v?.count === 'number' ? v.count : undefined,
              hasAudio: !!v?.hasAudio,
              hasImage: !!v?.hasImage,
              hasVideo: !!v?.hasVideo,
            }
          }
        }
      }
      cacheRef.current[month] = map
      setSummary(map)
    }catch(e:any){
      setLoadErr(e?.name==='AbortError' ? '連線逾時' : (e?.message || '讀取失敗'))
      setSummary({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchMonthSummary(focus.format('YYYY-MM')) }, [focus.year(), focus.month()])

  // ====== 聚光燈導覽 refs/states ======
  const headerRef = useRef<HTMLDivElement | null>(null)     // 頁面抬頭（日期/星期）
  const calHeaderRef = useRef<HTMLDivElement | null>(null)   // 月份切換列
  const calGridRef = useRef<HTMLDivElement | null>(null)     // 月曆格子
  const chipsRef = useRef<HTMLDivElement | null>(null)       // 下方快捷

  const [showTour, setShowTour] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const triesRef = useRef(0)

  const steps = [
    { title: '今天日期', desc: '這裡顯示目前聚焦的日期與星期。', getEl: () => headerRef.current, pad: 8 },
    { title: '切換月份', desc: '點左右箭頭切換月份，也可點中間月份快速辨識目前查看的月份。', getEl: () => calHeaderRef.current, pad: 10 },
    { title: '選擇日期', desc: '點任一天即可查看該日的語音日記與多媒體內容。', getEl: () => calGridRef.current, pad: 12 },
    { title: '更多功能', desc: '快速前往情緒可視化或互動小遊戲。', getEl: () => chipsRef.current, pad: 10 },
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

  // 量測 spotlight 位置：rAF + 最多重試 MAX_TRIES 次（避免初次渲染還沒拿到尺寸）
  const updateRect = () => {
    if (!showTour) return
    const s = steps[stepIndex]
    const doMeasure = () => {
      const r = getRect(s.getEl(), s.pad)
      if (r) {
        setRect(r)
        triesRef.current = 0
      } else if (triesRef.current < MAX_TRIES) {
        triesRef.current += 1
        requestAnimationFrame(doMeasure)
      }
    }
    requestAnimationFrame(doMeasure)
  }

  // 任何影響排版的變更都量一次
  useEffect(() => { updateRect() }, [showTour, stepIndex, focus]) // 切月也會改尺寸
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

  function next(){
    if (stepIndex < steps.length - 1) setStepIndex(i => i + 1)
    else finish()
  }
  function finish(skip = false){
    try {
      if (dontShowAgain || !skip) localStorage.setItem(TOUR_KEY, '1')
    } catch {}
    setShowTour(false)
    setStepIndex(0)
    setRect(null)
    triesRef.current = 0
  }

  // 提示卡：限制在「手機容器」內
  const tipLayout = (() => {
    if (!rect) return null
    const host = getHostRect(headerRef.current)
    const MARGIN = 12
    const EST_H = 190
    const GAP = 12
    const usableW = Math.max(240, host.width - MARGIN * 2)
    const width = Math.min(320, usableW)
    const below = rect.top + rect.height + GAP + EST_H < host.bottom - MARGIN
    const top = below
      ? clamp(rect.top + rect.height + GAP, host.top + MARGIN, host.bottom - EST_H - MARGIN)
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
    <div>
      {/* 頁面抬頭（和 Home 一樣的日期/星期） */}
      <div ref={headerRef} className="home-header" style={{marginBottom:10}}>
        <div className="date">{focus.format('YYYY年M月D日')}</div>
        <div className="weekday">{focus.format('dddd')}</div>
      </div>

      {/* 月曆卡片 */}
      <div className="calendar-card">
        <div ref={calHeaderRef} className="cal-header">
          <button onClick={()=>setFocus(focus.subtract(1,'month'))}>‹</button>
          <div>{focus.format('YYYY年M月')}</div>
          <button onClick={()=>setFocus(focus.add(1,'month'))}>›</button>
        </div>

        {/* 後端錯誤（中文提示、可重試） */}
        {loadErr && (
          <div className="inline-alert" role="alert" style={{marginTop:8}}>
            <div className="inline-alert-text">{loadErr}</div>
            <button
              className="inline-alert-close"
              aria-label="重試"
              onClick={()=>fetchMonthSummary(focus.format('YYYY-MM'))}
            >↻</button>
          </div>
        )}

        <div className="cal-week">
          {'週日 週一 週二 週三 週四 週五 週六'.split(' ').map(w=><div key={w} style={{textAlign:'center'}}>{w}</div>)}
        </div>
        <div ref={calGridRef} className={`cal-grid ${loading ? 'loading' : ''}`} aria-busy={loading}>
          {cells.map(d=>{
            const inMonth = d.month()===focus.month()
            const isToday = d.isSame(dayjs(), 'day')
            const key = d.format('YYYY-MM-DD')
            const hasAny = !!summary[key] && (summary[key].count || summary[key].hasAudio || summary[key].hasImage || summary[key].hasVideo)
            return (
              <div
                key={key}
                className={`cal-cell ${inMonth?'':'out'} ${isToday?'today':''} ${hasAny?'has':''}`}
                onClick={() => nav(`/diary1/${key}`)}
                title={`查看 ${d.format('YYYY/MM/DD')} 的日記`}
              >
                {d.date()}
              </div>
            )
          })}
        </div>
      </div>

      {/* 兩顆捷徑按鈕 */}
      <div ref={chipsRef} className="chips">
        <button className="chip" onClick={()=>nav('/stats')}>📊 情緒可視化</button>
        <button className="chip alt" onClick={()=>nav('/game')}>🎮 互動小遊戲</button>
      </div>

      {/* ===== 聚光燈導覽（Portal 到 body） ===== */}
      {showTour && rect && spotlight && tipLayout && createPortal(
        <>
          {/* 圓形聚光燈 */}
          <div
            aria-hidden
            style={{
              position:'fixed',
              top: spotlight.cy - spotlight.radius,
              left: spotlight.cx - spotlight.radius,
              width: spotlight.radius * 2,
              height: spotlight.radius * 2,
              borderRadius: '50%',
              boxShadow: '0 0 0 9999px rgba(0,0,0,.55)',
              transition: 'all .25s',
              zIndex: 2147483646,
              pointerEvents: 'none'
            }}
          />
          <div
            aria-hidden
            style={{
              position:'fixed',
              top: spotlight.cy - spotlight.radius,
              left: spotlight.cx - spotlight.radius,
              width: spotlight.radius * 2,
              height: spotlight.radius * 2,
              borderRadius: '50%',
              outline: '2px solid rgba(108,99,255,.85)',
              transition: 'all .25s',
              zIndex: 2147483647,
              pointerEvents: 'none'
            }}
          />

          {/* 提示卡（限制在手機容器內） */}
          <div
            style={{
              position:'fixed',
              top: tipLayout.top,
              left: tipLayout.left,
              width: tipLayout.width,
              maxWidth: tipLayout.width,
              maxHeight: tipLayout.maxHeight,
              overflowY: 'auto',
              background:'#fff',
              color:'#111',
              borderRadius:12,
              boxShadow:'0 12px 36px rgba(0,0,0,.25)',
              padding:'12px 14px',
              zIndex:2147483647,
              wordBreak:'break-word'
            }}
          >
            <div style={{fontWeight:700, fontSize:16, marginBottom:6}}>
              {steps[stepIndex].title}
            </div>
            <div style={{fontSize:14, lineHeight:1.6, opacity:.9}}>
              {steps[stepIndex].desc}
            </div>

            <label style={{display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:13}}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
              />
              <span>下次不再顯示</span>
            </label>

            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:10}}>
              <button
                onClick={() => finish(true)}
                style={{border:'1px solid #ddd', background:'#fff', borderRadius:10, padding:'6px 10px', cursor:'pointer'}}
              >
                跳過
              </button>
              <button
                onClick={next}
                style={{border:0, background:'var(--login-btn-bg, #6C63FF)', color:'#fff',
                        borderRadius:10, padding:'6px 12px', cursor:'pointer', fontWeight:600}}
              >
                {stepIndex < steps.length - 1 ? '下一步' : '完成'}
              </button>
            </div>
            <div style={{fontSize:12, opacity:.65, marginTop:6}}>
              提示：Enter/空白鍵/→ 前進，Esc 關閉
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}


