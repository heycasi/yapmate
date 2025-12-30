/**
 * Apple In-App Purchase (IAP) Wrapper
 * Uses Capacitor Purchases plugin for StoreKit 2 integration
 *
 * Installation:
 *   You'll need to install a Capacitor IAP plugin. Options:
 *   - capacitor-plugin-purchases (RevenueCat - recommended)
 *   - @capawesome/capacitor-purchases
 *   - Custom native module
 *
 *   Then run: npx cap sync ios
 *
 * Note: This module is designed to work even when the plugin isn't installed
 * (for web/development builds). The actual IAP functionality is only available on iOS.
 */

import { Capacitor } from '@capacitor/core'

// Type definitions for the IAP plugin
// These match the expected interface from most Capacitor IAP plugins
interface IAPPluginProduct {
  productId: string
  title: string
  description: string
  price: string
  priceValue: number
  currency: string
}

interface IAPPlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: IAPPluginProduct[] }>
  purchaseProduct(options: { productId: string }): Promise<{ receipt: string }>
  restorePurchases(): Promise<{ receipts: string[] }>
}

// Product IDs (must match App Store Connect configuration)
export const IAP_PRODUCTS = {
  PRO_MONTHLY: 'com.yapmate.pro.monthly',
  TRADE_MONTHLY: 'com.yapmate.trade.monthly',
} as const

export type ProductId = typeof IAP_PRODUCTS[keyof typeof IAP_PRODUCTS]

export interface IAPProduct {
  productId: string
  title: string
  description: string
  price: string
  priceValue: number
  currency: string
}

export interface PurchaseResult {
  success: boolean
  plan?: 'pro' | 'trade'
  expiresAt?: string
  error?: string
}

/**
 * Check if IAP is available (iOS only)
 */
export function isIAPAvailable(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

/**
 * Get available IAP products from App Store
 */
export async function getProducts(): Promise<IAPProduct[]> {
  if (!isIAPAvailable()) {
    console.warn('IAP not available on this platform')
    return []
  }

  try {
    // Dynamic import - will need to be updated with actual plugin name
    // For now, this will gracefully fail during development
    const IAPModule = (globalThis as any).InAppPurchases as IAPPlugin | undefined

    if (!IAPModule) {
      console.warn('IAP plugin not installed - install capacitor-plugin-purchases or similar')
      return []
    }

    const result = await IAPModule.getProducts({
      productIds: [IAP_PRODUCTS.PRO_MONTHLY, IAP_PRODUCTS.TRADE_MONTHLY],
    })

    return result.products.map((product) => ({
      productId: product.productId,
      title: product.title,
      description: product.description,
      price: product.price,
      priceValue: product.priceValue,
      currency: product.currency,
    }))
  } catch (error) {
    console.error('Failed to fetch products:', error)
    return []
  }
}

/**
 * Purchase a subscription product
 * @param productId - Product ID to purchase
 * @param supabaseUrl - Supabase URL for verification
 * @param accessToken - User access token
 */
export async function purchaseProduct(
  productId: ProductId,
  supabaseUrl: string,
  accessToken: string
): Promise<PurchaseResult> {
  if (!isIAPAvailable()) {
    return { success: false, error: 'IAP not available on this platform' }
  }

  try {
    // Get IAP plugin instance
    const IAPModule = (globalThis as any).InAppPurchases as IAPPlugin | undefined

    if (!IAPModule) {
      return { success: false, error: 'IAP plugin not installed' }
    }

    // Initiate purchase flow
    const purchaseResult = await IAPModule.purchaseProduct({
      productId,
    })

    if (!purchaseResult.receipt) {
      return { success: false, error: 'No receipt returned from purchase' }
    }

    // Verify receipt with backend
    const verifyResult = await verifyReceipt(
      purchaseResult.receipt,
      supabaseUrl,
      accessToken
    )

    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error || 'Receipt verification failed' }
    }

    return {
      success: true,
      plan: verifyResult.plan,
      expiresAt: verifyResult.expiresAt,
    }
  } catch (error: any) {
    console.error('Purchase failed:', error)

    // Handle user cancellation gracefully
    if (error.code === 'E_USER_CANCELLED') {
      return { success: false, error: 'Purchase cancelled' }
    }

    return {
      success: false,
      error: error.message || 'Purchase failed',
    }
  }
}

/**
 * Restore previous purchases
 * @param supabaseUrl - Supabase URL for verification
 * @param accessToken - User access token
 */
export async function restorePurchases(
  supabaseUrl: string,
  accessToken: string
): Promise<PurchaseResult> {
  if (!isIAPAvailable()) {
    return { success: false, error: 'IAP not available on this platform' }
  }

  try {
    // Get IAP plugin instance
    const IAPModule = (globalThis as any).InAppPurchases as IAPPlugin | undefined

    if (!IAPModule) {
      return { success: false, error: 'IAP plugin not installed' }
    }

    // Restore purchases
    const restoreResult = await IAPModule.restorePurchases()

    if (!restoreResult.receipts || restoreResult.receipts.length === 0) {
      return { success: false, error: 'No previous purchases found' }
    }

    // Get the latest receipt
    const latestReceipt = restoreResult.receipts[0]

    // Verify with backend
    const verifyResult = await verifyReceipt(
      latestReceipt,
      supabaseUrl,
      accessToken
    )

    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error || 'Receipt verification failed' }
    }

    return {
      success: true,
      plan: verifyResult.plan,
      expiresAt: verifyResult.expiresAt,
    }
  } catch (error: any) {
    console.error('Restore purchases failed:', error)
    return {
      success: false,
      error: error.message || 'Failed to restore purchases',
    }
  }
}

/**
 * Verify receipt with backend
 */
async function verifyReceipt(
  receiptData: string,
  supabaseUrl: string,
  accessToken: string
): Promise<{
  success: boolean
  plan?: 'pro' | 'trade'
  expiresAt?: string
  error?: string
}> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-iap`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ receiptData }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Verification failed' }
    }

    const result = await response.json()
    return result
  } catch (error: any) {
    console.error('Receipt verification error:', error)
    return { success: false, error: 'Network error during verification' }
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
