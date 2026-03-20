import { getAdminProfile } from "@/lib/get-profile"
import { AnnouncementsList } from "@/components/announcements/announcements-list"
import { AnnouncementDialog } from "@/components/announcements/announcement-dialog"

export default async function AnnouncementsPage() {
  const { supabase, associationId } = await getAdminProfile()

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("association_id", associationId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anunturi</h1>
          <p className="text-sm text-muted-foreground">
            Comunicati cu locatarii asociatiei
          </p>
        </div>
        <AnnouncementDialog mode="create" />
      </div>

      <AnnouncementsList announcements={announcements ?? []} />
    </div>
  )
}
