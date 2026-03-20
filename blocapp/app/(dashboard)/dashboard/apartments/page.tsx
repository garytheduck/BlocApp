import { ApartmentsTable } from "@/components/apartments/apartments-table"
import { CsvImportDialog } from "@/components/apartments/csv-import-dialog"
import { getAdminProfile } from "@/lib/get-profile"

export default async function ApartmentsPage() {
  const { supabase, associationId } = await getAdminProfile()

  // Fetch apartments — manual join since Supabase types don't declare relationships
  const { data: apartmentsRaw } = await supabase
    .from("apartments")
    .select("*")
    .eq("association_id", associationId)
    .order("number")

  const { data: buildings } = await supabase
    .from("buildings")
    .select("*")
    .eq("association_id", associationId)
    .order("name")

  // Build building name lookup
  const buildingMap = new Map((buildings ?? []).map((b) => [b.id, b.name]))

  const apartments = (apartmentsRaw ?? []).map((apt) => ({
    ...apt,
    buildings: apt.building_id ? { name: buildingMap.get(apt.building_id) ?? "—" } : null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Apartamente</h1>
          <p className="text-sm text-muted-foreground">
            Gestionati apartamentele asociatiei
          </p>
        </div>
        <CsvImportDialog associationId={associationId} buildings={buildings ?? []} />
      </div>

      <ApartmentsTable apartments={apartments} buildings={buildings ?? []} />
    </div>
  )
}
