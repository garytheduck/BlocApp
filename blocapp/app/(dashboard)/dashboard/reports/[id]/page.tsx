import { notFound } from "next/navigation"
import Link from "next/link"
import { getAdminProfile } from "@/lib/get-profile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExpensesTab } from "@/components/reports/expenses-tab"
import { MetersTab } from "@/components/reports/meters-tab"
import { ChargesTab } from "@/components/reports/charges-tab"
import { SettingsTab } from "@/components/reports/settings-tab"
import { formatPeriod } from "@/lib/utils/months"
import { ChevronLeft, FileDown } from "lucide-react"
import type { ConsumptionType } from "@/types/database"

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  collecting_meters: { label: "Colectare indici", variant: "default" },
  published: { label: "Publicat", variant: "default" },
  closed: { label: "Inchis", variant: "outline" },
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, associationId } = await getAdminProfile()

  const { data: report } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("id", id)
    .eq("association_id", associationId)
    .single()

  if (!report) notFound()

  // Fetch all data in parallel
  const [
    { data: expenseItems },
    { data: meterReadings },
    { data: chargesRaw },
    { data: apartments },
  ] = await Promise.all([
    supabase
      .from("expense_items")
      .select("*")
      .eq("report_id", id)
      .order("sort_order"),
    supabase
      .from("meter_readings")
      .select("*")
      .eq("report_id", id),
    supabase
      .from("apartment_charges")
      .select("*")
      .eq("report_id", id),
    supabase
      .from("apartments")
      .select("*")
      .eq("association_id", associationId)
      .order("number"),
  ])

  // Attach apartment to each charge
  const aptMap = new Map((apartments ?? []).map((a) => [a.id, a]))
  const charges = (chargesRaw ?? []).map((c) => ({
    ...c,
    apartment: aptMap.get(c.apartment_id),
  }))

  // Determine which consumption types have expense items
  const activeConsumptionTypes = [
    ...new Set(
      (expenseItems ?? [])
        .filter((i) => i.distribution_method === "per_consumption" && i.consumption_type)
        .map((i) => i.consumption_type as ConsumptionType)
    ),
  ]

  const readonly = report.status === "closed"
  const statusInfo = STATUS_LABELS[report.status] ?? STATUS_LABELS.draft

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          nativeButton={false}
          render={<Link href="/dashboard/reports" />}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              Lista {formatPeriod(report.period_month, report.period_year)}
            </h1>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {report.status !== "draft" && (
              <a
                href={`/api/reports/${id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <FileDown className="size-3.5 mr-1.5" />
                  PDF
                </Button>
              </a>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {report.total_expenses > 0
              ? `Total cheltuieli: ${Number(report.total_expenses).toLocaleString("ro-RO", {
                  minimumFractionDigits: 2,
                })} RON`
              : "Fara cheltuieli adaugate"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="expenses">Cheltuieli</TabsTrigger>
          <TabsTrigger value="meters">Indici contoare</TabsTrigger>
          <TabsTrigger value="charges">Lista generata</TabsTrigger>
          <TabsTrigger value="settings">Setari</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <ExpensesTab
            reportId={id}
            items={expenseItems ?? []}
            readonly={readonly}
          />
        </TabsContent>

        <TabsContent value="meters">
          <MetersTab
            reportId={id}
            apartments={apartments ?? []}
            readings={meterReadings ?? []}
            activeTypes={activeConsumptionTypes}
            readonly={readonly}
          />
        </TabsContent>

        <TabsContent value="charges">
          <ChargesTab
            reportId={id}
            charges={charges}
            canCalculate={!readonly && (expenseItems?.length ?? 0) > 0}
            reportStatus={report.status}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab report={report} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
