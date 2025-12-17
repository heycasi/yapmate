import { ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  maxWidth?: 'default' | 'wide' | 'full'
}

export function PageShell({
  children,
  title,
  description,
  action,
  maxWidth = 'default'
}: PageShellProps) {
  const maxWidthClasses = {
    default: 'max-w-4xl',
    wide: 'max-w-6xl',
    full: 'max-w-full',
  }

  return (
    <main className="min-h-screen px-4 pt-6 pb-safe">
      <div className={`${maxWidthClasses[maxWidth]} mx-auto`}>
        {(title || description || action) && (
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              {title && (
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-yapmate-slate-300">
                  {description}
                </p>
              )}
            </div>
            {action && (
              <div className="ml-4">
                {action}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </main>
  )
}
