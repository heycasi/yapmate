import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | YapMate',
  description: 'Privacy Policy for YapMate - Voice-to-Invoice Application',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-yapmate-black text-yapmate-gray-lightest">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-yapmate-white mb-2">Privacy Policy</h1>
        <p className="text-yapmate-gray-light mb-8">Last updated: 4 January 2026</p>

        <div className="space-y-6 text-yapmate-gray-lightest leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Introduction</h2>
            <p>
              YapMate is a voice-to-invoice application designed for tradespeople in the United Kingdom.
              This Privacy Policy explains how we collect, use, and protect your personal information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Data We Collect</h2>
            <p className="mb-2">When you use YapMate, we collect the following information:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Name</li>
              <li>Email address</li>
              <li>User ID</li>
              <li>Audio data (voice recordings you choose to submit)</li>
              <li>Purchase and subscription status (via Apple In-App Purchases)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">How We Use Your Data</h2>
            <p className="mb-2">We collect and process your personal information for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Account creation and management</li>
              <li>Voice-to-invoice processing</li>
              <li>Subscription access and billing validation</li>
              <li>Customer support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Audio Data Handling</h2>
            <p className="mb-2">
              Audio recordings are only processed when you actively choose to record using the application.
              Voice data is used solely to generate invoice text and structured data for your records.
              We process audio using third-party cloud AI services for transcription purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Third-Party Services</h2>
            <p className="mb-2">YapMate uses the following third-party services:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Apple In-App Purchases (for subscription management and billing)</li>
              <li>Cloud AI processing services (for audio transcription)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Data Retention</h2>
            <p>
              We retain your personal data only as long as necessary to provide the service and fulfill the purposes
              outlined in this Privacy Policy. You may request deletion of your account and associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Your Rights</h2>
            <p className="mb-2">Under UK data protection law, you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us at the email address below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or wish to exercise your data rights,
              please contact us at:
            </p>
            <p className="mt-2">
              <a href="mailto:support@yapmate.co.uk" className="text-yapmate-yellow hover:underline">
                support@yapmate.co.uk
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Jurisdiction</h2>
            <p>
              YapMate operates under the laws of the United Kingdom. This Privacy Policy is governed by UK data protection
              legislation, including the UK GDPR and the Data Protection Act 2018.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-yapmate-white mb-3">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated
              revision date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
