export interface InvoiceCalculation {
  labourSubtotal: number
  materialsSubtotal: number
  subtotal: number
  vatAmount: number
  invoiceTotal: number
  cisDeduction: number
  netPayment: number
  // Legacy field for backwards compatibility (same as invoiceTotal)
  grandTotal: number
}

export function calculateLabourCost(hours: number | null, rate: number): number {
  if (!hours || hours <= 0) return 0
  return hours * rate
}

export function calculateMaterialsTotal(
  materials: { cost: number; quantity: number }[]
): number {
  return materials.reduce((total, material) => {
    return total + material.cost * material.quantity
  }, 0)
}

export function calculateCIS(labourAmount: number, cisRate: number): number {
  if (labourAmount <= 0) return 0
  return (labourAmount * cisRate) / 100
}

export function calculateVAT(subtotal: number, vatRate: number): number {
  if (subtotal <= 0) return 0
  return (subtotal * vatRate) / 100
}

export function calculateInvoiceTotals(
  labourHours: number | null,
  labourRate: number,
  materials: { cost: number; quantity: number }[],
  cisJob: boolean,
  cisRate: number,
  vatRegistered: boolean,
  vatRate: number
): InvoiceCalculation {
  // Round to 2 decimal places to avoid float drift
  const round = (n: number) => Math.round(n * 100) / 100

  // Calculate labour and materials
  const labourSubtotal = round(calculateLabourCost(labourHours, labourRate))
  const materialsSubtotal = round(calculateMaterialsTotal(materials))
  const subtotal = round(labourSubtotal + materialsSubtotal)

  // UK VAT rules: VAT is calculated on full subtotal (labour + materials)
  // VAT is added on top and paid by the customer
  const vatAmount = vatRegistered ? round(calculateVAT(subtotal, vatRate)) : 0

  // Invoice total = what the customer pays
  const invoiceTotal = round(subtotal + vatAmount)

  // UK CIS rules: CIS is withheld by contractor from labour only
  // CIS does NOT reduce VAT or materials, and does NOT reduce invoice total
  const cisDeduction = cisJob ? round(calculateCIS(labourSubtotal, cisRate)) : 0

  // Net payment = what you receive (invoice total minus CIS withheld)
  const netPayment = round(invoiceTotal - cisDeduction)

  return {
    labourSubtotal,
    materialsSubtotal,
    subtotal,
    vatAmount,
    invoiceTotal,
    cisDeduction,
    netPayment,
    // Legacy field for backwards compatibility
    grandTotal: invoiceTotal,
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount)
}
