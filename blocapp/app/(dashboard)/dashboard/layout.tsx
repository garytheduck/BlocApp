import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminNav } from "@/components/admin-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") redirect("/auth/login")

  const { data: association } = await supabase
    .from("associations")
    .select("name")
    .eq("id", profile.association_id!)
    .single()

  return (
    <div className="flex h-screen bg-background">
      <AdminNav associationName={association?.name ?? "Asociatia mea"} />
      {/* pt-14 on mobile for fixed header bar, md:pt-0 resets for desktop */}
      <main className="flex-1 overflow-auto p-6 pt-20 md:pt-6">{children}</main>
    </div>
  )
}
