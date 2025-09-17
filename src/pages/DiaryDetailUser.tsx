// src/pages/DiaryDetailUser.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'

dayjs.locale('zh-tw')

// ========= 可調整：你的後端主機 =========
const BASE_URL =
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`

// ========= 型別 =========
type Diary = {
  date: string
  text: string
  audioUrl?: string
  images?: string[]
  videos?: string[]
  mood?: 'good' | 'ok' | 'bad'
  tags?: string[]
}

// ========= 小工具（都內嵌在本檔） =========
function getHeaders(): Headers {
  const h = new Headers({ Accept: 'application/json' })
  try {
    const t = localStorage.getItem('token')
    if (t) h.set('Authorization', `Bearer ${t}`)
  } catch {}
  return h
}

function toAbs(u?: string | null): string | undefined {
  if (!u) return undefined
  if (/^https?:/i.test(u)) return u
  if (u.startsWith('//')) return `${window.location.protocol}${u}`
  if (u.startsWith('/')) return `${BASE_URL}${u}`
  return u
}

function normalizeDiary(raw: any, date: string): Diary {
  const text = (raw?.text ?? raw?.content ?? raw?.transcript ?? '').toString()
  const audioUrl = toAbs(raw?.audioUrl ?? raw?.audio_url ?? raw?.audio?.url ?? raw?.audio)

  let images: string[] = []
  let videos: string[] = []
  const imgRaw = raw?.images ?? raw?.image_urls ?? raw?.media?.images
  const vidRaw = raw?.videos ?? raw?.video_urls ?? raw?.media?.videos
  if (Array.isArray(imgRaw)) images = imgRaw.map((x: any) => toAbs(x?.url ?? x)!).filter(Boolean) as string[]
  if (Array.isArray(vidRaw)) videos = vidRaw.map((x: any) => toAbs(x?.url ?? x)!).filter(Boolean) as string[]

  const mood = ['good','ok','bad'].includes(raw?.mood) ? (raw.mood as 'good'|'ok'|'bad') : undefined
  const tags = Array.isArray(raw?.tags) ? raw.tags.map((x: any) => String(x)) : undefined

  return { date, text, audioUrl, images, videos, mood, tags }
}

async function fetchJSON(url: string, signal?: AbortSignal) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10000)
  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: signal ?? ctrl.signal,
      credentials: 'include', // 後端若用 cookie-session 也可
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

// 直接在本檔提供 API 函式
async function fetchDiaryByDate(date: string, signal?: AbortSignal): Promise<Diary> {
  // 先試 /diary/:date
  try {
    const data = await fetchJSON(`${BASE_URL}/diary/${encodeURIComponent(date)}`, signal)
    return normalizeDiary(data, date)
  } catch (e: any) {
    if (e?.status && e.status !== 404 && e.status !== 405) throw e
  }
  // 退回 /diary?date=
  const data = await fetchJSON(`${BASE_URL}/diary?date=${encodeURIComponent(date)}`, signal)
  const raw = data?.diary ?? (Array.isArray(data) ? data[0] : data)
  if (!raw) {
    const err: any = new Error('此日期沒有日記或資料格式不正確')
    err.status = 404
    throw err
  }
  return normalizeDiary(raw, date)
}

// ========= 頁面元件 =========
export default function DiaryDetailUser() {
  // 路由參數：用 :date（建議 App.tsx 設 <Route path="/diary/:date" .../>）
  const { date: dateParam } = useParams<{ date?: string }>()
  const date = dateParam ?? dayjs().format('YYYY-MM-DD')

  const nav = useNavigate()
  const [data, setData] = useState<Diary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true); setErr(null); setData(null)
    fetchDiaryByDate(date, ac.signal)
      .then(setData)
      .catch((e: any) => setErr(e?.message || '讀取失敗'))
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [date])

  const d = dayjs(date)

  return (
    <div>
      <div className="home-header" style={{marginBottom:8}}>
        <div className="date">{d.format('YYYY年M月D日')}</div>
        <div className="weekday">{d.format('dddd')}</div>
      </div>

      {loading && <div className="card">讀取中…</div>}

      {err && (
        <div className="inline-alert" role="alert" style={{marginBottom:10}}>
          <div className="inline-alert-text">錯誤：{err}</div>
          <button className="inline-alert-close" aria-label="重試" onClick={() => window.location.reload()}>↻</button>
        </div>
      )}

      {!loading && !err && !data && (
        <div className="card" style={{opacity:.85}}>這一天沒有日記</div>
      )}

      {data && (
        <div className="diary-card">
          <div className="meta">{d.format('YYYY年M月D號')}</div>
          <div className="diary-text" style={{whiteSpace:'pre-line'}}>{data.text}</div>

          {(data.images?.length || data.videos?.length || data.audioUrl) && (
            <div style={{marginTop:12, display:'grid', gap:8}}>
              {data.audioUrl && <audio controls src={data.audioUrl} />}
              {data.images?.map((src, i) => (
                <img key={i} src={src} alt={`img-${i}`} style={{width:'100%', borderRadius:12}}/>
              ))}
              {data.videos?.map((src, i) => (
                <video key={i} src={src} controls style={{width:'100%', borderRadius:12}}/>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="card" onClick={() => nav('/calendar')}
              style={{marginTop:12, textAlign:'center', fontWeight:700}}>
        ← 返回月曆
      </button>
    </div>
  )
}
