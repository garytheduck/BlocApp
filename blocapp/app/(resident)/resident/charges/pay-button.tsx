"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createPaymentIntent } from "./payment-actions"
import { toast } from "sonner"
import { CreditCard, Loader2 } from "lucide-react"

interface PayButtonProps {
  chargeId: string
  remaining: number
  connectOnboarded: boolean
}

export function PayButton({ chargeId, remaining, connectOnboarded }: PayButtonProps) {
  const [loading, setLoading] = useState(false)

  if (!connectOnboarded || remaining < 10) return null

  async function handlePay() {
    setLoading(true)
    const result = await createPaymentIntent(chargeId)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    // For now, show client secret — full Stripe Elements integration deferred
    // In production, this would open a Stripe payment sheet
    toast.info(
      `PaymentIntent creat: ${result.amount?.toFixed(2)} RON. Integrarea Stripe Elements va fi adaugata.`
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePay}
      disabled={loading}
      className="mt-2"
    >
      {loading ? (
        <Loader2 className="size-3.5 mr-1.5 animate-spin" />
      ) : (
        <CreditCard className="size-3.5 mr-1.5" />
      )}
      {loading ? "Se proceseaza..." : `Plateste online ${remaining.toFixed(2)} RON`}
    </Button>
  )
}
