import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

dayjs.locale('zh-tw')

type Rect = { top: number; left: number; width: number; height: number }
const TOUR_KEY = 'tour_home_v3' // 升級 key，避免被舊紀錄擋住
const MAX_TRIES = 10

const forceTour = typeof window !== 'undefined' && /(?:\?|&)tour=1(?:&|$)/.test(window.location.search)

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
// 以 .screen 或 .phone 當作手機畫面邊界
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

export default function Home(){
  const today = useMemo(()=>dayjs(),[])
  const [recording, setRecording] = useState(false)

  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [videoFileName, setVideoFileName] = useState<string | null>(null)

  const imgInputRef = useRef<HTMLInputElement>(null)
  const vidInputRef = useRef<HTMLInputElement>(null)

  // ====== 聚光燈教學 ======
  const headerRef = useRef<HTMLDivElement | null>(null)
  const micBtnRef = useRef<HTMLButtonElement | null>(null)
  const toolsRef = useRef<HTMLDivElement | null>(null)

  const [showTour, setShowTour] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const triesRef = useRef(0)

  const steps = [
    { title: '今天的日期', desc: '在這裡快速確認今天日期與星期。', getEl: () => headerRef.current, pad: 8 },
    { title: '開始錄音', desc: '點一下麥克風開始語音日記；再次點擊即可結束並儲存。', getEl: () => micBtnRef.current, pad: 14 },
    { title: '加照片/影片', desc: '錄音時可在右上角加入照片或影片，讓紀錄更完整。', getEl: () => toolsRef.current, pad: 10 },
  ]

  // 首次自動開啟（或用 ?tour=1 強制）
  useLayoutEffect(() => {
    if (forceTour) { setShowTour(true); return }
    try {
      const seen = localStorage.getItem(TOUR_KEY)
      if (!seen) setShowTour(true)
    } catch {
      setShowTour(true)
    }
  }, [])

  // 第 3 步需要看到工具列 => 自動開啟錄音
  useEffect(() => {
    if (!showTour) return
    if (stepIndex === 2 && !recording) setRecording(true)
  }, [showTour, stepIndex, recording])

  // 穩定取得 spotlight 位置：用 rAF + 最多 10 次重試
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

  // 任何會影響排版的變化都重新量一次
  useEffect(() => { updateRect() }, [showTour, stepIndex])
  useEffect(() => { if (showTour) updateRect() }, [recording])
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

  // ===== UI 控制 =====
  function toggleMic(){ setRecording(v => !v) }
  function onPickImage(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return
    setImageFileName(f.name)
  }
  function onPickVideo(e: React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0]; if(!f) return
    setVideoFileName(f.name)
  }

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
    <div className="center" style={{flexDirection:'column', gap:12}}>
      {/* 日期與星期 */}
      <div ref={headerRef} className="home-header">
        <div className="date">{today.format('YYYY年M月D日')}</div>
        <div className="weekday">{today.format('dddd')}</div>
      </div>

      {/* 麥克風按鈕 */}
      <div className="mic-wrap">
        <button
          ref={micBtnRef}
          className={`mic-btn ${recording ? 'recording' : ''}`}
          onClick={toggleMic}
          aria-label="record"
          title="開始/結束錄音"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21H9v2h6v-2h-2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
        </button>
        <div className="mic-label">紀錄日記{recording ? '（錄音中）' : ''}</div>
      </div>

      {/* 錄音時顯示的對話卡，右上角有影片/照片上傳 */}
      {recording && (
        <div className="chat-card">
          <div className="row">
            <div className="chat-avatar">🗣️</div>

            <div className="chat-bubble">
              <div className="bubble-head">
                <div className="chat-title">今天天氣如何？</div>
                <div ref={toolsRef} className="chat-tools">
                  <button className="tool-btn" title="上傳影片" onClick={()=>vidInputRef.current?.click()}>🎬</button>
                  <button className="tool-btn" title="上傳照片" onClick={()=>imgInputRef.current?.click()}>🖼️</button>
                </div>
              </div>

              <div className="chat-text">XXXXXXXXXXXXXX</div>

              {(videoFileName || imageFileName) && (
                <div className="selected-note">
                  {videoFileName && <>影片：{videoFileName}　</>}
                  {imageFileName && <>照片：{imageFileName}</>}
                </div>
              )}
            </div>
          </div>

          {/* 隱藏 input（點右上工具會觸發） */}
          <input
            ref={imgInputRef}
            type="file"
            accept="image/*"
            style={{display:'none'}}
            onChange={onPickImage}
          />
          <input
            ref={vidInputRef}
            type="file"
            accept="video/*"
            style={{display:'none'}}
            onChange={onPickVideo}
          />
        </div>
      )}

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

