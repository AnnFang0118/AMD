import React, { useEffect, useRef } from 'react'

type TermsModalProps = {
  open: boolean
  onClose: () => void
  onAgree?: () => void
}

export default function TermsModal({ open, onClose, onAgree }: TermsModalProps) {
  const okBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (open && okBtnRef.current) okBtnRef.current.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="modal">
        <div className="modal-header">
          <h3 id="terms-title">使用條款（示範版本）</h3>
          <button className="modal-close" aria-label="關閉" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{maxHeight: '60vh', overflowY: 'auto'}}>
          <p><i>最後更新日期：2025 年 9 月 5 日</i></p>

          <h4>一、服務內容</h4>
          <ul>
            <li>以語音紀錄日常並自動轉換為文字。</li>
            <li>子女端可透過綁定帳號查看日記摘要。</li>
            <li>本服務僅供生活紀錄與心理輔助，非醫療建議。</li>
          </ul>

          <h4>二、帳號管理</h4>
          <ul>
            <li>請妥善保管帳號與密碼，不得出借或轉讓。</li>
            <li>帳號遭他人濫用之損失由使用者自行承擔。</li>
            <li>不得干擾、破壞或嘗試入侵本服務。</li>
          </ul>

          <h4>三、隱私與資料</h4>
          <ul>
            <li>語音、文字與情緒分析結果僅用於提供服務功能。</li>
            <li>未經同意不會提供個人資料給第三方。</li>
            <li>可申請刪除帳號與日記，刪除後無法復原。</li>
          </ul>

          <h4>四、責任限制</h4>
          <ul>
            <li>分析結果僅供參考，不保證完整或正確。</li>
            <li>使用本服務所造成之心理或健康變化，概不負責。</li>
            <li>不可抗力時（故障/斷線），服務可能暫停或中止。</li>
          </ul>

          <h4>五、條款修改</h4>
          <ul>
            <li>本服務得隨時修訂條款並公告於 App/網站。</li>
            <li>不同意修訂者應停止使用本服務。</li>
          </ul>

          <h4>六、準據法與管轄</h4>
          <ul>
            <li>以中華民國法律為準據法。</li>
            <li>臺灣臺北地方法院為第一審管轄法院。</li>
          </ul>

          <p style={{marginTop:8, fontStyle:'italic', color:'#666'}}>📌 本條款僅為示範內容，非正式法律文件。</p>
        </div>

        <div className="modal-footer" style={{gap:8}}>
          {onAgree && (
            <button className="btn-primary" ref={okBtnRef} onClick={onAgree}>
              同意並關閉
            </button>
          )}
          <button className="btn" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  )
}
