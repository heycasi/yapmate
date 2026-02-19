import type { Metadata } from 'next'
import BlogArticle, { Callout, InlineCTA } from '../_components/BlogArticle'
import { getPost } from '../_data'

const post = getPost('cis-deductions-explained')!

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

export default function CISDeductionsExplained() {
  return (
    <BlogArticle post={post}>
      <p>
        If you work as a subcontractor in the UK construction industry, money is being taken from
        your pay before you even see it. That&apos;s CIS — the Construction Industry Scheme — and
        understanding how it works is essential for managing your cash flow and making sure
        you&apos;re not paying more tax than you need to.
      </p>
      <p>
        This guide breaks down CIS deductions in plain English: what they are, how much gets taken,
        how to reduce them, and how to claim back any overpayments.
      </p>

      <h2 id="what-is-cis">What Is CIS?</h2>
      <p>
        The Construction Industry Scheme is HMRC&apos;s tax collection system for the construction
        sector. It requires <strong>contractors</strong> to deduct money from payments they make to{' '}
        <strong>subcontractors</strong> and pass that money directly to HMRC.
      </p>
      <p>
        It&apos;s essentially a way for HMRC to collect tax in advance. Rather than trusting every
        self-employed builder, plumber, and electrician to save up for their tax bill, the government
        takes a chunk at source.
      </p>
      <p>The deducted money counts as an advance payment towards your:</p>
      <ul>
        <li>Income Tax</li>
        <li>National Insurance contributions</li>
      </ul>
      <p>
        So it&apos;s not &quot;extra&quot; tax — it&apos;s tax you&apos;d owe anyway, just collected
        earlier.
      </p>

      <h2 id="who-does-cis-apply-to">Who Does CIS Apply To?</h2>
      <p>
        CIS applies to anyone working in the construction industry as a subcontractor, which covers a
        huge range of trades:
      </p>
      <ul>
        <li>Bricklaying and masonry</li>
        <li>Carpentry and joinery</li>
        <li>Plastering and rendering</li>
        <li>Plumbing and heating</li>
        <li>Electrical work</li>
        <li>Painting and decorating</li>
        <li>Roofing</li>
        <li>Scaffolding</li>
        <li>Groundwork and civil engineering</li>
        <li>Demolition</li>
        <li>Floor and wall tiling</li>
      </ul>
      <p>
        If you&apos;re doing any of this work for a contractor (rather than directly for a
        homeowner), CIS almost certainly applies.
      </p>

      <h3>What Counts as a &quot;Contractor&quot;?</h3>
      <p>
        In CIS terms, a contractor is anyone who pays subcontractors for construction work. This
        includes:
      </p>
      <ul>
        <li>Building and construction companies</li>
        <li>Property developers</li>
        <li>Local authorities and government bodies</li>
        <li>Housing associations</li>
        <li>
          Large businesses spending over £3 million per year on construction (even if that&apos;s not
          their main trade)
        </li>
      </ul>

      <h3>Does CIS Apply to Domestic Work?</h3>
      <p>
        Generally, no. If a homeowner hires you directly to do work on their own home, CIS
        doesn&apos;t apply. CIS kicks in when you&apos;re working for a{' '}
        <strong>business</strong> or <strong>contractor</strong> in the construction chain.
      </p>

      <h2 id="three-deduction-rates">The Three CIS Deduction Rates</h2>
      <p>
        Here&apos;s where it gets practical. There are three possible deduction rates, and which one
        applies to you depends on your registration status with HMRC.
      </p>

      <h3>20% — Standard Rate (Registered Subcontractor)</h3>
      <p>
        This is what most subcontractors pay. If you&apos;re registered for CIS with HMRC, your
        contractor will deduct <strong>20% from the labour portion</strong> of your invoice.
      </p>
      <p>
        Key point: the deduction applies to <strong>labour only</strong>, not materials. If your
        invoice is £1,000 for labour and £300 for materials, the 20% deduction applies to the £1,000
        — so £200 is deducted, and you receive £1,100 (£800 labour + £300 materials).
      </p>

      <h3>30% — Higher Rate (Unregistered Subcontractor)</h3>
      <p>
        If you haven&apos;t registered for CIS with HMRC, your contractor must deduct{' '}
        <strong>30% from the labour element</strong>. Using the same example above, that would be
        £300 deducted instead of £200 — a £100 difference on a single invoice.
      </p>
      <p>
        Over the course of a year, that adds up to thousands of pounds in unnecessary deductions.
        Yes, you can claim it back on your tax return, but in the meantime your cash flow takes a
        serious hit.
      </p>

      <Callout type="tip">
        <p className="mb-0">
          <strong>Bottom line: register for CIS.</strong> It&apos;s free, it takes minutes, and
          there&apos;s absolutely no reason not to.
        </p>
      </Callout>

      <h3>0% — Gross Payment Status</h3>
      <p>
        Some subcontractors qualify for gross payment status, meaning{' '}
        <strong>no deductions</strong> are made. You receive the full invoice amount and are
        responsible for paying your own tax through Self Assessment.
      </p>
      <p>To qualify, you generally need:</p>
      <ul>
        <li>
          A consistent track record of tax compliance (tax returns filed on time, tax paid on time)
        </li>
        <li>A minimum turnover threshold (currently £30,000 per year for sole traders)</li>
        <li>To have been in business for a sufficient period</li>
      </ul>
      <p>
        HMRC reviews gross payment status annually, and it can be withdrawn if you fall behind on tax
        obligations. It&apos;s worth pursuing if you qualify, as it significantly improves cash flow.
      </p>

      <h2 id="how-calculated">How CIS Deductions Are Calculated: Step by Step</h2>
      <p>Let&apos;s walk through a real example to make this crystal clear.</p>
      <p>
        <strong>Scenario:</strong> You&apos;re a registered plasterer. You&apos;ve just finished a
        job and your invoice breaks down as follows:
      </p>
      <ul>
        <li>Labour: £1,500</li>
        <li>Materials (plaster, beads, PVA): £250</li>
        <li>
          <strong>Invoice total: £1,750</strong>
        </li>
      </ul>

      <p>
        <strong>Step 1:</strong> The contractor verifies your CIS status with HMRC (they do this
        online — it&apos;s their responsibility).
      </p>
      <p>
        <strong>Step 2:</strong> HMRC confirms you&apos;re registered at the 20% rate.
      </p>
      <p>
        <strong>Step 3:</strong> The contractor calculates the deduction: 20% of £1,500 (labour
        only) = <strong>£300</strong>
      </p>
      <p>
        <strong>Step 4:</strong> The contractor pays you: £1,750 - £300 ={' '}
        <strong>£1,450</strong>
      </p>
      <p>
        <strong>Step 5:</strong> The contractor sends the £300 to HMRC and issues you a payment and
        deduction statement (PDS).
      </p>
      <p>
        <strong>Step 6:</strong> The £300 is credited against your tax bill when you file your Self
        Assessment.
      </p>

      <h3>What If You Don&apos;t Separate Labour and Materials?</h3>
      <p>
        If your invoice doesn&apos;t clearly separate labour from materials, the contractor must
        apply the CIS deduction to the <strong>entire amount</strong>. In the example above, that
        would mean: 20% of £1,750 = £350 deducted (instead of £300).
      </p>
      <p>
        You&apos;d lose an extra £50 for no reason. This is why properly formatted invoices matter —
        and why tools like <a href="https://yapmate.co.uk">YapMate</a> automatically separate labour
        and materials when you dictate your invoice, ensuring the CIS calculation is always correct.
      </p>

      <InlineCTA />

      <h2 id="payment-statements">Payment and Deduction Statements</h2>
      <p>
        Every time a contractor makes a CIS deduction from your payment, they must provide you with a{' '}
        <strong>payment and deduction statement</strong> (PDS). This is your proof that tax has been
        paid on your behalf.
      </p>
      <p>A PDS must include:</p>
      <ul>
        <li>The contractor&apos;s name, address, and employer&apos;s tax reference</li>
        <li>Your name and UTR</li>
        <li>The tax month it relates to</li>
        <li>The gross amount, deduction amount, and net payment</li>
        <li>Whether the payment includes materials costs</li>
      </ul>
      <p>
        <strong>
          Contractors must issue PDS documents within 14 days of the end of each tax month
        </strong>{' '}
        (tax months run from the 6th of one month to the 5th of the next).
      </p>

      <h3>Why PDS Documents Matter</h3>
      <p>
        Keep every single one. When you file your Self Assessment, you&apos;ll need to declare your
        CIS income and claim the deductions back as tax credits. Without PDS documents, you
        can&apos;t prove what was deducted.
      </p>
      <p>
        If a contractor isn&apos;t giving you payment statements, chase them. It&apos;s a legal
        requirement, and you have the right to these documents.
      </p>

      <h2 id="how-to-register">How to Register for CIS</h2>
      <p>Registration is straightforward. Here&apos;s how:</p>

      <h3>Online (Quickest Method)</h3>
      <ol>
        <li>
          Go to{' '}
          <a
            href="https://www.gov.uk/what-is-the-construction-industry-scheme"
            target="_blank"
            rel="noopener noreferrer"
          >
            gov.uk/what-is-the-construction-industry-scheme
          </a>
        </li>
        <li>Sign in with your Government Gateway account (or create one)</li>
        <li>You&apos;ll need your UTR and National Insurance number</li>
        <li>Follow the registration steps</li>
      </ol>

      <h3>By Phone</h3>
      <p>
        Call the CIS helpline on <strong>0300 200 3210</strong> (Monday to Friday, 8am to 6pm).
      </p>

      <h3>What You&apos;ll Need</h3>
      <ul>
        <li>
          Your UTR (Unique Taxpayer Reference) — if you don&apos;t have one, register as
          self-employed first
        </li>
        <li>Your National Insurance number</li>
        <li>Your business details (trading name, address)</li>
      </ul>
      <p>
        Registration is usually processed within a few days. Once registered, contractors can verify
        you at the 20% rate.
      </p>

      <h2 id="self-assessment">How CIS Affects Your Self Assessment</h2>
      <p>
        CIS deductions are advance payments towards your tax bill — they&apos;re not a separate tax.
        When you complete your Self Assessment tax return, here&apos;s what happens:
      </p>
      <ol>
        <li>You declare your total construction income (the gross amounts, before deductions)</li>
        <li>You enter the total CIS deductions made during the tax year</li>
        <li>HMRC calculates your actual tax liability (Income Tax + National Insurance)</li>
        <li>The CIS deductions are subtracted from what you owe</li>
      </ol>

      <h3>Three Possible Outcomes</h3>
      <p>
        <strong>You owe more tax than was deducted:</strong> You pay the difference. This can happen
        if you have other income, or if your expenses are low relative to your turnover.
      </p>
      <p>
        <strong>Your deductions match your liability:</strong> Perfect — nothing more to pay, nothing
        to claim back.
      </p>
      <p>
        <strong>More was deducted than you owe:</strong> You get a refund. This is more common than
        you&apos;d think, especially if you have significant business expenses.
      </p>

      <h2 id="reclaiming-overpayments">Reclaiming CIS Overpayments</h2>
      <p>
        If you&apos;ve had more CIS tax deducted than you actually owe, you can reclaim the
        difference through your Self Assessment tax return.
      </p>
      <p>Common reasons for overpayment:</p>
      <ul>
        <li>You have substantial business expenses that reduce your profit</li>
        <li>
          You were deducted at 30% because you weren&apos;t registered (register now to avoid this!)
        </li>
        <li>You have other tax reliefs or allowances</li>
        <li>Your total income is below the personal allowance (£12,570 for 2025/26)</li>
      </ul>

      <h3>How to Claim a CIS Refund</h3>
      <ol>
        <li>File your Self Assessment by the deadline (31 January for online returns)</li>
        <li>
          Complete the self-employment pages and the CIS deductions section accurately
        </li>
        <li>
          If you&apos;re owed a refund, HMRC will process it — usually within 4-8 weeks of filing
        </li>
      </ol>

      <h3>Speed Up Your Refund</h3>
      <ul>
        <li>File early. Don&apos;t wait until January — you can file from April onwards.</li>
        <li>
          Make sure your figures match. Check your CIS deductions against your payment and deduction
          statements.
        </li>
        <li>Keep your bank details up to date with HMRC so refunds can be paid directly.</li>
      </ul>

      <h2 id="common-questions">Common CIS Questions</h2>

      <h3>Can I Be Both a Contractor and a Subcontractor?</h3>
      <p>
        Yes. Many tradespeople both hire subcontractors and work as subcontractors themselves.
        You&apos;d need to register as both with HMRC. When you hire subs, you must verify them, make
        deductions, and file monthly CIS returns. When you work as a sub, your contractors deduct
        from your payments.
      </p>

      <h3>Do I Pay National Insurance on Top of CIS?</h3>
      <p>
        CIS deductions count towards Income Tax and NI. However, you may still need to make
        additional NI payments through Self Assessment, depending on your total profits. Class 2 NI
        is currently paid through Self Assessment for profits above £6,725 (2025/26), and Class 4 NI
        applies at 6% on profits between £12,570 and £50,270.
      </p>

      <h3>What If I&apos;m on CIS and Also Do Private Work?</h3>
      <p>
        CIS only applies to payments from contractors for construction work. If you also do private
        domestic work (e.g., a kitchen fit for a homeowner), those jobs don&apos;t involve CIS
        deductions. You still need to declare that income on your tax return, but no one deducts from
        it at source — you&apos;re responsible for the full tax yourself.
      </p>

      <h3>What Happens If I Don&apos;t Register for CIS?</h3>
      <p>
        Your contractors will deduct 30% instead of 20%. You&apos;ll get the excess back when you
        file your tax return, but your cash flow will suffer in the meantime. There&apos;s no penalty
        for not registering, but there&apos;s a significant financial incentive to do so.
      </p>

      <h3>Can My CIS Deductions Cover My Full Tax Bill?</h3>
      <p>
        Sometimes, yes. If your CIS deductions over the year are higher than your total Income Tax
        and NI liability, you won&apos;t owe anything at Self Assessment and you&apos;ll receive a
        refund for the difference.
      </p>

      <h2 id="practical-tips">Practical Tips for Managing CIS Deductions</h2>
      <ol>
        <li>
          <strong>Register for CIS immediately</strong> if you haven&apos;t already — get the 20%
          rate.
        </li>
        <li>
          <strong>Always separate labour and materials</strong> on your invoices to avoid
          over-deduction.
        </li>
        <li>
          <strong>Keep every payment and deduction statement</strong> — you need them for your tax
          return.
        </li>
        <li>
          <strong>Track your deductions throughout the year</strong> so there are no surprises at Self
          Assessment time.
        </li>
        <li>
          <strong>File your tax return early</strong> to get any refund sooner.
        </li>
        <li>
          <strong>Use an invoicing tool that understands CIS.</strong>{' '}
          <a href="https://yapmate.co.uk/app">YapMate</a> is designed for UK tradespeople and
          automatically handles CIS calculations when you create invoices by voice — meaning the
          labour/materials split and deduction amounts are always right.
        </li>
      </ol>

      <h2 id="summary">Summary</h2>
      <p>CIS deductions are straightforward once you understand the mechanics:</p>
      <ul>
        <li>
          <strong>20%</strong> if you&apos;re registered (and you should be)
        </li>
        <li>
          <strong>30%</strong> if you&apos;re not registered (don&apos;t let this happen)
        </li>
        <li>
          <strong>0%</strong> if you have gross payment status (aim for this eventually)
        </li>
        <li>
          Deductions apply to <strong>labour only</strong>, not materials
        </li>
        <li>
          Everything is reconciled through <strong>Self Assessment</strong>
        </li>
        <li>
          You can <strong>claim back overpayments</strong> as a refund
        </li>
      </ul>
      <p>
        The system isn&apos;t perfect, but it&apos;s not going anywhere. The best thing you can do is
        understand it, register properly, invoice correctly, and keep good records.
      </p>
      <p>
        <em>
          Want to make CIS invoicing effortless?{' '}
          <a href="https://yapmate.co.uk/app">Try YapMate</a> — dictate your invoice, and
          we&apos;ll handle the CIS maths for you.
        </em>
      </p>
    </BlogArticle>
  )
}
