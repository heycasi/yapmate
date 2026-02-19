import type { Metadata } from 'next'
import BlogArticle, { Callout, InlineCTA } from '../_components/BlogArticle'
import { getPost } from '../_data'

const post = getPost('chase-late-payments')!

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

export default function ChaseLatePayments() {
  return (
    <BlogArticle post={post}>
      <p>
        Late payments are one of the biggest headaches in the trades. You&apos;ve done the work,
        you&apos;ve sent the invoice, and now you&apos;re waiting. And waiting. And chasing. And
        still waiting.
      </p>
      <p>
        You&apos;re not alone. Research from January 2026 found that{' '}
        <strong>68% of UK tradespeople are currently chasing at least one late payment</strong>, with
        the average amount owed sitting at over £2,000. Separate research by Direct Line found that
        the average tradesperson is chasing a staggering <strong>£6,000</strong> in unpaid invoices
        at any given time.
      </p>
      <p>
        That&apos;s not just frustrating — it&apos;s money you&apos;ve already earned being kept
        from you. It affects your ability to buy materials, pay your own bills, and run your
        business.
      </p>
      <p>
        This guide covers practical strategies to prevent late payments, chase them effectively when
        they happen, and know your legal options when a customer simply won&apos;t pay.
      </p>

      <h2 id="prevention">Prevention Is Better Than Chasing</h2>
      <p>
        The best late payment strategy is to avoid them in the first place. Here&apos;s how to stack
        the odds in your favour before you even pick up a tool.
      </p>

      <h3>1. Agree Payment Terms Before Starting Work</h3>
      <p>
        Never start a job without agreeing when and how you&apos;ll be paid. This conversation should
        happen during the quoting stage, not after the work is done.
      </p>
      <p>Put it in writing — even a simple text or email confirming:</p>
      <ul>
        <li>The total cost (or your day rate / hourly rate)</li>
        <li>When payment is due (on completion, within 14 days, etc.)</li>
        <li>How they can pay (bank transfer, card, cash)</li>
        <li>Whether you require a deposit</li>
      </ul>

      <h3>2. Take Deposits for Larger Jobs</h3>
      <p>
        For anything more than a day&apos;s work, it&apos;s standard practice to ask for a deposit.
        Common structures include:
      </p>
      <ul>
        <li>
          <strong>50% upfront, 50% on completion</strong> — the most common for medium jobs
        </li>
        <li>
          <strong>Staged payments</strong> — e.g., 30% upfront, 40% at mid-point, 30% on completion
          (for larger projects)
        </li>
        <li>
          <strong>Materials upfront, labour on completion</strong> — ensures you&apos;re never out of
          pocket for supplies
        </li>
      </ul>
      <p>
        Deposits serve two purposes: they protect your cash flow, and they filter out customers who
        aren&apos;t serious about paying.
      </p>

      <h3>3. Invoice Immediately</h3>
      <p>
        This is the single most effective thing you can do. The longer you wait to send an invoice,
        the longer you wait to get paid. Every day between finishing the job and sending the invoice
        is a day wasted.
      </p>
      <p>
        Ideally, you should invoice on the same day you complete the work — or even on site, before
        you leave. This is one of the core reasons{' '}
        <a href="https://yapmate.co.uk">YapMate</a> exists: you can dictate your invoice details on
        your phone straight after finishing a job and send a professional invoice within minutes. No
        waiting until you get home, no &quot;I&apos;ll do it at the weekend.&quot;
      </p>

      <h3>4. Make It Easy to Pay</h3>
      <p>Remove every possible barrier to payment:</p>
      <ul>
        <li>Include bank details clearly on every invoice</li>
        <li>Offer multiple payment methods if possible (bank transfer, card)</li>
        <li>Include a payment link if your invoicing tool supports it</li>
      </ul>
      <p>
        If someone has to phone you to ask for your bank details, that&apos;s a delay you created.
      </p>

      <h3>5. Use Clear, Short Payment Terms</h3>
      <p>
        &quot;Payment due within 30 days&quot; is standard in many industries, but for tradespeople,
        shorter is better:
      </p>
      <ul>
        <li>
          <strong>Due on completion</strong> — for smaller jobs
        </li>
        <li>
          <strong>Due within 7 days</strong> — reasonable for most trade work
        </li>
        <li>
          <strong>Due within 14 days</strong> — the maximum you should consider for domestic clients
        </li>
      </ul>
      <p>
        The longer your payment terms, the more likely the customer will forget or deprioritise your
        invoice.
      </p>

      <InlineCTA />

      <h2 id="step-by-step">How to Chase Late Payments: A Step-by-Step Approach</h2>
      <p>
        Despite your best efforts, some payments will be late. Here&apos;s a structured approach to
        chasing them without damaging customer relationships (or your sanity).
      </p>

      <h3>Day 1 Past Due: Friendly Reminder</h3>
      <p>
        The day after your payment deadline, send a polite reminder. Most late payments aren&apos;t
        malicious — people simply forget, or the invoice slipped through the cracks.
      </p>
      <p>
        <strong>Template — Friendly Reminder:</strong>
      </p>
      <blockquote>
        <p>
          Subject: Invoice [number] — Friendly Payment Reminder
          <br />
          <br />
          Hi [Name],
          <br />
          <br />
          Just a quick note to let you know that invoice [number] for £[amount] was due on [date]. I
          appreciate things get busy, so this is just a gentle reminder.
          <br />
          <br />
          For reference, the invoice was for [brief description of work] at [address].
          <br />
          <br />
          My bank details are:
          <br />
          [Sort code] | [Account number] | [Account name]
          <br />
          <br />
          If you&apos;ve already sent payment, please ignore this — and thanks!
          <br />
          <br />
          Cheers,
          <br />
          [Your name]
        </p>
      </blockquote>
      <p>Keep it friendly. No accusatory language. Assume goodwill.</p>

      <h3>Day 7 Past Due: Firm Follow-Up</h3>
      <p>
        If the first reminder didn&apos;t work, follow up after a week. This time, be slightly more
        direct.
      </p>
      <p>
        <strong>Template — Follow-Up:</strong>
      </p>
      <blockquote>
        <p>
          Subject: Invoice [number] — Payment Now Overdue
          <br />
          <br />
          Hi [Name],
          <br />
          <br />
          I&apos;m following up on invoice [number] for £[amount], which was due on [date] and is now
          [X] days overdue.
          <br />
          <br />
          I&apos;d appreciate if you could arrange payment at your earliest convenience. If
          there&apos;s an issue with the invoice or the work, please let me know and I&apos;m happy
          to discuss.
          <br />
          <br />
          Payment can be made by bank transfer to:
          <br />
          [Sort code] | [Account number] | [Account name]
          <br />
          <br />
          Thanks,
          <br />
          [Your name]
        </p>
      </blockquote>

      <h3>Day 14 Past Due: Final Notice Before Escalation</h3>
      <p>
        If two weeks have passed with no response, it&apos;s time to send a more formal notice.
      </p>
      <p>
        <strong>Template — Final Notice:</strong>
      </p>
      <blockquote>
        <p>
          Subject: Invoice [number] — Final Payment Notice
          <br />
          <br />
          Dear [Name],
          <br />
          <br />
          This is a final notice regarding invoice [number] for £[amount], dated [date], which is now
          [X] days overdue.
          <br />
          <br />
          I have not received payment or any communication regarding this invoice despite previous
          reminders sent on [dates].
          <br />
          <br />
          Under the Late Payment of Commercial Debts (Interest) Act 1998, I am entitled to charge
          statutory interest of 8% above the Bank of England base rate on overdue invoices, plus a
          fixed compensation fee. I would prefer not to exercise this right and would appreciate
          prompt payment to resolve this matter.
          <br />
          <br />
          Please arrange payment within 7 days of this notice. If I do not receive payment or hear
          from you by [date], I will need to consider further action.
          <br />
          <br />
          Regards,
          <br />
          [Your name]
          <br />
          [Your business name]
        </p>
      </blockquote>

      <h3>Day 30+: Escalation Options</h3>
      <p>
        If none of your reminders have worked after a month, you have several options depending on
        the amount and the situation.
      </p>

      <h2 id="legal-options">Your Legal Options for Unpaid Invoices</h2>

      <h3>The Late Payment of Commercial Debts (Interest) Act 1998</h3>
      <p>
        This legislation is your friend. If your customer is a <strong>business</strong> (not a
        private individual for personal work), you have the statutory right to:
      </p>
      <p>
        <strong>Charge interest:</strong> 8% per year above the Bank of England base rate, calculated
        daily from the day after the payment deadline.
      </p>
      <p>
        <strong>Claim compensation:</strong> A fixed sum based on the debt amount:
      </p>
      <ul>
        <li>Up to £999.99: £40</li>
        <li>£1,000 to £9,999.99: £70</li>
        <li>£10,000 or more: £100</li>
      </ul>
      <p>
        <strong>Claim reasonable recovery costs:</strong> If you&apos;ve spent money trying to
        recover the debt (e.g., solicitor&apos;s letters), you can add these costs.
      </p>

      <Callout type="warning">
        <p className="mb-0">
          <strong>Important:</strong> This Act applies to <strong>business-to-business</strong>{' '}
          transactions. If your customer is a private homeowner, different rules apply (you&apos;d
          need to rely on contract law instead).
        </p>
      </Callout>

      <h3>Letter Before Action</h3>
      <p>
        Before taking formal legal steps, you should send a &quot;Letter Before Action&quot; (LBA).
        This is a formal letter giving the debtor a final chance to pay (usually 14 days) before you
        commence legal proceedings.
      </p>
      <p>
        An LBA often prompts payment because it signals you&apos;re serious. Many disputes are
        resolved at this stage.
      </p>

      <h3>Small Claims Court (Money Claim Online)</h3>
      <p>
        For debts up to £10,000 in England and Wales, you can use the small claims track. The process
        is:
      </p>
      <ol>
        <li>
          <strong>File a claim online</strong> at moneyclaims.service.gov.uk
        </li>
        <li>
          <strong>Pay the court fee</strong> — ranges from £35 (for claims up to £300) to £455 (for
          claims up to £10,000)
        </li>
        <li>
          <strong>The defendant has 14 days to respond</strong>
        </li>
        <li>If they don&apos;t respond, you can request a default judgment</li>
        <li>If they dispute it, a hearing may be scheduled</li>
      </ol>
      <p>
        The small claims court is designed to be used without a solicitor. It&apos;s straightforward,
        relatively inexpensive, and often effective — many people pay up as soon as they receive
        court papers.
      </p>

      <h3>Mediation</h3>
      <p>
        For disputes where the relationship matters or the facts are contested, mediation can be a
        good option. A neutral mediator helps both parties reach an agreement. It&apos;s cheaper and
        faster than court, and the success rate is high.
      </p>
      <p>
        The Small Business Commissioner also offers a free complaints and resolution service for late
        payment disputes.
      </p>

      <h3>Debt Collection Agencies</h3>
      <p>
        For commercial debts, you can instruct a debt collection agency. They&apos;ll chase the
        payment on your behalf (usually for a percentage of the recovered amount). This can be
        effective for larger sums where you don&apos;t want to manage the process yourself.
      </p>

      <h3>When to Write Off a Bad Debt</h3>
      <p>
        Sometimes, despite your best efforts, you won&apos;t get paid. It&apos;s a painful reality
        of running a trade business. Consider writing off a debt when:
      </p>
      <ul>
        <li>The debtor has no assets or has gone into insolvency</li>
        <li>The cost of pursuing the debt exceeds the amount owed</li>
        <li>You&apos;ve exhausted all reasonable options</li>
        <li>The stress of chasing is affecting your wellbeing or ability to work</li>
      </ul>
      <p>
        If you write off a bad debt, keep records — you can reduce your taxable income by the amount
        of genuinely irrecoverable debts.
      </p>

      <h2 id="common-excuses">How to Handle Common Excuses</h2>
      <p>You&apos;ve heard them all before. Here&apos;s how to respond:</p>

      <h3>&quot;I&apos;ll pay you next week&quot;</h3>
      <p>
        <em>
          &quot;Thanks for letting me know. I&apos;ll follow up on [specific date] to confirm
          payment has been made.&quot;
        </em>
      </p>
      <p>Pin down a specific date and follow up on it. Vague promises need concrete deadlines.</p>

      <h3>&quot;I&apos;m not happy with the work&quot;</h3>
      <p>
        <em>
          &quot;I&apos;m sorry to hear that — can you tell me specifically what the issue is?
          I&apos;m happy to come back and look at it. In the meantime, the undisputed portion of the
          invoice is still due for payment.&quot;
        </em>
      </p>
      <p>
        Genuine complaints should be addressed. But a complaint raised only after you&apos;ve chased
        for payment is often a delay tactic. Don&apos;t let it derail the payment conversation
        entirely.
      </p>

      <h3>&quot;I never received the invoice&quot;</h3>
      <p>
        <em>
          &quot;No problem — I&apos;ll resend it right now. Here it is [attach]. Payment is due
          within [X] days of today&apos;s date.&quot;
        </em>
      </p>
      <p>
        This is why sending invoices by email (with a read receipt or tracking if possible) is better
        than paper. It&apos;s also why invoicing immediately matters — if you invoice on the day of
        completion, this excuse has less credibility.
      </p>

      <h3>&quot;Money&apos;s tight at the moment&quot;</h3>
      <p>
        <em>
          &quot;I understand — can we set up a payment plan? I&apos;m happy to accept [amount] per
          week/month until the balance is cleared.&quot;
        </em>
      </p>
      <p>
        Something is better than nothing. A payment plan keeps money flowing and shows you&apos;re
        reasonable. Get it in writing.
      </p>

      <h3>Radio silence — no response at all</h3>
      <p>
        Move to formal written notices and then legal options. Someone who won&apos;t even respond to
        communications is unlikely to pay without pressure.
      </p>

      <h2 id="good-habits">Building Good Payment Habits</h2>
      <p>
        Long-term, the best way to deal with late payments is to build a business where they rarely
        happen:
      </p>
      <ol>
        <li>
          <strong>Vet your customers</strong> — ask around, check reviews, trust your instincts
        </li>
        <li>
          <strong>Always get terms in writing</strong> — even if it&apos;s just a text message
        </li>
        <li>
          <strong>Take deposits</strong> — especially for new customers or larger jobs
        </li>
        <li>
          <strong>Invoice the same day you finish</strong> — use tools that make this instant
        </li>
        <li>
          <strong>Follow up promptly</strong> — don&apos;t let overdue invoices drift
        </li>
        <li>
          <strong>Keep detailed records</strong> — photos of completed work, signed-off job sheets,
          email confirmations
        </li>
        <li>
          <strong>Be professional</strong> — clear invoices, clear communication, clear terms
        </li>
      </ol>

      <h2 id="key-takeaways">Key Takeaways</h2>
      <ul>
        <li>
          <strong>68% of tradespeople</strong> are chasing late payments — it&apos;s an
          industry-wide issue, not just your problem
        </li>
        <li>
          <strong>Prevention works better than chasing</strong> — deposits, clear terms, and
          immediate invoicing are your best tools
        </li>
        <li>
          <strong>Follow a structured chase process</strong> — friendly reminder → firm follow-up →
          final notice → legal action
        </li>
        <li>
          <strong>Know your rights</strong> — the Late Payment of Commercial Debts Act gives you
          statutory interest and compensation
        </li>
        <li>
          <strong>Small claims court is accessible</strong> — you don&apos;t need a solicitor for
          claims up to £10,000
        </li>
        <li>
          <strong>Sometimes you have to write off</strong> — but keep records for tax purposes
        </li>
      </ul>
      <p>
        Late payments will never disappear entirely, but with the right systems in place, you can
        minimise them and deal with them efficiently when they do occur.
      </p>
      <p>
        <em>
          The fastest way to reduce late payments? Don&apos;t delay your invoices.{' '}
          <a href="https://yapmate.co.uk/app">Try YapMate</a> and send professional invoices from
          your phone the moment the job&apos;s done.
        </em>
      </p>
    </BlogArticle>
  )
}
