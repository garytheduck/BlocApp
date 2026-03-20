import { StatsCards } from "@/components/dashboard/stats-cards"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { Separator } from "@/components/ui/separator"
import { getAdminProfile } from "@/lib/get-profile"

export default async function DashboardPage() {
  const { supabase, associationId, profile } = await getAdminProfile()

  // Fetch all data in parallel
  const [
    associationResult,
    apartmentsResult,
    buildingsResult,
    lastReportResult,
    recentAnnouncementsResult,
  ] = await Promise.all([
    supabase
      .from("associations")
      .select("subscription_status, trial_ends_at")
      .eq("id", associationId)
      .single(),
    supabase
      .from("apartments")
      .select("id, is_vacant", { count: "exact" })
      .eq("association_id", associationId),
    supabase
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .eq("association_id", associationId),
    supabase
      .from("monthly_reports")
      .select("period_month, period_year")
      .eq("association_id", associationId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("announcements")
      .select("title, created_at")
      .eq("association_id", associationId)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const association = associationResult.data
  const apartments = apartmentsResult.data ?? []
  const totalApartments = apartmentsResult.count ?? 0
  const vacantCount = apartments.filter((a) => a.is_vacant).length
  const totalBuildings = buildingsResult.count ?? 0

  const trialDaysLeft = association
    ? Math.max(
        0,
        Math.ceil(
          (new Date(association.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const lastReport = lastReportResult.data
    ? { month: lastReportResult.data.period_month, year: lastReportResult.data.period_year }
    : null

  // Build activity feed
  type ActivityItem = { type: "apartment" | "report" | "payment" | "announcement"; description: string; time: string }
  const activity: ActivityItem[] = []

  for (const ann of recentAnnouncementsResult.data ?? []) {
    activity.push({
      type: "announcement",
      description: `Anunt: ${ann.title}`,
      time: ann.created_at,
    })
  }

  // Sort by time desc, take top 5
  activity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  const recentActivity = activity.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Bine ai venit{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Rezumatul asociatiei tale
        </p>
      </div>

      <StatsCards
        totalApartments={totalApartments}
        vacantCount={vacantCount}
        totalBuildings={totalBuildings}
        subscriptionStatus={association?.subscription_status ?? "trialing"}
        trialDaysLeft={trialDaysLeft}
        lastReport={lastReport}
      />

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Actiuni rapide</h2>
          <QuickActions />
        </div>
        <RecentActivity items={recentActivity} />
      </div>
    </div>
  )
}
