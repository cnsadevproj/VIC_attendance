import { useState } from 'react'

interface BugReportModalProps {
  isOpen: boolean
  onClose: () => void
}

export interface BugReport {
  id: string
  timestamp: string
  url: string
  description: string
  errorInfo: string
  userAgent: string
  isRead: boolean
}

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('')
  const [errorInfo, setErrorInfo] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!isOpen) return null

  const handleSend = () => {
    if (!description.trim() && !errorInfo.trim()) {
      alert('버그 설명 또는 오류 정보를 입력해주세요.')
      return
    }

    setIsSending(true)

    const now = new Date()
    const reportId = `bug_${now.getTime()}`

    const bugReport: BugReport = {
      id: reportId,
      timestamp: now.toISOString(),
      url: window.location.href,
      description: description.trim() || '(설명 없음)',
      errorInfo: errorInfo.trim() || '(오류 정보 없음)',
      userAgent: navigator.userAgent,
      isRead: false,
    }

    // localStorage에서 기존 버그 보고 목록 가져오기
    const existingReports = localStorage.getItem('bug_reports')
    let reports: BugReport[] = []
    if (existingReports) {
      try {
        reports = JSON.parse(existingReports)
      } catch {
        reports = []
      }
    }

    // 새 보고 추가
    reports.unshift(bugReport)

    // 최대 100개까지만 저장
    if (reports.length > 100) {
      reports = reports.slice(0, 100)
    }

    // localStorage에 저장
    localStorage.setItem('bug_reports', JSON.stringify(reports))

    setTimeout(() => {
      setIsSending(false)
      setSent(true)
      setTimeout(() => {
        setSent(false)
        setDescription('')
        setErrorInfo('')
        onClose()
      }, 1500)
    }, 300)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setErrorInfo(text)
    } catch {
      alert('클립보드 접근 권한이 없습니다. 직접 붙여넣기 해주세요.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="bg-orange-500 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-bold">버그 보고</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 내용 */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-800">보고 완료!</p>
              <p className="text-sm text-gray-500 mt-1">버그 보고가 저장되었습니다</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  버그 설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="어떤 문제가 발생했나요? 어떤 상황에서 발생했나요?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-orange-500"
                  rows={3}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    오류 정보 (선택)
                  </label>
                  <button
                    onClick={handlePaste}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    클립보드에서 붙여넣기
                  </button>
                </div>
                <textarea
                  value={errorInfo}
                  onChange={(e) => setErrorInfo(e.target.value)}
                  placeholder="오류 화면에서 복사한 정보를 여기에 붙여넣으세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:border-orange-500 font-mono text-xs"
                  rows={5}
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                <p className="font-medium mb-1">보고 방법:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>오류 화면에서 "오류 정보 복사" 버튼 클릭</li>
                  <li>이 창에서 "클립보드에서 붙여넣기" 클릭</li>
                  <li>버그 설명 작성 후 전송 버튼 클릭</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        {!sent && (
          <div className="p-4 border-t flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex-1 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {isSending ? '전송 중...' : '전송'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
