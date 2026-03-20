"use server"

import { getStripe } from "@/lib/stripe"
import { getAdminCtx } from "@/lib/admin-ctx"

export async function createConnectOnboardingLink() {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Check if Stripe keys are configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Stripe nu este configurat. Contactati administratorul platformei." }
  }

  const stripe = getStripe()

  // Get current association
  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_connect_account_id, name")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc) return { error: "Asociatia nu a fost gasita." }

  let accountId = assoc.stripe_connect_account_id

  // Create Connect Express account if none exists
  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: "RO",
        business_type: "non_profit",
        metadata: { association_id: ctx.associationId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })

      accountId = account.id

      await ctx.supabase
        .from("associations")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", ctx.associationId)
    } catch (err) {
      console.error("Failed to create Connect account:", err)
      return { error: "Eroare la crearea contului Stripe Connect." }
    }
  }

  // Create onboarding link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/dashboard/settings?tab=plati&connect=refresh`,
      return_url: `${baseUrl}/dashboard/settings?tab=plati&connect=success`,
      type: "account_onboarding",
    })

    return { url: accountLink.url }
  } catch (err) {
    console.error("Failed to create account link:", err)
    return { error: "Eroare la generarea link-ului de onboarding." }
  }
}

export async function getConnectAccountStatus() {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_connect_account_id, stripe_connect_onboarded")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc) return { error: "Asociatia nu a fost gasita." }

  if (!assoc.stripe_connect_account_id) {
    return { status: "not_created" as const }
  }

  if (assoc.stripe_connect_onboarded) {
    return { status: "active" as const }
  }

  // Account exists but not onboarded — check with Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe()
      const account = await stripe.accounts.retrieve(assoc.stripe_connect_account_id)
      if (account.charges_enabled) {
        // Update our DB
        await ctx.supabase
          .from("associations")
          .update({ stripe_connect_onboarded: true })
          .eq("id", ctx.associationId)
        return { status: "active" as const }
      }
    } catch {
      // Stripe error — fall through to pending
    }
  }

  return { status: "pending" as const }
}
