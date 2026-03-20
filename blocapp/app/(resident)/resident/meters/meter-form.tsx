"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitMeterReading } from "./meter-actions"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

interface MeterFormProps {
  reportId: string
  type: "apa_rece" | "apa_calda" | "gaz"
  label: string
  previousIndex: number
  currentIndex?: number
  submitted: boolean
  disabled: boolean
}

export function MeterForm({
  reportId,
  type,
  label,
  previousIndex,
  currentIndex,
  submitted: initialSubmitted,
  disabled,
}: MeterFormProps) {
  const [value, setValue] = useState(currentIndex?.toString() ?? "")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(initialSubmitted)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const idx = parseFloat(value)
    if (isNaN(idx) || idx < 0) {
      toast.error("Introduceti un index valid.")
      return
    }

    setLoading(true)
    const result = await submitMeterReading({
      report_id: reportId,
      type,
      index_current: idx,
    })
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${label}: consum = ${result.consumption} mc`)
      setSubmitted(true)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">{label}</h3>
        {submitted && (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <CheckCircle2 className="size-3" /> Trimis
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Index anterior
          </Label>
          <Input value={previousIndex} disabled className="font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Index curent *</Label>
          <Input
            type="number"
            step="0.01"
            min={previousIndex}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            className="font-mono"
            required
          />
        </div>
      </div>
      {!disabled && (
        <div className="flex justify-end mt-3">
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Se trimite..." : submitted ? "Actualizeaza" : "Trimite"}
          </Button>
        </div>
      )}
    </form>
  )
}
