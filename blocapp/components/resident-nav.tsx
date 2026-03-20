"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { LogOut } from "lucide-react"

const NAV_ITEMS = [
  { href: "/resident", label: "Acasa" },
  { href: "/resident/charges", label: "Intretinere" },
  { href: "/resident/announcements", label: "Anunturi" },
  { href: "/resident/meters", label: "Apometre" },
]

export function ResidentNav({ apartmentNumber }: { apartmentNumber: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-sm font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
          BlocApp
        </span>
        <nav className="flex gap-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Ap. {apartmentNumber}</span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="size-3" />
          Iesire
        </button>
      </div>
    </header>
  )
}
