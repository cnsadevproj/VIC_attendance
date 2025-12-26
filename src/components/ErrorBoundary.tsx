import { Component, type ReactNode } from 'react'

interface ErrorInfo {
  componentStack: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorCode: string
}

interface ErrorBoundaryProps {
  children: ReactNode
}

// 오류 코드 생성 (날짜 + 랜덤)
function generateErrorCode(): string {
  const now = new Date()
  const dateStr = `${now.getMonth() + 1}${now.getDate()}`
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ERR-${dateStr}-${randomStr}`
}

// 이메일 본문 생성
function generateEmailBody(errorCode: string, error: Error | null, errorInfo: ErrorInfo | null): string {
  const now = new Date()
  const timestamp = now.toLocaleString('ko-KR')
  const userAgent = navigator.userAgent
  const url = window.location.href

  return `
[VIC 출결 시스템 오류 보고]

오류 코드: ${errorCode}
발생 시각: ${timestamp}
페이지 URL: ${url}

오류 메시지:
${error?.message || '알 수 없는 오류'}

오류 스택:
${error?.stack || '없음'}

컴포넌트 스택:
${errorInfo?.componentStack || '없음'}

브라우저 정보:
${userAgent}

---
이 이메일은 VIC 출결 시스템에서 자동 생성되었습니다.
`.trim()
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCode: '',
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorCode: generateErrorCode(),
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    // 콘솔에도 로그
    console.error('VIC 출결 시스템 오류:', {
      errorCode: this.state.errorCode,
      error,
      errorInfo,
    })
  }

  handleCopyError = () => {
    const { errorCode, error, errorInfo } = this.state
    const errorText = generateEmailBody(errorCode, error, errorInfo)

    navigator.clipboard.writeText(errorText).then(() => {
      alert('오류 정보가 클립보드에 복사되었습니다.')
    }).catch(() => {
      alert('복사에 실패했습니다. 스크린샷을 찍어주세요.')
    })
  }

  handleSendEmail = () => {
    const { errorCode, error, errorInfo } = this.state
    const subject = encodeURIComponent(`[VIC 출결 오류] ${errorCode}`)
    const body = encodeURIComponent(generateEmailBody(errorCode, error, errorInfo))

    window.location.href = `mailto:soojeongmin@cnsa.hs.kr?subject=${subject}&body=${body}`
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const { errorCode, error } = this.state

      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            {/* 헤더 */}
            <div className="bg-red-500 text-white p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold">오류가 발생했습니다</h1>
                  <p className="text-red-100 text-sm">예상치 못한 문제가 발생했습니다</p>
                </div>
              </div>
            </div>

            {/* 오류 정보 */}
            <div className="p-5">
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">오류 코드</span>
                  <span className="font-mono font-bold text-red-600">{errorCode}</span>
                </div>
                <div className="text-sm text-gray-600 break-all">
                  {error?.message || '알 수 없는 오류가 발생했습니다.'}
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                이 오류가 지속되면 아래 방법으로 관리자에게 알려주세요.
              </p>

              {/* 액션 버튼들 */}
              <div className="space-y-2">
                <button
                  onClick={this.handleSendEmail}
                  className="w-full py-3 bg-blue-500 text-white font-semibold rounded-xl
                           hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  이메일로 오류 보고
                </button>

                <button
                  onClick={this.handleCopyError}
                  className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl
                           hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  오류 정보 복사
                </button>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={this.handleReload}
                    className="flex-1 py-3 bg-primary-500 text-white font-semibold rounded-xl
                             hover:bg-primary-600 transition-colors"
                  >
                    새로고침
                  </button>
                  <button
                    onClick={this.handleGoHome}
                    className="flex-1 py-3 bg-gray-500 text-white font-semibold rounded-xl
                             hover:bg-gray-600 transition-colors"
                  >
                    홈으로
                  </button>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="bg-gray-50 px-5 py-3 text-center">
              <p className="text-xs text-gray-400">
                스크린샷을 찍어 soojeongmin@cnsa.hs.kr로 보내주셔도 됩니다.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
