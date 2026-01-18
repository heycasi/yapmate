import React from 'react'
import Image from 'next/image'

interface AppStoreBadgeProps {
  className?: string
}

export default function AppStoreBadge({ className = '' }: AppStoreBadgeProps) {
  const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL || 'https://apps.apple.com/gb/app/yapmate/id6756750891'

  return (
    <a
      href={appStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition-opacity hover:opacity-80 ${className}`}
      aria-label="Download YapMate on the App Store"
    >
      <Image
        src="/app-store-badge.svg"
        alt="Download on the App Store"
        width={120}
        height={40}
        className="w-full h-auto"
        priority
      />
    </a>
  )
}
