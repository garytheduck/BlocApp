import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface ImportRow {
  number: string
  floor: number | null
  staircase: string | null
  surface_m2: number | null
  cota_parte: number
  persons_count: number
  owner_name: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ message: "Neautorizat" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("association_id, role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin" || !profile.association_id) {
      return NextResponse.json({ message: "Neautorizat" }, { status: 403 })
    }

    const body = await request.json()
    const apartments: ImportRow[] = body.apartments

    if (!apartments || !Array.isArray(apartments) || apartments.length === 0) {
      return NextResponse.json({ message: "Nu exista apartamente de importat." }, { status: 400 })
    }

    // Get existing apartment numbers
    const { data: existing } = await supabase
      .from("apartments")
      .select("number")
      .eq("association_id", profile.association_id)

    const existingNumbers = new Set((existing ?? []).map((e) => e.number))

    const toInsert: ImportRow[] = []
    const skipped: { number: string; reason: string }[] = []
    const warnings: string[] = []

    for (const apt of apartments) {
      if (!apt.number) {
        skipped.push({ number: "(gol)", reason: "Nr. apartament lipseste" })
        continue
      }

      if (existingNumbers.has(apt.number)) {
        skipped.push({ number: apt.number, reason: "Apartamentul exista deja" })
        continue
      }

      if (!apt.cota_parte || apt.cota_parte <= 0) {
        skipped.push({ number: apt.number, reason: "Cota parte invalida" })
        continue
      }

      toInsert.push(apt)
    }

    // Check cota sum
    const cotaSum = toInsert.reduce((sum, a) => sum + a.cota_parte, 0)
    const existingCotaResult = await supabase
      .from("apartments")
      .select("cota_parte")
      .eq("association_id", profile.association_id)
      .eq("is_vacant", false)

    const existingCotaSum = (existingCotaResult.data ?? []).reduce(
      (sum, a) => sum + (a.cota_parte || 0),
      0
    )

    const totalCota = existingCotaSum + cotaSum
    if (Math.abs(totalCota - 1.0) > 0.0001) {
      warnings.push(
        `Suma totala a cotelor va fi ${totalCota.toFixed(6)} (existente: ${existingCotaSum.toFixed(6)} + import: ${cotaSum.toFixed(6)}). Ajustati cotele dupa import.`
      )
    }

    // Insert all valid rows
    if (toInsert.length > 0) {
      const rows = toInsert.map((apt) => ({
        association_id: profile.association_id!,
        number: apt.number,
        floor: apt.floor,
        staircase: apt.staircase,
        surface_m2: apt.surface_m2,
        cota_parte: apt.cota_parte,
        persons_count: apt.persons_count || 1,
        owner_name: apt.owner_name,
        is_vacant: false,
      }))

      const { error } = await supabase.from("apartments").insert(rows)

      if (error) {
        return NextResponse.json(
          { message: `Eroare la inserare: ${error.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      inserted: toInsert.length,
      skipped,
      warnings,
    })
  } catch {
    return NextResponse.json({ message: "Eroare interna." }, { status: 500 })
  }
}
