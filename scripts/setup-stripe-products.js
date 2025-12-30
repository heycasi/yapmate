#!/usr/bin/env node

/**
 * Stripe Product Setup Script
 *
 * Creates YapMate pricing products and prices in Stripe.
 * Run once during initial billing setup.
 *
 * Usage:
 *   node scripts/setup-stripe-products.js
 *
 * Requirements:
 *   - STRIPE_SECRET_KEY in .env.local
 *   - npm install stripe
 */

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY not found in .env.local')
  console.error('   Add your Stripe secret key to .env.local')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

async function setupProducts() {
  try {
    console.log('🏗️  Setting up YapMate Stripe products...\n')

    // ========================================================================
    // PRO PLAN - £15/month
    // ========================================================================

    console.log('Creating Pro plan...')

    const proProduct = await stripe.products.create({
      name: 'YapMate Pro',
      description: 'Unlimited invoices + VAT support',
      metadata: {
        plan_type: 'pro',
        features: 'unlimited_invoices,vat_support',
      },
    })

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 1500, // £15.00 in pence
      currency: 'gbp',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan_type: 'pro',
      },
    })

    console.log(`✅ Pro Product ID: ${proProduct.id}`)
    console.log(`✅ Pro Price ID:   ${proPrice.id}\n`)

    // ========================================================================
    // TRADE PLAN - £30/month
    // ========================================================================

    console.log('Creating Trade plan...')

    const tradeProduct = await stripe.products.create({
      name: 'YapMate Trade',
      description: 'Unlimited invoices + VAT + CIS support',
      metadata: {
        plan_type: 'trade',
        features: 'unlimited_invoices,vat_support,cis_support',
      },
    })

    const tradePrice = await stripe.prices.create({
      product: tradeProduct.id,
      unit_amount: 3000, // £30.00 in pence
      currency: 'gbp',
      recurring: {
        interval: 'month',
      },
      metadata: {
        plan_type: 'trade',
      },
    })

    console.log(`✅ Trade Product ID: ${tradeProduct.id}`)
    console.log(`✅ Trade Price ID:   ${tradePrice.id}\n`)

    // ========================================================================
    // SUMMARY
    // ========================================================================

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 ADD THESE TO YOUR .env.local FILE:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log(`# Stripe Product IDs`)
    console.log(`NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=${proPrice.id}`)
    console.log(`NEXT_PUBLIC_STRIPE_TRADE_PRICE_ID=${tradePrice.id}`)
    console.log(`STRIPE_PRO_PRODUCT_ID=${proProduct.id}`)
    console.log(`STRIPE_TRADE_PRODUCT_ID=${tradeProduct.id}\n`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('✅ Setup complete!')
    console.log('📝 Next steps:')
    console.log('   1. Copy the env vars above to .env.local')
    console.log('   2. Set up Stripe webhook for subscription events')
    console.log('   3. Create subscriptions table migration')
    console.log('   4. Implement Apple IAP verification\n')

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error.message)
    if (error.type === 'StripeAuthenticationError') {
      console.error('   Check that your STRIPE_SECRET_KEY is correct')
    }
    process.exit(1)
  }
}

setupProducts()
