"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Database } from "@/types/database"

type Apartment = Database["public"]["Tables"]["apartments"]["Row"]
type Building = Database["public"]["Tables"]["buildings"]["Row"]

interface ApartmentFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apartment?: Apartment | null
  buildings: Building[]
  onSubmit: (data: {
    number: string
    building_id: string | null
    floor: number | null
    staircase: string | null
    surface_m2: number | null
    cota_parte: number
    persons_count: number
    owner_name: string | null
    is_vacant: boolean
  }) => Promise<void>
}

export function ApartmentForm({
  open,
  onOpenChange,
  apartment,
  buildings,
  onSubmit,
}: ApartmentFormProps) {
  const isEdit = !!apartment
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    number: apartment?.number ?? "",
    building_id: apartment?.building_id ?? "",
    floor: apartment?.floor?.toString() ?? "",
    staircase: apartment?.staircase ?? "",
    surface_m2: apartment?.surface_m2?.toString() ?? "",
    cota_parte: apartment?.cota_parte?.toString() ?? "",
    persons_count: apartment?.persons_count?.toString() ?? "1",
    owner_name: apartment?.owner_name ?? "",
    is_vacant: apartment?.is_vacant ?? false,
  })

  function updateField(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await onSubmit({
      number: form.number,
      building_id: form.building_id || null,
      floor: form.floor ? parseInt(form.floor, 10) : null,
      staircase: form.staircase || null,
      surface_m2: form.surface_m2 ? parseFloat(form.surface_m2) : null,
      cota_parte: parseFloat(form.cota_parte) || 0,
      persons_count: parseInt(form.persons_count, 10) || 1,
      owner_name: form.owner_name || null,
      is_vacant: form.is_vacant,
    })

    setLoading(false)
    if (!isEdit) {
      setForm({
        number: "",
        building_id: "",
        floor: "",
        staircase: "",
        surface_m2: "",
        cota_parte: "",
        persons_count: "1",
        owner_name: "",
        is_vacant: false,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? `Editeaza apartament ${apartment.number}` : "Adauga apartament"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Modificati datele apartamentului."
                : "Introduceti datele noului apartament."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apt-number">Nr. apartament *</Label>
                <Input
                  id="apt-number"
                  value={form.number}
                  onChange={updateField("number")}
                  required
                  placeholder="12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-building">Bloc</Label>
                <Select
                  value={form.building_id}
                  onValueChange={(val: string | null) =>
                    setForm((prev) => ({ ...prev, building_id: (!val || val === "__none__") ? "" : val }))
                  }
                >
                  <SelectTrigger id="apt-building">
                    <SelectValue placeholder="Selecteaza bloc" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Fara bloc</SelectItem>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apt-floor">Etaj</Label>
                <Input
                  id="apt-floor"
                  type="number"
                  value={form.floor}
                  onChange={updateField("floor")}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-staircase">Scara</Label>
                <Input
                  id="apt-staircase"
                  value={form.staircase}
                  onChange={updateField("staircase")}
                  placeholder="A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-surface">Suprafata (m²)</Label>
                <Input
                  id="apt-surface"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.surface_m2}
                  onChange={updateField("surface_m2")}
                  placeholder="52.50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="apt-cota">Cota parte *</Label>
                <Input
                  id="apt-cota"
                  type="number"
                  step="0.000001"
                  min="0"
                  max="1"
                  value={form.cota_parte}
                  onChange={updateField("cota_parte")}
                  required
                  placeholder="0.020833"
                />
                <p className="text-xs text-muted-foreground">
                  Fractie din total (ex: 1/48 = 0.020833)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apt-persons">Nr. persoane</Label>
                <Input
                  id="apt-persons"
                  type="number"
                  min="0"
                  value={form.persons_count}
                  onChange={updateField("persons_count")}
                  placeholder="2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apt-owner">Proprietar</Label>
              <Input
                id="apt-owner"
                value={form.owner_name}
                onChange={updateField("owner_name")}
                placeholder="Popescu Ion"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="apt-vacant"
                checked={form.is_vacant}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_vacant: checked }))
                }
              />
              <Label htmlFor="apt-vacant" className="cursor-pointer">
                Apartament vacant (exclus din calcule)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Se salveaza..." : isEdit ? "Salveaza" : "Adauga"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
