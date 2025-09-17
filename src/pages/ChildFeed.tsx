// src/pages/ChildFeed.tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'

dayjs.locale('zh-tw')

// ====== 可調整：你的後端位址 & API 路徑 ======
const BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`

/**
 * 預期端點（任選其一；程式會自動容錯）：
 * 1) GET /child/feed?limit=20
 * 2) GET /feed?limit=20
 * 回傳格式可以是：
 *   - { items: [...] } 或 { data: [...] } 或直接是陣列 [...]
 * 每筆 item 可接受欄位：
 *   - date / day / created_at（能被 dayjs 解析或已是 YYYY-MM-DD）
 *   - title（可選）
 *   - summary / text / content（摘要）
 *   - mood: 'good' | 'ok' | 'bad'（可選）
 *   - images / videos / audio / hasImage / hasVideo / hasAudio（可選）
 *   - link（若有直接用；否則以 /child/diary2/:date 建）
 */
const API_CHILD_FEED = '/child/feed'
const API_FALLBACK_FEED = '/feed'
const DEFAULT_LIMIT = 20

// ====== 型別 ======
type FeedItem = {
  date: string          // YYYY-MM-DD
  title: string
  summary: string
  mood?: 'good' | 'ok' | 'bad'
  hasImage?: boolean
  hasVideo?: boolean
  hasAudio?: boolean
  link?: string
}

// ====== 工具：Spotlight 用 ======
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

// ====== 後端存取（內嵌在本檔） ======
function buildHeaders(): Headers {
  const h = new Headers({ Accept: 'application/json' })
  try {
    const t = localStorage.getItem('token')
    if (t) h.set('Authorization', `Bearer ${t}`)
  } catch {}
  return h
}
async function fetchJSON(url: string, signal?: AbortSignal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, {
      headers: buildHeaders(),
      signal: signal ?? ctrl.signal,
      credentials: 'include', // 若用 cookie-session
    })
    let data: any = null; try { data = await res.json() } catch {}
    if (!res.ok) {
      const msg = data?.detail || data?.message || `HTTP ${res.status}`
      const err: any = new Error(msg); err.status = res.status; throw err
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}
function toDateYYYYMMDD(v: any): string | null {
  if (!v) return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = dayjs(v)
  return d.isValid() ? d.format('YYYY-MM-DD') : null
}
function normalizeFeed(data: any): FeedItem[] {
  const rawArr: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data)
        ? data.data
        : []

  const items: FeedItem[] = rawArr.map((r) => {
    const date =
      toDateYYYYMMDD(r?.date) ??
      toDateYYYYMMDD(r?.day) ??
      toDateYYYYMMDD(r?.created_at) ??
      ''

    const text = (r?.summary ?? r?.text ?? r?.content ?? '').toString()
    const title = (r?.title ?? (date ? dayjs(date).format('YYYY年M月D號') : '日記摘要')).toString()
    const summary = text.length > 140 ? text.slice(0, 140) + '…' : text

    const hasImage = !!r?.hasImage || Array.isArray(r?.images)
    const hasVideo = !!r?.hasVideo || Array.isArray(r?.videos)
    const hasAudio = !!r?.hasAudio || !!r?.audio

    const mood = ['good','ok','bad'].includes(r?.mood) ? (r.mood as 'good'|'ok'|'bad') : undefined
    const link =
      typeof r?.link === 'string' ? r.link :
      date ? `/child/diary2/${date}` : undefined

    return { date, title, summary, mood, hasImage, hasVideo, hasAudio, link }
  }).filter(it => !!it.date)

  // 依日期新到舊
  items.sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return items
}

async function fetchChildFeed(limit = DEFAULT_LIMIT, signal?: AbortSignal): Promise<FeedItem[]> {
  // 1) 先試 /child/feed
  try {
    const d1 = await fetchJSON(`${BASE_URL}${API_CHILD_FEED}?limit=${limit}`, signal)
    const items = normalizeFeed(d1)
    if (items.length) return items
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 2) 退回 /feed
  const d2 = await fetchJSON(`${BASE_URL}${API_FALLBACK_FEED}?limit=${limit}`, signal)
  return normalizeFeed(d2)
}

// ====== 元件 ======
export default function ChildFeed(){
  // 原本內容 refs
  const headerRef = useRef<HTMLDivElement | null>(null)
  const firstCardRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // 資料狀態
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // Spotlight 狀態
  const [showTour, setShowTour] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const triesRef = useRef(0)

  const getFirstCard = () =>
    (listRef.current?.querySelector('.skeleton-card, .topic-card') as HTMLElement | null) ||
    firstCardRef.current

  const steps = [
    { title: '今日摘要', desc: '這裡會顯示目前日期與星期，方便你確認資料時間。', getEl: () => headerRef.current, pad: 8 },
    { title: '話題整理', desc: '每張卡片是系統從日記中整理的主題與情緒摘要。', getEl: getFirstCard, pad: 12 },
    { title: '查看更多', desc: '向下滑動瀏覽更多卡片，點擊可進入對應日記。', getEl: getFirstCard, pad: 12 },
  ]

  // 讀取資料
  useEffect(() => {
    const ac = new AbortController()
    setLoading(true); setErr(null); setItems([])
    fetchChildFeed(DEFAULT_LIMIT, ac.signal)
      .then(setItems)
      .catch((e:any) => setErr(e?.message || '讀取失敗'))
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  // Spotlight：首次自動開啟（或 ?tour=1 強制）
  useLayoutEffect(() => {
    if (forceTour) { setShowTour(true); return }
    try {
      const seen = localStorage.getItem(TOUR_KEY)
      if (!seen) setShowTour(true)
    } catch {
      setShowTour(true)
    }
  }, [])

  // Spotlight：量測位置（rAF + 重試）
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
  // 當資料載入完，第一張卡片才會出現 → 也要量一次
  useEffect(() => { if (showTour) updateRect() }, [items.length])

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

  // Spotlight：鍵盤導覽
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
    try { if (dontShowAgain || !skip) localStorage.setItem(TOUR_KEY, '1') } catch {}
    setShowTour(false); setStepIndex(0); setRect(null); triesRef.current = 0
  }

  const tipLayout = (() => {
    if (!rect) return null
    const host = getHostRect(headerRef.current)
    const MARGIN = 12, EST_H = 180, GAP = 12
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

  const spotlight = (() => {
    if (!rect) return null
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const baseR = Math.sqrt((rect.width/2)**2 + (rect.height/2)**2)
    const radius = Math.ceil(baseR + 12)
    return { cx, cy, radius }
  })()

  const today = dayjs()

  return (
    <div>
      <div ref={headerRef} className="home-header">
        <div className="date">{today.format('YYYY年M月D日')}</div>
        <div className="weekday">{today.format('dddd')}</div>
      </div>

      {/* 錯誤提示（可重試） */}
      {err && (
        <div className="inline-alert" role="alert" style={{marginBottom:10}}>
          <div className="inline-alert-text">{err}</div>
          <button
            className="inline-alert-close"
            aria-label="重試"
            onClick={() => {
              setErr(null); setLoading(true)
              const ac = new AbortController()
              fetchChildFeed(DEFAULT_LIMIT, ac.signal)
                .then(setItems)
                .catch((e:any)=>setErr(e?.message || '讀取失敗'))
                .finally(()=>setLoading(false))
            }}
          >↻</button>
        </div>
      )}

      {/* 卡片列表容器（讓 Spotlight 能抓到第一張） */}
      <div ref={listRef}>
        {/* Loading：骨架卡 */}
        {loading && (
          <>
            <div ref={firstCardRef} className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" style={{height:60}} />
          </>
        )}

        {/* 沒資料 */}
        {!loading && !err && items.length === 0 && (
          <div className="card" style={{opacity:.85}}>目前沒有可顯示的內容</div>
        )}

        {/* 真正的資料卡 */}
        {!loading && !err && items.map((it, idx) => (
          <a
            key={`${it.date}-${idx}`}
            href={it.link ?? `/child/diary2/${it.date}`}
            className="topic-card"
            title={`查看 ${it.date} 的日記`}
            style={{ display:'block', textDecoration:'none' }}
          >
            <div className="topic-title" style={{ fontWeight:700 }}>
              {it.title}
            </div>
            <div className="topic-meta" style={{ fontSize:12, opacity:.7, margin:'4px 0 6px' }}>
              {dayjs(it.date).format('YYYY/MM/DD')}
              {it.mood && <>　•　{it.mood === 'good' ? '好心情' : it.mood === 'ok' ? '普通' : '較低落'}</>}
              {(it.hasAudio || it.hasImage || it.hasVideo) && (
                <>
                  {'　•　'}
                  {[
                    it.hasAudio ? '語音' : null,
                    it.hasImage ? '照片' : null,
                    it.hasVideo ? '影片' : null
                  ].filter(Boolean).join(' / ')}
                </>
              )}
            </div>
            <div className="topic-summary" style={{ color:'inherit', opacity:.95 }}>
              {it.summary}
            </div>
          </a>
        ))}
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
              {['今日摘要','話題整理','查看更多'][stepIndex]}
            </div>
            <div style={{fontSize:14, lineHeight:1.6, opacity:.9}}>
              {[
                '這裡會顯示目前日期與星期，方便你確認資料時間。',
                '每張卡片是系統從日記中整理的主題與情緒摘要。',
                '向下滑動瀏覽更多卡片，點擊可進入對應日記。'
              ][stepIndex]}
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
                {stepIndex < 2 ? '下一步' : '完成'}
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
