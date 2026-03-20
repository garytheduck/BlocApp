import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DoorOpen, ClipboardList, CreditCard, Megaphone } from "lucide-react"

interface ActivityItem {
  type: "apartment" | "report" | "payment" | "announcement"
  description: string
  time: string
}

interface RecentActivityProps {
  items: ActivityItem[]
}

const ICONS = {
  apartment: DoorOpen,
  report: ClipboardList,
  payment: CreditCard,
  announcement: Megaphone,
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "acum"
  if (minutes < 60) return `acum ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `acum ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `acum ${days}z`
  return new Date(dateStr).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })
}

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activitate recenta</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nicio activitate recenta. Adaugati apartamente si creati prima lista de intretinere.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const Icon = ICONS[item.type]
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-1.5 mt-0.5">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(item.time)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
