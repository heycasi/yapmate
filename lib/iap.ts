/**
 * RevenueCat In-App Purchase (IAP) Wrapper
 *
 * Handles iOS subscriptions with 7-day free trial via RevenueCat.
 * - iOS: Full RevenueCat integration
 * - Web: Graceful no-op (returns helpful errors)
 *
 * Installation:
 *   npm install @revenuecat/purchases-capacitor --legacy-peer-deps
 *   npx cap sync ios
 */

import { Capacitor } from '@capacitor/core'
import { isTradeEnabled } from '@/lib/runtime-config'

// RevenueCat types
export interface IAPOffering {
  identifier: string
  serverDescription: string
  availablePackages: IAPPackage[]
}

export interface IAPPackage {
  identifier: string
  packageType: string
  product: IAPProduct
  offeringIdentifier: string
}

export interface IAPProduct {
  identifier: string
  description: string
  title: string
  price: number
  priceString: string
  currencyCode: string
  introPrice: {
    price: number
    priceString: string
    period: string
    cycles: number
    periodUnit: string
    periodNumberOfUnits: number
  } | null
}

export interface IAPCustomerInfo {
  originalAppUserId: string
  activeSubscriptions: string[]
  allPurchasedProductIdentifiers: string[]
  latestExpirationDate: string | null
  entitlements: {
    active: Record<string, IAPEntitlement>
    all: Record<string, IAPEntitlement>
  }
}

export interface IAPEntitlement {
  identifier: string
  isActive: boolean
  productIdentifier: string
  expirationDate: string | null
  periodType: string
  isSandbox: boolean
  willRenew: boolean
}

// Product IDs (must match App Store Connect + RevenueCat configuration)
export const IAP_PRODUCTS = {
  PRO_MONTHLY: 'com.yapmate.pro.monthly',
  TRADE_MONTHLY: 'com.yapmate.trade.monthly',
} as const

// Entitlement IDs (configured in RevenueCat dashboard)
export const IAP_ENTITLEMENTS = {
  PRO: 'pro',
  TRADE: 'trade',
} as const

export type ProductId = typeof IAP_PRODUCTS[keyof typeof IAP_PRODUCTS]
export type EntitlementId = typeof IAP_ENTITLEMENTS[keyof typeof IAP_ENTITLEMENTS]

export interface PurchaseResult {
  success: boolean
  customerInfo?: IAPCustomerInfo
  error?: string
  userCancelled?: boolean
}

let isConfigured = false

/**
 * Check if IAP is available (iOS only)
 */
export function isIAPAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

/**
 * Configure RevenueCat SDK
 * Must be called once on app startup (iOS only)
 *
 * @param apiKey - RevenueCat iOS API key from env
 * @param appUserID - Optional Supabase user ID for linking
 */
export async function configureIAP(apiKey: string, appUserID?: string): Promise<void> {
  if (!isIAPAvailable()) {
    console.log('[IAP] Not available on web, skipping configuration')
    return
  }

  if (isConfigured) {
    console.log('[IAP] Already configured, skipping')
    return
  }

  try {
    // Dynamic import only on iOS
    const { Purchases } = await import('@revenuecat/purchases-capacitor')

    await Purchases.configure({
      apiKey,
      appUserID: appUserID || undefined,
    })

    isConfigured = true
    console.log('[IAP] RevenueCat configured successfully', { appUserID })
  } catch (error: any) {
    console.error('[IAP] Configuration failed:', error)
    throw new Error(`IAP configuration failed: ${error.message}`)
  }
}

/**
 * Get available offerings (subscription packages)
 */
