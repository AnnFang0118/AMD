// src/pages/ChildCalendarPage.tsx
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'

dayjs.locale('zh-tw')

function buildMonthGrid(base: dayjs.Dayjs){
  const start = base.startOf('month').startOf('week')
  return Array.from({length:42}, (_,i)=>start.add(i,'day'))
}

// ===== Spotlight 導覽工具 =====
type Rect = { top: number; left: number; width: number; height: number }
const TOUR_KEY = 'tour_calendar_child_v1'
const MAX_TRIES = 10
const forceTour =
  typeof window !== 'undefined' && /(?:\?|&)tour=1(?:&|$)/.test(window.location.search)

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
function getRect(el: HTMLElement | null, pad = 10): Rect | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    top: Math.max(8, r.top - pad),
    left: Math.max(8, r.left - pad),
    width: Math.min(window.innerWidth - 16, r.width + pad * 2),
    height: Math.min(window.innerHeight - 16, r.height + pad * 2),
  }
}
// 取得手機畫面邊界（優先 .screen，其次 .phone，再退回 body）
function getHostRect(anchor?: HTMLElement | null): DOMRect {
  const fromClosest =
    (anchor?.closest('.screen') as HTMLElement | null) ||
    (anchor?.closest('.phone') as HTMLElement | null)
  const el =
    fromClosest ||
    (document.querySelector('.phone .screen') as HTMLElement | null) ||
    (document.querySelector('.phone') as HTMLElement | null)
  return (el || document.body).getBoundingClientRect()
}

export default function CalendarPage(){
  const [focus,setFocus]=useState(dayjs())
  const cells = useMemo(()=>buildMonthGrid(focus),[focus])
  const nav = useNavigate()

  // ===== Spotlight 導覽 refs/states =====
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
    { title: '目前日期', desc: '這裡顯示目前聚焦的日期與星期。', getEl: () => headerRef.current, pad: 8 },
    { title: '切換月份', desc: '用左右箭頭切換月份，中間顯示當前月份。', getEl: () => calHeaderRef.current, pad: 10 },
    { title: '選擇日期', desc: '點任一天即可查看該日的日記。', getEl: () => calGridRef.current, pad: 12 },
    { title: '更多分析', desc: '快速前往情緒可視化頁面。', getEl: () => chipsRef.current, pad: 10 },
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

  // 量測 spotlight 位置：rAF + 重試，避免初次渲染尚未取得尺寸
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

  // 任何會影響版面的變化都重算（切月也會變）
  useEffect(() => { updateRect() }, [showTour, stepIndex, focus])
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

  // 提示卡限制在「手機容器」內
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
        <div className="cal-week">
          {'週日 週一 週二 週三 週四 週五 週六'.split(' ').map(w=><div key={w} style={{textAlign:'center'}}>{w}</div>)}
        </div>
        <div ref={calGridRef} className="cal-grid">
          {cells.map(d=>{
            const inMonth = d.month()===focus.month()
            const isToday = d.isSame(dayjs(), 'day')
            return (
              <div
                key={d.format('YYYY-MM-DD')}
                className={`cal-cell ${inMonth?'':'out'} ${isToday?'today':''}`}
                onClick={() => nav(`/child/diary2/${d.format('YYYY-MM-DD')}`)}
                title={`查看 ${d.format('YYYY/MM/DD')} 的日記`}
              >
                {d.date()}
              </div>
            )
          })}
        </div>
      </div>

      {/* 捷徑按鈕 */}
      <div ref={chipsRef} className="chips">
        <button className="chip" onClick={()=>nav('/stats')}>📊 情緒可視化</button>
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
