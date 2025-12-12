export type Invoice = {
  customerName: string | null
  jobSummary: string // REQUIRED: Never null, AI must always generate a summary
  labourHours: number | null
  materials: { description: string; cost: number | null }[]
  cisJob: boolean | null // null = unknown/not mentioned
  vatRegistered: boolean | null // null = unknown/not mentioned
  notes?: string | null
}
