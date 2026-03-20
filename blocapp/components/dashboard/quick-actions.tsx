"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ClipboardList, DoorOpen, Megaphone, Settings } from "lucide-react"

const ACTIONS = [
  {
    href: "/dashboard/reports",
    label: "Liste intretinere",
    description: "Genereaza si gestioneaza listele lunare",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/apartments",
    label: "Apartamente",
    description: "Adauga sau importa apartamente",
    icon: DoorOpen,
  },
  {
    href: "/dashboard/announcements",
    label: "Anunturi",
    description: "Trimite anunturi catre locatari",
    icon: Megaphone,
  },
  {
    href: "/dashboard/settings",
    label: "Setari",
    description: "Configureaza asociatia",
    icon: Settings,
  },
]

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Link key={action.href} href={action.href}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
              <CardContent className="flex items-start gap-3 pt-5">
                <div className="rounded-md bg-primary/10 p-2">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
