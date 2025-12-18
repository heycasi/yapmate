'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: '🏠' },
    { href: '/record', label: 'Record', icon: '🎤' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-yapmate-black/95 backdrop-blur-lg border-t border-yapmate-slate-800 pb-safe">
      <div className="flex justify-around items-center" style={{ height: '68px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors duration-200 tap-highlight ${
                isActive
                  ? 'text-yapmate-amber-500'
                  : 'text-yapmate-slate-400 active:text-yapmate-slate-200'
              }`}
            >
              <span className="text-2xl mb-1">{item.icon}</span>
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
