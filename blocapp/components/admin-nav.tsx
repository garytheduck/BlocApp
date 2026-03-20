"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  LayoutDashboard,
  ClipboardList,
  CreditCard,
  DoorOpen,
  Gauge,
  Megaphone,
  Users,
  Settings,
  LogOut,
  Menu,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/reports", label: "Liste intretinere", icon: ClipboardList },
  { href: "/dashboard/payments", label: "Plati", icon: CreditCard },
  { href: "/dashboard/apartments", label: "Apartamente", icon: DoorOpen },
  { href: "/dashboard/residents", label: "Locatari", icon: Users },
  { href: "/dashboard/meters", label: "Apometre", icon: Gauge },
  { href: "/dashboard/announcements", label: "Anunturi", icon: Megaphone },
  { href: "/dashboard/settings", label: "Setari", icon: Settings },
]

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 py-2">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm border-l-2 transition-colors",
              isActive
                ? "text-primary border-primary bg-primary/10"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function BrandHeader({ associationName }: { associationName: string }) {
  return (
    <div className="p-4 border-b border-border">
      <div className="text-xs font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-1">
        BlocApp
      </div>
      <div className="text-xs text-muted-foreground truncate">{associationName}</div>
    </div>
  )
}

export function AdminNav({ associationName }: { associationName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 bg-card border-r border-border flex-col">
        <BrandHeader associationName={associationName} />
        <NavLinks pathname={pathname} />
        <div className="p-4 border-t border-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="size-3" />
            Deconectare
          </button>
        </div>
      </aside>

      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex md:hidden items-center gap-3 bg-card border-b border-border px-4 py-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="size-8">
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Meniu navigare</SheetTitle>
            </SheetHeader>
            <BrandHeader associationName={associationName} />
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="p-4 border-t border-border">
              <button
                onClick={() => {
                  setMobileOpen(false)
                  handleSignOut()
                }}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="size-3" />
                Deconectare
              </button>
            </div>
          </SheetContent>
        </Sheet>
        <div className="text-xs font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
          BlocApp
        </div>
      </div>
    </>
  )
}
