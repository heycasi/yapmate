import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  elevated?: boolean
  interactive?: boolean
}

export function Card({ children, className = '', elevated = false, interactive = false }: CardProps) {
  const baseClasses = 'bg-yapmate-slate-800 rounded-xl shadow-lg'
  const elevatedClasses = elevated ? 'p-6 shadow-xl' : 'p-4'
  const interactiveClasses = interactive ? 'active:bg-yapmate-slate-700 transition-colors duration-200' : ''

  return (
    <div className={`${baseClasses} ${elevatedClasses} ${interactiveClasses} ${className}`}>
      {children}
    </div>
  )
}
