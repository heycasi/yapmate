# YapMate Support Playbook: Billing & Subscriptions

**Last Updated:** January 2026
**For:** Support team handling billing-related queries

---

## Overview

YapMate uses **Apple In-App Purchases** exclusively. We do NOT process payments or have access to customer payment details. All billing is handled by Apple through the customer's Apple ID.

**Key principle:** Direct customers to Apple for all payment, cancellation, and refund requests. We cannot cancel or refund subscriptions—only Apple can.

---

## Common Issues & Email Templates

### 1. "I was charged after my trial ended"

**When to use:** Customer says they were charged unexpectedly after their 7-day free trial.

**What to check:**
- Did they cancel before Day 7 ended?
- Did they receive Apple's 24-hour reminder notification?

**Email template:**

```
Subject: Your YapMate Trial & Subscription

Hi [Name],

Thanks for reaching out. I can help clarify what happened with your trial.

When you start a 7-day free trial for YapMate Pro or Trade, Apple automatically converts it to a paid subscription on Day 8 unless you cancel before the trial ends.

Apple sends a reminder notification 24 hours before your trial ends, but it's easy to miss. If you didn't cancel before Day 7 ended, you would have been charged £15 (Pro) or £25 (Trade) on Day 8.

**To request a refund:**
1. Go to reportaproblem.apple.com
2. Sign in with your Apple ID
3. Find your YapMate subscription charge
4. Request a refund

Apple reviews refund requests on a case-by-case basis and typically responds within 48 hours.

**To cancel your subscription (so you're not charged next month):**
1. Open iPhone Settings
2. Tap your Apple ID at the top
3. Tap Subscriptions
4. Find YapMate AI
5. Tap Cancel Subscription

You'll keep access until the end of your current billing period, then drop back to the Free plan.

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
support@yapmate.co.uk
```

**Escalate if:**
- Customer claims they were charged multiple times
- Customer says they never started a trial
- Customer is abusive or threatening

---

### 2. "I cancelled but I still have access"

**When to use:** Customer is confused about why they still have Pro/Trade features after cancelling.

**What to check:**
- Did they cancel or just think about cancelling?
- What is their current subscription status in Supabase?

**Email template:**

```
Subject: Your YapMate Subscription Access

Hi [Name],

Good news—this is actually how it's supposed to work!

When you cancel your YapMate subscription through Apple, you keep full access to your plan (Pro or Trade) until the end of your current billing period. This means you get what you paid for, even if you cancel mid-month.

**Example:**
- You subscribed on January 1st
- You cancelled on January 10th
- You'll keep Pro/Trade access until January 31st
- On February 1st, you'll drop back to the Free plan

You won't be charged again after your current period ends. Your invoices and data will be kept, so you can re-subscribe anytime.

To check when your access ends:
1. Open iPhone Settings
2. Tap your Apple ID at the top
3. Tap Subscriptions
4. Find YapMate AI
5. You'll see the expiration date

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
```

**Escalate if:**
- Customer's subscription status doesn't match what they see in the app
- Customer claims they lost access immediately after cancelling

---

### 3. "How do I cancel?"

**When to use:** Customer wants to cancel their subscription.

**Email template:**

```
Subject: How to Cancel Your YapMate Subscription

Hi [Name],

To cancel your YapMate subscription:

1. Open **iPhone Settings** (not the YapMate app)
2. Tap your **Apple ID** at the top
3. Tap **Subscriptions**
4. Find **YapMate AI**
5. Tap **Cancel Subscription**

**What happens after you cancel:**
- You keep access to Pro/Trade features until the end of your current billing period
- You won't be charged again
- After your period ends, you'll drop back to the Free plan
- Your invoices and customer data will be kept

You can re-subscribe anytime if you change your mind.

Let me know if you have any trouble finding the cancellation option!

Best regards,
[Your Name]
YapMate Support Team
```

**Escalate if:**
- Customer doesn't have an iPhone Settings option (they're on Android—we don't support Android)
- Customer can't find YapMate in their Subscriptions list (may indicate account mismatch)

---

### 4. "How do I get a refund?"

**When to use:** Customer wants a refund for a charge.

**Email template:**

