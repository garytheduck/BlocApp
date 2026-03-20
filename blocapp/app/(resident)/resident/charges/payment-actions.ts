"use server"

import { createClient } from "@/lib/supabase/server"
import { getStripe, calculateApplicationFee, MIN_ONLINE_PAYMENT_RON } from "@/lib/stripe"

async function getResidentCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, apartment_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "resident" || !profile.apartment_id || !profile.association_id) return null
  return { supabase, associationId: profile.association_id, apartmentId: profile.apartment_id }
}

export async function createPaymentIntent(chargeId: string) {
  const ctx = await getResidentCtx()
  if (!ctx) return { error: "Neautorizat" }

  const stripe = getStripe()

  // Fetch charge
  const { data: charge } = await ctx.supabase
    .from("apartment_charges")
    .select("total_due, amount_paid, apartment_id, report_id")
    .eq("id", chargeId)
    .eq("apartment_id", ctx.apartmentId)
    .single()

  if (!charge) return { error: "Lista de intretinere nu a fost gasita." }

  const remaining = Math.round((Number(charge.total_due) - Number(charge.amount_paid)) * 100) / 100
  if (remaining < MIN_ONLINE_PAYMENT_RON) {
    return { error: `Suma minima pentru plata online este ${MIN_ONLINE_PAYMENT_RON} RON.` }
  }

  // Get association's Connect account
  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_connect_account_id, stripe_connect_onboarded, name")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc?.stripe_connect_account_id || !assoc.stripe_connect_onboarded) {
    return { error: "Asociatia nu are platile online activate." }
  }

  const amountInBani = Math.round(remaining * 100)
  const applicationFee = calculateApplicationFee(amountInBani)

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountInBani,
      currency: "ron",
      application_fee_amount: applicationFee,
      metadata: {
        apartment_charge_id: chargeId,
        association_id: ctx.associationId,
        apartment_id: ctx.apartmentId,
      },
    }, {
      stripeAccount: assoc.stripe_connect_account_id,
    })

    return { clientSecret: pi.client_secret, amount: remaining }
  } catch (err) {
    console.error("Failed to create PaymentIntent:", err)
    return { error: "Eroare la initializarea platii." }
  }
}
