import { createClient } from "@/lib/supabase/server"

/**
 * Shared admin context helper for Server Actions.
 * Returns authenticated supabase client, association ID, and user ID.
 * Returns null if user is not an authenticated admin.
 */
export async function getAdminCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin" || !profile.association_id) return null
  return { supabase, associationId: profile.association_id, userId: user.id }
}