```
Subject: YapMate Refund Request

Hi [Name],

I understand you'd like a refund for your YapMate subscription.

Since YapMate uses Apple In-App Purchases, all refunds are handled by Apple directly. We don't have the ability to process refunds ourselves.

**To request a refund:**
1. Go to reportaproblem.apple.com
2. Sign in with your Apple ID (the same one you use on your iPhone)
3. Find your YapMate subscription charge
4. Click "Report a Problem"
5. Select "Request a refund"
6. Explain your reason

Apple reviews refund requests on a case-by-case basis and typically responds within 48 hours. They're generally understanding, especially if you're within your trial period or experienced a technical issue.

**If you're still within your 7-day free trial:**
You can cancel now and you won't be charged at all. Follow these steps:
1. Open iPhone Settings
2. Tap your Apple ID at the top
3. Tap Subscriptions
4. Find YapMate AI
5. Tap Cancel Subscription

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
```

**Escalate if:**
- Customer claims Apple denied their refund request unfairly
- Customer is threatening legal action

---

### 5. "I upgraded from Pro to Trade, why was I charged immediately?"

**When to use:** Customer is confused about pro-rated billing.

**Email template:**

```
Subject: Your YapMate Upgrade Charge

Hi [Name],

Thanks for upgrading to Trade! Let me explain the charge you saw.

When you upgrade from Pro (£15/month) to Trade (£25/month) mid-cycle, Apple calculates a **pro-rated charge** for the remaining days in your current billing period.

**Example:**
- You subscribed to Pro on January 1st
- You upgraded to Trade on January 15th (halfway through the month)
- You'd already paid £15 for the full month of Pro
- Apple charges you the difference (£10) for the remaining 15 days at the Trade rate
- On February 1st, you'll be charged the full £25 for Trade

This ensures you're only paying for what you use at the correct rate.

Your next full billing cycle will be £25/month for Trade.

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
```

**Escalate if:**
- Customer claims they were double-charged
- The pro-rated amount seems incorrect

---

### 6. "I can't restore my purchases"

**When to use:** Customer says "Restore Purchases" isn't working.

**What to check:**
- Are they signed in with the correct Apple ID?
- Do they actually have an active subscription?
- Is their internet connection working?

**Email template:**

```
Subject: YapMate Restore Purchases

Hi [Name],

Let's troubleshoot the "Restore Purchases" issue.

First, make sure you're signed in with the same Apple ID you used to subscribe to YapMate:

1. Open iPhone Settings
2. Tap your Apple ID at the top
3. Confirm it's the email address you used to subscribe

**If it's the correct Apple ID:**
1. Go to iPhone Settings → Apple ID → Subscriptions
2. Find YapMate AI
3. Check if your subscription is active

**If your subscription is active but the app still shows Free:**
1. Close the YapMate app completely (swipe up from the app switcher)
2. Open YapMate again
3. Go to Settings
4. Tap "Restore Purchases"
5. Wait 10-15 seconds

**If it still doesn't work:**
- Check your internet connection
- Try restarting your iPhone
- Make sure YapMate is updated to the latest version in the App Store

Let me know if you're still having trouble and I'll escalate this to our engineering team.

Best regards,
[Your Name]
YapMate Support Team
```

**Escalate if:**
- Customer has confirmed active subscription but app still shows Free after troubleshooting
- Customer suspects a bug in the RevenueCat sync

---

### 7. "What's the difference between Pro and Trade?"

**When to use:** Customer is deciding which plan to choose.

**Email template:**

```
Subject: YapMate Pro vs Trade

Hi [Name],

Great question! Here's the breakdown:

**Pro (£15/month) is best for:**
- Sole traders
- Businesses that need VAT support
- Anyone needing unlimited invoices

**Pro includes:**
- Unlimited invoices
- VAT support (standard, reduced, exempt)
- Reverse Charge calculations
- Customer list with saved details
- Clean, professional PDFs
- 7-day free trial

**Trade (£25/month) is best for:**
- CIS contractors (Construction Industry Scheme)
- Tradespeople who work for CIS-registered clients

**Trade includes:**
- Everything in Pro, plus:
- CIS deduction calculations (20% or 30%)
- Bank details on invoices
- Priority support (response within 24 hours)
- 7-day free trial

**Bottom line:**
- If you don't work in construction or don't need CIS deductions, choose Pro
- If you're a CIS contractor and need to show CIS deductions on invoices, choose Trade

Both plans have a 7-day free trial, so you can try either one risk-free and cancel if it's not right for you.

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
```

