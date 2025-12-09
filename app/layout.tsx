import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YapMate - Voice Invoice Assistant',
  description: 'Record voice notes and extract structured invoice data',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {children}
      </body>
    </html>
  )
}
