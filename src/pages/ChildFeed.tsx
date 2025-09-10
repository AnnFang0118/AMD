// src/pages/ChildFeed.tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Rect = { top: number; left: number; width: number; height: number }

const TOUR_KEY = 'tour_child_feed_v1'
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
// 取得「手機畫面」容器邊界（優先 .screen，其次 .phone，再退回 body）
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

export default function ChildFeed(){
  // ======== 原本內容 refs ========
  const headerRef = useRef<HTMLDivElement | null>(null)
  const firstCardRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // ======== Spotlight 狀態 ========
  const [showTour, setShowTour] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const triesRef = useRef(0)

  // 找到第一張卡片（skeleton 或之後換真卡片都能抓到）
  const getFirstCard = () =>
    (listRef.current?.querySelector('.skeleton-card, .topic-card') as HTMLElement | null) ||
    firstCardRef.current

  const steps = [
    { title: '今日摘要', desc: '這裡會顯示目前日期與星期，方便你確認資料時間。', getEl: () => headerRef.current, pad: 8 },
    { title: '話題整理', desc: '每張卡片是系統從日記中整理的主題與情緒摘要。', getEl: getFirstCard, pad: 12 },
    { title: '查看更多', desc: '向下滑動瀏覽更多卡片，點擊可進入對應日記。', getEl: getFirstCard, pad: 12 },
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

  useEffect(() => { updateRect() }, [showTour, stepIndex])
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
    const EST_H = 180
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
      <div ref={headerRef} className="home-header">
        <div className="date">2025年1月1日</div>
        <div className="weekday">星期一</div>
      </div>

      {/* 卡片列表容器，用來抓第一張卡片的座標 */}
      <div ref={listRef}>
        <div ref={firstCardRef} className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" style={{height:60}} />
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
