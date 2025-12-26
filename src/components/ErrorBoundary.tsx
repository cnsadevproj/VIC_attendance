import { type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

// ErrorBoundary 비활성화 - 에러 화면 표시 없이 그냥 children 렌더링
function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return <>{children}</>
}

export default ErrorBoundary
