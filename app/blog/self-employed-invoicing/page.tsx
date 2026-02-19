import type { Metadata } from 'next'
import BlogArticle, { Callout, InlineCTA } from '../_components/BlogArticle'
import { getPost } from '../_data'

const post = getPost('self-employed-invoicing')!

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

export default function SelfEmployedInvoicing() {
  return (
    <BlogArticle post={post}>
      <p>
        You&apos;ve done the work. Now you need to get paid. But if your invoice is missing key
        details — or worse, doesn&apos;t meet HMRC&apos;s requirements — you could be waiting
        longer than you should, or creating problems for your tax return down the line.
      </p>
      <p>
        Whether you&apos;re a plumber, electrician, builder, gardener, or any other self-employed
        tradesperson in the UK, this guide covers exactly what needs to go on your invoices, why it
        matters, and how to make the whole process as painless as possible.
      </p>

      <h2 id="do-you-need-invoices">Do Self-Employed People Need to Send Invoices?</h2>
      <p>Short answer: yes.</p>
      <p>
        While there&apos;s no specific law that says &quot;you must issue an invoice&quot; for every
        job (unless you&apos;re VAT registered — more on that later), invoices are the backbone of
        your financial records. HMRC expects you to keep accurate records of all your income and
        expenses, and invoices are how you do that.
      </p>
      <p>Beyond the legal side, invoices are simply good business. They:</p>
      <ul>
        <li>Make it clear what&apos;s owed and when</li>
        <li>Protect you in payment disputes</li>
        <li>Create a professional impression</li>
        <li>Make Self Assessment much easier</li>
        <li>Help you track your income throughout the year</li>
      </ul>

      <h2 id="hmrc-requirements">What HMRC Expects on a UK Invoice</h2>
      <p>
        HMRC doesn&apos;t prescribe an exact invoice format, but they do expect certain information
        to be present. Here&apos;s what every self-employed invoice should include:
      </p>

      <h3>1. Your Business Name and Contact Details</h3>
      <p>
        This means your trading name (or your own name if you trade under it), your address, phone
        number, and email. If you&apos;re a sole trader, you don&apos;t need a company registration
        number — that&apos;s for limited companies.
      </p>

      <h3>2. The Customer&apos;s Name and Address</h3>
      <p>
        Who are you billing? Get this right, especially if the customer is a business — use their
        registered trading name.
      </p>

      <h3>3. A Unique Invoice Number</h3>
      <p>
        Every invoice must have a unique, sequential number. This is non-negotiable. It&apos;s how
        you (and HMRC) can identify and track individual transactions.
      </p>
      <p>Good numbering systems include:</p>
      <ul>
        <li>Simple sequential: 001, 002, 003</li>
        <li>Year-based: 2026-001, 2026-002</li>
        <li>Prefix-based: INV-001, INV-002</li>
      </ul>
      <p>Pick a system and stick with it. Don&apos;t skip numbers or reuse them.</p>

      <h3>4. The Invoice Date</h3>
      <p>
        The date you issued the invoice. This is important for your records and for determining when
        payment is due.
      </p>

      <h3>5. A Clear Description of the Work or Services</h3>
      <p>
        This is where many tradespeople fall short. &quot;Work done at property&quot; isn&apos;t
        enough. Be specific:
      </p>
      <ul>
        <li>
          &quot;Replaced boiler and fitted new thermostatic radiator valves — 14 Elm Street,
          Bristol&quot;
        </li>
        <li>
          <em>Not</em> &quot;Plumbing work&quot;
        </li>
      </ul>
      <p>
        Detail protects you in disputes and satisfies HMRC&apos;s record-keeping requirements.
      </p>

      <h3>6. The Amount Charged</h3>
      <p>Break this down if possible:</p>
      <ul>
        <li>Labour costs</li>
        <li>Materials (listed separately, ideally with costs)</li>
        <li>Any other charges (call-out fees, travel, etc.)</li>
      </ul>
      <p>Showing a breakdown looks more professional and avoids customer queries.</p>

      <h3>7. The Total Amount Due</h3>
      <p>The bottom line — what the customer needs to pay.</p>

      <h3>8. Payment Terms</h3>
      <p>When do you expect to be paid? Common terms include:</p>
      <ul>
        <li>
          <strong>Due on receipt</strong> — payment expected immediately
        </li>
        <li>
          <strong>Net 7</strong> — within 7 days
        </li>
        <li>
          <strong>Net 14</strong> — within 14 days
        </li>
        <li>
          <strong>Net 30</strong> — within 30 days
        </li>
      </ul>
      <p>
        For tradespeople, shorter terms are generally better. &quot;Due within 14 days&quot; is
        standard in the trade. Some tradespeople request payment on completion, which is perfectly
        reasonable for smaller jobs.
      </p>

      <h3>9. Payment Methods</h3>
      <p>How can the customer pay you? Include:</p>
      <ul>
        <li>Bank transfer details (sort code, account number, account name)</li>
        <li>Whether you accept card payments</li>
        <li>Any online payment links</li>
      </ul>
      <p>The easier you make it to pay, the faster you&apos;ll get paid.</p>

      <h3>10. Your UTR Number (Optional but Recommended)</h3>
      <p>
        If you&apos;re working under CIS or your customer is a business that might need it for their
        records, including your Unique Taxpayer Reference is helpful.
      </p>

      <InlineCTA />

      <h2 id="vat-vs-non-vat">VAT Invoices vs Non-VAT Invoices</h2>
      <p>
        This is one of the biggest areas of confusion for self-employed tradespeople, so let&apos;s
        clear it up.
      </p>

      <h3>If You&apos;re NOT VAT Registered</h3>
      <p>
        If your annual turnover is below £85,000 (the current VAT threshold for 2025/26), you
        don&apos;t need to register for VAT. Your invoices should:
      </p>
      <ul>
        <li>
          <strong>Not</strong> include VAT
        </li>
        <li>
          <strong>Not</strong> show a VAT number
        </li>
        <li>
          <strong>Not</strong> include a VAT breakdown
        </li>
      </ul>
      <p>Simple. Just show your prices as the final amount.</p>

      <Callout type="warning">
        <p className="mb-0">
          <strong>Important:</strong> You must <strong>not</strong> charge VAT if you&apos;re not
          registered. This is illegal and can result in penalties.
        </p>
      </Callout>

      <h3>If You ARE VAT Registered</h3>
      <p>
        Once your turnover exceeds £85,000 (or you register voluntarily), your invoices must include
        additional information:
      </p>
      <ul>
        <li>Your VAT registration number</li>
        <li>The date of supply (tax point) — which may differ from the invoice date</li>
        <li>The net amount (before VAT)</li>
        <li>The VAT rate applied (usually 20%, but 5% or 0% for some goods/services)</li>
        <li>The VAT amount</li>
        <li>The gross total (including VAT)</li>
      </ul>
      <p>HMRC actually defines three types of VAT invoice:</p>
      <ol>
        <li>
          <strong>Full VAT invoice</strong> — for supplies over £250 (includes all details above)
        </li>
        <li>
          <strong>Simplified VAT invoice</strong> — for supplies under £250 (can omit some details)
        </li>
        <li>
          <strong>Modified VAT invoice</strong> — for retail supplies over £250
        </li>
      </ol>
      <p>For most tradespeople, you&apos;ll be issuing full VAT invoices.</p>

      <h3>VAT Flat Rate Scheme</h3>
      <p>
        Many self-employed tradespeople use the VAT Flat Rate Scheme, which simplifies things. You
        still charge 20% VAT on your invoices, but you pay HMRC a fixed percentage of your gross
        turnover (the percentage depends on your trade). The difference is yours to keep.
      </p>
      <p>
        Your invoices look the same to the customer — the flat rate only affects how you calculate
        what you owe HMRC.
      </p>

      <h2 id="professional-tips">Professional Tips for Better Invoices</h2>
      <p>
        Getting the basics right is essential, but if you want to get paid faster and look more
        professional, consider these tips:
      </p>

      <h3>Brand Your Invoices</h3>
      <p>
        Add your logo, use consistent colours, and make your invoices look professional. First
        impressions matter, and a well-designed invoice suggests you run a professional operation.
      </p>

      <h3>Include a Job Reference or Purchase Order Number</h3>
      <p>
        If your customer gave you a PO number or job reference, put it on the invoice. This makes it
        easier for them to process your payment — especially if they&apos;re a larger business with
        an accounts department.
      </p>

      <h3>Add Late Payment Terms</h3>
      <p>
        You&apos;re legally entitled to charge interest on late commercial payments under the Late
        Payment of Commercial Debts (Interest) Act 1998. Including a note like:
      </p>
      <blockquote>
        <p>
          &quot;We reserve the right to charge interest on overdue invoices at 8% above the Bank of
          England base rate, plus a fixed sum for debt recovery, in accordance with the Late Payment
          of Commercial Debts Act.&quot;
        </p>
      </blockquote>
      <p>This won&apos;t win you friends, but it can motivate prompt payment.</p>

      <h3>Send Invoices Promptly</h3>
      <p>
        This is the single biggest thing you can do to speed up payment. Invoice on the day you
        finish the job — or even on site, before you leave.
      </p>
      <p>
        This is one of the reasons we built <a href="https://yapmate.co.uk">YapMate</a>. As a
        tradesperson, you can dictate your invoice details on your phone right after finishing a job,
        and have a professional invoice generated and sent within minutes. No laptop needed, no
        waiting until you get home.
      </p>

      <h3>Keep Digital Records</h3>
      <p>Gone are the days of paper invoice books. Digital invoicing means:</p>
      <ul>
        <li>Automatic backups</li>
        <li>Easy searching and filtering</li>
        <li>Simpler Self Assessment preparation</li>
        <li>Professional PDF invoices you can email instantly</li>
      </ul>

      <h3>Number Your Invoices Properly from Day One</h3>
      <p>
        This sounds basic, but plenty of tradespeople start with random numbers, skip invoices, or
        restart their numbering. Start at 001 (or 0001 if you&apos;re optimistic) and go
        sequentially. Your future self — and your accountant — will thank you.
      </p>

      <h2 id="common-mistakes">Common Invoicing Mistakes Self-Employed Tradespeople Make</h2>

      <h3>Waiting Too Long to Invoice</h3>
      <p>
        We get it — after a long day on the tools, the last thing you want to do is sit down and
        type up invoices. But every day you delay is another day you&apos;re not getting paid. Make
        invoicing part of your end-of-job routine.
      </p>

      <h3>Not Chasing Overdue Invoices</h3>
      <p>
        Sending the invoice is only half the battle. If payment doesn&apos;t arrive by the due date,
        follow up immediately. A friendly reminder on day one of being overdue is much more effective
        than an angry phone call three months later.
      </p>

      <h3>Inconsistent Formatting</h3>
      <p>
        If every invoice looks different, it suggests disorganisation. Use a consistent template for
        every invoice.
      </p>

      <h3>Not Keeping Copies</h3>
      <p>
        HMRC requires you to keep records for at least five years after the 31 January Self
        Assessment deadline. That means invoices from the 2025/26 tax year need to be kept until at
        least January 2032. Digital records make this easy.
      </p>

      <h3>Forgetting to Include Payment Details</h3>
      <p>
        You&apos;d be surprised how often tradespeople send invoices without bank details. If the
        customer wants to pay by bank transfer and can&apos;t find your details, they&apos;ll put it
        to one side — and forget about it.
      </p>

      <h2 id="invoice-template">Invoice Template: What a Good Self-Employed Invoice Looks Like</h2>
      <p>Here&apos;s a simple structure you can follow:</p>

      <pre>
        <code>{`─────────────────────────────────────────────
[YOUR LOGO]

[Your Name / Business Name]
[Address]
[Phone] | [Email]

INVOICE

To: [Customer Name]
    [Customer Address]

Invoice No: INV-2026-015
Date: 18 February 2026

─────────────────────────────────────────────
Description                          Amount

Labour: [Detailed description]      £XXX.XX
Materials: [Itemised list]          £XXX.XX
[Other charges]                     £XXX.XX

─────────────────────────────────────────────
Subtotal                            £XXX.XX
VAT @ 20% (if applicable)          £XXX.XX
TOTAL DUE                          £XXX.XX

─────────────────────────────────────────────
Payment Terms: Due within 14 days
Bank: [Name] | Sort: XX-XX-XX | Acc: XXXXXXXX

Thank you for your business.
─────────────────────────────────────────────`}</code>
      </pre>

      <h2 id="checklist">Self-Employed Invoice Checklist</h2>
      <p>Before you hit send, run through this quick checklist:</p>
      <ul>
        <li>Your name/business name and contact details</li>
        <li>Customer name and address</li>
        <li>Unique sequential invoice number</li>
        <li>Invoice date</li>
        <li>Clear description of work done</li>
        <li>Labour and materials separated</li>
        <li>Total amount due</li>
        <li>VAT details (if VAT registered)</li>
        <li>Payment terms</li>
        <li>Bank/payment details</li>
        <li>PO number or job reference (if applicable)</li>
      </ul>

      <h2 id="final-thoughts">Final Thoughts</h2>
      <p>
        Invoicing might not be the most exciting part of being self-employed, but it&apos;s one of
        the most important. A clear, professional invoice gets you paid faster, keeps HMRC happy, and
        makes your end-of-year accounts a breeze.
      </p>
      <p>
        The good news? It doesn&apos;t have to be time-consuming. Whether you use a simple template,
        a spreadsheet, or an app like <a href="https://yapmate.co.uk/app">YapMate</a> that lets you
        create invoices by voice, the key is consistency: same format, same details, every time.
      </p>
      <p>Get your invoicing right, and the rest of your finances will follow.</p>
    </BlogArticle>
  )
}
