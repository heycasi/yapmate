export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readTime: string
  keywords: string[]
  toc: { id: string; title: string }[]
  relatedSlugs: string[]
}

export const posts: BlogPost[] = [
  {
    slug: 'cis-invoice-guide',
    title: 'How to Create a CIS Invoice: UK Guide 2026',
    description:
      'Learn how to create a CIS invoice with our complete UK guide. Covers CIS deductions, what to include, common mistakes, and a free example layout.',
    date: '2026-02-03',
    readTime: '10 min read',
    keywords: ['CIS invoice', 'CIS invoice template', 'construction industry scheme invoicing'],
    toc: [
      { id: 'what-is-cis', title: 'What Is CIS?' },
      { id: 'who-needs-cis-invoices', title: 'Who Needs CIS Invoices?' },
      { id: 'what-to-include', title: 'What to Include on a CIS Invoice' },
      { id: 'how-deductions-work', title: 'How CIS Deductions Work' },
      { id: 'example-layout', title: 'CIS Invoice Example Layout' },
      { id: 'common-mistakes', title: 'Common CIS Invoice Mistakes' },
      { id: 'make-it-easier', title: 'How to Make CIS Invoicing Easier' },
      { id: 'what-happens-to-deductions', title: 'What Happens to Your Deductions?' },
      { id: 'faq', title: 'FAQ' },
    ],
    relatedSlugs: ['cis-deductions-explained', 'self-employed-invoicing'],
  },
  {
    slug: 'self-employed-invoicing',
    title: 'Self-Employed Invoicing: What to Include (UK)',
    description:
      'Complete guide to self-employed invoicing in the UK. Learn what HMRC requires on your invoices, VAT rules, payment terms, and tips to get paid faster.',
    date: '2026-02-06',
    readTime: '10 min read',
    keywords: ['self employed invoice UK', 'what to put on an invoice', 'sole trader invoice'],
    toc: [
      { id: 'do-you-need-invoices', title: 'Do You Need to Send Invoices?' },
      { id: 'hmrc-requirements', title: 'What HMRC Expects' },
      { id: 'vat-vs-non-vat', title: 'VAT vs Non-VAT Invoices' },
      { id: 'professional-tips', title: 'Professional Tips' },
      { id: 'common-mistakes', title: 'Common Invoicing Mistakes' },
      { id: 'invoice-template', title: 'Invoice Template' },
      { id: 'checklist', title: 'Self-Employed Invoice Checklist' },
    ],
    relatedSlugs: ['cis-invoice-guide', 'chase-late-payments'],
  },
  {
    slug: 'cis-deductions-explained',
    title: 'CIS Deductions Explained: A Subcontractor Guide',
    description:
      'CIS deductions explained simply. Learn how the 20% and 30% rates work, how to register, reclaim overpayments, and what CIS means for your self-assessment.',
    date: '2026-02-10',
    readTime: '9 min read',
    keywords: ['CIS deductions explained', 'CIS deductions', 'CIS tax'],
    toc: [
      { id: 'what-is-cis', title: 'What Is CIS?' },
      { id: 'who-does-cis-apply-to', title: 'Who Does CIS Apply To?' },
      { id: 'three-deduction-rates', title: 'The Three CIS Deduction Rates' },
      { id: 'how-calculated', title: 'How Deductions Are Calculated' },
      { id: 'payment-statements', title: 'Payment and Deduction Statements' },
      { id: 'how-to-register', title: 'How to Register for CIS' },
      { id: 'self-assessment', title: 'How CIS Affects Self Assessment' },
      { id: 'reclaiming-overpayments', title: 'Reclaiming CIS Overpayments' },
      { id: 'common-questions', title: 'Common CIS Questions' },
      { id: 'practical-tips', title: 'Practical Tips' },
    ],
    relatedSlugs: ['cis-invoice-guide', 'best-invoicing-apps'],
  },
  {
    slug: 'best-invoicing-apps',
    title: 'Best Invoicing Apps for UK Tradespeople 2026',
    description:
      'Comparing the best invoicing apps for UK tradespeople in 2026. Honest reviews of QuickBooks, Xero, FreshBooks, Invoice Ninja, Tradify, and YapMate.',
    date: '2026-02-13',
    readTime: '9 min read',
    keywords: ['best invoicing app UK', 'invoicing app tradespeople', 'best invoice app builders'],
    toc: [
      { id: 'what-tradespeople-need', title: 'What Tradespeople Need' },
      { id: 'quickbooks', title: 'QuickBooks' },
      { id: 'xero', title: 'Xero' },
      { id: 'freshbooks', title: 'FreshBooks' },
      { id: 'invoice-ninja', title: 'Invoice Ninja' },
      { id: 'tradify', title: 'Tradify' },
      { id: 'yapmate', title: 'YapMate' },
      { id: 'comparison-table', title: 'Comparison Table' },
      { id: 'which-should-you-choose', title: 'Which Should You Choose?' },
    ],
    relatedSlugs: ['self-employed-invoicing', 'chase-late-payments'],
  },
  {
    slug: 'chase-late-payments',
    title: 'How to Chase Late Payments as a Tradesperson',
    description:
      'Practical guide to chasing late payments as a UK tradesperson. Includes prevention tips, reminder templates, legal options, and when to write off bad debt.',
    date: '2026-02-17',
    readTime: '10 min read',
    keywords: ['chasing late payments', 'late payment tradesperson', 'overdue invoice UK'],
    toc: [
      { id: 'prevention', title: 'Prevention Is Better Than Chasing' },
      { id: 'step-by-step', title: 'How to Chase: Step by Step' },
      { id: 'legal-options', title: 'Your Legal Options' },
      { id: 'common-excuses', title: 'How to Handle Common Excuses' },
      { id: 'good-habits', title: 'Building Good Payment Habits' },
      { id: 'key-takeaways', title: 'Key Takeaways' },
    ],
    relatedSlugs: ['self-employed-invoicing', 'best-invoicing-apps'],
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug)
}

export function getRelatedPosts(slugs: string[]): BlogPost[] {
  return slugs.map((s) => posts.find((p) => p.slug === s)).filter(Boolean) as BlogPost[]
}