---

### 8. "Can I downgrade from Trade to Pro?"

**When to use:** Customer wants to switch from Trade to Pro.

**Email template:**

```
Subject: Downgrading from Trade to Pro

Hi [Name],

Yes, you can switch from Trade to Pro, but there's no direct "downgrade" option in Apple's subscription system.

**Here's how to do it:**

1. **Cancel your Trade subscription:**
   - Open iPhone Settings
   - Tap your Apple ID → Subscriptions
   - Find YapMate AI
   - Tap Cancel Subscription

2. **Keep using Trade until it expires:**
   - You'll keep full Trade access until the end of your current billing period
   - You won't be charged again

3. **Subscribe to Pro after Trade expires:**
   - After your Trade subscription ends, you'll drop to the Free plan
   - Open YapMate → Settings → Pricing
   - Subscribe to Pro (you can start a 7-day free trial if you want)

**Important:** Apple doesn't offer pro-rated refunds for downgrades. You'll pay the full £25 for your current Trade billing period, even if you don't use it for the whole month.

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
```

---

### 9. "I was charged twice this month"

**When to use:** Customer claims they were charged multiple times.

**What to check:**
- Check their subscription history in Supabase
- Ask them to screenshot their Apple receipt

**Email template:**

```
Subject: Double Charge Investigation

Hi [Name],

I'm sorry to hear you were charged twice. Let me help investigate this.

First, can you send me a screenshot of your Apple receipt? You can find it here:
1. Open the App Store app
2. Tap your profile icon (top right)
3. Tap "Purchased"
4. Find the YapMate charges
5. Take a screenshot

This will help me see exactly what you were charged and when.

**Possible explanations:**
- If you upgraded from Pro to Trade mid-cycle, you'd see two charges: one for the pro-rated difference, and one for your next full billing cycle
- If you cancelled and re-subscribed, you'd see a charge for the new subscription
- If you have multiple Apple IDs, you might see charges on different accounts

Once I see your receipt, I'll be able to confirm what happened and help you request a refund from Apple if there was an error.

Please send the screenshot and I'll follow up immediately.

Best regards,
[Your Name]
YapMate Support Team
```

**Escalate if:**
- Customer provides proof of duplicate charges for the same period
- Charges don't match any known subscription event

---

### 10. "Can I get a discount or student pricing?"

**When to use:** Customer asks for a discount.

**Email template:**

```
Subject: YapMate Pricing & Discounts

Hi [Name],

Thanks for asking! Unfortunately, we don't currently offer discounts or student pricing for YapMate.

Our pricing is set through Apple's App Store, and we're required to charge the same price to all customers in the UK (£15/month for Pro, £25/month for Trade).

**What we do offer:**
- **7-day free trial** on both Pro and Trade—try it risk-free before you commit
- **Monthly billing**—no annual commitment, cancel anytime
- **Fair pro-rated upgrades**—if you upgrade from Pro to Trade, you only pay for the remaining days

If cost is a concern, I'd recommend starting with the Free plan (3 invoices total) to see if YapMate works for your needs. When you're ready to upgrade, start a 7-day free trial to test Pro or Trade before you're charged.

Let me know if you have any other questions!

Best regards,
[Your Name]
YapMate Support Team
```

---

## Escalation Matrix

| Issue | Escalate To | When to Escalate |
|-------|-------------|------------------|
| Duplicate charges | Engineering + Apple Support | Customer provides proof of duplicate charges for same period |
| Restore Purchases not working | Engineering | Customer has active subscription but app shows Free after troubleshooting |
| Subscription status mismatch | Engineering | Supabase subscription status doesn't match Apple subscription status |
| Refund dispute | Founder / Legal | Customer threatens legal action or claims Apple denied refund unfairly |
| Abusive customer | Founder | Customer is threatening, abusive, or harassing |
| RevenueCat sync issue | Engineering | Webhook events not updating Supabase correctly |

---

## Quick Reference

**Support email:** support@yapmate.co.uk
**Trade subscriber SLA:** 24-hour response time
**Pro/Free subscriber SLA:** 48-hour response time

**Apple refund link:** https://reportaproblem.apple.com
**RevenueCat dashboard:** (Engineering only)
**Supabase dashboard:** (Engineering only)

---

**Version 1.0** • Updated January 2026
