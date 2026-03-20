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
import { BuildingForm } from "./building-form"
import {
  createBuilding,
  updateBuilding,
  deleteBuilding,
} from "@/app/(dashboard)/dashboard/settings/building-actions"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Building2 } from "lucide-react"
import type { Database } from "@/types/database"

type Building = Database["public"]["Tables"]["buildings"]["Row"]

interface BuildingsListProps {
  buildings: (Building & { apartment_count: number })[]
}

export function BuildingsList({ buildings: initialBuildings }: BuildingsListProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editBuilding, setEditBuilding] = useState<Building | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null)
  const [deleting, setDeleting] = useState(false)

  function handleEdit(building: Building) {
    setEditBuilding(building)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditBuilding(null)
    setFormOpen(true)
  }

  async function handleSubmit(data: {
    name: string
    address: string | null
    floors: number | null
    staircase_count: number | null
  }) {
    if (editBuilding) {
      const result = await updateBuilding(editBuilding.id, data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Blocul a fost actualizat.")
      }
    } else {
      const result = await createBuilding(data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Blocul a fost adaugat.")
      }
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const result = await deleteBuilding(deleteTarget.id)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Blocul a fost sters.")
    }

    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Blocuri / Scari</h3>
          <p className="text-sm text-muted-foreground">
            Gestionati blocurile si scarile asociatiei
          </p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-1.5 size-4" />
          Adauga bloc
        </Button>
      </div>

      {initialBuildings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Building2 className="mb-3 size-10 text-muted-foreground" />
          <p className="text-sm font-medium">Niciun bloc adaugat</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Adaugati primul bloc al asociatiei
          </p>
          <Button onClick={handleAdd} size="sm" variant="outline">
            <Plus className="mr-1.5 size-4" />
            Adauga bloc
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Denumire</TableHead>
                <TableHead>Adresa</TableHead>
                <TableHead className="text-center">Etaje</TableHead>
                <TableHead className="text-center">Scari</TableHead>
                <TableHead className="text-center">Apartamente</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialBuildings.map((building) => (
                <TableRow key={building.id}>
                  <TableCell className="font-medium">{building.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {building.address || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {building.floors ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {building.staircase_count ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">{building.apartment_count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleEdit(building)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(building)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BuildingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        building={editBuilding}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stergeti blocul?</AlertDialogTitle>
            <AlertDialogDescription>
              Sunteti sigur ca doriti sa stergeti blocul &quot;{deleteTarget?.name}&quot;? Aceasta
              actiune nu poate fi anulata.
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
