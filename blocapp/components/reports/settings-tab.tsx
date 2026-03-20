"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { updateReport, advanceReportStatus } from "@/app/(dashboard)/dashboard/reports/report-actions"
import { toast } from "sonner"
import { formatPeriod } from "@/lib/utils/months"
import type { Database, ReportStatus } from "@/types/database"

type Report = Database["public"]["Tables"]["monthly_reports"]["Row"]

interface SettingsTabProps {
  report: Report
}

const STATUS_FLOW: Record<
  ReportStatus,
  { action: "start_meters" | "publish" | "close"; label: string; confirm: string } | null
> = {
  draft: {
    action: "start_meters",
    label: "Incepe colectare indici",
    confirm: "Statusul va fi schimbat in 'Colectare indici'.",
  },
  collecting_meters: {
    action: "publish",
    label: "Publica lista",
    confirm: "Lista va fi publicata si vizibila pentru locatari.",
  },
  published: {
    action: "close",
    label: "Inchide lista",
    confirm: "Lista va fi inchisa. Nu mai pot fi facute modificari.",
  },
  closed: null,
}

export function SettingsTab({ report }: SettingsTabProps) {
  const [fondRulment, setFondRulment] = useState(String(Number(report.fond_rulment_pct) * 100))
  const [fondReparatii, setFondReparatii] = useState(String(Number(report.fond_reparatii_pct) * 100))
  const [penaltyRate, setPenaltyRate] = useState(String(Number(report.penalty_rate_per_day) * 100))
  const [meterDeadline, setMeterDeadline] = useState(report.meter_deadline ?? "")
  const [dueDate, setDueDate] = useState(report.due_date ?? "")
  const [saving, setSaving] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  const readonly = report.status === "closed"
  const nextAction = STATUS_FLOW[report.status]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const result = await updateReport(report.id, {
      fond_rulment_pct: parseFloat(fondRulment) / 100,
      fond_reparatii_pct: parseFloat(fondReparatii) / 100,
      penalty_rate_per_day: parseFloat(penaltyRate) / 100,
      meter_deadline: meterDeadline || null,
      due_date: dueDate || null,
    })
    setSaving(false)
    if (result.error) toast.error(result.error)
    else toast.success("Setarile au fost salvate.")
  }

  async function handleAdvance() {
    if (!nextAction) return
    setAdvancing(true)
    const result = await advanceReportStatus(report.id, nextAction.action)
    setAdvancing(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Statusul a fost actualizat.")
      window.location.reload()
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Status card */}
      {nextAction && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avanseaza statusul</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{nextAction.confirm}</p>
            <Button onClick={handleAdvance} disabled={advancing} variant="outline">
              {advancing ? "Se proceseaza..." : nextAction.label}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Settings form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Setari — {formatPeriod(report.period_month, report.period_year)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fond rulment (%)</Label>
                <Input
                  type="number"
                  value={fondRulment}
                  onChange={(e) => setFondRulment(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={readonly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fond reparatii (%)</Label>
                <Input
                  type="number"
                  value={fondReparatii}
                  onChange={(e) => setFondReparatii(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={readonly}
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
                disabled={readonly}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Termen index</Label>
                <Input
                  type="date"
                  value={meterDeadline}
                  onChange={(e) => setMeterDeadline(e.target.value)}
                  disabled={readonly}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Scadenta plata</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={readonly}
                />
              </div>
            </div>

            {!readonly && (
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Se salveaza..." : "Salveaza setarile"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
