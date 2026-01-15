import React from 'react'
import AppStoreBadge from './AppStoreBadge'

export default function Footer() {
  return (
    <footer className="px-6 py-8 text-center text-yapmate-gray-light text-sm border-t border-gray-800 mt-16">
      <div className="flex flex-col items-center gap-4 max-w-6xl mx-auto">
        <AppStoreBadge className="w-32" />
        <p>© {new Date().getFullYear()} YapMate. Built for tradies, by tradies.</p>
      </div>
    </footer>
  )
}
