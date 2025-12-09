export interface InvoiceCalculation {
  labourSubtotal: number
  materialsSubtotal: number
  subtotal: number
  cisDeduction: number
  vatAmount: number
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
  // Calculate labour and materials
  const labourSubtotal = calculateLabourCost(labourHours, labourRate)
  const materialsSubtotal = calculateMaterialsTotal(materials)
  const subtotal = labourSubtotal + materialsSubtotal

  // Calculate CIS (only on labour, before VAT)
  const cisDeduction = cisJob ? calculateCIS(labourSubtotal, cisRate) : 0

  // Calculate VAT (on full subtotal after CIS deduction)
  const amountAfterCIS = subtotal - cisDeduction
  const vatAmount = vatRegistered ? calculateVAT(amountAfterCIS, vatRate) : 0

  // Grand total
  const grandTotal = amountAfterCIS + vatAmount

  return {
    labourSubtotal,
    materialsSubtotal,
    subtotal,
    cisDeduction,
    vatAmount,
    grandTotal,
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount)
}
