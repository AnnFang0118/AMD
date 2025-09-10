import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { fetchDiaryByDate } from '../api/diary'
import type { Diary } from '../api/diary'


dayjs.locale('zh-tw')

export default function DiaryDetailUser() {
  const { date = dayjs().format('YYYY-MM-DD') } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState<Diary | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true); setErr(null)
    fetchDiaryByDate(date, ac.signal)
      .then(setData)
      .catch(e => setErr(e.message || '讀取失敗'))
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
      {err && <div className="card" style={{color:'#b91c1c'}}>錯誤：{err}</div>}
      {data && (
        <div className="diary-card">
          <div className="meta">{d.format('YYYY年M月D號')}</div>
          <div className="diary-text" style={{whiteSpace:'pre-line'}}>{data.text}</div>

          {/* 可選：附件區塊（使用者端可看到更多操作） */}
          {(data.images?.length || data.videos?.length || data.audioUrl) && (
            <div style={{marginTop:12, display:'grid', gap:8}}>
              {data.audioUrl && <audio controls src={data.audioUrl} />}
              {data.images?.map((src, i) => <img key={i} src={src} alt="img" style={{width:'100%', borderRadius:12}}/>)}
              {data.videos?.map((src, i) => <video key={i} src={src} controls style={{width:'100%', borderRadius:12}}/>)}
            </div>
          )}
        </div>
      )}

      <button className="card" onClick={() => nav('/calendar')} style={{marginTop:12, textAlign:'center', fontWeight:700}}>
        ← 返回月曆
      </button>
    </div>
  )
}
