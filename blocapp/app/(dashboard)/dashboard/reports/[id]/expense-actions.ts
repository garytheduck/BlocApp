"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { DistributionMethod, ConsumptionType } from "@/types/database"

async function getAdminCtx() {
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

async function verifyReportOwnership(ctx: NonNullable<Awaited<ReturnType<typeof getAdminCtx>>>, reportId: string) {
  const { data } = await ctx.supabase
    .from("monthly_reports")
    .select("id, status")
    .eq("id", reportId)
    .eq("association_id", ctx.associationId)
    .single()
  return data
}

export async function addExpenseItem(
  reportId: string,
  formData: {
    category: string
    description: string | null
    amount: number
    distribution_method: DistributionMethod
    consumption_type: ConsumptionType | null
    sort_order: number
  }
) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const report = await verifyReportOwnership(ctx, reportId)
  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status === "closed") return { error: "Lista este inchisa." }

  const { error } = await ctx.supabase.from("expense_items").insert({
    report_id: reportId,
    association_id: ctx.associationId,
    category: formData.category,
    description: formData.description || null,
    amount: formData.amount,
    distribution_method: formData.distribution_method,
    consumption_type: formData.consumption_type || null,
    sort_order: formData.sort_order,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true }
}

export async function updateExpenseItem(
  id: string,
  reportId: string,
  formData: {
    category: string
    description: string | null
    amount: number
    distribution_method: DistributionMethod
    consumption_type: ConsumptionType | null
    sort_order: number
  }
) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const report = await verifyReportOwnership(ctx, reportId)
  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status === "closed") return { error: "Lista este inchisa." }

  const { error } = await ctx.supabase
    .from("expense_items")
    .update({
      category: formData.category,
      description: formData.description || null,
      amount: formData.amount,
      distribution_method: formData.distribution_method,
      consumption_type: formData.consumption_type || null,
      sort_order: formData.sort_order,
    })
    .eq("id", id)
    .eq("report_id", reportId)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true }
}

export async function deleteExpenseItem(id: string, reportId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const report = await verifyReportOwnership(ctx, reportId)
  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status === "closed") return { error: "Lista este inchisa." }

  const { error } = await ctx.supabase
    .from("expense_items")
    .delete()
    .eq("id", id)
    .eq("report_id", reportId)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true }
}
