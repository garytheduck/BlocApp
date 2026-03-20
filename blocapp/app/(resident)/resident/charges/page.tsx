import { getResidentProfile } from "@/lib/get-resident-profile"
import { Badge } from "@/components/ui/badge"
import { PayButton } from "./pay-button"

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

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  unpaid: { label: "Neplatit", variant: "destructive" },
  partial: { label: "Partial", variant: "secondary" },
  paid: { label: "Platit", variant: "default" },
}

type BreakdownItem = {
  category: string
  amount: number
}

export default async function ResidentChargesPage() {
  const { supabase, apartmentId, associationId } = await getResidentProfile()

  const { data: assoc } = await supabase
    .from("associations")
    .select("stripe_connect_onboarded")
    .eq("id", associationId)
    .single()

  const connectOnboarded = assoc?.stripe_connect_onboarded ?? false

  const { data: charges } = await supabase
    .from("apartment_charges")
    .select(
      "*, monthly_reports!inner(period_month, period_year, status, due_date)"
    )
    .eq("apartment_id", apartmentId)
    .in("monthly_reports.status", ["published", "closed"])
    .order("monthly_reports(period_year)", { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Detalii intretinere</h1>

      {!charges || charges.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nu exista liste publicate inca.
        </p>
      ) : (
        <div className="space-y-4">
          {charges.map((charge) => {
            const report = charge.monthly_reports as unknown as {
              period_month: number
              period_year: number
              due_date: string | null
            }
            const breakdown = charge.charges_breakdown as BreakdownItem[]
            const remaining =
              Number(charge.total_due) - Number(charge.amount_paid)
            const statusInfo = STATUS_MAP[charge.payment_status]

            return (
              <div key={charge.id} className="rounded-lg border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-muted/30">
                  <div>
                    <span className="font-medium">
                      {MONTH_NAMES[report.period_month]} {report.period_year}
                    </span>
                    {report.due_date && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Scadenta:{" "}
                        {new Date(report.due_date).toLocaleDateString("ro-RO")}
                      </span>
                    )}
                  </div>
                  <Badge variant={statusInfo?.variant ?? "secondary"}>
                    {statusInfo?.label ?? charge.payment_status}
                  </Badge>
                </div>

                {/* Breakdown */}
                <div className="p-4 space-y-1">
                  {breakdown?.map((b, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{b.category}</span>
                      <span className="font-mono">
                        {Number(b.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 space-y-1">
                    {Number(charge.fond_rulment) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Fond rulment
                        </span>
                        <span className="font-mono">
                          {Number(charge.fond_rulment).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {Number(charge.fond_reparatii) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Fond reparatii
                        </span>
                        <span className="font-mono">
                          {Number(charge.fond_reparatii).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {Number(charge.penalties) > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Penalizari</span>
                        <span className="font-mono">
                          {Number(charge.penalties).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span className="font-mono">
                        {Number(charge.total_due).toFixed(2)} RON
                      </span>
                    </div>
                    {Number(charge.amount_paid) > 0 && (
                      <div className="flex justify-between text-sm text-emerald-500 mt-1">
                        <span>Platit</span>
                        <span className="font-mono">
                          -{Number(charge.amount_paid).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {remaining > 0.01 && (
                      <div className="flex justify-between text-sm font-medium text-destructive mt-1">
                        <span>Rest de plata</span>
                        <span className="font-mono">
                          {remaining.toFixed(2)} RON
                        </span>
                      </div>
                    )}
                    {remaining > 0.01 && (
                      <PayButton
                        chargeId={charge.id}
                        remaining={remaining}
                        connectOnboarded={connectOnboarded}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
