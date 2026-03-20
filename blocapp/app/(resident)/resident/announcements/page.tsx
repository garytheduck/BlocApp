import { getResidentProfile } from "@/lib/get-resident-profile"

export default async function ResidentAnnouncementsPage() {
  const { supabase, associationId } = await getResidentProfile()

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_pinned, created_at")
    .eq("association_id", associationId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Anunturi</h1>

      {!announcements || announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Niciun anunt de la administratie.
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{a.title}</h3>
                {a.is_pinned && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                    Fixat
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                {a.body}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                {new Date(a.created_at).toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
