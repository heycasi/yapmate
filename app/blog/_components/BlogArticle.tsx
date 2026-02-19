import Link from 'next/link'
import { BlogPost, getRelatedPosts } from '../_data'

export function BlogHeader() {
  return (
    <nav className="border-b border-gray-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="text-white font-bold text-lg tracking-tight py-2"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            YapMate
          </Link>
          <Link
            href="/blog"
            className="text-yapmate-gray-light hover:text-white transition-colors text-sm font-medium py-2"
          >
            Blog
          </Link>
        </div>
        <a
          href="https://yapmate.co.uk/app"
          className="bg-yapmate-status-orange text-black px-4 py-2 text-sm font-bold hover:bg-orange-400 transition-colors"
        >
          Get the App
        </a>
      </div>
    </nav>
  )
}

export function TableOfContents({ items }: { items: { id: string; title: string }[] }) {
  return (
    <nav aria-label="Table of contents">
      {/* Mobile: horizontal scroll */}
      <div className="lg:hidden mb-8 border border-gray-800 p-4">
        <p
          className="text-xs font-semibold text-yapmate-gray-light uppercase tracking-wider mb-3"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Contents
        </p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-sm text-yapmate-gray-light hover:text-yapmate-status-orange transition-colors min-h-0 block"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Desktop: sticky sidebar */}
      <div className="hidden lg:block sticky top-8">
        <p
          className="text-xs font-semibold text-yapmate-gray-light uppercase tracking-wider mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Contents
        </p>
        <ul className="space-y-2 border-l border-gray-800 pl-4">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="text-sm text-yapmate-gray-light hover:text-yapmate-status-orange transition-colors min-h-0 block py-1"
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export function Callout({
  children,
  type = 'info',
}: {
  children: React.ReactNode
  type?: 'info' | 'tip' | 'warning'
}) {
  const styles = {
    info: 'border-yapmate-status-orange bg-yapmate-status-orange/5',
    tip: 'border-yapmate-status-green bg-yapmate-status-green/5',
    warning: 'border-yapmate-status-yellow bg-yapmate-status-yellow/5',
  }
  return <div className={`border-l-4 ${styles[type]} p-4 my-6 [&_a]:min-h-0`}>{children}</div>
}

export function InlineCTA() {
  return (
    <div className="my-8 border border-gray-800 p-6 text-center">
      <p className="text-yapmate-gray-lightest mb-3 text-sm">
        Create CIS-compliant invoices by voice in under a minute.
      </p>
      <a
        href="https://yapmate.co.uk/app"
        className="inline-block bg-yapmate-status-orange text-black px-6 py-2 text-sm font-bold hover:bg-orange-400 transition-colors min-h-0"
      >
        Try YapMate Free
      </a>
    </div>
  )
}

export function RelatedPosts({ slugs }: { slugs: string[] }) {
  const related = getRelatedPosts(slugs)
  if (related.length === 0) return null

  return (
    <section className="mt-16 border-t border-gray-800 pt-8">
      <h2
        className="text-xl font-bold text-white mb-6"
        style={{ fontFamily: 'var(--font-space-grotesk)' }}
      >
        Related Articles
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block border border-gray-800 p-5 hover:border-yapmate-status-orange/50 transition-colors min-h-0"
          >
            <p className="text-sm text-yapmate-gray-light mb-1">{post.readTime}</p>
            <h3
              className="text-white font-semibold mb-2"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {post.title}
            </h3>
            <p className="text-sm text-yapmate-gray-light line-clamp-2">{post.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function StickyCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#0B0B0B]/95 backdrop-blur-sm border-t border-gray-800 px-4 py-3 z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm text-yapmate-gray-lightest hidden sm:block">
          Voice-powered invoicing for UK tradespeople
        </p>
        <p className="text-sm text-yapmate-gray-lightest sm:hidden">Invoice by voice</p>
        <a
          href="https://yapmate.co.uk/app"
          className="bg-yapmate-status-orange text-black px-5 py-2 text-sm font-bold hover:bg-orange-400 transition-colors whitespace-nowrap min-h-0 shrink-0"
        >
          Try YapMate Free
        </a>
      </div>
    </div>
  )
}

function ArticleSchema({ post }: { post: BlogPost }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Organization',
      name: 'YapMate',
      url: 'https://yapmate.co.uk',
    },
    publisher: {
      '@type': 'Organization',
      name: 'YapMate',
      url: 'https://yapmate.co.uk',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://yapmate.co.uk/blog/${post.slug}`,
    },
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}

export default function BlogArticle({
  post,
  children,
}: {
  post: BlogPost
  children: React.ReactNode
}) {
  const formattedDate = new Date(post.date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <ArticleSchema post={post} />
      <main className="min-h-screen bg-[#0B0B0B] text-[#F2F2F2]">
        <BlogHeader />

        <article className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24">
          {/* Article Header */}
          <header className="mb-8 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-sm text-yapmate-gray-light mb-4">
              <Link href="/blog" className="hover:text-white transition-colors min-h-0">
                Blog
              </Link>
              <span>/</span>
              <span>{post.keywords[0]}</span>
            </div>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-yapmate-gray-light">
              <time dateTime={post.date}>{formattedDate}</time>
              <span>·</span>
              <span>{post.readTime}</span>
            </div>
          </header>

          {/* Content area with TOC sidebar */}
          <div className="lg:flex lg:gap-10">
            <aside className="lg:w-56 shrink-0">
              <TableOfContents items={post.toc} />
            </aside>
            <div className="blog-prose min-w-0 flex-1 max-w-3xl">{children}</div>
          </div>

          {/* Related Posts */}
          <RelatedPosts slugs={post.relatedSlugs} />
        </article>

        <StickyCTA />
      </main>
    </>
  )
}
