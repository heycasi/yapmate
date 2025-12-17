YapMate Roadmap (UK-only, Accent-first)

Product goal

YapMate helps UK tradies (strong accents included) finish admin after a job in minutes:
	•	Talk → invoice/quote → send → get paid
	•	Built for sole traders and tiny teams first.
	•	UK rules first: VAT, CIS, Domestic Reverse Charge.

Target user
	•	Sole traders and teams up to ~5 people
	•	High admin friction in evenings
	•	Often on-site with noise, gloves, poor signal, low patience for forms

Product principles
	•	Mobile-first, thumb-friendly
	•	Default to voice, with fast tap corrections
	•	Offline-tolerant (queue uploads and sends)
	•	Integrations must be “boring reliable” (sync logs, retries, no duplicates)
	•	UK compliance baked into templates, not optional extras buried in settings

Assumptions for estimates
	•	Pace: 1–2 dev days/week (8–16 hours/week)
	•	1 dev day = 8 hours
	•	Estimates include build + basic testing + minimal UI polish
	•	Doesn’t include heavy marketing site work, paid ads, or large refactors

Running costs (ongoing)

You should expect these recurring costs:
	•	Transcription + LLM usage (variable per minute / per invoice)
	•	Storage for PDFs/photos (low at first, rises with evidence packs)
	•	Email provider (Resend/SendGrid) (low)
	•	SMS provider (Twilio or similar) (variable per message)
	•	Payments fees (Stripe, transaction based)
	•	Hosting (Vercel) + DB/Auth (Supabase)

⸻

Phase roadmap

Phase 0 — Accent-first Voice-to-Invoice MVP (ship a trusted core)

Outcome: A tradie can talk an invoice, correct it fast, send it, and it looks professional.

Features
	•	Voice capture UX
	•	Push-to-talk + pause/resume
	•	Noise handling (site/van), quick redo last sentence
	•	Save drafts automatically
	•	Accent-first transcription
	•	Tune prompts / language settings for UK usage
	•	User-level “common terms” dictionary (materials, brand names)
	•	Low-confidence highlighting (tap to correct)
	•	Extraction v1
	•	Customer + address
	•	Line items with quantity, unit, unit rate
	•	Labour vs materials split
	•	Dates, terms, notes, discounts
	•	Invoice templates
	•	VAT toggle
	•	Bank details + payment terms
	•	Branded PDF
	•	Sending
	•	Email send with PDF
	•	SMS send with a secure link to view/download

Build time / cost
	•	6–10 dev days (48–80 hours)

Risks to manage
	•	Accent accuracy varies by user and environment
	•	“Correction UX” must be fast or voice becomes a gimmick

Definition of done
	•	20+ test invoices from real voices
	•	<2 minutes to go from recording to send
	•	Confidence highlights reduce manual edits

⸻

Phase 1 — Get paid (Stripe + chasers)

Outcome: Invoices get paid faster with less chasing.

Features
	•	Stripe payments
	•	Pay link per invoice
	•	Payment status shown in app
	•	Auto-receipt email to customer
	•	Deposits + part-payments
	•	“Request deposit” option on invoice/quote
	•	Track paid vs outstanding
	•	Chasers
	•	Email reminders: Day 3, Day 7, Day 14
	•	Stop automatically once paid
	•	“Nudge now” button

Build time / cost
	•	6–9 dev days (48–72 hours)

Risks to manage
	•	Payment status sync must be reliable (webhooks + retries)
	•	Avoid spammy reminders (simple toggles)

Definition of done
	•	Payment link works end-to-end
	•	Status updates automatically within minutes
	•	Chasers don’t fire after payment

⸻

Phase 2 — Voice-to-Quote + acceptance link

Outcome: Quotes go out quickly and get accepted without phone tag.

Features
	•	Quote mode
	•	Voice-to-quote using same extractor
	•	Quote PDF template
	•	Acceptance link
	•	Customer accept/reject page (mobile friendly)
	•	Optional typed name + date as lightweight signature
	•	Convert to invoice
	•	One tap quote → invoice
	•	Carry over line items + notes

Build time / cost
	•	5–8 dev days (40–64 hours)

Risks to manage
	•	Quote acceptance needs simple tracking (“Accepted”, “Expired”, “Revised”)
	•	Keep the acceptance page dead simple and fast

