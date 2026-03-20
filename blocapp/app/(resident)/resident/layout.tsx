import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ResidentNav } from "@/components/resident-nav"

export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, apartment_id")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "resident") redirect("/auth/login")

  let apartmentNumber = "–"
  if (profile.apartment_id) {
    const { data: apt } = await supabase
      .from("apartments")
      .select("number")
      .eq("id", profile.apartment_id)
      .single()
    if (apt) apartmentNumber = apt.number
  }

  return (
    <div className="min-h-screen bg-background">
      <ResidentNav apartmentNumber={apartmentNumber} />
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
