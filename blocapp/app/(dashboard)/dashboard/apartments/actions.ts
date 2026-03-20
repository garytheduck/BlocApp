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

export async function createApartment(formData: {
  number: string
  building_id: string | null
  floor: number | null
  staircase: string | null
  surface_m2: number | null
  cota_parte: number
  persons_count: number
  owner_name: string | null
  is_vacant: boolean
}) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  // Check uniqueness
  const { data: existing } = await ctx.supabase
    .from("apartments")
    .select("id")
    .eq("association_id", ctx.associationId)
    .eq("number", formData.number)
    .maybeSingle()

  if (existing) {
    return { error: `Apartamentul nr. ${formData.number} exista deja.` }
  }

  const { error } = await ctx.supabase.from("apartments").insert({
    association_id: ctx.associationId,
    number: formData.number,
    building_id: formData.building_id || null,
    floor: formData.floor,
    staircase: formData.staircase || null,
    surface_m2: formData.surface_m2,
    cota_parte: formData.cota_parte,
    persons_count: formData.persons_count,
    owner_name: formData.owner_name || null,
    is_vacant: formData.is_vacant,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/apartments")
  return { success: true }
}

export async function updateApartment(
  id: string,
  formData: {
    number: string
    building_id: string | null
    floor: number | null
    staircase: string | null
    surface_m2: number | null
    cota_parte: number
    persons_count: number
    owner_name: string | null
    is_vacant: boolean
  }
) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  // Check uniqueness excluding this apartment
  const { data: existing } = await ctx.supabase
    .from("apartments")
    .select("id")
    .eq("association_id", ctx.associationId)
    .eq("number", formData.number)
    .neq("id", id)
    .maybeSingle()

  if (existing) {
    return { error: `Apartamentul nr. ${formData.number} exista deja.` }
  }

  const { error } = await ctx.supabase
    .from("apartments")
    .update({
      number: formData.number,
      building_id: formData.building_id || null,
      floor: formData.floor,
      staircase: formData.staircase || null,
      surface_m2: formData.surface_m2,
      cota_parte: formData.cota_parte,
      persons_count: formData.persons_count,
      owner_name: formData.owner_name || null,
      is_vacant: formData.is_vacant,
    })
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/apartments")
  return { success: true }
}

export async function deleteApartment(id: string) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  // Check if apartment has charges
  const { count: chargesCount } = await ctx.supabase
    .from("apartment_charges")
    .select("id", { count: "exact", head: true })
    .eq("apartment_id", id)

  if (chargesCount && chargesCount > 0) {
    return {
      error:
        "Apartamentul are istoric de plati/liste. Marcati-l ca vacant in loc sa il stergeti.",
    }
  }

  // Check if apartment has a linked resident
  const { count: residentCount } = await ctx.supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("apartment_id", id)

  if (residentCount && residentCount > 0) {
    return {
      error: "Apartamentul are un locatar asociat. Dezasociati locatarul mai intai.",
    }
  }

  const { error } = await ctx.supabase
    .from("apartments")
    .delete()
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/apartments")
  return { success: true }
}

export async function toggleVacant(id: string, isVacant: boolean) {
  const ctx = await getAdminAssociation()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("apartments")
    .update({ is_vacant: isVacant })
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/apartments")
  return { success: true }
}
