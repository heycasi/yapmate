/* eslint-disable jsx-a11y/alt-text */
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import { InvoiceCalculation, formatCurrency } from '@/lib/tax'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 20,
  },
  logoContainer: {
    width: 100,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  headerRight: {
    textAlign: 'right',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  companyInfo: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingBottom: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  table: {
    marginTop: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#444',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  col1: {
    width: '60%',
  },
  col2: {
    width: '15%',
    textAlign: 'right',
  },
  col3: {
    width: '25%',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    marginLeft: 'auto',
    width: '50%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 10,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  notesSection: {
    marginTop: 30,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  notesText: {
    fontSize: 9,
    color: '#444',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
})

interface BankDetails {
  accountName: string
  sortCode: string
  accountNumber: string
  paymentReference: string
}

interface InvoicePDFProps {
  invoice: any
  calculations: InvoiceCalculation
  bankDetails: BankDetails | null
}

// Helper to check if a value is effectively false/null
const isNA = (val: boolean | null) => val === false || val === null

const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, calculations, bankDetails }) => {
  // Use public URL or absolute path if possible. 
  // For Vercel/Next.js, we might need the full URL for server-side generation if it's external,
  // or file system path if local. React-PDF Image src can be a url.
  // Using the hosted URL (production) is safest for PDF generation if local file access issues arise,
  // but let's try the public path first. If it fails, fallback to text.
  // Actually, let's just use text for the logo placeholder if image is risky, 
  // BUT the requirement says "Logo top-left".
  // I will assume the deployment URL or just use a placeholder text if I can't guarantee the path.
  // Wait, I can use process.cwd() + public... but let's try just the string path.
  // Or better, let's use the yapmate.vercel.app URL if safe, or a relative path.
  // Given constraints, I will use the path `/yapmatetransparetnew112.png` and hope Next.js resolves it.
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* 
               In production (Vercel), local file access for PDF might be tricky. 
               Using the public URL is often reliable. 
            */}
             <Image 
                src="https://yapmate.vercel.app/yapmatetransparetnew112.png" 
                style={styles.logo} 
             />
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.companyInfo}>Invoice #: {invoice.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.companyInfo}>
              Date: {new Date(invoice.created_at).toLocaleDateString('en-GB')}
            </Text>
            {/* Add user's details if we had them, for now just generic */}
          </View>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={{ fontSize: 12, marginBottom: 2 }}>{invoice.customer_name || 'Valued Customer'}</Text>
          {/* We don't have address field separately, so just name */}
        </View>

        {/* Job Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text style={{ lineHeight: 1.4 }}>{invoice.job_summary}</Text>
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, styles.tableHeaderCell]}>Description</Text>
              <Text style={[styles.col2, styles.tableHeaderCell]}>Qty</Text>
              <Text style={[styles.col3, styles.tableHeaderCell]}>Amount</Text>
            </View>

            {/* Labour */}
            {invoice.labour_hours && invoice.labour_hours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>
                  Labour ({invoice.labour_hours} hrs @ £{invoice.labour_rate.toFixed(2)}/hr)
                </Text>
                <Text style={styles.col2}>1</Text>
                <Text style={styles.col3}>
                  {formatCurrency(calculations.labourSubtotal)}
                </Text>
              </View>
            )}

            {/* Materials */}
            {invoice.materials.map((material: any, index: number) => (
              <View key={index} style={styles.tableRow}>
                <Text style={styles.col1}>{material.description}</Text>
                <Text style={styles.col2}>{material.quantity}</Text>
                <Text style={styles.col3}>
                  {formatCurrency(material.cost * material.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text>Subtotal (Labour + Materials)</Text>
            <Text>{formatCurrency(calculations.subtotal)}</Text>
          </View>

          {/* VAT Section - only show if enabled */}
          {!isNA(invoice.vat_registered) && (
            <View style={styles.totalRow}>
              <Text>VAT ({invoice.vat_rate}%)</Text>
              <Text>{formatCurrency(calculations.vatAmount)}</Text>
            </View>
          )}

          <View style={styles.grandTotal}>
            <Text>INVOICE TOTAL</Text>
            <Text>{formatCurrency(calculations.invoiceTotal)}</Text>
          </View>

          {/* CIS Section - only show if enabled, appears after invoice total */}
          {!isNA(invoice.cis_job) && (
            <>
              <View style={[styles.totalRow, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#ccc' }]}>
                <Text style={{ fontSize: 9, color: '#666' }}>CIS withheld by contractor ({invoice.cis_rate}% of labour)</Text>
                <Text style={{ fontSize: 9, color: '#666' }}>{formatCurrency(calculations.cisDeduction)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={{ fontWeight: 'bold' }}>Net Payment to Contractor</Text>
                <Text style={{ fontWeight: 'bold' }}>{formatCurrency(calculations.netPayment)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Notes / Payment Terms */}
        {invoice.notes && (
            <View style={styles.notesSection}>
                <Text style={styles.notesTitle}>Payment Terms & Notes</Text>
                <Text style={styles.notesText}>{invoice.notes}</Text>
            </View>
        )}

        {/* Payment Details */}
        {bankDetails && (
          <View style={{ marginTop: 30, padding: 15, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd' }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Payment Details</Text>
            <View style={{ fontSize: 9, lineHeight: 1.6 }}>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: '40%', fontWeight: 'bold' }}>Account Name:</Text>
                <Text style={{ width: '60%' }}>{bankDetails.accountName}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: '40%', fontWeight: 'bold' }}>Sort Code:</Text>
                <Text style={{ width: '60%' }}>{bankDetails.sortCode}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ width: '40%', fontWeight: 'bold' }}>Account Number:</Text>
                <Text style={{ width: '60%' }}>{bankDetails.accountNumber}</Text>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ width: '40%', fontWeight: 'bold' }}>Payment Reference:</Text>
                <Text style={{ width: '60%' }}>{bankDetails.paymentReference}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business</Text>
          <Text style={{ marginTop: 2 }}>Generated by YapMate - The Tradie&apos;s Voice Assistant</Text>
        </View>
      </Page>
    </Document>
  )
}

export default InvoicePDF
