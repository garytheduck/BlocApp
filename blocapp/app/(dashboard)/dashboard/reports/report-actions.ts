"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

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

export async function createReport(formData: {
  period_month: number
  period_year: number
  fond_rulment_pct: number
  fond_reparatii_pct: number
  penalty_rate_per_day: number
  meter_deadline: string | null
  due_date: string | null
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { data, error } = await ctx.supabase
    .from("monthly_reports")
    .insert({
      association_id: ctx.associationId,
      period_month: formData.period_month,
      period_year: formData.period_year,
      fond_rulment_pct: formData.fond_rulment_pct,
      fond_reparatii_pct: formData.fond_reparatii_pct,
      penalty_rate_per_day: formData.penalty_rate_per_day,
      meter_deadline: formData.meter_deadline || null,
      due_date: formData.due_date || null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "Exista deja o lista pentru aceasta luna si an." }
    }
    return { error: error.message }
  }

  revalidatePath("/dashboard/reports")
  return { success: true, id: data.id }
}

export async function updateReport(
  id: string,
  formData: {
    fond_rulment_pct: number
    fond_reparatii_pct: number
    penalty_rate_per_day: number
    meter_deadline: string | null
    due_date: string | null
  }
) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("monthly_reports")
    .update({
      fond_rulment_pct: formData.fond_rulment_pct,
      fond_reparatii_pct: formData.fond_reparatii_pct,
      penalty_rate_per_day: formData.penalty_rate_per_day,
      meter_deadline: formData.meter_deadline || null,
      due_date: formData.due_date || null,
    })
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${id}`)
  return { success: true }
}

export async function deleteReport(id: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Only allow deleting drafts
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("status")
    .eq("id", id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status !== "draft") {
    return { error: "Puteti sterge doar liste cu statusul Draft." }
  }

  const { error } = await ctx.supabase
    .from("monthly_reports")
    .delete()
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/reports")
  return { success: true }
}

export async function advanceReportStatus(id: string, action: "start_meters" | "publish" | "close") {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("status")
    .eq("id", id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!report) return { error: "Lista nu a fost gasita." }

  const transitions: Record<string, { from: string; to: string; field?: string }> = {
    start_meters: { from: "draft", to: "collecting_meters" },
    publish: { from: "collecting_meters", to: "published", field: "published_at" },
    close: { from: "published", to: "closed", field: "closed_at" },
  }

  const t = transitions[action]
  if (report.status !== t.from) {
    return { error: `Statusul curent (${report.status}) nu permite aceasta actiune.` }
  }

  const updateData: Record<string, string> = { status: t.to }
  if (t.field) updateData[t.field] = new Date().toISOString()

  const { error } = await ctx.supabase
    .from("monthly_reports")
    .update(updateData)
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${id}`)
  revalidatePath("/dashboard/reports")
  return { success: true }
}

