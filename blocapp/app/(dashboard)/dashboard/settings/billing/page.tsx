import { getAdminProfile } from "@/lib/get-profile"
import { BillingCard } from "@/components/settings/billing-card"

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { supabase, associationId } = await getAdminProfile()
  const params = await searchParams

  const { data: assoc } = await supabase
    .from("associations")
    .select("subscription_status, plan, trial_ends_at, canceled_at, stripe_subscription_id")
    .eq("id", associationId)
    .single()

  if (!assoc) return <p className="text-destructive">Eroare.</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Abonament</h1>
        <p className="text-sm text-muted-foreground">
          Gestionati planul si facturarea
        </p>
      </div>

      <BillingCard
        subscriptionStatus={assoc.subscription_status}
        plan={assoc.plan}
        trialEndsAt={assoc.trial_ends_at}
        canceledAt={assoc.canceled_at}
        hasSubscription={!!assoc.stripe_subscription_id}
        checkoutResult={params.checkout}
      />
    </div>
  )
}
