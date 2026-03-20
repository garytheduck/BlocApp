"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  createConnectOnboardingLink,
  getConnectAccountStatus,
} from "@/app/(dashboard)/dashboard/settings/stripe-actions"
import { toast } from "sonner"
import { ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react"

interface StripeConnectCardProps {
  initialOnboarded: boolean
  connectReturn?: string | null
}

export function StripeConnectCard({
  initialOnboarded,
  connectReturn,
}: StripeConnectCardProps) {
  const [status, setStatus] = useState<"not_created" | "pending" | "active">(
    initialOnboarded ? "active" : "not_created"
  )
  const [loading, setLoading] = useState(false)

  // On mount, if we just returned from Stripe, re-check status
  useEffect(() => {
    if (connectReturn === "success" || connectReturn === "refresh") {
      checkStatus()
    }
  }, [connectReturn])

  async function checkStatus() {
    const result = await getConnectAccountStatus()
    if (result.status) setStatus(result.status)
  }

  async function handleOnboard() {
    setLoading(true)
    const result = await createConnectOnboardingLink()
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.url) {
      window.location.href = result.url
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Plati online (Stripe Connect)
          {status === "active" && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="size-3" /> Activ
            </Badge>
          )}
          {status === "pending" && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" /> In curs
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Permite locatarilor sa plateasca intretinerea online cu cardul.
          Platforma retine un comision de 1.5%.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "active" ? (
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm">
              Configurat — locatarii pot plati online
            </span>
          </div>
        ) : status === "pending" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-400">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>
                Procesul de onboarding nu a fost finalizat. Continuati
                configurarea pentru a activa platile online.
              </span>
            </div>
            <Button
              onClick={handleOnboard}
              disabled={loading}
              variant="outline"
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              {loading ? "Se incarca..." : "Continua configurarea"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conectati un cont Stripe pentru a permite locatarilor sa plateasca
              online. Procesul dureaza cateva minute si necesita date despre
              asociatie.
            </p>
            <Button onClick={handleOnboard} disabled={loading}>
              <ExternalLink className="size-3.5 mr-1.5" />
              {loading ? "Se incarca..." : "Configureaza Stripe Connect"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
