// src/pages/ChildHome.tsx
import { Link } from 'react-router-dom'

type Item = {
  id: string
  date: string            // YYYY-MM-DD
  time?: string           // HH:mm，可省略
  title: string
  snippet: string
  hasImage?: boolean
  hasVideo?: boolean
}

const mock: Item[] = [
  {
    id: '1',
    date: '2025-01-01',
    time: '08:10',
    title: '早安日記',
    snippet: '今天天氣晴朗，散步 20 分鐘，心情不錯…',
    hasImage: true
  },
  {
    id: '2',
    date: '2024-12-31',
    time: '20:05',
    title: '跨年前一天',
    snippet: '晚飯吃得下，精神還行，準備早點睡…',
    hasVideo: true
  },
  {
    id: '3',
    date: '2024-12-30',
    title: '簡短紀錄',
    snippet: '今天稍微頭暈，午休後好一些。'
  },
]

export default function ChildHome() {
  return (
    <div style={{display:'flex', flexDirection:'column', gap:12}}>
      <div className="home-header" style={{marginBottom:4}}>
        <div className="date">最近日記</div>
        <div className="weekday" style={{marginTop:4}}>（假資料，之後串 API ）</div>
      </div>

      {mock.map(item => (
        <Link
          key={item.id}
          to={`/diary/${item.date}`}
          className="card"
          style={{
            display:'flex',
            gap:12,
            textDecoration:'none',
            color:'inherit',
            alignItems:'flex-start'
          }}
        >
          <div
            className="dot"
            style={{
              width:42, height:42, borderRadius:10,
              background:'#e6ebf2', display:'flex',
              alignItems:'center', justifyContent:'center',
              fontSize:22, flex:'0 0 auto'
            }}
            aria-hidden
          >
            📝
          </div>

          <div style={{flex:1, minWidth:0}}>
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <b style={{fontSize:15}}>{item.title}</b>
              <span className="meta">
                {item.date}{item.time ? ` ${item.time}` : ''}
              </span>
              {item.hasImage && <span title="含照片" style={{marginLeft:'auto'}}>🖼️</span>}
              {item.hasVideo && <span title="含影片">{item.hasImage ? ' 🎬' : '🎬'}</span>}
            </div>
            <div className="meta" style={{
              marginTop:6,
              overflow:'hidden',
              textOverflow:'ellipsis',
              display:'-webkit-box',
              WebkitLineClamp:2,
              WebkitBoxOrient:'vertical'
            }}>
              {item.snippet}
            </div>
          </div>
        </Link>
      ))}

      {/* 你可以把這顆當成「載入更多」或「刷新」 */}
      <button className="card" style={{border:'none', cursor:'pointer'}}>
        載入更多…
      </button>
    </div>
  )
}