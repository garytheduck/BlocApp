import { getAdminProfile } from "@/lib/get-profile"
import { ResidentsList } from "@/components/residents/residents-list"
import { InviteDialog } from "@/components/residents/invite-dialog"
import type { ResidentRow } from "@/components/residents/residents-list"

export default async function ResidentsPage() {
  const { supabase, associationId } = await getAdminProfile()

  // Fetch linked residents (profiles with apartment_id set)
  const { data: residents } = await supabase
    .from("profiles")
    .select("id, full_name, apartment_id, apartments!inner(number)")
    .eq("association_id", associationId)
    .eq("role", "resident")
    .not("apartment_id", "is", null)

  // Fetch pending invites
  const { data: invites } = await supabase
    .from("resident_invites")
    .select("id, email, apartment_id, expires_at, apartments!inner(number)")
    .eq("association_id", associationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  // Fetch apartments for invite dialog
  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, number")
    .eq("association_id", associationId)
    .order("number")

  // Build rows
  const rows: ResidentRow[] = [
    ...(residents ?? []).map((r) => ({
      type: "linked" as const,
      profileId: r.id,
      fullName: r.full_name,
      apartmentNumber: (r.apartments as unknown as { number: string }).number,
    })),
    ...(invites ?? []).map((i) => ({
      type: "pending" as const,
      inviteId: i.id,
      email: i.email,
      apartmentNumber: (i.apartments as unknown as { number: string }).number,
      expiresAt: i.expires_at,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locatari</h1>
          <p className="text-sm text-muted-foreground">
            Gestionati accesul locatarilor la portal
          </p>
        </div>
        <InviteDialog apartments={apartments ?? []} />
      </div>

      <ResidentsList rows={rows} />
    </div>
  )
}
