import { ReactNode } from 'react'

interface BottomCTAProps {
  children: ReactNode
  className?: string
}

export function BottomCTA({ children, className = '' }: BottomCTAProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 p-4 pb-safe bg-yapmate-black border-t border-yapmate-slate-800 ${className}`}>
      <div className="max-w-4xl mx-auto">
        {children}
      </div>
    </div>
  )
}
