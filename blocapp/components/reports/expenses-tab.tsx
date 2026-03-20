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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { addExpenseItem, updateExpenseItem, deleteExpenseItem } from "@/app/(dashboard)/dashboard/reports/[id]/expense-actions"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Receipt } from "lucide-react"
import type { Database, DistributionMethod, ConsumptionType } from "@/types/database"

type ExpenseItem = Database["public"]["Tables"]["expense_items"]["Row"]

const DISTRIBUTION_LABELS: Record<DistributionMethod, string> = {
  per_cota: "Cota-parte",
  per_person: "Per persoana",
  per_apartment: "Per apartament",
  per_consumption: "Per consum",
}

const CONSUMPTION_LABELS: Record<ConsumptionType, string> = {
  apa_rece: "Apa rece",
  apa_calda: "Apa calda",
  gaz: "Gaz",
}

const CATEGORY_SUGGESTIONS = [
  "Apa rece",
  "Apa calda",
  "Gaz",
  "Energie electrica",
  "Ascensor",
  "Curatenie",
  "Administratie",
  "Reparatii",
  "Gunoi",
  "Antena TV",
  "Interfon",
]

interface ExpensesTabProps {
  reportId: string
  items: ExpenseItem[]
  readonly: boolean
}

const defaultForm = {
  category: "",
  description: "",
  amount: "",
  distribution_method: "per_cota" as DistributionMethod,
  consumption_type: "" as ConsumptionType | "",
}

export function ExpensesTab({ reportId, items: initialItems, readonly }: ExpensesTabProps) {
  const [items, setItems] = useState(initialItems)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<ExpenseItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(defaultForm)

  function openAdd() {
    setEditItem(null)
    setForm({ ...defaultForm, sort_order: String(items.length) } as typeof defaultForm & { sort_order?: string })
    setDialogOpen(true)
  }

  function openEdit(item: ExpenseItem) {
    setEditItem(item)
    setForm({
      category: item.category,
      description: item.description ?? "",
      amount: String(item.amount),
      distribution_method: item.distribution_method,
      consumption_type: item.consumption_type ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category.trim()) return toast.error("Categoria este obligatorie.")
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return toast.error("Suma trebuie sa fie pozitiva.")
    if (form.distribution_method === "per_consumption" && !form.consumption_type) {
      return toast.error("Selectati tipul de consum.")
    }

    setLoading(true)
    const payload = {
      category: form.category.trim(),
      description: form.description.trim() || null,
      amount,
      distribution_method: form.distribution_method,
      consumption_type: (form.consumption_type as ConsumptionType) || null,
      sort_order: editItem ? editItem.sort_order : items.length,
    }

    const result = editItem
      ? await updateExpenseItem(editItem.id, reportId, payload)
      : await addExpenseItem(reportId, payload)

    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success(editItem ? "Cheltuiala actualizata." : "Cheltuiala adaugata.")

    if (editItem) {
      setItems((prev) => prev.map((i) => (i.id === editItem.id ? { ...i, ...payload } : i)))
    } else {
      // Reload page to get new ID — simplest approach
      window.location.reload()
    }
    setDialogOpen(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setLoading(true)
    const result = await deleteExpenseItem(deleteTarget.id, reportId)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Cheltuiala stearsa.")
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  const total = items.reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="space-y-4">
      {!readonly && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4 mr-2" />
            Adauga cheltuiala
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
          <Receipt className="size-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nu exista cheltuieli</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adaugati cheltuielile pentru aceasta luna
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categorie</TableHead>
                <TableHead>Distribuire</TableHead>
                <TableHead className="text-right">Suma (RON)</TableHead>
                {!readonly && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{item.category}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {DISTRIBUTION_LABELS[item.distribution_method]}
                    {item.consumption_type && (
                      <span className="ml-1 text-xs">({CONSUMPTION_LABELS[item.consumption_type]})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {Number(item.amount).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                  </TableCell>
                  {!readonly && (
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={2}>Total cheltuieli</TableCell>
                <TableCell className="text-right font-mono">
                  {total.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                </TableCell>
                {!readonly && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editeaza cheltuiala" : "Adauga cheltuiala"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categorie *</Label>
              <Input
                list="category-suggestions"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="ex: Apa rece"
              />
              <datalist id="category-suggestions">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label>Descriere (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detalii suplimentare"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Suma (RON) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Metoda de distribuire</Label>
              <select
                value={form.distribution_method}
                onChange={(e) =>
                  setForm({
                    ...form,
                    distribution_method: e.target.value as DistributionMethod,
                    consumption_type: e.target.value !== "per_consumption" ? "" : form.consumption_type,
                  })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {Object.entries(DISTRIBUTION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {form.distribution_method === "per_consumption" && (
              <div className="space-y-1.5">
                <Label>Tip consum *</Label>
                <select
                  value={form.consumption_type}
                  onChange={(e) =>
                    setForm({ ...form, consumption_type: e.target.value as ConsumptionType })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">— Selectati —</option>
                  {Object.entries(CONSUMPTION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={loading}
              >
                Anuleaza
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Se salveaza..." : editItem ? "Salveaza" : "Adauga"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stergi cheltuiala?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `"${deleteTarget.category}" va fi stearsa definitiv.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Anuleaza</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Se sterge..." : "Sterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
