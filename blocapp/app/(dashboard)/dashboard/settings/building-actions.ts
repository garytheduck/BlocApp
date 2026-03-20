"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function getAdminAssociation() {
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
  return { supabase, associationId: profile.association_id }
}

export async function createBuilding(formData: {
  name: string
  address: string | null
  floors: number | null
  staircase_count: number | null
}) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase.from("buildings").insert({
    association_id: ctx.associationId,
    name: formData.name,
    address: formData.address || null,
    floors: formData.floors || null,
    staircase_count: formData.staircase_count || null,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function updateBuilding(
  id: string,
  formData: {
    name: string
    address: string | null
    floors: number | null
    staircase_count: number | null
  }
) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("buildings")
    .update({
      name: formData.name,
      address: formData.address || null,
      floors: formData.floors || null,
      staircase_count: formData.staircase_count || null,
    })
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function deleteBuilding(id: string) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  // Check if building has apartments
  const { count } = await ctx.supabase
    .from("apartments")
    .select("id", { count: "exact", head: true })
    .eq("building_id", id)

  if (count && count > 0) {
    return {
      error: `Blocul are ${count} apartament${count > 1 ? "e" : ""}. Mutati sau stergeti apartamentele mai intai.`,
    }
  }

  const { error } = await ctx.supabase
    .from("buildings")
    .delete()
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/settings")
  return { success: true }
}
