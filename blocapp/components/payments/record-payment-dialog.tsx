"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { recordPayment } from "@/app/(dashboard)/dashboard/payments/payment-actions"
import { toast } from "sonner"
import { Plus } from "lucide-react"

interface RecordPaymentDialogProps {
  chargeId: string
  apartmentNumber: string
  totalDue: number
  amountPaid: number
  trigger?: React.ReactElement
}

export function RecordPaymentDialog({
  chargeId,
  apartmentNumber,
  totalDue,
  amountPaid,
  trigger,
}: RecordPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const remaining = Math.round((totalDue - amountPaid) * 100) / 100

  const [form, setForm] = useState({
    amount: remaining.toString(),
    method: "cash" as "cash" | "transfer",
    paid_at: new Date().toISOString().slice(0, 10),
    notes: "",
  })

  function resetForm() {
    const r = Math.round((totalDue - amountPaid) * 100) / 100
    setForm({
      amount: r.toString(),
      method: "cash",
      paid_at: new Date().toISOString().slice(0, 10),
      notes: "",
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Introduceti o suma valida.")
      return
    }
    if (amount > remaining + 0.01) {
      toast.error(`Suma depaseste restul de plata (${remaining.toFixed(2)} RON).`)
      return
    }

    setLoading(true)
    const result = await recordPayment({
      apartment_charge_id: chargeId,
      amount,
      method: form.method,
      paid_at: new Date(form.paid_at).toISOString(),
      notes: form.notes || null,
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(
        `Plata de ${amount.toFixed(2)} RON inregistrata pentru Ap. ${apartmentNumber}.`
      )
      resetForm()
      setOpen(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) resetForm()
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" variant="outline">
              <Plus className="size-3.5 mr-1" />
              Plata
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inregistreaza plata — Ap. {apartmentNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Rest de plata:{" "}
            <span className="font-medium text-foreground">
              {remaining.toFixed(2)} RON
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Suma (RON) *</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={form.amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-method">Metoda *</Label>
              <Select
                value={form.method}
                onValueChange={(val: string | null) => {
                  if (val)
                    setForm((p) => ({
                      ...p,
                      method: val as "cash" | "transfer",
                    }))
                }}
              >
                <SelectTrigger id="pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Numerar</SelectItem>
                  <SelectItem value="transfer">Transfer bancar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-date">Data platii</Label>
            <Input
              id="pay-date"
              type="date"
              value={form.paid_at}
              onChange={(e) =>
                setForm((p) => ({ ...p, paid_at: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-notes">Note (optional)</Label>
            <Textarea
              id="pay-notes"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              placeholder="Nr. chitanta, detalii transfer..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Se salveaza..." : "Inregistreaza plata"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
