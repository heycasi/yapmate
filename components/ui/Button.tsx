import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'icon'
  size?: 'default' | 'large'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClasses = {
    primary: 'bg-yapmate-amber-500 text-yapmate-black shadow-lg shadow-yapmate-amber-500/50 active:bg-yapmate-amber-600',
    secondary: 'border-2 border-yapmate-slate-700 text-yapmate-slate-100 active:bg-yapmate-slate-800',
    destructive: 'bg-red-500 text-white active:bg-red-600',
    icon: 'rounded-full active:bg-yapmate-slate-800 text-yapmate-slate-100',
  }

  const sizeClasses = {
    default: variant === 'icon' ? 'w-11 h-11' : 'h-12 px-6',
    large: variant === 'icon' ? 'w-14 h-14' : 'h-14 px-8',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