Definition of done
	•	A quote can be created in under 2 minutes
	•	Customer can accept in under 30 seconds
	•	Conversion produces a correct invoice every time

⸻

Phase 3 — Job evidence (photos, signature, job pack) done properly

Outcome: Proof of work is painless and doesn’t crash on mobile.

Features
	•	Photo capture
	•	Before/after
	•	Auto-compress
	•	Offline queue + background upload
	•	Job notes + signature
	•	Customer sign-off on completion
	•	Job pack PDF
	•	Photos + notes + signature compiled to a single PDF
	•	Attach to invoice or store with job

Build time / cost
	•	7–12 dev days (56–96 hours)

Risks to manage
	•	Upload reliability (poor signal)
	•	Storage costs creep if you keep full-res images

Definition of done
	•	Photos upload reliably with weak signal (queued)
	•	No app freezes when adding multiple images
	•	Job pack generates consistently

⸻

Phase 4 — UK compliance pack (CIS + Domestic Reverse Charge + VAT polish)

Outcome: YapMate feels “built for UK construction”, not generic invoicing.

Features
	•	CIS
	•	Mark invoice/job as CIS applicable
	•	Subcontractor records
	•	Deduction summary export (CSV/PDF)
	•	Domestic Reverse Charge
	•	Toggle per invoice/job
	•	Correct wording and VAT treatment on invoice template
	•	VAT polish
	•	VAT number, rates, customer VAT flag
	•	Simple scheme toggles later (don’t overbuild early)

Build time / cost
	•	9–15 dev days (72–120 hours)

Risks to manage
	•	Compliance errors kill trust
	•	Needs careful template wording and clear toggles

Definition of done
	•	CIS outputs match accountant expectations
	•	Reverse charge invoices show correct notes/format
	•	Users can’t accidentally send the wrong type without warning

⸻

Phase 5 — Accounting integration (start with Xero)

Outcome: Invoices and payments land in accounts without double entry.

Features
	•	Connect to Xero
	•	OAuth connect
	•	Sync invoices
	•	Create ACCREC invoices
	•	Sync payment status back
	•	Webhooks + resync
	•	Webhook handling
	•	Manual “resync” per invoice
	•	Sync log
	•	Show last sync, errors, actions taken
	•	Prevent duplicates (idempotent keys)

Build time / cost
	•	10–16 dev days (80–128 hours)

Risks to manage
	•	Duplicate invoices if you don’t do idempotency properly
	•	Webhook edge cases and token refresh issues

Definition of done
	•	Users can trust the sync (clear logs, predictable behaviour)
	•	No duplicates under normal use
	•	Reconnect and resync flows work

⸻

Phase 6 — Reporting basics

Outcome: Users see money owed and what’s happening this month.

Features
	•	Outstanding invoices + ageing
	•	Cash in by week/month
	•	Quote conversion rate
	•	Revenue by customer
	•	CSV export

Build time / cost
	•	3–6 dev days (24–48 hours)

⸻

Phase 7 — Light diary + customer comms (optional)

Outcome: Simple scheduling and comms without turning into a job management platform.

Features
	•	Simple diary (single user → small team)
	•	Appointment reminder
	•	“On my way” SMS templates
	•	Basic job statuses

Build time / cost
	•	6–10 dev days (48–80 hours)

⸻

Recommended build order (UK + accent-first)
	1.	Phase 0 — Voice-to-invoice that works with accents
	2.	Phase 1 — Stripe + chasers
	3.	Phase 2 — Quotes + acceptance
	4.	Phase 3 — Job evidence (photos/signature/job pack)
	5.	Phase 4 — UK compliance (CIS + reverse charge)
	6.	Phase 5 — Xero
	7.	Phase 6 — Reporting
	8.	Phase 7 — Diary/comms

⸻

“Not building” (protect the MVP)

Don’t build these until you have real demand:
	•	Full job management suite (complex workflows, procurement, full inventory)
	•	Deep analytics dashboards
	•	Multi-warehouse stock control
	•	Heavy CRM features
	•	Too many accounting integrations at once

⸻

Notes for visuals (for Canva / Slides)
	•	Use black background, gold accents
	•	One slide per phase
	•	Add a “Value” tag per phase:
	•	Get paid faster
	•	Win more work
	•	Proof of work
	•	UK compliance
	•	Accountant-friendly

