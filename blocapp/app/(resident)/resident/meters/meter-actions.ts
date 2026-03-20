"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

async function getResidentCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, apartment_id, role")
    .eq("id", user.id)
    .single()

  if (
    !profile ||
    profile.role !== "resident" ||
    !profile.apartment_id ||
    !profile.association_id
  )
    return null
  return {
    supabase,
    associationId: profile.association_id,
    apartmentId: profile.apartment_id,
  }
}

export async function submitMeterReading(formData: {
  report_id: string
  type: "apa_rece" | "apa_calda" | "gaz"
  index_current: number
}) {
  const ctx = await getResidentCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Verify report is in collecting_meters state
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("id, status, meter_deadline")
    .eq("id", formData.report_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status !== "collecting_meters") {
    return { error: "Colectarea indicilor nu este activa." }
  }

  if (report.meter_deadline && new Date(report.meter_deadline) < new Date()) {
    return { error: "Termenul de trimitere a indicilor a expirat." }
  }

  // Get previous reading for this meter type
  const { data: prevReading } = await ctx.supabase
    .from("meter_readings")
    .select("index_current")
    .eq("apartment_id", ctx.apartmentId)
    .eq("type", formData.type)
    .neq("report_id", formData.report_id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const indexPrevious = prevReading?.index_current ?? 0

  if (formData.index_current < indexPrevious) {
    return {
      error: `Indexul curent (${formData.index_current}) nu poate fi mai mic decat cel anterior (${indexPrevious}).`,
    }
  }

  const consumption = formData.index_current - indexPrevious

  // Upsert meter reading
  const { error } = await ctx.supabase.from("meter_readings").upsert(
    {
      association_id: ctx.associationId,
      apartment_id: ctx.apartmentId,
      report_id: formData.report_id,
      type: formData.type,
      index_previous: indexPrevious,
      index_current: formData.index_current,
      consumption,
      submitted_by: "resident",
    },
    { onConflict: "report_id,apartment_id,type" }
  )

  if (error) return { error: error.message }

  revalidatePath("/resident/meters")
  return { success: true, consumption }
}