export async function calculateReport(reportId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Verify report belongs to this association
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("*")
    .eq("id", reportId)
    .eq("association_id", ctx.associationId)
    .single()

  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status === "closed") return { error: "Lista este inchisa si nu poate fi recalculata." }

  // Re-publish guard: block recalculation if succeeded payments exist
  const { count: paymentCount } = await ctx.supabase
    .from("payments")
    .select("id, apartment_charges!inner(report_id)", { count: "exact", head: true })
    .eq("apartment_charges.report_id", reportId)
    .eq("status", "succeeded")

  if (paymentCount && paymentCount > 0) {
    return {
      error: "Nu puteti recalcula lista deoarece exista plati inregistrate. Stergeti platile mai intai.",
    }
  }

  // Fetch all apartments
  const { data: apartments } = await ctx.supabase
    .from("apartments")
    .select("*")
    .eq("association_id", ctx.associationId)
    .order("number")

  if (!apartments || apartments.length === 0) {
    return { error: "Nu exista apartamente in asociatie." }
  }

  // Fetch all expense items for this report
  const { data: expenseItems } = await ctx.supabase
    .from("expense_items")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order")

  if (!expenseItems || expenseItems.length === 0) {
    return { error: "Nu exista cheltuieli adaugate in lista." }
  }

  // Fetch all meter readings for this report
  const { data: meterReadings } = await ctx.supabase
    .from("meter_readings")
    .select("*")
    .eq("report_id", reportId)

  // Build meter reading lookup: apt_id -> type -> consumption
  const meterMap = new Map<string, Map<string, number>>()
  for (const mr of meterReadings ?? []) {
    if (!meterMap.has(mr.apartment_id)) meterMap.set(mr.apartment_id, new Map())
    meterMap.get(mr.apartment_id)!.set(mr.type, mr.consumption)
  }

  // Precompute aggregates for distribution methods
  const activeApts = apartments.filter((a) => !a.is_vacant)
  const totalCota = apartments.reduce((s, a) => s + Number(a.cota_parte), 0)
  const totalPersons = activeApts.reduce((s, a) => s + a.persons_count, 0)
  const activeCount = activeApts.length

  // ── Carry-forward balance from previous month ──
  const { data: prevReport } = await ctx.supabase
    .from("monthly_reports")
    .select("id, due_date, penalty_rate_per_day")
    .eq("association_id", ctx.associationId)
    .in("status", ["published", "closed"])
    .neq("id", reportId)
    .or(
      `period_year.lt.${report.period_year},and(period_year.eq.${report.period_year},period_month.lt.${report.period_month})`
    )
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(1)
    .maybeSingle()

  const balanceMap = new Map<string, number>()
  if (prevReport) {
    const { data: prevCharges } = await ctx.supabase
      .from("apartment_charges")
      .select("apartment_id, total_due, amount_paid")
      .eq("report_id", prevReport.id)

    for (const pc of prevCharges ?? []) {
      const remaining = Math.round((Number(pc.total_due) - Number(pc.amount_paid)) * 100) / 100
      if (remaining > 0) {
        balanceMap.set(pc.apartment_id, remaining)
      }
    }
  }

  // ── Penalties calculation ──
  const prevPenaltyRate = prevReport ? Number(prevReport.penalty_rate_per_day) || 0 : 0
  const prevDueDate = prevReport?.due_date ? new Date(prevReport.due_date) : null
  const today = new Date()
  const penaltyDays =
    prevDueDate && today > prevDueDate
      ? Math.floor((today.getTime() - prevDueDate.getTime()) / 86400000)
      : 0

  // For per_consumption: sum consumption per type across all apartments
  const totalConsumptionByType = new Map<string, number>()
  for (const [, typeMap] of meterMap) {
    for (const [type, consumption] of typeMap) {
      totalConsumptionByType.set(type, (totalConsumptionByType.get(type) ?? 0) + consumption)
    }
  }

  // Calculate charges per apartment
  const chargesData = apartments.map((apt) => {
    const breakdown: Array<{
      expense_item_id: string
      category: string
      amount: number
      distribution_method: string
    }> = []
    let subtotal = 0

    for (const item of expenseItems) {
      let aptAmount = 0
      const itemAmount = Number(item.amount)

      if (item.distribution_method === "per_cota") {
        const cota = Number(apt.cota_parte)
        aptAmount = totalCota > 0 ? (cota / totalCota) * itemAmount : 0
      } else if (item.distribution_method === "per_person") {
        if (apt.is_vacant) {
          aptAmount = 0
        } else {
          aptAmount = totalPersons > 0 ? (apt.persons_count / totalPersons) * itemAmount : 0
        }
      } else if (item.distribution_method === "per_apartment") {
        aptAmount = apt.is_vacant ? 0 : activeCount > 0 ? itemAmount / activeCount : 0
      } else if (item.distribution_method === "per_consumption") {
        const consumptionType = item.consumption_type!
        const aptConsumption = meterMap.get(apt.id)?.get(consumptionType) ?? 0
        const totalConsumption = totalConsumptionByType.get(consumptionType) ?? 0
        aptAmount = totalConsumption > 0 ? (aptConsumption / totalConsumption) * itemAmount : 0
      }

      aptAmount = Math.round(aptAmount * 100) / 100

      if (aptAmount !== 0) {
        breakdown.push({
          expense_item_id: item.id,
          category: item.category,
          amount: aptAmount,
          distribution_method: item.distribution_method,
        })
        subtotal += aptAmount
      }
    }

    subtotal = Math.round(subtotal * 100) / 100
    const fondRulment = Math.round(subtotal * Number(report.fond_rulment_pct) * 100) / 100
    const fondReparatii = Math.round(subtotal * Number(report.fond_reparatii_pct) * 100) / 100
    const balancePrevious = balanceMap.get(apt.id) ?? 0
    const penalties =
      prevPenaltyRate > 0 && penaltyDays > 0
        ? Math.round(balancePrevious * prevPenaltyRate * penaltyDays * 100) / 100
        : 0
    const totalDue = Math.round((subtotal + fondRulment + fondReparatii + balancePrevious + penalties) * 100) / 100

    return {
      association_id: ctx.associationId,
      report_id: reportId,
      apartment_id: apt.id,
      charges_breakdown: breakdown,
      subtotal,
      fond_rulment: fondRulment,
      fond_reparatii: fondReparatii,
      balance_previous: balancePrevious,
      penalties,
      total_due: totalDue,
      amount_paid: 0,
      payment_status: "unpaid" as const,
    }
  })

  // Upsert all charges
  const { error: upsertError } = await ctx.supabase
    .from("apartment_charges")
    .upsert(chargesData, { onConflict: "report_id,apartment_id" })

  if (upsertError) return { error: upsertError.message }

  // Update report total_expenses
  const totalExpenses = expenseItems.reduce((s, i) => s + Number(i.amount), 0)
  await ctx.supabase
    .from("monthly_reports")
    .update({ total_expenses: Math.round(totalExpenses * 100) / 100 })
    .eq("id", reportId)
    .eq("association_id", ctx.associationId)

  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true, count: chargesData.length }
}
