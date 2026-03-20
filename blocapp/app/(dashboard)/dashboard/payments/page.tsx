import { getAdminProfile } from "@/lib/get-profile"
import { PaymentsTable } from "@/components/payments/payments-table"
import type { PaymentRow } from "@/components/payments/payments-table"

const MONTH_NAMES = [
  "",
  "Ianuarie",
  "Februarie",
  "Martie",
  "Aprilie",
  "Mai",
  "Iunie",
  "Iulie",
  "August",
  "Septembrie",
  "Octombrie",
  "Noiembrie",
  "Decembrie",
]

export default async function PaymentsPage() {
  const { supabase, associationId } = await getAdminProfile()

  // Fetch all payments with apartment info and report period
  const { data: payments } = await supabase
    .from("payments")
    .select(
      `
      *,
      apartments!inner(number),
      apartment_charges!inner(report_id, monthly_reports!inner(period_month, period_year))
    `
    )
    .eq("association_id", associationId)
    .order("paid_at", { ascending: false })

  // Transform to flat structure for client component
  const tablePayments: PaymentRow[] = (payments ?? []).map((p) => {
    const apt = p.apartments as unknown as { number: string } | null
    const charge = p.apartment_charges as unknown as {
      report_id: string
      monthly_reports: { period_month: number; period_year: number }
    } | null
    const period = charge?.monthly_reports
      ? `${MONTH_NAMES[charge.monthly_reports.period_month]} ${charge.monthly_reports.period_year}`
      : "—"

    return {
      id: p.id,
      apartment_number: apt?.number ?? "—",
      report_period: period,
      amount: Number(p.amount),
      method: p.method as PaymentRow["method"],
      status: p.status as PaymentRow["status"],
      paid_at: p.paid_at,
      notes: p.notes,
    }
  })

  // Summary stats
  const succeeded = tablePayments.filter((p) => p.status === "succeeded")
  const totalCollected = succeeded.reduce((s, p) => s + p.amount, 0)
  const cashCount = succeeded.filter((p) => p.method === "cash").length
  const transferCount = succeeded.filter((p) => p.method === "transfer").length
  const onlineCount = succeeded.filter((p) => p.method === "online").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plati</h1>
        <p className="text-sm text-muted-foreground">
          Toate platile inregistrate pentru asociatie
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total incasat</div>
          <div className="text-2xl font-bold font-mono">
            {totalCollected.toFixed(2)} RON
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Numar plati</div>
          <div className="text-2xl font-bold">{succeeded.length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {cashCount} numerar · {transferCount} transfer · {onlineCount}{" "}
            online
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Ultima plata</div>
          <div className="text-lg font-medium">
            {tablePayments.length > 0 && tablePayments[0].paid_at
              ? new Date(tablePayments[0].paid_at).toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </div>
        </div>
      </div>

      <PaymentsTable payments={tablePayments} />
    </div>
  )
}
