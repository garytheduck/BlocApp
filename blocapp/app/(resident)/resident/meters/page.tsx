import { getResidentProfile } from "@/lib/get-resident-profile"
import { MeterForm } from "./meter-form"

const TYPE_LABELS: Record<string, string> = {
  apa_rece: "Apa rece",
  apa_calda: "Apa calda",
  gaz: "Gaz",
}

export default async function ResidentMetersPage() {
  const { supabase, associationId, apartmentId } = await getResidentProfile()

  // Find active collecting_meters report
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("id, period_month, period_year, meter_deadline, status")
    .eq("association_id", associationId)
    .eq("status", "collecting_meters")
    .maybeSingle()

  if (!report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Apometre</h1>
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nu exista o colectare de indici activa in acest moment.
        </p>
      </div>
    )
  }

  // Get required consumption types from expense items
  const { data: expenseItems } = await supabase
    .from("expense_items")
    .select("consumption_type")
    .eq("report_id", report.id)
    .eq("distribution_method", "per_consumption")
    .not("consumption_type", "is", null)

  const requiredTypes = [
    ...new Set((expenseItems ?? []).map((e) => e.consumption_type!)),
  ]

  // Get existing readings for this report
  const { data: readings } = await supabase
    .from("meter_readings")
    .select("type, index_previous, index_current, consumption, submitted_at")
    .eq("report_id", report.id)
    .eq("apartment_id", apartmentId)

  const readingsMap = new Map((readings ?? []).map((r) => [r.type, r]))
  const deadlinePassed = report.meter_deadline
    ? new Date(report.meter_deadline) < new Date()
    : false

  // Get previous readings for each type
  const previousIndexes: Record<string, number> = {}
  for (const type of requiredTypes) {
    const existing = readingsMap.get(type)
    if (existing) {
      previousIndexes[type] = existing.index_previous
    } else {
      const { data: prev } = await supabase
        .from("meter_readings")
        .select("index_current")
        .eq("apartment_id", apartmentId)
        .eq("type", type)
        .neq("report_id", report.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      previousIndexes[type] = prev?.index_current ?? 0
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Apometre</h1>

      {report.meter_deadline && (
        <p
          className={`text-sm ${deadlinePassed ? "text-destructive" : "text-muted-foreground"}`}
        >
          {deadlinePassed
            ? "Termenul de trimitere a expirat."
            : `Termen: ${new Date(report.meter_deadline).toLocaleDateString("ro-RO")}`}
        </p>
      )}

      {requiredTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nu exista contoare necesare pentru aceasta perioada.
        </p>
      ) : (
        <div className="space-y-4">
          {requiredTypes.map((type) => {
            const existing = readingsMap.get(type)
            return (
              <MeterForm
                key={type}
                reportId={report.id}
                type={type}
                label={TYPE_LABELS[type] ?? type}
                previousIndex={previousIndexes[type] ?? 0}
                currentIndex={existing?.index_current ?? undefined}
                submitted={!!existing}
                disabled={deadlinePassed}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
