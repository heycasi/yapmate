/**
 * Test script to verify invoice totals calculations
 * Run with: node scripts/test-totals.js
 */

// Simple inline version of the calculations for testing
function calculateLabourCost(hours, rate) {
  if (!hours || hours <= 0) return 0
  return hours * rate
}

function calculateMaterialsTotal(materials) {
  return materials.reduce((total, material) => {
    return total + material.cost * material.quantity
  }, 0)
}

function calculateCIS(labourAmount, cisRate) {
  if (labourAmount <= 0) return 0
  return (labourAmount * cisRate) / 100
}

function calculateVAT(subtotal, vatRate) {
  if (subtotal <= 0) return 0
  return (subtotal * vatRate) / 100
}

function calculateInvoiceTotals(
  labourHours,
  labourRate,
  materials,
  cisJob,
  cisRate,
  vatRegistered,
  vatRate
) {
  const round = (n) => Math.round(n * 100) / 100

  const labourSubtotal = round(calculateLabourCost(labourHours, labourRate))
  const materialsSubtotal = round(calculateMaterialsTotal(materials))
  const subtotal = round(labourSubtotal + materialsSubtotal)

  const vatAmount = vatRegistered ? round(calculateVAT(subtotal, vatRate)) : 0
  const invoiceTotal = round(subtotal + vatAmount)
  const cisDeduction = cisJob ? round(calculateCIS(labourSubtotal, cisRate)) : 0
  const netPayment = round(invoiceTotal - cisDeduction)

  return {
    labourSubtotal,
    materialsSubtotal,
    subtotal,
    vatAmount,
    invoiceTotal,
    cisDeduction,
    netPayment,
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount)
}

console.log('=== YapMate Invoice Totals Test ===\n')

// Test inputs
const labourHours = 10
const labourRate = 45
const materials = [{ cost: 100, quantity: 1 }]
const cisRate = 20
const vatRate = 20

console.log('Test Inputs:')
console.log(`  Labour: ${labourHours}h @ £${labourRate} = £${labourHours * labourRate}`)
console.log(`  Materials: £${materials[0].cost}`)
console.log(`  Subtotal: £${labourHours * labourRate + materials[0].cost}`)
console.log(`  CIS Rate: ${cisRate}%`)
console.log(`  VAT Rate: ${vatRate}%\n`)

// Scenario 1: VAT OFF, CIS OFF
console.log('Scenario 1: VAT OFF, CIS OFF')
const s1 = calculateInvoiceTotals(labourHours, labourRate, materials, false, cisRate, false, vatRate)
console.log(`  Subtotal: ${formatCurrency(s1.subtotal)}`)
console.log(`  Invoice Total: ${formatCurrency(s1.invoiceTotal)}`)
console.log(`  ✓ Expected: £550.00\n`)

// Scenario 2: VAT ON (20%), CIS OFF
console.log('Scenario 2: VAT ON (20%), CIS OFF')
const s2 = calculateInvoiceTotals(labourHours, labourRate, materials, false, cisRate, true, vatRate)
console.log(`  Subtotal: ${formatCurrency(s2.subtotal)}`)
console.log(`  VAT (20%): ${formatCurrency(s2.vatAmount)}`)
console.log(`  Invoice Total: ${formatCurrency(s2.invoiceTotal)}`)
console.log(`  ✓ Expected: £550 + £110 = £660.00\n`)

// Scenario 3: VAT OFF, CIS ON (20% labour)
console.log('Scenario 3: VAT OFF, CIS ON (20% labour)')
const s3 = calculateInvoiceTotals(labourHours, labourRate, materials, true, cisRate, false, vatRate)
console.log(`  Subtotal: ${formatCurrency(s3.subtotal)}`)
console.log(`  Invoice Total: ${formatCurrency(s3.invoiceTotal)}`)
console.log(`  CIS Withheld (20% of £450): ${formatCurrency(s3.cisDeduction)}`)
console.log(`  Net Payment: ${formatCurrency(s3.netPayment)}`)
console.log(`  ✓ Expected: Invoice £550, CIS £90, Net £460.00\n`)

// Scenario 4: VAT ON (20%), CIS ON (20% labour)
console.log('Scenario 4: VAT ON (20%), CIS ON (20% labour)')
const s4 = calculateInvoiceTotals(labourHours, labourRate, materials, true, cisRate, true, vatRate)
console.log(`  Subtotal: ${formatCurrency(s4.subtotal)}`)
console.log(`  VAT (20%): ${formatCurrency(s4.vatAmount)}`)
console.log(`  Invoice Total: ${formatCurrency(s4.invoiceTotal)}`)
console.log(`  CIS Withheld (20% of £450): ${formatCurrency(s4.cisDeduction)}`)
console.log(`  Net Payment: ${formatCurrency(s4.netPayment)}`)
console.log(`  ✓ Expected: Invoice £660, CIS £90, Net £570.00\n`)

// Verify all scenarios
let allPassed = true

if (s1.invoiceTotal !== 550) {
  console.error(`❌ Scenario 1 FAILED: Expected £550, got ${formatCurrency(s1.invoiceTotal)}`)
  allPassed = false
}

if (s2.vatAmount !== 110 || s2.invoiceTotal !== 660) {
  console.error(`❌ Scenario 2 FAILED: Expected VAT £110 and Total £660, got ${formatCurrency(s2.vatAmount)} and ${formatCurrency(s2.invoiceTotal)}`)
  allPassed = false
}

if (s3.invoiceTotal !== 550 || s3.cisDeduction !== 90 || s3.netPayment !== 460) {
  console.error(`❌ Scenario 3 FAILED: Expected Total £550, CIS £90, Net £460, got ${formatCurrency(s3.invoiceTotal)}, ${formatCurrency(s3.cisDeduction)}, ${formatCurrency(s3.netPayment)}`)
  allPassed = false
}

if (s4.vatAmount !== 110 || s4.invoiceTotal !== 660 || s4.cisDeduction !== 90 || s4.netPayment !== 570) {
  console.error(`❌ Scenario 4 FAILED: Expected VAT £110, Total £660, CIS £90, Net £570, got ${formatCurrency(s4.vatAmount)}, ${formatCurrency(s4.invoiceTotal)}, ${formatCurrency(s4.cisDeduction)}, ${formatCurrency(s4.netPayment)}`)
  allPassed = false
}

if (allPassed) {
  console.log('✅ All scenarios PASSED!')
} else {
  console.log('\n❌ Some scenarios FAILED - check calculations')
  process.exit(1)
}
