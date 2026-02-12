import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Use | YapMate',
  description: 'Terms of Use for YapMate - Voice-to-Invoice Application',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-yapmate-black text-yapmate-gray-lightest">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-yapmate-white mb-2">Terms of Use</h1>
        <p className="text-yapmate-gray-light mb-8">Last updated: 14 January 2026</p>

        <div className="space-y-6 text-yapmate-gray-lightest leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Introduction</h2>
            <p>
              Welcome to YapMate. These Terms of Use govern your access to and use of the YapMate application
              and services. By using YapMate, you agree to be bound by these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Acceptance of Terms</h2>
            <p>
              By creating an account or using YapMate, you confirm that you accept these Terms of Use and agree
              to comply with them. If you do not agree to these terms, you must not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Description of Service</h2>
            <p>
              YapMate is a voice-to-invoice application designed for tradespeople in the United Kingdom.
              The service allows you to create professional invoices using voice input, with features including
              VAT calculations and PDF generation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Subscription Plans</h2>
            <p className="mb-2">YapMate offers the following subscription tiers:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Free Plan:</strong> Limited to 3 invoices with basic features</li>
              <li><strong>Pro Plan:</strong> Unlimited invoices, VAT support, and premium features</li>
              {/* Trade Plan disabled for v1.0 App Store submission */}
              {/* <li><strong>Trade Plan:</strong> All Pro features plus CIS deductions and priority support</li> */}
            </ul>
            <p className="mt-3">
              Subscriptions are processed through Apple In-App Purchases and are subject to Apple&apos;s terms and conditions.
              Apple may offer a free trial period for eligible new subscribers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Payment and Billing</h2>
            <p>
              Subscription fees are charged on a monthly basis and will automatically renew unless cancelled.
              You may cancel your subscription at any time through your Apple ID account settings. Cancellations
              take effect at the end of the current billing period. Refunds are subject to Apple&apos;s refund policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">User Responsibilities</h2>
            <p className="mb-2">When using YapMate, you agree to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Provide accurate information in your invoices</li>
              <li>Comply with all applicable UK tax laws and regulations</li>
              <li>Use the service only for lawful purposes</li>
              <li>Maintain the security of your account credentials</li>
              <li>Not attempt to circumvent subscription limitations or features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Accuracy of Information</h2>
            <p>
              While YapMate uses AI to generate invoice data from voice recordings, you are solely responsible
              for reviewing and verifying the accuracy of all invoice information before sending to customers.
              YapMate is a tool to assist invoice creation and does not provide financial, tax, or legal advice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Intellectual Property</h2>
            <p>
              The YapMate application, including its design, code, and content, is owned by YapMate and protected
              by intellectual property laws. You retain ownership of the invoice data and content you create using
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Service Availability</h2>
            <p>
              We strive to maintain continuous service availability but do not guarantee uninterrupted access.
              We reserve the right to modify, suspend, or discontinue any aspect of the service at any time,
              with or without notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Limitation of Liability</h2>
            <p>
              YapMate is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages
              arising from your use of the service, including but not limited to errors in generated invoices,
              data loss, or business interruption. Your use of YapMate is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Account Termination</h2>
            <p>
              You may delete your account at any time through the Settings page. We reserve the right to
              suspend or terminate accounts that violate these Terms of Use or engage in fraudulent activity.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Privacy</h2>
            <p>
              Your use of YapMate is also governed by our{' '}
              <a href="/privacy" className="text-yapmate-yellow hover:underline">
                Privacy Policy
              </a>
              , which explains how we collect, use, and protect your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Changes to Terms</h2>
            <p>
              We may update these Terms of Use from time to time. Any changes will be posted on this page with
              an updated revision date. Your continued use of YapMate after changes are posted constitutes
              acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Governing Law</h2>
            <p>
              These Terms of Use are governed by the laws of England and Wales. Any disputes arising from these
              terms or your use of YapMate shall be subject to the exclusive jurisdiction of the courts of
              England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Contact Us</h2>
            <p>
              If you have any questions about these Terms of Use, please contact us at:
            </p>
            <p className="mt-2">
              <a href="mailto:support@yapmate.co.uk" className="text-yapmate-yellow hover:underline">
                support@yapmate.co.uk
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
