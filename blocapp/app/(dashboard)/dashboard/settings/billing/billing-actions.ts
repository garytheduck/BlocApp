"use server"

import { getAdminCtx } from "@/lib/admin-ctx"
import { getStripe } from "@/lib/stripe"

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID ?? "",
  pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
}

export async function createCheckoutSession(plan: "starter" | "pro") {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const priceId = PRICE_IDS[plan]
  if (!priceId) return { error: "Planul selectat nu este configurat." }

  // Get or create Stripe customer
  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_customer_id, name")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc) return { error: "Asociatia nu a fost gasita." }

  let customerId = assoc.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { association_id: ctx.associationId },
      name: assoc.name,
    })
    customerId = customer.id
    await ctx.supabase
      .from("associations")
      .update({ stripe_customer_id: customerId })
      .eq("id", ctx.associationId)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/dashboard/settings/billing?checkout=cancel`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { association_id: ctx.associationId },
    },
    metadata: { association_id: ctx.associationId },
  })

  return { url: session.url }
}

export async function createPortalSession() {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_customer_id")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc?.stripe_customer_id) {
    return { error: "Nu exista un abonament activ." }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: assoc.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/settings/billing`,
  })

  return { url: session.url }
}
