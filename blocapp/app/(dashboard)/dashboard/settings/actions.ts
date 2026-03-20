"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function updateAssociation(formData: {
  name: string
  address: string | null
  cui: string | null
  bank_account: string | null
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Neautorizat" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin" || !profile.association_id) {
    return { error: "Neautorizat" }
  }

  const { error } = await supabase
    .from("associations")
    .update({
      name: formData.name,
      address: formData.address || null,
      cui: formData.cui || null,
      bank_account: formData.bank_account || null,
    })
    .eq("id", profile.association_id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/settings")
  return { success: true }
}
