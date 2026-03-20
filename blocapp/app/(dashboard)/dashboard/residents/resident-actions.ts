"use server"

import { revalidatePath } from "next/cache"
import { getAdminCtx } from "@/lib/admin-ctx"
import { randomBytes } from "crypto"
import { getResend, FROM_EMAIL } from "@/lib/resend"
import { inviteEmailHtml } from "@/lib/emails/invite-email"

export async function inviteResident(formData: {
  apartment_id: string
  email: string
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const email = formData.email.trim().toLowerCase()
  if (!email) return { error: "Email-ul este obligatoriu." }

  // Verify apartment belongs to this association
  const { data: apt } = await ctx.supabase
    .from("apartments")
    .select("id, number")
    .eq("id", formData.apartment_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!apt) return { error: "Apartamentul nu a fost gasit." }

  // Check if apartment already has a linked resident
  const { data: existingProfile } = await ctx.supabase
    .from("profiles")
    .select("id, full_name")
    .eq("apartment_id", apt.id)
    .eq("role", "resident")
    .maybeSingle()

  if (existingProfile) {
    return {
      error: `Apartamentul #${apt.number} are deja un locatar asociat (${existingProfile.full_name ?? "anonim"}).`,
    }
  }

  // Revoke any existing pending invites for this apartment
  await ctx.supabase
    .from("resident_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("apartment_id", apt.id)
    .eq("association_id", ctx.associationId)
    .is("accepted_at", null)
    .is("revoked_at", null)

  // Create new invite
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await ctx.supabase.from("resident_invites").insert({
    association_id: ctx.associationId,
    apartment_id: apt.id,
    email,
    token,
    expires_at: expiresAt,
    created_by: ctx.userId,
  })

  if (error) return { error: error.message }

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/accept-invite?token=${token}`

  // Send invite email (if Resend is configured)
  const resend = getResend()
  if (resend) {
    try {
      // Fetch association name for email
      const { data: assocData } = await ctx.supabase
        .from("associations")
        .select("name")
        .eq("id", ctx.associationId)
        .single()

      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `Invitatie portal locatar — ${assocData?.name ?? "Asociatia"}`,
        html: inviteEmailHtml({
          inviteUrl,
          associationName: assocData?.name ?? "Asociatia",
          apartmentNumber: apt.number,
        }),
      })
    } catch (err) {
      console.error("Failed to send invite email:", err)
      // Don't fail the invite if email fails — admin has the link
    }
  }

  revalidatePath("/dashboard/residents")
  return { success: true, inviteUrl }
}

export async function revokeInvite(inviteId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("resident_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("association_id", ctx.associationId)
    .is("accepted_at", null)
    .is("revoked_at", null)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/residents")
  return { success: true }
}

export async function unlinkResident(profileId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ apartment_id: null })
    .eq("id", profileId)
    .eq("association_id", ctx.associationId)
    .eq("role", "resident")

  if (error) return { error: error.message }

  revalidatePath("/dashboard/residents")
  return { success: true }
}