export async function getOfferings(): Promise<IAPOffering[]> {
  if (!isIAPAvailable()) {
    console.warn('[IAP] getOfferings called on web - returning empty array')
    return []
  }

  if (!isConfigured) {
    console.error('[IAP] SDK not configured - call configureIAP first')
    return []
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const offerings = await Purchases.getOfferings()

    if (!offerings.current) {
      console.warn('[IAP] No current offering found')
      return []
    }

    // Return all offerings as array
    const allOfferings = [offerings.current, ...Object.values(offerings.all)]

    console.log('[IAP] Loaded offerings:', allOfferings.length)
    return allOfferings as IAPOffering[]
  } catch (error: any) {
    console.error('[IAP] Failed to get offerings:', error)
    return []
  }
}

/**
 * Purchase a package (initiates iOS payment flow)
 *
 * @param packageId - Package identifier from offerings
 * @returns Purchase result with customer info
 */
export async function purchase(packageId: string): Promise<PurchaseResult> {
  if (!isIAPAvailable()) {
    return {
      success: false,
      error: 'In-app purchases are only available on iOS. Please use the mobile app.',
    }
  }

  if (!isConfigured) {
    return {
      success: false,
      error: 'IAP not configured',
    }
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')

    // Get offerings to find the package
    const offerings = await Purchases.getOfferings()
    let targetPackage: any = null

    // Search for package in current offering
    if (offerings.current) {
      targetPackage = offerings.current.availablePackages.find(
        (pkg: any) => pkg.identifier === packageId
      )
    }

    // Search in all offerings if not found
    if (!targetPackage) {
      for (const offering of Object.values(offerings.all)) {
        const pkg = (offering as any).availablePackages.find(
          (p: any) => p.identifier === packageId
        )
        if (pkg) {
          targetPackage = pkg
          break
        }
      }
    }

    if (!targetPackage) {
      return {
        success: false,
        error: `Package not found: ${packageId}`,
      }
    }

    // Initiate purchase
    console.log('[IAP] Starting purchase:', packageId)
    const result = await Purchases.purchasePackage({
      aPackage: targetPackage,
    })

    console.log('[IAP] Purchase successful')
    return {
      success: true,
      customerInfo: result.customerInfo as IAPCustomerInfo,
    }
  } catch (error: any) {
    console.error('[IAP] Purchase failed:', error)

    // Check if user cancelled
    if (error.code === 'USER_CANCELLED' || error.userCancelled) {
      return {
        success: false,
        error: 'Purchase cancelled',
        userCancelled: true,
      }
    }

    return {
      success: false,
      error: error.message || 'Purchase failed',
    }
  }
}

/**
 * Purchase by product ID directly (alternative to package-based)
 *
 * @param productId - Product identifier (com.yapmate.pro.monthly)
 */
