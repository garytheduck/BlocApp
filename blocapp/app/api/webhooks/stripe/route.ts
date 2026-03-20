import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 }
    )
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = await createServiceClient()

  try {
    switch (event.type) {
      // ── Stripe Connect: account onboarding status change ──
      case "account.updated": {
        const account = event.data.object as Stripe.Account
        await supabase
          .from("associations")
          .update({
            stripe_connect_onboarded: account.charges_enabled ?? false,
          })
          .eq("stripe_connect_account_id", account.id)
        break
      }

      // ── Stripe Connect: account deauthorized ──
      case "account.application.deauthorized": {
        const application = event.data.object as unknown as { id: string; account?: string }
        if (application.account) {
          await supabase
            .from("associations")
            .update({ stripe_connect_onboarded: false })
            .eq("stripe_connect_account_id", application.account)
        }
        break
      }

      // ── Payment succeeded (online payment from resident) ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent

        // Idempotency: check if we already processed this event
        const { data: existing } = await supabase
          .from("payments")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle()

        if (existing) break // Already processed

        // Extract metadata
        const chargeId = pi.metadata?.apartment_charge_id
        const associationId = pi.metadata?.association_id
        const apartmentId = pi.metadata?.apartment_id

        if (!chargeId || !associationId || !apartmentId) {
          console.error("Payment intent missing metadata:", pi.id)
          break
        }

        const amountRon = pi.amount / 100 // Stripe uses bani (cents)
        const applicationFee = pi.application_fee_amount
          ? pi.application_fee_amount / 100
          : null

        // Insert payment
        await supabase.from("payments").insert({
          association_id: associationId,
          apartment_id: apartmentId,
          apartment_charge_id: chargeId,
          amount: amountRon,
          method: "online",
          stripe_payment_intent_id: pi.id,
          stripe_application_fee: applicationFee,
          stripe_event_id: event.id,
          status: "succeeded",
          paid_at: new Date().toISOString(),
        })

        // Update charge amount_paid
        const { data: charge } = await supabase
          .from("apartment_charges")
          .select("amount_paid, total_due")
          .eq("id", chargeId)
          .single()

        if (charge) {
          const newAmountPaid = Number(charge.amount_paid) + amountRon
          const newStatus =
            newAmountPaid >= Number(charge.total_due) - 0.01
              ? "paid"
              : "partial"

          await supabase
            .from("apartment_charges")
            .update({
              amount_paid: Math.round(newAmountPaid * 100) / 100,
              payment_status: newStatus,
            })
            .eq("id", chargeId)
        }
        break
      }

      // ── SaaS subscription updated ──
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const status =
          sub.status === "active"
            ? "active"
            : sub.status === "trialing"
              ? "trialing"
              : sub.status === "past_due"
                ? "past_due"
                : "canceled"

        await supabase
          .from("associations")
          .update({ subscription_status: status })
          .eq("stripe_customer_id", sub.customer as string)
        break
      }

      // ── SaaS subscription deleted ──
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from("associations")
          .update({
            subscription_status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", sub.customer as string)
        break
      }

      // ── Checkout session completed (new subscription) ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription") break

        const associationId = session.metadata?.association_id
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id

        if (!associationId || !subscriptionId) break

        // Retrieve subscription to get plan details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const status =
          subscription.status === "trialing" ? "trialing" : "active"

        // Determine plan from price ID
        const priceId = subscription.items.data[0]?.price?.id ?? ""
        const plan =
          priceId === process.env.STRIPE_PRO_PRICE_ID ? "pro" : "starter"

        // Trial end date
        const trialEndsAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null

        await supabase
          .from("associations")
          .update({
            stripe_customer_id:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id ?? null,
            stripe_subscription_id: subscriptionId,
            subscription_status: status,
            plan,
            ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
          })
          .eq("id", associationId)
        break
      }

      default:
        // Unhandled event type — ignore
        break
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
