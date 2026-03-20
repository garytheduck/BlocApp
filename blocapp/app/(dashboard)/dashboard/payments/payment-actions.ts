"use server"

import { revalidatePath } from "next/cache"
import { getAdminCtx } from "@/lib/admin-ctx"

export async function recordPayment(formData: {
  apartment_charge_id: string
  amount: number
  method: "cash" | "transfer"
  paid_at: string
  notes: string | null
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  if (formData.amount <= 0) return { error: "Suma trebuie sa fie pozitiva." }

  // Verify charge belongs to this association and get current state
  const { data: charge } = await ctx.supabase
    .from("apartment_charges")
    .select("id, apartment_id, association_id, total_due, amount_paid, payment_status, report_id")
    .eq("id", formData.apartment_charge_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!charge) return { error: "Cheltuiala nu a fost gasita." }
  if (charge.payment_status === "paid") return { error: "Aceasta cheltuiala este deja platita integral." }

  // Verify report is published (payments only on published reports)
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("status")
    .eq("id", charge.report_id)
    .single()

  if (!report || report.status !== "published") {
    return { error: "Platile se pot inregistra doar pe liste publicate." }
  }

  const remaining = Number(charge.total_due) - Number(charge.amount_paid)
  if (formData.amount > remaining + 0.01) {
    return { error: `Suma depaseste restul de plata (${remaining.toFixed(2)} RON).` }
  }

  // Insert payment
  const { error: payError } = await ctx.supabase.from("payments").insert({
    association_id: ctx.associationId,
    apartment_id: charge.apartment_id,
    apartment_charge_id: charge.id,
    amount: formData.amount,
    method: formData.method,
    status: "succeeded",
    paid_at: formData.paid_at || new Date().toISOString(),
    recorded_by: ctx.userId,
    notes: formData.notes || null,
  })

  if (payError) return { error: payError.message }

  // Update charge amount_paid and payment_status
  const newAmountPaid = Number(charge.amount_paid) + formData.amount
  const newStatus =
    newAmountPaid >= Number(charge.total_due) - 0.01 ? "paid" : "partial"

  const { error: updateError } = await ctx.supabase
    .from("apartment_charges")
    .update({
      amount_paid: Math.round(newAmountPaid * 100) / 100,
      payment_status: newStatus,
    })
    .eq("id", charge.id)
    .eq("association_id", ctx.associationId)

  if (updateError) return { error: updateError.message }

  revalidatePath("/dashboard/payments")
  revalidatePath(`/dashboard/reports/${charge.report_id}`)
  return { success: true }
}

export async function deletePayment(paymentId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Get the payment
  const { data: payment } = await ctx.supabase
    .from("payments")
    .select("id, amount, apartment_charge_id, status, method")
    .eq("id", paymentId)
    .eq("association_id", ctx.associationId)
    .single()

  if (!payment) return { error: "Plata nu a fost gasita." }
  if (payment.status !== "succeeded") return { error: "Doar platile cu succes pot fi sterse." }
  if (payment.method === "online") return { error: "Platile online nu pot fi sterse manual. Folositi refund din Stripe." }

  // Get the charge
  const { data: charge } = await ctx.supabase
    .from("apartment_charges")
    .select("id, amount_paid, total_due, report_id")
    .eq("id", payment.apartment_charge_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!charge) return { error: "Cheltuiala asociata nu a fost gasita." }

  // Verify report is still published
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("status")
    .eq("id", charge.report_id)
    .single()

  if (!report || report.status !== "published") {
    return { error: "Platile pot fi sterse doar pe liste publicate." }
  }

  // Delete the payment
  const { error: delError } = await ctx.supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("association_id", ctx.associationId)

  if (delError) return { error: delError.message }

  // Reverse charge update
  const newAmountPaid = Math.max(0, Number(charge.amount_paid) - Number(payment.amount))
  const newStatus = newAmountPaid <= 0.01 ? "unpaid" : "partial"

  await ctx.supabase
    .from("apartment_charges")
    .update({
      amount_paid: Math.round(newAmountPaid * 100) / 100,
      payment_status: newStatus,
    })
    .eq("id", charge.id)
    .eq("association_id", ctx.associationId)

  revalidatePath("/dashboard/payments")
  revalidatePath(`/dashboard/reports/${charge.report_id}`)
  return { success: true }
}
