import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #333",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
    borderBottom: "0.5pt solid #ddd",
  },
  col1: { width: "8%" },
  col2: { width: "52%" },
  col3: { width: "20%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  chargeCol1: { width: "6%" },
  chargeColOwner: { width: "10%" },
  chargeCol3: { width: "12%", textAlign: "right" },
  chargeCol4: { width: "10%", textAlign: "right" },
  chargeCol5: { width: "10%", textAlign: "right" },
  chargeCol6: { width: "12%", textAlign: "right" },
  chargeCol7: { width: "10%", textAlign: "right" },
  chargeCol8: { width: "12%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    borderTop: "1.5pt solid #333",
    paddingTop: 4,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#999",
  },
})

const MONTH_NAMES = [
  "", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

interface ExpenseItem {
  category: string
  amount: number
  distribution_method: string
}

interface ApartmentCharge {
  apartment_number: string
  owner_name: string
  subtotal: number
  fond_rulment: number
  fond_reparatii: number
  balance_previous: number
  penalties: number
  total_due: number
  amount_paid: number
}

interface ReportPDFProps {
  associationName: string
  address: string | null
  periodMonth: number
  periodYear: number
  expenses: ExpenseItem[]
  charges: ApartmentCharge[]
  totalExpenses: number
}

export function ReportPDF({
  associationName,
  address,
  periodMonth,
  periodYear,
  expenses,
  charges,
  totalExpenses,
}: ReportPDFProps) {
  const grandTotal = charges.reduce((s, c) => s + c.total_due, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{associationName}</Text>
          {address && <Text style={styles.subtitle}>{address}</Text>}
          <Text style={[styles.subtitle, { marginTop: 8 }]}>
            Lista de intretinere — {MONTH_NAMES[periodMonth]} {periodYear}
          </Text>
        </View>

        {/* Expenses table */}
        <Text style={styles.sectionTitle}>Cheltuieli comune</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Nr.</Text>
            <Text style={styles.col2}>Categorie</Text>
            <Text style={styles.col3}>Distributie</Text>
            <Text style={styles.col4}>Suma (RON)</Text>
          </View>
          {expenses.map((e, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{i + 1}</Text>
              <Text style={styles.col2}>{e.category}</Text>
              <Text style={styles.col3}>{e.distribution_method}</Text>
              <Text style={styles.col4}>{Number(e.amount).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.col1} />
            <Text style={styles.col2}>TOTAL CHELTUIELI</Text>
            <Text style={styles.col3} />
            <Text style={styles.col4}>{totalExpenses.toFixed(2)}</Text>
          </View>
        </View>

        {/* Charges per apartment */}
        <Text style={styles.sectionTitle}>Defalcare pe apartamente</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.chargeCol1}>Ap.</Text>
            <Text style={styles.chargeColOwner}>Proprietar</Text>
            <Text style={styles.chargeCol3}>Subtotal</Text>
            <Text style={styles.chargeCol4}>F. rul.</Text>
            <Text style={styles.chargeCol5}>F. rep.</Text>
            <Text style={styles.chargeCol6}>Sold ant.</Text>
            <Text style={styles.chargeCol7}>Penalizari</Text>
            <Text style={styles.chargeCol8}>TOTAL</Text>
          </View>
          {charges.map((c, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.chargeCol1}>{c.apartment_number}</Text>
              <Text style={styles.chargeColOwner}>{c.owner_name}</Text>
              <Text style={styles.chargeCol3}>{c.subtotal.toFixed(2)}</Text>
              <Text style={styles.chargeCol4}>{c.fond_rulment.toFixed(2)}</Text>
              <Text style={styles.chargeCol5}>{c.fond_reparatii.toFixed(2)}</Text>
              <Text style={styles.chargeCol6}>{c.balance_previous.toFixed(2)}</Text>
              <Text style={styles.chargeCol7}>{c.penalties.toFixed(2)}</Text>
              <Text style={styles.chargeCol8}>{c.total_due.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.chargeCol1} />
            <Text style={styles.chargeColOwner} />
            <Text style={styles.chargeCol3} />
            <Text style={styles.chargeCol4} />
            <Text style={styles.chargeCol5} />
            <Text style={styles.chargeCol6} />
            <Text style={styles.chargeCol7}>TOTAL</Text>
            <Text style={styles.chargeCol8}>{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generat de BlocApp — {new Date().toLocaleDateString("ro-RO")}
        </Text>
      </Page>
    </Document>
  )
}
