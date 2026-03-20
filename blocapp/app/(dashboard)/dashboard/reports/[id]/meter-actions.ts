"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { ConsumptionType } from "@/types/database"

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

export async function upsertMeterReading(
  reportId: string,
  data: {
    apartment_id: string
    type: ConsumptionType
    index_previous: number
    index_current: number
    is_estimate: boolean
  }
) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Verify report
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("id, status")
    .eq("id", reportId)
    .eq("association_id", ctx.associationId)
    .single()

  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status === "closed") return { error: "Lista este inchisa." }

  if (data.index_current < data.index_previous) {
    return { error: "Indexul curent nu poate fi mai mic decat indexul precedent." }
  }

  const { error } = await ctx.supabase.from("meter_readings").upsert(
    {
      association_id: ctx.associationId,
      report_id: reportId,
      apartment_id: data.apartment_id,
      type: data.type,
      index_previous: data.index_previous,
      index_current: data.index_current,
      is_estimate: data.is_estimate,
      submitted_by: "admin",
    },
    { onConflict: "apartment_id,report_id,type" }
  )

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true }
}

export async function deleteMeterReading(id: string, reportId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("meter_readings")
    .delete()
    .eq("id", id)
    .eq("report_id", reportId)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/reports/${reportId}`)
  return { success: true }
}
