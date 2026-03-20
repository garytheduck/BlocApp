import Stripe from "stripe"

// Singleton — one instance per cold start
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
    stripeInstance = new Stripe(key, { apiVersion: "2026-02-25.clover" })
  }
  return stripeInstance
}

/** Platform fee: 1.5% of amount, rounded up to nearest cent */
export function calculateApplicationFee(amountInBani: number): number {
  return Math.ceil(amountInBani * 0.015)
}

/** Minimum online payment in RON */
export const MIN_ONLINE_PAYMENT_RON = 10
