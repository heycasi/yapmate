/**
 * TRADE TIER CONFIGURATION
 *
 * Status: DISABLED for v1.0 App Store submission
 * Date Disabled: January 14, 2026
 * Reason: Shipping Free + Pro only for initial launch
 *
 * This file preserves all Trade tier configuration for future re-enablement.
 * DO NOT DELETE - contains product IDs, pricing, features, and marketing copy.
 */

// ============================================================================
// PRODUCT CONFIGURATION
// ============================================================================

export const TRADE_PRODUCT_CONFIG = {
  // Apple IAP Product ID
  productId: 'com.yapmate.trade.monthly',

  // RevenueCat Entitlement ID
  entitlementId: 'trade',

  // Pricing
  price: {
    amount: 25.00,
    currency: 'GBP',
    displayString: '£25',
    period: 'month',
    trialDays: 7,
  },

  // Plan metadata
  metadata: {
    name: 'Trade',
    displayName: 'YapMate Trade',
    description: 'For CIS contractors',
    tier: 'trade' as const,
  },
} as const

// ============================================================================
// FEATURES & LIMITS
// ============================================================================

export const TRADE_PLAN_LIMITS = {
  maxInvoices: Infinity, // Unlimited
  canUseVAT: true,
  canUseCIS: true, // TRADE-ONLY FEATURE
  canUseReverseCharge: true,
  canAccessCustomerList: true,
  canRemoveBranding: true,
  canUseBankDetails: true, // TRADE-ONLY FEATURE
  hasPrioritySupport: true, // TRADE-ONLY FEATURE
} as const

// ============================================================================
// MARKETING COPY
// ============================================================================

export const TRADE_MARKETING = {
  // Pricing page card
  card: {
    title: 'Trade',
    price: '£25',
    period: 'month',
    description: 'For CIS contractors',

    features: [
      {
        included: true,
        text: 'Everything in Pro',
        bold: true,
      },
      {
        included: true,
        text: 'CIS deduction',
      },
      {
        included: true,
        text: 'Bank details on invoice',
      },
      {
        included: true,
        text: 'Priority support',
      },
    ],

    cta: {
      text: 'Start Free Trial',
      textWeb: 'Join Waitlist',
    },
  },

  // FAQ copy
  faq: {
    cisQuestion: 'What is CIS deduction?',
    cisAnswer: 'The Construction Industry Scheme (CIS) requires contractors to deduct tax from subcontractor payments. The Trade plan calculates and applies CIS deductions (typically 20%) automatically on your invoices.',
  },

  // Terms of Use copy
  terms: {
    description: 'All Pro features plus CIS deductions and priority support',
  },
} as const

// ============================================================================
// CIS-SPECIFIC TYPES (Trade-only feature)
// ============================================================================

export interface CISPreferences {
  default_cis_enabled: boolean
  cis_rate: number
}

export const DEFAULT_CIS_RATE = 20.0

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a plan tier includes Trade features
 */
export function hasTradeFeaturesUnlocked(plan: 'free' | 'pro' | 'trade'): boolean {
  return plan === 'trade'
}

/**
 * Check if CIS features are available for a plan
 */
export function canUseCISFeatures(plan: 'free' | 'pro' | 'trade'): boolean {
  return plan === 'trade'
}

/**
 * Get the maximum tier name (for display purposes)
 */
export function getTradeTierDisplayName(): string {
  return 'Trade'
}

// ============================================================================
// STOREKIT CONFIGURATION (for reference)
// ============================================================================

export const TRADE_STOREKIT_CONFIG = {
  productID: 'com.yapmate.trade.monthly',
  type: 'Auto-Renewable Subscription',
  displayName: 'Trade Monthly',
  description: 'Trade monthly subscription with 7-day free trial',
  price: 25.00,
  familyShareable: false,

  subscriptionGroupId: '21571031',
  subscriptionGroupName: 'YapMate Subscriptions',

  introductoryOffer: {
    type: 'Free Trial',
    duration: 7,
    durationUnit: 'Day',
  },

  reviewNote: 'Trade tier includes CIS (Construction Industry Scheme) tax deduction features for UK contractors.',
} as const

// ============================================================================
// REVENUECAT CONFIGURATION (for reference)
// ============================================================================

export const TRADE_REVENUECAT_CONFIG = {
  // Product must be added to RevenueCat dashboard under:
  // Project → Products → Add Product
  productIdentifier: 'com.yapmate.trade.monthly',

  // Entitlement must be added to RevenueCat dashboard under:
  // Project → Entitlements → Add Entitlement
  entitlementIdentifier: 'trade',

  // Offering configuration (must be added to default offering)
  offeringConfig: {
    offeringIdentifier: 'default',
    packageIdentifier: 'trade', // or $rc_monthly
    productIdentifier: 'com.yapmate.trade.monthly',
  },

  note: 'Trade product must be added to the "default" offering in RevenueCat dashboard before enabling.',
} as const

// ============================================================================
// EXPORT ALL
// ============================================================================

export const TRADE_TIER_COMPLETE_CONFIG = {
  product: TRADE_PRODUCT_CONFIG,
  limits: TRADE_PLAN_LIMITS,
  marketing: TRADE_MARKETING,
  storeKit: TRADE_STOREKIT_CONFIG,
  revenueCat: TRADE_REVENUECAT_CONFIG,
} as const

export default TRADE_TIER_COMPLETE_CONFIG
