import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import { InvoiceCalculation, formatCurrency } from '@/lib/tax'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  companyInfo: {
    fontSize: 9,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  col1: {
    width: '60%',
  },
  col2: {
    width: '20%',
    textAlign: 'right',
  },
  col3: {
    width: '20%',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 11,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
})

interface InvoicePDFProps {
  invoice: any
  calculations: InvoiceCalculation
}

const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice, calculations }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>INVOICE</Text>
          <Text style={styles.companyInfo}>Invoice ID: {invoice.id}</Text>
          <Text style={styles.companyInfo}>
            Date: {new Date(invoice.created_at).toLocaleDateString('en-GB')}
          </Text>
        </View>

        {/* Customer Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text>{invoice.customer_name || 'Customer Name Not Provided'}</Text>
        </View>

        {/* Job Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <Text>{invoice.job_summary}</Text>
          {invoice.notes && <Text style={{ marginTop: 5 }}>{invoice.notes}</Text>}
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Description</Text>
              <Text style={styles.col2}>Qty</Text>
              <Text style={styles.col3}>Amount</Text>
            </View>

            {/* Labour */}
            {invoice.labour_hours && invoice.labour_hours > 0 && (
              <View style={styles.tableRow}>
                <Text style={styles.col1}>
                  Labour ({invoice.labour_hours} hours @ £
                  {invoice.labour_rate.toFixed(2)}/hr)
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
            <Text>Subtotal</Text>
            <Text>{formatCurrency(calculations.subtotal)}</Text>
          </View>

          {invoice.cis_job && calculations.cisDeduction > 0 && (
            <View style={styles.totalRow}>
              <Text>CIS Deduction ({invoice.cis_rate}%)</Text>
              <Text>-{formatCurrency(calculations.cisDeduction)}</Text>
            </View>
          )}

          {invoice.vat_registered && calculations.vatAmount > 0 && (
            <View style={styles.totalRow}>
              <Text>VAT ({invoice.vat_rate}%)</Text>
              <Text>{formatCurrency(calculations.vatAmount)}</Text>
            </View>
          )}

          <View style={styles.grandTotal}>
            <Text>TOTAL DUE</Text>
            <Text>{formatCurrency(calculations.grandTotal)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Thank you for your business</Text>
          <Text>Generated by YapMate</Text>
        </View>
      </Page>
    </Document>
  )
}

export default InvoicePDF
