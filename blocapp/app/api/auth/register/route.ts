import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { userId, fullName, associationName, associationAddress } = await request.json()

  if (!userId || !associationName) {
    return NextResponse.json({ message: "Date lipsa." }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Create association
  const { data: association, error: assocError } = await supabase
    .from("associations")
    .insert({ name: associationName, address: associationAddress ?? null })
    .select("id")
    .single()

  if (assocError || !association) {
    return NextResponse.json({ message: "Eroare la crearea asociatiei." }, { status: 500 })
  }

  // Update profile with role=admin and association_id
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "admin",
      full_name: fullName,
      association_id: association.id,
    })
    .eq("id", userId)

  if (profileError) {
    return NextResponse.json({ message: "Eroare la configurarea profilului." }, { status: 500 })
  }

  return NextResponse.json({ associationId: association.id })
}
