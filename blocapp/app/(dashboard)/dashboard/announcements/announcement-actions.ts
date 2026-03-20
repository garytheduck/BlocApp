"use server"

import { revalidatePath } from "next/cache"
import { getAdminCtx } from "@/lib/admin-ctx"

export async function createAnnouncement(formData: {
  title: string
  body: string
  is_pinned: boolean
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  if (!formData.title.trim()) return { error: "Titlul este obligatoriu." }
  if (!formData.body.trim()) return { error: "Continutul este obligatoriu." }

  const { error } = await ctx.supabase.from("announcements").insert({
    association_id: ctx.associationId,
    author_id: ctx.userId,
    title: formData.title.trim(),
    body: formData.body.trim(),
    is_pinned: formData.is_pinned,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/announcements")
  return { success: true }
}

export async function updateAnnouncement(
  id: string,
  formData: { title: string; body: string; is_pinned: boolean }
) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("announcements")
    .update({
      title: formData.title.trim(),
      body: formData.body.trim(),
      is_pinned: formData.is_pinned,
    })
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/announcements")
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/announcements")
  return { success: true }
}
