import type { Metadata } from 'next'
import Link from 'next/link'
import { posts } from './_data'
import { BlogHeader } from './_components/BlogArticle'

export const metadata: Metadata = {
  title: 'Blog | YapMate - Invoicing Tips for UK Tradespeople',
  description:
    'Practical guides on CIS invoicing, self-employed invoicing, VAT, chasing late payments, and the best invoicing apps for UK tradespeople.',
  openGraph: {
    title: 'YapMate Blog - Invoicing Tips for UK Tradespeople',
    description:
      'Practical guides on CIS invoicing, self-employed invoicing, VAT, chasing late payments, and the best invoicing apps for UK tradespeople.',
    type: 'website',
    url: 'https://yapmate.co.uk/blog',
  },
}

export default function BlogIndex() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] text-[#F2F2F2]">
      <BlogHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <header className="mb-12">
          <h1
            className="text-4xl sm:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Blog
          </h1>
          <p className="text-lg text-yapmate-gray-light max-w-2xl">
            Practical guides on invoicing, CIS, VAT, and getting paid — written for UK
            tradespeople.
          </p>
        </header>

        {/* Post Grid */}
        <div className="space-y-6">
          {posts.map((post) => {
            const formattedDate = new Date(post.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
            return (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block border border-gray-800 p-6 hover:border-yapmate-status-orange/50 transition-colors group min-h-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-yapmate-gray-light mb-2">
                  <time dateTime={post.date}>{formattedDate}</time>
                  <span>·</span>
                  <span>{post.readTime}</span>
                </div>
                <h2
                  className="text-xl sm:text-2xl font-bold text-white mb-2 group-hover:text-yapmate-status-orange transition-colors"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {post.title}
                </h2>
                <p className="text-yapmate-gray-light mb-3">{post.description}</p>
                <div className="flex flex-wrap gap-2">
                  {post.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-xs px-2 py-1 border border-gray-800 text-yapmate-gray-light"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="border-t border-gray-800 px-4 sm:px-6 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h2
            className="text-2xl font-bold text-white mb-3"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Ready to invoice faster?
          </h2>
          <p className="text-yapmate-gray-light mb-6">
            YapMate turns your voice into professional invoices. CIS, VAT, and UK compliance built
            in.
          </p>
          <a
            href="https://yapmate.co.uk/app"
            className="inline-block bg-yapmate-status-orange text-black px-8 py-3 font-bold hover:bg-orange-400 transition-colors min-h-0"
          >
            Try YapMate Free
          </a>
        </div>
      </section>
    </main>
  )
}
