import dayjs from 'dayjs'
import 'dayjs/locale/zh-tw'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ------------------ 地區設定 ------------------
dayjs.locale('zh-tw')

// ------------------ 可調整區（後端/欄位名） ------------------
const BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8000`
const API_UPLOAD = '/diary/upload' // 你們的上傳 API 路徑（POST）
// 後端接收的欄位名（multipart/form-data）
const FLD_AUDIO = 'audio'
const FLD_IMAGE = 'image'
const FLD_VIDEO = 'video'

// ------------------ 型別 ------------------
type Rect = { top: number; left: number; width: number; height: number }

type UploadResponse = {
  id?: string
  url?: string
  message?: string
  detail?: string
}

// ------------------ Spotlight / 教學 ------------------
const TOUR_KEY = 'tour_home_v3' // 升級 key，避免被舊紀錄擋住
const MAX_TRIES = 10
const forceTour = typeof window !== 'undefined' && /(?:\?|&)tour=1(?:&|$)/.test(window.location.search)

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)) }
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
  const fromClosest = (anchor?.closest('.screen') as HTMLElement | null) || (anchor?.closest('.phone') as HTMLElement | null)
  const el = fromClosest || (document.querySelector('.phone .screen') as HTMLElement | null) || (document.querySelector('.phone') as HTMLElement | null)
  return (el || document.body).getBoundingClientRect()
}

export default function Home(){
  const today = useMemo(()=>dayjs(),[])

  // =============== 錄音 / 上傳狀態 ===============
  const [recording, setRecording] = useState(false)
  const [permissionErr, setPermissionErr] = useState<string | null>(null)
  const [mediaSupported, setMediaSupported] = useState(true)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<BlobPart[]>([])
  const [mimeType, setMimeType] = useState<string>('audio/webm')
  const timerRef = useRef<number | null>(null)
  const startAtRef = useRef<number>(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioURL, setAudioURL] = useState<string | null>(null)

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0) // 0~100
  const [ok, setOk] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // =============== Spotlight 參考元素 ===============
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
    { title: '開始錄音', desc: '點一下麥克風開始語音日記；再次點擊即可結束並儲存預覽。', getEl: () => micBtnRef.current, pad: 14 },
    { title: '加照片/影片', desc: '錄音時可在右上角加入照片或影片，讓紀錄更完整。', getEl: () => toolsRef.current, pad: 10 },
  ]

  // 首次自動開啟（或用 ?tour=1 強制）
  useLayoutEffect(() => {
    if (forceTour) { setShowTour(true); return }
    try {
      const seen = localStorage.getItem(TOUR_KEY)
      if (!seen) setShowTour(true)
    } catch { setShowTour(true) }
  }, [])

  // 第 3 步需要看到工具列 => 自動開啟錄音
  useEffect(() => { if (showTour && stepIndex === 2 && !recording) void startRecording() }, [showTour, stepIndex])

  // 任何會影響排版的變化都重新量一次
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
  useEffect(() => { updateRect() }, [showTour, stepIndex])
  useEffect(() => { if (showTour) updateRect() }, [recording])
  useEffect(() => {
    if (!showTour) return
    const onResize = () => updateRect()
    const onScroll = () => updateRect()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive:true })
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll) }
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

  // ================= 錄音核心 =================
  useEffect(() => {
    // 支援檢查
    const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
    setMediaSupported(supported)
  }, [])

  function pickBestMime(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
    // @ts-ignore
    const MR = (window as any).MediaRecorder
    if (!MR || !MR.isTypeSupported) return 'audio/webm'
    for (const c of candidates){ if (MR.isTypeSupported(c)) return c }
    return 'audio/webm'
  }

  async function startRecording(){
    setErr(null); setOk(null)
    if (!mediaSupported) { setErr('此瀏覽器不支援錄音（MediaRecorder）'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mt = pickBestMime()
      setMimeType(mt)
      // @ts-ignore
      const rec: MediaRecorder = new MediaRecorder(stream, { mimeType: mt })
      mediaRecRef.current = rec
      mediaChunksRef.current = []
      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(mediaChunksRef.current, { type: mt })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioURL(prev => { if (prev) URL.revokeObjectURL(prev); return url })
      }
      rec.start(250) // 每 250ms 觸發一次 dataavailable
      startTimer()
      setRecording(true)
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') setPermissionErr('尚未允許麥克風，請在瀏覽器網址列右側開啟麥克風權限')
      else setErr(e?.message || '無法開始錄音')
    }
  }

  async function stopRecording(){
    try {
      mediaRecRef.current?.stop()
    } catch {}
    stopTimer()
    setRecording(false)
    try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
    mediaStreamRef.current = null
  }

  function toggleMic(){ recording ? void stopRecording() : void startRecording() }

  function startTimer(){
    startAtRef.current = Date.now()
    setElapsedMs(0)
    stopTimer()
    timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startAtRef.current), 200)
  }
  function stopTimer(){ if (timerRef.current){ clearInterval(timerRef.current); timerRef.current = null } }

  function formatMS(ms: number){
    const s = Math.floor(ms / 1000)
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  // ================= 檔案挑選 =================
  const imgInputRef = useRef<HTMLInputElement>(null)
  const vidInputRef = useRef<HTMLInputElement>(null)

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>){ const f = e.target.files?.[0] || null; setImageFile(f) }
  function onPickVideo(e: React.ChangeEvent<HTMLInputElement>){ const f = e.target.files?.[0] || null; setVideoFile(f) }
  function clearImage(){ setImageFile(null); if (imgInputRef.current) imgInputRef.current.value = '' }
  function clearVideo(){ setVideoFile(null); if (vidInputRef.current) vidInputRef.current.value = '' }

  // ================= 上傳 =================
  function getAuthHeader(){
    try { const token = localStorage.getItem('token'); return token ? { Authorization: `Bearer ${token}` } : {} }
    catch { return {} }
  }

  function buildForm(): FormData {
    const fd = new FormData()
    if (audioBlob) fd.append(FLD_AUDIO, audioBlob, `voice-${Date.now()}.${mimeType.includes('ogg') ? 'ogg' : 'webm'}`)
    if (imageFile) fd.append(FLD_IMAGE, imageFile, imageFile.name)
    if (videoFile) fd.append(FLD_VIDEO, videoFile, videoFile.name)
    fd.append('date', today.toISOString())
    fd.append('durationMs', String(elapsedMs))
    return fd
  }

  // 以 XMLHttpRequest 取得上傳進度（fetch 無原生進度事件）
  function uploadWithProgress(url: string, form: FormData, headers: Record<string,string> = {}): Promise<UploadResponse>{
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', url, true)
      for (const [k,v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable){ setProgress(Math.round((e.loaded / e.total) * 100)) } }
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4){
          try {
            const json = xhr.responseText ? JSON.parse(xhr.responseText) : {}
            if (xhr.status >= 200 && xhr.status < 300) resolve(json)
            else reject(new Error(json?.detail || json?.message || `上傳失敗（HTTP ${xhr.status}）`))
          } catch {
            if (xhr.status >= 200 && xhr.status < 300) resolve({})
            else reject(new Error(`上傳失敗（HTTP ${xhr.status}）`))
          }
        }
      }
      xhr.onerror = () => reject(new Error('上傳發生網路錯誤'))
      xhr.send(form)
    })
  }

  async function onSave(){
    setErr(null); setOk(null)
    if (!audioBlob && !imageFile && !videoFile){ setErr('請先錄音或加入照片/影片'); return }
    try {
      setUploading(true); setProgress(0)
      const form = buildForm()
      const headers = getAuthHeader() as Record<string,string>
      const data = await uploadWithProgress(`${BASE_URL}${API_UPLOAD}`, form, headers)
      setOk(data?.message || '已儲存！')
      // 清空附件但保留預覽音檔（可依需求移除）：
      clearImage(); clearVideo()
    } catch (e: any) {
      setErr(e?.message || '儲存失敗，請稍後重試')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  // 卸載時釋放資源
  useEffect(() => () => { try { mediaStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}; if (audioURL) URL.revokeObjectURL(audioURL) }, [])

  // ===== 提示卡限制在「手機容器」內 =====
  const tipLayout = (() => {
    if (!rect) return null
    const host = getHostRect(headerRef.current)
    const MARGIN = 12
    const EST_H = 200
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

  // =============== UI ===============
  return (
    <div className="center" style={{flexDirection:'column', gap:12}}>
      {/* 狀態條 */}
      {ok && (
        <div className="card" role="status" aria-live="polite" style={{background:'var(--ok-bg)', border:'1px solid var(--ok-border)', color:'var(--ok-fg)', padding:'10px 12px', borderRadius:10}}>
          {ok}
        </div>
      )}
      {err && (
        <div className="error" role="alert" aria-live="assertive">{err}</div>
      )}
      {permissionErr && (
        <div className="card" role="alert" style={{background:'#fff3cd', border:'1px solid #ffeeba', color:'#856404', padding:'10px 12px', borderRadius:10}}>
          {permissionErr}
        </div>
      )}
      {!mediaSupported && (
        <div className="card" role="alert" style={{background:'#fde2e2', border:'1px solid #f5c2c7', color:'#842029', padding:'10px 12px', borderRadius:10}}>
          目前瀏覽器不支援 MediaRecorder，請改用 Chrome / Edge / Android Chrome。
        </div>
      )}

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
          aria-label={recording ? '停止錄音' : '開始錄音'}
          title={recording ? '停止錄音' : '開始錄音'}
          disabled={!mediaSupported}
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21H9v2h6v-2h-2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
        </button>
        <div className="mic-label">
          {recording ? `錄音中 ${formatMS(elapsedMs)}` : (audioBlob ? '已完成一段錄音' : '點擊開始紀錄日記')}
        </div>
      </div>

      {/* 錄音預覽（停止後出現） */}
      {!recording && audioURL && (
        <div className="card" style={{padding:12, border:'1px solid #eee', borderRadius:12, width:'100%', maxWidth:420}}>
          <div style={{fontWeight:600, marginBottom:6}}>錄音預覽</div>
          <audio src={audioURL} controls style={{width:'100%'}} />
          <div style={{fontSize:12, opacity:.8, marginTop:6}}>長度：約 {formatMS(elapsedMs)}</div>
        </div>
      )}

      {/* 錄音時顯示的對話卡，右上角有影片/照片上傳 */}
      {recording && (
        <div className="chat-card">
          <div className="row">
            <div className="chat-avatar">🗣️</div>

            <div className="chat-bubble">
              <div className="bubble-head">
                <div className="chat-title">說點什麼吧</div>
                <div ref={toolsRef} className="chat-tools">
                  <button className="tool-btn" title="上傳影片" onClick={()=>vidInputRef.current?.click()}>🎬</button>
                  <button className="tool-btn" title="上傳照片" onClick={()=>imgInputRef.current?.click()}>🖼️</button>
                </div>
              </div>

              <div className="chat-text">錄音中… {formatMS(elapsedMs)}</div>

              {(videoFile || imageFile) && (
                <div className="selected-note">
                  {videoFile && <>影片：{videoFile.name}　<button className="link" onClick={clearVideo}>移除</button></>}
                  {imageFile && <>照片：{imageFile.name}　<button className="link" onClick={clearImage}>移除</button></>}
                </div>
              )}
            </div>
          </div>

          {/* 隱藏 input（點右上工具會觸發） */}
          <input ref={imgInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={onPickImage} />
          <input ref={vidInputRef} type="file" accept="video/*" style={{display:'none'}} onChange={onPickVideo} />
        </div>
      )}

      {/* 儲存／上傳區塊：有錄音或附件時出現 */}
      {(audioBlob || imageFile || videoFile) && (
        <div style={{display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:420}}>
          <button className="btn-primary" onClick={onSave} disabled={uploading} style={{background:'var(--login-btn-bg)'}}>
            {uploading ? '上傳中…' : '儲存到後端'}
          </button>
          {uploading && (
            <div style={{height:10, background:'#eee', borderRadius:6, overflow:'hidden'}} aria-label="upload-progress">
              <div style={{height:'100%', width:`${progress}%`, background:'#6C63FF', transition:'width .2s'}} />
            </div>
          )}
        </div>
      )}

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
              <button onClick={next} style={{border:0, background:'var(--login-btn-bg, #6C63FF)', color:'#fff', borderRadius:10, padding:'6px 12px', cursor:'pointer', fontWeight:600}}>{stepIndex < steps.length - 1 ? '下一步' : '完成'}</button>
            </div>
            <div style={{fontSize:12, opacity:.65, marginTop:6}}>提示：Enter/空白鍵/→ 前進，Esc 關閉</div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
