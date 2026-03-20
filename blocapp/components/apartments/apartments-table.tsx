"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApartmentForm } from "./apartment-form"
import {
  createApartment,
  updateApartment,
  deleteApartment,
} from "@/app/(dashboard)/dashboard/apartments/actions"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, DoorOpen, Search, AlertTriangle } from "lucide-react"
import type { Database } from "@/types/database"

type Apartment = Database["public"]["Tables"]["apartments"]["Row"]
type Building = Database["public"]["Tables"]["buildings"]["Row"]

type ApartmentWithBuilding = Apartment & { buildings: { name: string } | null }

interface ApartmentsTableProps {
  apartments: ApartmentWithBuilding[]
  buildings: Building[]
}

export function ApartmentsTable({ apartments, buildings }: ApartmentsTableProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editApartment, setEditApartment] = useState<Apartment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Apartment | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState("")
  const [buildingFilter, setBuildingFilter] = useState("__all__")

  // Filter apartments
  const filtered = apartments.filter((apt) => {
    const matchesSearch =
      !search ||
      apt.number.toLowerCase().includes(search.toLowerCase()) ||
      apt.owner_name?.toLowerCase().includes(search.toLowerCase())
    const matchesBuilding =
      buildingFilter === "__all__" ||
      (buildingFilter === "__none__" ? !apt.building_id : apt.building_id === buildingFilter)
    return matchesSearch && matchesBuilding
  })

  // Cota parte sum for non-vacant
  const cotaSum = apartments
    .filter((a) => !a.is_vacant)
    .reduce((sum, a) => sum + (a.cota_parte || 0), 0)
  const cotaWarning = Math.abs(cotaSum - 1.0) > 0.0001

  function handleAdd() {
    setEditApartment(null)
    setFormOpen(true)
  }

  function handleEdit(apt: Apartment) {
    setEditApartment(apt)
    setFormOpen(true)
  }

  async function handleSubmit(data: {
    number: string
    building_id: string | null
    floor: number | null
    staircase: string | null
    surface_m2: number | null
    cota_parte: number
    persons_count: number
    owner_name: string | null
    is_vacant: boolean
  }) {
    if (editApartment) {
      const result = await updateApartment(editApartment.id, data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Apartamentul ${data.number} a fost actualizat.`)
      }
    } else {
      const result = await createApartment(data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Apartamentul ${data.number} a fost adaugat.`)
      }
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteApartment(deleteTarget.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Apartamentul ${deleteTarget.number} a fost sters.`)
    }
    setDeleting(false)
    setDeleteTarget(null)
  }

  const totalApartments = apartments.length
  const vacantCount = apartments.filter((a) => a.is_vacant).length

  return (
    <div className="space-y-4">
      {/* Summary + Warning */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {totalApartments} apartament{totalApartments !== 1 ? "e" : ""}
          {vacantCount > 0 && (
            <> ({vacantCount} vacant{vacantCount > 1 ? "e" : ""})</>
          )}
        </span>
        <span className="text-muted-foreground">
          Suma cote: <span className="font-mono">{cotaSum.toFixed(6)}</span>
        </span>
        {cotaWarning && totalApartments > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            Suma cotelor nu este 1.0
          </Badge>
        )}
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Cauta nr. sau proprietar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {buildings.length > 0 && (
            <Select value={buildingFilter} onValueChange={(val: string | null) => setBuildingFilter(val ?? "__all__")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Toate blocurile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toate blocurile</SelectItem>
                <SelectItem value="__none__">Fara bloc</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-1.5 size-4" />
          Adauga apartament
        </Button>
      </div>

      {/* Table or empty state */}
      {apartments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <DoorOpen className="mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">Niciun apartament adaugat</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Adaugati apartamentele asociatiei manual sau importati din CSV
          </p>
          <div className="flex gap-2">
            <Button onClick={handleAdd} size="sm" variant="outline">
              <Plus className="mr-1.5 size-4" />
              Adauga manual
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Nr.</TableHead>
                <TableHead>Bloc</TableHead>
                <TableHead className="text-center">Etaj</TableHead>
                <TableHead className="text-center">Suprafata</TableHead>
                <TableHead className="text-right">Cota</TableHead>
                <TableHead className="text-center">Pers.</TableHead>
                <TableHead>Proprietar</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((apt) => (
                <TableRow key={apt.id} className={apt.is_vacant ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{apt.number}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {apt.buildings?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">{apt.floor ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    {apt.surface_m2 ? `${apt.surface_m2} m²` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {apt.cota_parte?.toFixed(6) ?? "0"}
                  </TableCell>
                  <TableCell className="text-center">{apt.persons_count}</TableCell>
                  <TableCell>{apt.owner_name || "—"}</TableCell>
                  <TableCell className="text-center">
                    {apt.is_vacant ? (
                      <Badge variant="outline" className="text-xs">
                        Vacant
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="bg-emerald-500/15 text-emerald-400 text-xs"
                      >
                        Ocupat
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleEdit(apt)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(apt)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && apartments.length > 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Niciun rezultat pentru filtrele selectate.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <ApartmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        apartment={editApartment}
        buildings={buildings}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stergeti apartamentul?</AlertDialogTitle>
            <AlertDialogDescription>
              Sunteti sigur ca doriti sa stergeti apartamentul nr. {deleteTarget?.number}?
              Aceasta actiune nu poate fi anulata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuleaza</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Se sterge..." : "Sterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
