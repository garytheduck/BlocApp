import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DoorOpen, Building2, CreditCard, ClipboardList } from "lucide-react"
import type { SubscriptionStatus } from "@/types/database"

interface StatsCardsProps {
  totalApartments: number
  vacantCount: number
  totalBuildings: number
  subscriptionStatus: SubscriptionStatus
  trialDaysLeft: number
  lastReport: { month: number; year: number } | null
}

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

export function StatsCards({
  totalApartments,
  vacantCount,
  totalBuildings,
  subscriptionStatus,
  trialDaysLeft,
  lastReport,
}: StatsCardsProps) {
  const subscriptionLabel: Record<string, string> = {
    trialing: "Perioada de proba",
    active: "Activ",
    past_due: "Restant",
    canceled: "Anulat",
  }

  const subscriptionVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    trialing: "outline",
    active: "default",
    past_due: "destructive",
    canceled: "destructive",
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Apartamente
          </CardTitle>
          <DoorOpen className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalApartments}</div>
          {vacantCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {vacantCount} vacant{vacantCount > 1 ? "e" : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Blocuri
          </CardTitle>
          <Building2 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalBuildings}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Abonament
          </CardTitle>
          <CreditCard className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Badge variant={subscriptionVariant[subscriptionStatus]}>
            {subscriptionLabel[subscriptionStatus]}
          </Badge>
          {subscriptionStatus === "trialing" && (
            <p className="mt-1 text-xs text-muted-foreground">
              {trialDaysLeft} zile ramase
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ultima lista
          </CardTitle>
          <ClipboardList className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {lastReport ? (
            <div className="text-2xl font-bold">
              {MONTHS_RO[lastReport.month - 1]}
              <span className="text-lg font-normal text-muted-foreground ml-1">
                {lastReport.year}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nicio lista generata</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
