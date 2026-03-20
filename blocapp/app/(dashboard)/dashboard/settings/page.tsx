import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssociationForm } from "@/components/settings/association-form"
import { BuildingsList } from "@/components/settings/buildings-list"
import { StripeConnectCard } from "@/components/settings/stripe-connect-card"
import { getAdminProfile } from "@/lib/get-profile"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connect?: string }>
}) {
  const { supabase, associationId } = await getAdminProfile()
  const params = await searchParams

  const { data: association } = await supabase
    .from("associations")
    .select("*")
    .eq("id", associationId)
    .single()

  if (!association) {
    return <p className="text-destructive">Eroare la incarcarea asociatiei.</p>
  }

  const { data: buildingsRaw } = await supabase
    .from("buildings")
    .select("*")
    .eq("association_id", associationId)
    .order("name")

  // Get apartment counts per building
  const buildings = await Promise.all(
    (buildingsRaw ?? []).map(async (b) => {
      const { count } = await supabase
        .from("apartments")
        .select("id", { count: "exact", head: true })
        .eq("building_id", b.id)
      return { ...b, apartment_count: count ?? 0 }
    })
  )

  const defaultTab = params.tab ?? "general"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Setari</h1>
        <p className="text-sm text-muted-foreground">
          Configurati asociatia si gestionati blocurile
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">Asociatie</TabsTrigger>
          <TabsTrigger value="buildings">Blocuri / Scari</TabsTrigger>
          <TabsTrigger value="plati">Plati online</TabsTrigger>
          <TabsTrigger value="billing">Abonament</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <AssociationForm association={association} />
        </TabsContent>

        <TabsContent value="buildings">
          <BuildingsList buildings={buildings} />
        </TabsContent>

        <TabsContent value="plati">
          <StripeConnectCard
            initialOnboarded={association.stripe_connect_onboarded}
            connectReturn={params.connect}
          />
        </TabsContent>

        <TabsContent value="billing">
          <div className="text-sm text-muted-foreground">
            <a href="/dashboard/settings/billing" className="text-primary underline underline-offset-4">
              Deschide pagina de abonament →
            </a>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
