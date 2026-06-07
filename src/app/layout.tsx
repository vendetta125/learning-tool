import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Math Ascension',
  description: 'GCSE Higher Maths — Grade 4 to 9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="sticky top-0 z-20 border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-white">
              Math Ascension
            </Link>
            <nav className="flex gap-6 text-sm font-medium text-gray-400">
              <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
              <Link href="/curriculum" className="hover:text-white transition-colors">Curriculum</Link>
              <Link href="/study" className="hover:text-white transition-colors">Study</Link>
              <Link href="/exam" className="hover:text-white transition-colors">Exam</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
