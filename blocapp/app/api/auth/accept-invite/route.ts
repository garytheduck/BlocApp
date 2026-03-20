import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const { token, fullName, password } = await req.json()

  if (!token) {
    return NextResponse.json({ error: "Token lipsa." }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Validate invite token
  const { data: invite } = await supabase
    .from("resident_invites")
    .select(
      "id, association_id, apartment_id, email, expires_at, accepted_at, revoked_at"
    )
    .eq("token", token)
    .single()

  if (!invite) {
    return NextResponse.json(
      { error: "Invitatie invalida." },
      { status: 400 }
    )
  }

  if (invite.accepted_at) {
    return NextResponse.json(
      { error: "Aceasta invitatie a fost deja acceptata." },
      { status: 400 }
    )
  }

  if (invite.revoked_at) {
    return NextResponse.json(
      { error: "Aceasta invitatie a fost revocata." },
      { status: 400 }
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Aceasta invitatie a expirat." },
      { status: 400 }
    )
  }

  // Check if a user with this email already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === invite.email.toLowerCase()
  )

  let userId: string

  if (existingUser) {
    // Existing user — link apartment to their profile
    userId = existingUser.id

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        apartment_id: invite.apartment_id,
        association_id: invite.association_id,
        role: "resident",
      })
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json(
        { error: "Eroare la asocierea apartamentului." },
        { status: 500 }
      )
    }
  } else {
    // New user — create account
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Parola trebuie sa aiba minim 8 caractere." },
        { status: 400 }
      )
    }

    const { data: signUpData, error: signUpError } =
      await supabase.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

    if (signUpError || !signUpData.user) {
      return NextResponse.json(
        { error: signUpError?.message ?? "Eroare la crearea contului." },
        { status: 500 }
      )
    }

    userId = signUpData.user.id

    // Create profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      apartment_id: invite.apartment_id,
      association_id: invite.association_id,
      role: "resident",
      full_name: fullName || null,
    })

    if (profileError) {
      return NextResponse.json(
        { error: "Eroare la crearea profilului." },
        { status: 500 }
      )
    }
  }

  // Mark invite as accepted
  await supabase
    .from("resident_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)

  return NextResponse.json({
    success: true,
    isExisting: !!existingUser,
    email: invite.email,
  })
}
