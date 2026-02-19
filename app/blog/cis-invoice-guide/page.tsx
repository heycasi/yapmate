import type { Metadata } from 'next'
import BlogArticle, { Callout, InlineCTA } from '../_components/BlogArticle'
import { getPost } from '../_data'

const post = getPost('cis-invoice-guide')!

export const metadata: Metadata = {
  title: `${post.title} | YapMate Blog`,
  description: post.description,
  keywords: post.keywords,
  openGraph: {
    title: post.title,
    description: post.description,
    type: 'article',
    publishedTime: post.date,
    authors: ['YapMate'],
    url: `https://yapmate.co.uk/blog/${post.slug}`,
  },
}

export default function CISInvoiceGuide() {
  return (
    <BlogArticle post={post}>
      <p>
        If you&apos;re a subcontractor working in the UK construction industry, getting your CIS
        invoices right isn&apos;t optional — it&apos;s essential. A dodgy invoice can delay your
        payment, cause headaches at tax time, and even land you in trouble with HMRC.
      </p>
      <p>
        But here&apos;s the thing: CIS invoicing doesn&apos;t have to be complicated. Once you
        understand what needs to go on there and why, it becomes second nature.
      </p>
      <p>
        In this guide, we&apos;ll walk you through everything you need to know about creating a
        proper CIS invoice in 2026 — from what the Construction Industry Scheme actually is, to a
        line-by-line breakdown of what your invoice should include.
      </p>

      <h2 id="what-is-cis">What Is the Construction Industry Scheme (CIS)?</h2>
      <p>
        The Construction Industry Scheme is HMRC&apos;s system for collecting tax from people working
        in construction. Rather than waiting until the end of the tax year for subcontractors to pay
        their tax bill, the scheme requires <strong>contractors</strong> to deduct tax at source and
        send it directly to HMRC.
      </p>
      <p>Think of it like PAYE, but for self-employed construction workers.</p>
      <p>The scheme covers most construction work in the UK, including:</p>
      <ul>
        <li>Building and repairs</li>
        <li>Decorating and painting</li>
        <li>Demolition and dismantling</li>
        <li>Plumbing, heating and electrical work</li>
        <li>Roofing and scaffolding</li>
        <li>Road building and civil engineering</li>
      </ul>
      <p>
        It does <strong>not</strong> cover things like architecture, surveying, or the delivery of
        materials (unless you&apos;re also doing the installation).
      </p>

      <h2 id="who-needs-cis-invoices">Who Needs to Use CIS Invoices?</h2>
      <p>
        If you&apos;re a <strong>subcontractor</strong> doing construction work for a{' '}
        <strong>contractor</strong>, you need to issue CIS-compliant invoices.
      </p>
      <p>
        A &quot;contractor&quot; in CIS terms isn&apos;t just a building firm. It includes:
      </p>
      <ul>
        <li>Construction companies</li>
        <li>Property developers</li>
        <li>Government departments and local authorities</li>
        <li>Housing associations</li>
        <li>
          Any business that spends more than £3 million on construction in a 12-month period (even
          if construction isn&apos;t their main business)
        </li>
      </ul>
      <p>
        So if you&apos;re a plumber doing a bathroom refit for a housing association, or an
        electrician wiring a new office for a large company — CIS applies to you.
      </p>

      <h3>Do You Need to Be Registered?</h3>
      <p>
        Both contractors and subcontractors should register for CIS with HMRC. Here&apos;s why it
        matters:
      </p>
      <ul>
        <li>
          <strong>Registered subcontractors</strong> have 20% deducted from the labour portion of
          their invoices
        </li>
        <li>
          <strong>Unregistered subcontractors</strong> have 30% deducted — that&apos;s a significant
          difference
        </li>
        <li>
          <strong>Gross payment status</strong> means 0% deduction (but you need a clean tax record
          and minimum turnover to qualify)
        </li>
      </ul>
      <p>
        You can register for CIS online through your Government Gateway account. It&apos;s free and
        straightforward.
      </p>

      <Callout type="tip">
        <p className="mb-0">
          <strong>Register for CIS now if you haven&apos;t already.</strong> The difference between
          20% and 30% deductions adds up to thousands of pounds a year.
        </p>
      </Callout>

      <h2 id="what-to-include">What to Include on a CIS Invoice</h2>
      <p>
        This is where most people trip up. A CIS invoice needs everything a standard invoice does,
        plus some CIS-specific details. Here&apos;s the complete list:
      </p>

      <h3>Standard Invoice Details</h3>
      <ol>
        <li>
          <strong>Your name or business name</strong> — as registered with HMRC
        </li>
        <li>
          <strong>Your contact details</strong> — address, phone number, email
        </li>
        <li>
          <strong>Your UTR (Unique Taxpayer Reference)</strong> — this is essential for CIS
        </li>
        <li>
          <strong>Your VAT number</strong> (if VAT registered)
        </li>
        <li>
          <strong>The contractor&apos;s name and address</strong>
        </li>
        <li>
          <strong>A unique invoice number</strong> — sequential, no gaps
        </li>
        <li>
          <strong>The invoice date</strong>
        </li>
        <li>
          <strong>A description of the work carried out</strong> — be specific (e.g., &quot;First
          fix plumbing — Plot 7, Phase 2&quot; not just &quot;plumbing work&quot;)
        </li>
        <li>
          <strong>The date or period the work was done</strong>
        </li>
      </ol>

      <h3>CIS-Specific Details</h3>
      <ol start={10}>
        <li>
          <strong>Labour costs</strong> — shown separately from materials
        </li>
        <li>
          <strong>Materials costs</strong> — also shown separately (CIS deductions only apply to
          labour, not materials)
        </li>
        <li>
          <strong>The CIS deduction rate</strong> — 20%, 30%, or 0%
        </li>
        <li>
          <strong>The CIS deduction amount</strong> — calculated on the labour portion only
        </li>
        <li>
          <strong>The net amount payable</strong> — after the deduction
        </li>
      </ol>

      <h3>Payment Details</h3>
      <ol start={15}>
        <li>
          <strong>Your bank details</strong> — sort code, account number, account name
        </li>
        <li>
          <strong>Payment terms</strong> — e.g., &quot;Payment due within 30 days&quot;
        </li>
        <li>
          <strong>The total amount due</strong>
        </li>
      </ol>

      <h2 id="how-deductions-work">How CIS Deductions Work: A Worked Example</h2>
      <p>
        Let&apos;s make this concrete. Say you&apos;re a registered subcontractor and you&apos;ve
        just finished a plastering job. Your invoice looks like this:
      </p>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Labour — plastering (3 days)</td>
            <td>£900.00</td>
          </tr>
          <tr>
            <td>Materials — plaster, beads, PVA</td>
            <td>£150.00</td>
          </tr>
          <tr>
            <td>
              <strong>Subtotal</strong>
            </td>
            <td>
              <strong>£1,050.00</strong>
            </td>
          </tr>
          <tr>
            <td>CIS deduction (20% of labour)</td>
            <td>-£180.00</td>
          </tr>
          <tr>
            <td>
              <strong>Total payable</strong>
            </td>
            <td>
              <strong>£870.00</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The contractor pays you £870 and sends the £180 to HMRC on your behalf. That £180 counts as
        a tax credit — it&apos;s money already paid towards your tax bill.
      </p>

      <h3>What About VAT?</h3>
      <p>
        If you&apos;re VAT registered, it gets slightly more involved. CIS deductions are calculated{' '}
        <strong>before</strong> VAT is added. So:
      </p>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Labour</td>
            <td>£900.00</td>
          </tr>
          <tr>
            <td>Materials</td>
            <td>£150.00</td>
          </tr>
          <tr>
            <td>
              <strong>Subtotal</strong>
            </td>
            <td>
              <strong>£1,050.00</strong>
            </td>
          </tr>
          <tr>
            <td>CIS deduction (20% of £900 labour)</td>
            <td>-£180.00</td>
          </tr>
          <tr>
            <td>
              <strong>Net after CIS</strong>
            </td>
            <td>
              <strong>£870.00</strong>
            </td>
          </tr>
          <tr>
            <td>VAT (20% of £1,050)</td>
            <td>+£210.00</td>
          </tr>
          <tr>
            <td>
              <strong>Total payable</strong>
            </td>
            <td>
              <strong>£1,080.00</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Important: the <strong>VAT is calculated on the full amount</strong> (labour + materials),
        not on the amount after CIS deduction. The CIS deduction and VAT are separate calculations.
      </p>

      <Callout type="warning">
        <p className="mb-0">
          <strong>VAT Reverse Charge:</strong> Since March 2021, the domestic VAT reverse charge
          applies to most CIS-regulated construction services. If the reverse charge applies, you
          don&apos;t charge VAT — instead, the contractor accounts for it. Your invoice should state:
          &quot;Customer to account for VAT to HMRC under the domestic reverse charge.&quot; Check
          whether this applies to your specific situation.
        </p>
      </Callout>

      <h2 id="example-layout">CIS Invoice Example Layout</h2>
      <p>Here&apos;s what a complete CIS invoice might look like:</p>

      <pre>
        <code>{`─────────────────────────────────────────────
INVOICE

[Your Name / Trading Name]
[Your Address]
[Phone] | [Email]
UTR: 12345 67890
VAT No: GB 123 4567 89 (if applicable)

TO:
[Contractor Name]
[Contractor Address]

Invoice No: INV-2026-047
Date: 18 February 2026
Work Period: 10–14 February 2026
Site: 42 New Build Road, Manchester

─────────────────────────────────────────────
DESCRIPTION                          AMOUNT

Labour: First fix electrical,        £1,200.00
        Plot 12 — wiring, back
        boxes, consumer unit

Materials: Cable, back boxes,          £340.00
           consumer unit, clips

─────────────────────────────────────────────
Subtotal                             £1,540.00
CIS Deduction (20% of £1,200)        -£240.00
Net after CIS                        £1,300.00
VAT (20% of £1,540)*                  £308.00
─────────────────────────────────────────────
TOTAL PAYABLE                        £1,608.00

*Or state reverse charge applies if applicable

Payment Terms: 14 days
Bank: [Name] | Sort: 12-34-56 | Acc: 12345678
─────────────────────────────────────────────`}</code>
      </pre>

      <InlineCTA />

      <h2 id="common-mistakes">Common CIS Invoice Mistakes (and How to Avoid Them)</h2>
      <p>
        Over the years, we&apos;ve seen the same mistakes crop up again and again. Here are the big
        ones:
      </p>

      <h3>1. Not Separating Labour and Materials</h3>
      <p>
        This is the most common error. If you lump everything together as one figure, the contractor
        has to deduct CIS from the <strong>entire amount</strong> — including your materials. That
        means you&apos;re losing money unnecessarily.
      </p>
      <p>
        <strong>Always</strong> break your invoice into labour and materials. Keep receipts for
        materials in case HMRC asks.
      </p>

      <h3>2. Forgetting Your UTR Number</h3>
      <p>
        Without your UTR, the contractor can&apos;t verify you with HMRC. That means they&apos;ll
        either have to deduct at 30% (the unregistered rate) or delay your payment until they can
        verify you.
      </p>

      <h3>3. Using Vague Descriptions</h3>
      <p>
        &quot;Building work — £2,000&quot; won&apos;t cut it. HMRC expects reasonable detail.
        Include:
      </p>
      <ul>
        <li>What work was done</li>
        <li>Where it was done (site address)</li>
        <li>When it was done</li>
        <li>Which plot/phase/area (for larger sites)</li>
      </ul>

      <h3>4. Getting the VAT Reverse Charge Wrong</h3>
      <p>
        Since the domestic reverse charge was introduced, this has been a constant source of
        confusion. If you&apos;re supplying CIS-regulated services to another VAT-registered
        contractor (who is not the end user), the reverse charge likely applies. Get it wrong and you
        could face penalties.
      </p>

      <h3>5. Inconsistent Invoice Numbering</h3>
      <p>
        Your invoice numbers need to be sequential. Gaps or duplicates can trigger questions from
        HMRC during an inspection. Pick a system (e.g., INV-2026-001, INV-2026-002) and stick with
        it.
      </p>

      <h3>6. Not Keeping Copies</h3>
      <p>
        You need to keep copies of every invoice you issue for at least six years. Digital copies are
        fine — in fact, they&apos;re better because they&apos;re easier to search and harder to lose.
      </p>

      <h2 id="make-it-easier">How to Make CIS Invoicing Easier</h2>
      <p>
        Let&apos;s be honest — most tradespeople didn&apos;t get into the trade to do paperwork. But
        invoicing is one of those non-negotiable tasks that directly affects your income.
      </p>
      <p>Here are some practical tips:</p>
      <p>
        <strong>Use a template.</strong> Whether it&apos;s a spreadsheet or an app, having a
        consistent template means you won&apos;t forget key details.
      </p>
      <p>
        <strong>Invoice immediately.</strong> The sooner you send your invoice, the sooner you get
        paid. Waiting until the end of the month (or worse, when you &quot;get around to it&quot;)
        delays everything.
      </p>
      <p>
        <strong>Go digital.</strong> Paper invoices get lost. Email or app-based invoices create an
        automatic record and are easier for contractors to process.
      </p>
      <p>
        <strong>Automate the calculations.</strong> CIS deduction maths isn&apos;t hard, but doing
        it manually on every invoice is tedious and error-prone. This is where tools like{' '}
        <a href="https://yapmate.co.uk">YapMate</a> come in handy — you dictate the details of your
        job, and it handles the CIS calculations automatically, generating a professional invoice you
        can send straight away.
      </p>
      <p>
        <strong>Keep your CIS registration up to date.</strong> If your details change (name,
        address, business structure), update HMRC promptly to avoid verification issues.
      </p>

      <h2 id="what-happens-to-deductions">What Happens to Your CIS Deductions?</h2>
      <p>
        The money deducted from your invoices isn&apos;t gone — it&apos;s a credit against your tax
        bill. When you file your Self Assessment tax return, you declare all your income and claim
        back the CIS deductions already paid.
      </p>
      <p>
        If the deductions exceed your tax liability (which can happen, especially if you have
        significant allowable expenses), you&apos;ll get a refund from HMRC.
      </p>
      <p>Make sure you:</p>
      <ul>
        <li>Keep all your payment and deduction statements from contractors</li>
        <li>Reconcile them against your invoices</li>
        <li>Declare the correct figures on your tax return</li>
      </ul>
      <p>
        If a contractor hasn&apos;t given you a payment and deduction statement, chase them —
        you&apos;re legally entitled to one within 14 days of the end of each tax month.
      </p>

      <h2 id="faq">Frequently Asked Questions</h2>

      <h3>Do I need to put CIS deductions on my invoice?</h3>
      <p>
        Strictly speaking, the <strong>contractor</strong> is responsible for calculating and making
        the deduction. However, it&apos;s best practice to show the deduction on your invoice so
        both parties are clear on the expected payment. It also reduces disputes.
      </p>

      <h3>Can I invoice for CIS work without being registered?</h3>
      <p>
        Yes, but the contractor must deduct 30% instead of 20%. You&apos;re essentially losing an
        extra 10% of your labour income up front. Register — it&apos;s free and takes minutes.
      </p>

      <h3>What if I have gross payment status?</h3>
      <p>
        If HMRC has granted you gross payment status, the contractor deducts 0%. Your invoice should
        still show the CIS information, but the deduction line will be £0.00. You&apos;ll need to
        pay your full tax liability through Self Assessment.
      </p>

      <h3>How long should I keep CIS invoices?</h3>
      <p>
        HMRC requires you to keep records for at least 5 years after the 31 January submission
        deadline of the relevant tax year. In practice, keeping records for 6 years is safer.
      </p>

      <h2 id="wrapping-up">Wrapping Up</h2>
      <p>Creating a proper CIS invoice isn&apos;t difficult once you know what&apos;s required. The key points are:</p>
      <ul>
        <li>
          <strong>Separate labour and materials</strong> — always
        </li>
        <li>
          <strong>Include your UTR</strong> — every time
        </li>
        <li>
          <strong>Show the CIS deduction</strong> — clearly
        </li>
        <li>
          <strong>Be specific</strong> about the work done
        </li>
        <li>
          <strong>Invoice promptly</strong> — don&apos;t wait
        </li>
      </ul>
      <p>
        Getting this right means faster payments, fewer queries, and a much easier time when Self
        Assessment rolls around.
      </p>
      <p>
        If you&apos;re tired of fiddling with spreadsheets on site,{' '}
        <a href="https://yapmate.co.uk/app">give YapMate a try</a>. Just tell it what work
        you&apos;ve done, and it creates a professional, CIS-compliant invoice in seconds. It&apos;s
        built specifically for UK tradespeople who&apos;d rather be working than doing admin.
      </p>
    </BlogArticle>
  )
}
