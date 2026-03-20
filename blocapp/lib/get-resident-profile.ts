import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function getResidentProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, association_id, apartment_id, role, full_name")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "resident") redirect("/auth/login")
  if (!profile.association_id || !profile.apartment_id) redirect("/auth/login")

  return {
    user,
    profile,
    supabase,
    associationId: profile.association_id,
    apartmentId: profile.apartment_id,
  }
}
