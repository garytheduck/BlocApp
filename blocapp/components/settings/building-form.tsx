"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Database } from "@/types/database"

type Building = Database["public"]["Tables"]["buildings"]["Row"]

interface BuildingFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  building?: Building | null
  onSubmit: (data: {
    name: string
    address: string | null
    floors: number | null
    staircase_count: number | null
  }) => Promise<void>
}

export function BuildingForm({ open, onOpenChange, building, onSubmit }: BuildingFormProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: building?.name ?? "",
    address: building?.address ?? "",
    floors: building?.floors?.toString() ?? "",
    staircase_count: building?.staircase_count?.toString() ?? "",
  })

  // Reset form when dialog opens with new building data
  const isEdit = !!building

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await onSubmit({
      name: form.name,
      address: form.address || null,
      floors: form.floors ? parseInt(form.floors, 10) : null,
      staircase_count: form.staircase_count ? parseInt(form.staircase_count, 10) : null,
    })

    setLoading(false)
    setForm({ name: "", address: "", floors: "", staircase_count: "" })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editeaza blocul" : "Adauga bloc nou"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Modificati informatiile blocului."
                : "Introduceti datele noului bloc sau scara."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="building-name">Denumire *</Label>
              <Input
                id="building-name"
                value={form.name}
                onChange={update("name")}
                required
                placeholder="Bloc A / Scara 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="building-address">Adresa</Label>
              <Input
                id="building-address"
                value={form.address}
                onChange={update("address")}
                placeholder="Str. Exemplu nr. 12"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="building-floors">Nr. etaje</Label>
                <Input
                  id="building-floors"
                  type="number"
                  min={0}
                  value={form.floors}
                  onChange={update("floors")}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="building-staircases">Nr. scari</Label>
                <Input
                  id="building-staircases"
                  type="number"
                  min={0}
                  value={form.staircase_count}
                  onChange={update("staircase_count")}
                  placeholder="2"
                />
              </div>
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
