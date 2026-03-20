import { getAdminProfile } from "@/lib/get-profile"
import { ReportsList } from "@/components/reports/reports-list"
import { CreateReportDialog } from "@/components/reports/create-report-dialog"

export default async function ReportsPage() {
  const { supabase, associationId } = await getAdminProfile()

  const { data: reports } = await supabase
    .from("monthly_reports")
    .select("*")
    .eq("association_id", associationId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liste de intretinere</h1>
          <p className="text-sm text-muted-foreground">
            Gestionati listele lunare de cheltuieli
          </p>
        </div>
        <CreateReportDialog />
      </div>

      <ReportsList reports={reports ?? []} />
    </div>
  )
}