export async function purchaseProduct(productId: ProductId): Promise<PurchaseResult> {
  if (!isIAPAvailable()) {
    return {
      success: false,
      error: 'In-app purchases are only available on iOS. Please use the mobile app.',
    }
  }

  if (!isConfigured) {
    console.error('[IAP] purchaseProduct called but SDK not configured')
    return {
      success: false,
      error: 'IAP not configured. Please restart the app.',
    }
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')

    console.log('[IAP] ===== STARTING PURCHASE =====')
    console.log('[IAP] Product ID:', productId)

    // Get offerings to find the full product object
    console.log('[IAP] Fetching offerings from RevenueCat...')
    const offeringsResult = await Purchases.getOfferings()

    console.log('[IAP] Offerings fetched successfully')
    console.log('[IAP] Current offering:', offeringsResult.current?.identifier || 'NONE')
    console.log('[IAP] Total offerings:', Object.keys(offeringsResult.all || {}).length)

    // Check current offering and all offerings
    const allOfferings = [offeringsResult.current, ...Object.values(offeringsResult.all || {})]
      .filter(Boolean)

    console.log('[IAP] Searching for product in', allOfferings.length, 'offering(s)...')

    // Find the product in available offerings
    let productToPurchase = null
    let foundInOffering: string | null = null

    for (const offering of allOfferings) {
      if (offering?.availablePackages) {
        console.log('[IAP] Checking offering:', offering.identifier)
        console.log('[IAP] Packages in offering:', offering.availablePackages.length)

        for (const pkg of offering.availablePackages) {
          console.log('[IAP]   - Package:', pkg.identifier, '→ Product:', pkg.product?.identifier)

          if (pkg.product?.identifier === productId) {
            productToPurchase = pkg.product
            foundInOffering = offering.identifier
            console.log('[IAP] ✓ FOUND! Product found in offering:', foundInOffering)
            break
          }
        }
      }
      if (productToPurchase) break
    }

    if (!productToPurchase) {
      console.error('[IAP] ❌ PRODUCT NOT FOUND')
      console.error('[IAP] Searched for:', productId)
      console.error('[IAP] Available products:')

      allOfferings.forEach((offering) => {
        if (offering?.availablePackages) {
          offering.availablePackages.forEach((pkg) => {
            console.error('[IAP]   -', pkg.product?.identifier)
          })
        }
      })

      return {
        success: false,
        error: `Product not found: ${productId}. Available offerings: ${allOfferings.length}`,
      }
    }

    console.log('[IAP] Product details:')
    console.log('[IAP]   - ID:', productToPurchase.identifier)
    console.log('[IAP]   - Title:', productToPurchase.title)
    console.log('[IAP]   - Price:', productToPurchase.priceString)
    console.log('[IAP]   - Intro Offer:', productToPurchase.introPrice ? 'YES' : 'NO')

    // Purchase using the full product object
    console.log('[IAP] Initiating purchase with StoreKit...')
    const result = await Purchases.purchaseStoreProduct({
      product: productToPurchase,
    })

    console.log('[IAP] ===== PURCHASE SUCCESSFUL =====')
    console.log('[IAP] Customer ID:', result.customerInfo?.originalAppUserId)
    console.log('[IAP] Active subscriptions:', result.customerInfo?.activeSubscriptions?.length || 0)

    return {
      success: true,
      customerInfo: result.customerInfo as IAPCustomerInfo,
    }
  } catch (error: any) {
    console.error('[IAP] ===== PURCHASE FAILED =====')
    console.error('[IAP] Error code:', error.code)
    console.error('[IAP] Error message:', error.message)
    console.error('[IAP] Full error:', error)

    if (error.code === 'USER_CANCELLED' || error.userCancelled) {
      console.log('[IAP] User cancelled the purchase')
      return {
        success: false,
        error: 'Purchase cancelled',
        userCancelled: true,
      }
    }

    // Provide more context in error message
    let errorMessage = error.message || 'Purchase failed'
    if (error.code) {
      errorMessage += ` (Error: ${error.code})`
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isIAPAvailable()) {
    return {
      success: false,
      error: 'In-app purchases are only available on iOS. Please use the mobile app.',
    }
  }

  if (!isConfigured) {
    return {
      success: false,
      error: 'IAP not configured',
    }
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')

    console.log('[IAP] Restoring purchases...')
    const result = await Purchases.restorePurchases()

    console.log('[IAP] Restore successful')
    return {
      success: true,
      customerInfo: result.customerInfo as IAPCustomerInfo,
    }
  } catch (error: any) {
    console.error('[IAP] Restore failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to restore purchases',
    }
  }
}

/**
 * Get current customer info (entitlements, subscriptions)
 */
export async function getCustomerInfo(): Promise<IAPCustomerInfo | null> {
  if (!isIAPAvailable()) {
    console.warn('[IAP] getCustomerInfo called on web')
    return null
  }

  if (!isConfigured) {
    console.error('[IAP] SDK not configured')
    return null
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')
    const result = await Purchases.getCustomerInfo()

    return result.customerInfo as IAPCustomerInfo
  } catch (error: any) {
    console.error('[IAP] Failed to get customer info:', error)
    return null
  }
}

/**
 * Get active plan from customer info
 * Maps RevenueCat entitlements to YapMate plans
 *
 * NOTE: When Trade tier is disabled, Trade entitlements are treated as Pro
 */
export function getActivePlan(customerInfo: IAPCustomerInfo | null): 'free' | 'pro' | 'trade' {
  if (!customerInfo) {
    return 'free'
  }

  // Check active entitlements
  const { active } = customerInfo.entitlements

  // Trade takes precedence (higher tier)
  // When Trade is disabled, treat Trade entitlements as Pro
  if (active[IAP_ENTITLEMENTS.TRADE]?.isActive) {
    return isTradeEnabled() ? 'trade' : 'pro'
  }

  if (active[IAP_ENTITLEMENTS.PRO]?.isActive) {
    return 'pro'
  }

  return 'free'
}

/**
 * Get subscription status for display
 */
export function getSubscriptionStatus(customerInfo: IAPCustomerInfo | null): {
  plan: 'free' | 'pro' | 'trade'
  status: 'active' | 'trialing' | 'expired' | 'none'
  willRenew: boolean
  expirationDate: string | null
} {
  if (!customerInfo) {
    return {
      plan: 'free',
      status: 'none',
      willRenew: false,
      expirationDate: null,
    }
  }

  const plan = getActivePlan(customerInfo)

  if (plan === 'free') {
    return {
      plan: 'free',
      status: 'none',
      willRenew: false,
      expirationDate: null,
    }
  }

  // Get the active entitlement
  const entitlementKey = plan === 'trade' ? IAP_ENTITLEMENTS.TRADE : IAP_ENTITLEMENTS.PRO
  const entitlement = customerInfo.entitlements.active[entitlementKey]

  if (!entitlement) {
    return {
      plan: 'free',
      status: 'expired',
      willRenew: false,
      expirationDate: null,
    }
  }

  // Determine status based on period type
  let status: 'active' | 'trialing' | 'expired' = 'active'
  if (entitlement.periodType === 'TRIAL' || entitlement.periodType === 'INTRO') {
    status = 'trialing'
  }

  return {
    plan,
    status,
    willRenew: entitlement.willRenew,
    expirationDate: entitlement.expirationDate,
  }
}

/**
 * Get product display info
 */
export function getProductInfo(productId: ProductId): {
  name: string
  plan: 'pro' | 'trade'
  features: string[]
} {
  switch (productId) {
    case IAP_PRODUCTS.PRO_MONTHLY:
      return {
        name: 'YapMate Pro',
        plan: 'pro',
        features: ['Unlimited invoices', 'VAT support', 'Priority support'],
      }
    case IAP_PRODUCTS.TRADE_MONTHLY:
      return {
        name: 'YapMate Trade',
        plan: 'trade',
        features: [
          'Unlimited invoices',
          'VAT support',
          'CIS deduction support',
          'Priority support',
        ],
      }
    default:
      return {
        name: 'Unknown',
        plan: 'pro',
        features: [],
      }
  }
}

/**
 * Link anonymous RevenueCat user to authenticated user
 * Call this after user logs in to merge purchases
 *
 * @param appUserID - Supabase user ID to link to
 */
export async function linkUser(appUserID: string): Promise<{ success: boolean; error?: string }> {
  if (!isIAPAvailable()) {
    return {
      success: false,
      error: 'IAP not available on web',
    }
  }

  if (!isConfigured) {
    return {
      success: false,
      error: 'IAP not configured',
    }
  }

  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor')

    console.log('[IAP] Linking user to RevenueCat:', appUserID)

    // Use logIn to merge anonymous user with authenticated user
    const result = await Purchases.logIn({ appUserID })

    console.log('[IAP] User linked successfully')

    return {
      success: true,
    }
  } catch (error: any) {
    console.error('[IAP] Failed to link user:', error)
    return {
      success: false,
      error: error.message || 'Failed to link user',
    }
  }
}
