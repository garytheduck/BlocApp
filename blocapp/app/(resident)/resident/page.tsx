import { getResidentProfile } from "@/lib/get-resident-profile"

const MONTH_NAMES = [
  "",
  "Ian",
  "Feb",
  "Mar",
  "Apr",
  "Mai",
  "Iun",
  "Iul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export default async function ResidentDashboard() {
  const { supabase, associationId, apartmentId } = await getResidentProfile()

  // Fetch latest charges (from published/closed reports)
  const { data: charges } = await supabase
    .from("apartment_charges")
    .select(
      "total_due, amount_paid, payment_status, monthly_reports!inner(period_month, period_year, status)"
    )
    .eq("apartment_id", apartmentId)
    .in("monthly_reports.status", ["published", "closed"])
    .order("monthly_reports(period_year)", { ascending: false })
    .limit(6)

  // Calculate balance
  const totalDue = (charges ?? []).reduce(
    (s, c) => s + Number(c.total_due),
    0
  )
  const totalPaid = (charges ?? []).reduce(
    (s, c) => s + Number(c.amount_paid),
    0
  )
  const balance = totalDue - totalPaid

  // Fetch recent announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_pinned, created_at")
    .eq("association_id", associationId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3)

  // Check for open meter collection
  const { data: meterReport } = await supabase
    .from("monthly_reports")
    .select("id, period_month, period_year, meter_deadline")
    .eq("association_id", associationId)
    .eq("status", "collecting_meters")
    .maybeSingle()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portal locatar</h1>

      {/* Balance card */}
      <div className="rounded-lg border bg-card p-5">
        <div className="text-sm text-muted-foreground">Sold restant</div>
        <div
          className={`text-3xl font-bold font-mono mt-1 ${balance > 0 ? "text-destructive" : "text-emerald-500"}`}
        >
          {balance.toFixed(2)} RON
        </div>
        {balance <= 0 && (
          <p className="text-xs text-emerald-500 mt-1">Totul este achitat!</p>
        )}
      </div>

      {/* Meter reading alert */}
      {meterReport && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-400">
            Trimiteti indicii contoarelor pentru{" "}
            {MONTH_NAMES[meterReport.period_month]} {meterReport.period_year}
          </p>
          {meterReport.meter_deadline && (
            <p className="text-xs text-muted-foreground mt-1">
              Termen:{" "}
              {new Date(meterReport.meter_deadline).toLocaleDateString("ro-RO")}
            </p>
          )}
        </div>
      )}

      {/* Recent charges */}
      {charges && charges.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3">Ultimele liste</h2>
          <div className="space-y-2">
            {charges.map((c, i) => {
              const report = c.monthly_reports as unknown as {
                period_month: number
                period_year: number
              }
              const remaining = Number(c.total_due) - Number(c.amount_paid)
              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <span className="text-sm">
                    {MONTH_NAMES[report.period_month]} {report.period_year}
                  </span>
                  <div className="text-right">
                    <span className="font-mono text-sm font-medium">
                      {Number(c.total_due).toFixed(2)} RON
                    </span>
                    {remaining > 0.01 && (
                      <span className="text-xs text-destructive block">
                        rest: {remaining.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent announcements */}
      {announcements && announcements.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3">Anunturi recente</h2>
          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  {a.is_pinned && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      Fixat
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {a.body}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(a.created_at).toLocaleDateString("ro-RO")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
