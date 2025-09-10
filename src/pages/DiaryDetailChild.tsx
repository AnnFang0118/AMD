import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { fetchDiaryByDate } from '../api/diary'
import type { Diary } from '../api/diary'


dayjs.locale('zh-tw')

export default function DiaryDetailChild() {
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
          {/* 子女端重點放在純閲讀，因此附件先不顯示或顯示精簡版 */}
          <div className="diary-text" style={{whiteSpace:'pre-line'}}>{data.text}</div>
        </div>
      )}

      <button className="card" onClick={() => nav('/child')} style={{marginTop:12, textAlign:'center', fontWeight:700}}>
        ← 返回月曆
      </button>
    </div>
  )
}
