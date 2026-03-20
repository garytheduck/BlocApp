"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  createCheckoutSession,
  createPortalSession,
} from "@/app/(dashboard)/dashboard/settings/billing/billing-actions"
import { toast } from "sonner"
import { CheckCircle2, Crown, ExternalLink } from "lucide-react"

interface BillingCardProps {
  subscriptionStatus: string
  plan: string
  trialEndsAt: string
  canceledAt: string | null
  hasSubscription: boolean
  checkoutResult?: string | null
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  trialing: { label: "Trial", variant: "secondary" },
  active: { label: "Activ", variant: "default" },
  past_due: { label: "Plata restanta", variant: "destructive" },
  canceled: { label: "Anulat", variant: "destructive" },
}

export function BillingCard({
  subscriptionStatus,
  plan,
  trialEndsAt,
  canceledAt,
  hasSubscription,
  checkoutResult,
}: BillingCardProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const statusInfo = STATUS_LABELS[subscriptionStatus]
  const isTrialing = subscriptionStatus === "trialing"
  const isCanceled = subscriptionStatus === "canceled"
  const trialDaysLeft = isTrialing
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0

  async function handleCheckout(selectedPlan: "starter" | "pro") {
    setLoading(selectedPlan)
    const result = await createCheckoutSession(selectedPlan)
    setLoading(null)
    if (result.error) {
      toast.error(result.error)
    } else if (result.url) {
      window.location.href = result.url
    }
  }

  async function handlePortal() {
    setLoading("portal")
    const result = await createPortalSession()
    setLoading(null)
    if (result.error) {
      toast.error(result.error)
    } else if (result.url) {
      window.location.href = result.url
    }
  }

  return (
    <div className="space-y-6">
      {checkoutResult === "success" && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-sm">
          <CheckCircle2 className="size-4" />
          Abonamentul a fost activat cu succes!
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Abonament
            {statusInfo && (
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isTrialing
              ? `Trial gratuit — ${trialDaysLeft} zile ramase`
              : isCanceled
                ? `Anulat${canceledAt ? ` pe ${new Date(canceledAt).toLocaleDateString("ro-RO")}` : ""}`
                : `Plan ${plan === "pro" ? "Pro" : "Starter"}`}
          </CardDescription>
        </CardHeader>
        {hasSubscription && !isCanceled && (
          <CardContent>
            <Button variant="outline" onClick={handlePortal} disabled={loading === "portal"}>
              <ExternalLink className="size-3.5 mr-1.5" />
              {loading === "portal" ? "Se incarca..." : "Gestioneaza abonament"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Plan selection — show when no subscription or canceled */}
      {(!hasSubscription || isCanceled) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Starter */}
          <Card className={plan === "starter" && !isCanceled ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="text-lg">Starter</CardTitle>
              <CardDescription>Pana la 50 apartamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold font-mono">49</span>
                <span className="text-sm text-muted-foreground"> RON/luna</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Liste de intretinere</li>
                <li>✓ Portal locatari</li>
                <li>✓ Plati online</li>
                <li>✓ Anunturi</li>
              </ul>
              <Button
                className="w-full"
                onClick={() => handleCheckout("starter")}
                disabled={loading !== null}
              >
                {loading === "starter" ? "Se incarca..." : "Alege Starter"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className={plan === "pro" && !isCanceled ? "border-primary" : "border-amber-500/30"}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Pro
                <Crown className="size-4 text-amber-500" />
              </CardTitle>
              <CardDescription>Apartamente nelimitate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold font-mono">149</span>
                <span className="text-sm text-muted-foreground"> RON/luna</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Tot ce include Starter</li>
                <li>✓ Export PDF</li>
                <li>✓ Email automat locatari</li>
                <li>✓ Suport prioritar</li>
              </ul>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleCheckout("pro")}
                disabled={loading !== null}
              >
                {loading === "pro" ? "Se incarca..." : "Alege Pro"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
