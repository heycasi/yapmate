export type Invoice = {
  customerName: string | null
  jobSummary: string
  labourHours: number | null
  materials: { description: string; cost: number | null }[]
  cisJob: boolean
  vatRegistered: boolean
  notes?: string | null
}
