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
import { Badge } from "@/components/ui/badge"
import { upsertMeterReading, deleteMeterReading } from "@/app/(dashboard)/dashboard/reports/[id]/meter-actions"
import { toast } from "sonner"
import { Save, Trash2, Gauge } from "lucide-react"
import type { Database, ConsumptionType } from "@/types/database"

type Apartment = Database["public"]["Tables"]["apartments"]["Row"]
type MeterReading = Database["public"]["Tables"]["meter_readings"]["Row"]

const CONSUMPTION_LABELS: Record<ConsumptionType, string> = {
  apa_rece: "Apa rece",
  apa_calda: "Apa calda",
  gaz: "Gaz",
}

interface MetersTabProps {
  reportId: string
  apartments: Apartment[]
  readings: MeterReading[]
  activeTypes: ConsumptionType[]
  readonly: boolean
}

interface RowState {
  index_previous: string
  index_current: string
  is_estimate: boolean
  saving: boolean
}

export function MetersTab({ reportId, apartments, readings, activeTypes, readonly }: MetersTabProps) {
  // Build initial row state from existing readings
  function buildKey(aptId: string, type: ConsumptionType) {
    return `${aptId}__${type}`
  }

  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {}
    for (const r of readings) {
      initial[buildKey(r.apartment_id, r.type)] = {
        index_previous: String(r.index_previous),
        index_current: String(r.index_current),
        is_estimate: r.is_estimate,
        saving: false,
      }
    }
    return initial
  })

  const [readingIds, setReadingIds] = useState<Record<string, string>>(() => {
    const ids: Record<string, string> = {}
    for (const r of readings) {
      ids[buildKey(r.apartment_id, r.type)] = r.id
    }
    return ids
  })

  const [selectedType, setSelectedType] = useState<ConsumptionType>(
    activeTypes[0] ?? "apa_rece"
  )

  function updateRow(key: string, field: keyof RowState, value: string | boolean) {
    setRowStates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { index_previous: "0", index_current: "0", is_estimate: false, saving: false }), [field]: value },
    }))
  }

  async function handleSave(apt: Apartment, type: ConsumptionType) {
    const key = buildKey(apt.id, type)
    const row = rowStates[key]
    if (!row) return

    const prev = parseFloat(row.index_previous)
    const curr = parseFloat(row.index_current)

    if (isNaN(prev) || isNaN(curr)) {
      toast.error("Introduceti valori numerice valide.")
      return
    }

    setRowStates((s) => ({ ...s, [key]: { ...s[key], saving: true } }))

    const result = await upsertMeterReading(reportId, {
      apartment_id: apt.id,
      type,
      index_previous: prev,
      index_current: curr,
      is_estimate: row.is_estimate,
    })

    setRowStates((s) => ({ ...s, [key]: { ...s[key], saving: false } }))

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Index salvat: Ap. ${apt.number}`)
    }
  }

  async function handleDelete(apt: Apartment, type: ConsumptionType) {
    const key = buildKey(apt.id, type)
    const id = readingIds[key]
    if (!id) return

    const result = await deleteMeterReading(id, reportId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Index sters.")
      setRowStates((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      setReadingIds((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  if (activeTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
        <Gauge className="size-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Nu exista cheltuieli per consum</p>
        <p className="text-xs text-muted-foreground mt-1">
          Adaugati cheltuieli cu distribuire &quot;Per consum&quot; pentru a activa aceasta sectiune
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Type selector */}
      {activeTypes.length > 1 && (
        <div className="flex gap-2">
          {activeTypes.map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type)}
            >
              {CONSUMPTION_LABELS[type]}
            </Button>
          ))}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Ap.</TableHead>
              <TableHead>Proprietar</TableHead>
              <TableHead>Index anterior</TableHead>
              <TableHead>Index curent</TableHead>
              <TableHead>Consum</TableHead>
              <TableHead className="w-16">Estimat</TableHead>
              {!readonly && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {apartments.map((apt) => {
              const key = buildKey(apt.id, selectedType)
              const row = rowStates[key]
              const hasReading = !!readingIds[key]

              const prev = row ? parseFloat(row.index_previous) : NaN
              const curr = row ? parseFloat(row.index_current) : NaN
              const consumption = !isNaN(prev) && !isNaN(curr) ? Math.max(0, curr - prev) : null

              return (
                <TableRow key={apt.id}>
                  <TableCell className="font-medium">#{apt.number}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {apt.owner_name ?? "—"}
                    {apt.is_vacant && (
                      <Badge variant="outline" className="ml-2 text-xs">Vacant</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {readonly ? (
                      <span className="font-mono text-sm">{row?.index_previous ?? "—"}</span>
                    ) : (
                      <Input
                        type="number"
                        className="h-8 w-28 font-mono"
                        value={row?.index_previous ?? ""}
                        onChange={(e) => updateRow(key, "index_previous", e.target.value)}
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readonly ? (
                      <span className="font-mono text-sm">{row?.index_current ?? "—"}</span>
                    ) : (
                      <Input
                        type="number"
                        className="h-8 w-28 font-mono"
                        value={row?.index_current ?? ""}
                        onChange={(e) => updateRow(key, "index_current", e.target.value)}
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {consumption !== null ? consumption.toFixed(3) : "—"}
                  </TableCell>
                  <TableCell>
                    {readonly ? (
                      row?.is_estimate ? (
                        <Badge variant="outline" className="text-xs">Da</Badge>
                      ) : null
                    ) : (
                      <input
                        type="checkbox"
                        checked={row?.is_estimate ?? false}
                        onChange={(e) => updateRow(key, "is_estimate", e.target.checked)}
                        className="size-4"
                      />
                    )}
                  </TableCell>
                  {!readonly && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => handleSave(apt, selectedType)}
                          disabled={row?.saving}
                          title="Salveaza"
                        >
                          <Save className="size-3.5" />
                        </Button>
                        {hasReading && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(apt, selectedType)}
                            title="Sterge"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Salvati fiecare rand individual dupa introducerea indicilor.
      </p>
    </div>
  )
}
