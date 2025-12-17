interface SkeletonProps {
  className?: string
  variant?: 'default' | 'card' | 'text' | 'circle'
}

export function Skeleton({ className = '', variant = 'default' }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-yapmate-slate-800'

  const variantClasses = {
    default: 'h-4 rounded',
    card: 'h-24 rounded-xl',
    text: 'h-4 rounded',
    circle: 'rounded-full',
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  )
}
