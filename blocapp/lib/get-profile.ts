import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function getAdminProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, association_id, role, full_name")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") redirect("/auth/login")
  if (!profile.association_id) redirect("/auth/login")

  return { user, profile, supabase, associationId: profile.association_id }
}
