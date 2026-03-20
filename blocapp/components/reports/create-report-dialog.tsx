"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { createReport } from "@/app/(dashboard)/dashboard/reports/report-actions"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { MONTHS_RO } from "@/lib/utils/months"

export function CreateReportDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [fondRulmentPct, setFondRulmentPct] = useState("2")
  const [fondReparatiiPct, setFondReparatiiPct] = useState("0")
  const [penaltyRate, setPenaltyRate] = useState("0.2")
  const [meterDeadline, setMeterDeadline] = useState("")
  const [dueDate, setDueDate] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await createReport({
      period_month: month,
      period_year: year,
      fond_rulment_pct: parseFloat(fondRulmentPct) / 100,
      fond_reparatii_pct: parseFloat(fondReparatiiPct) / 100,
      penalty_rate_per_day: parseFloat(penaltyRate) / 100,
      meter_deadline: meterDeadline || null,
      due_date: dueDate || null,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Lista a fost creata.")
    setOpen(false)
    router.push(`/dashboard/reports/${result.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4 mr-2" />
            Lista noua
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Creeaza lista noua</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Luna</Label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {MONTHS_RO.slice(1).map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>An</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2100}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fond rulment (%)</Label>
              <Input
                type="number"
                value={fondRulmentPct}
                onChange={(e) => setFondRulmentPct(e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fond reparatii (%)</Label>
              <Input
                type="number"
                value={fondReparatiiPct}
                onChange={(e) => setFondReparatiiPct(e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Penalitate zilnica (%)</Label>
            <Input
              type="number"
              value={penaltyRate}
              onChange={(e) => setPenaltyRate(e.target.value)}
              min="0"
              max="10"
              step="0.01"
            />
            <p className="text-xs text-muted-foreground">
              Aplicat pe zi la restantele neplatite
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Termen index (optional)</Label>
              <Input
                type="date"
                value={meterDeadline}
                onChange={(e) => setMeterDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Scadenta plata (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Se creeaza..." : "Creeaza lista"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
