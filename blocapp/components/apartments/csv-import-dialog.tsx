"use client"

import { useState, useCallback } from "react"
import Papa from "papaparse"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react"
import type { Database } from "@/types/database"

type Building = Database["public"]["Tables"]["buildings"]["Row"]

interface CsvImportDialogProps {
  associationId: string
  buildings: Building[]
}

interface CsvRow {
  numar: string
  etaj?: string
  scara?: string
  suprafata_m2?: string
  cota_parte: string
  numar_persoane?: string
  nume_proprietar?: string
  _valid: boolean
  _error?: string
}

type ImportResult = {
  inserted: number
  skipped: { number: string; reason: string }[]
  warnings: string[]
}

export function CsvImportDialog({ associationId }: CsvImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "result">("upload")
  const [rows, setRows] = useState<CsvRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setStep("upload")
    setRows([])
    setResult(null)
    setError(null)
  }

  function handleFile(file: File) {
    setError(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // auto-detect
      complete(results) {
        if (results.errors.length > 0) {
          setError(`Eroare CSV: ${results.errors[0].message}`)
          return
        }

        const data = results.data as Record<string, string>[]
        if (data.length === 0) {
          setError("Fisierul CSV este gol.")
          return
        }

        // Normalize column names
        const parsed: CsvRow[] = data.map((row) => {
          const normalized: Record<string, string> = {}
          for (const [key, val] of Object.entries(row)) {
            normalized[key.trim().toLowerCase()] = val?.trim() ?? ""
          }

          const numar = normalized["numar"] || normalized["nr"] || ""
          const cotaParte = normalized["cota_parte"] || normalized["cota"] || ""

          let valid = true
          let rowError = ""
          if (!numar) {
            valid = false
            rowError = "Lipseste nr. apartament"
          } else if (!cotaParte || isNaN(parseFloat(cotaParte))) {
            valid = false
            rowError = "Cota parte invalida"
          }

          return {
            numar,
            etaj: normalized["etaj"] || undefined,
            scara: normalized["scara"] || undefined,
            suprafata_m2: normalized["suprafata_m2"] || normalized["suprafata"] || undefined,
            cota_parte: cotaParte,
            numar_persoane: normalized["numar_persoane"] || normalized["persoane"] || undefined,
            nume_proprietar:
              normalized["nume_proprietar"] || normalized["proprietar"] || undefined,
            _valid: valid,
            _error: rowError || undefined,
          }
        })

        setRows(parsed)
        setStep("preview")
      },
      error(err) {
        setError(`Eroare la citirea fisierului: ${err.message}`)
      },
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleFile(file)
    } else {
      setError("Va rugam selectati un fisier CSV.")
    }
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    setStep("importing")

    const validRows = rows.filter((r) => r._valid)
    const payload = validRows.map((r) => ({
      number: r.numar,
      floor: r.etaj ? parseInt(r.etaj, 10) : null,
      staircase: r.scara || null,
      surface_m2: r.suprafata_m2 ? parseFloat(r.suprafata_m2) : null,
      cota_parte: parseFloat(r.cota_parte),
      persons_count: r.numar_persoane ? parseInt(r.numar_persoane, 10) : 1,
      owner_name: r.nume_proprietar || null,
    }))

    try {
      const res = await fetch("/api/apartments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apartments: payload, association_id: associationId }),
      })

      if (!res.ok) {
        const { message } = await res.json()
        throw new Error(message || "Eroare la import")
      }

      const data: ImportResult = await res.json()
      setResult(data)
      setStep("result")

      if (data.inserted > 0) {
        toast.success(`${data.inserted} apartament${data.inserted > 1 ? "e" : ""} importat${data.inserted > 1 ? "e" : ""}.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscuta")
      setStep("preview")
    }
  }

  function downloadTemplate() {
    const csv =
      "numar,etaj,scara,suprafata_m2,cota_parte,numar_persoane,nume_proprietar\n1,P,,52.50,0.020833,2,Popescu Ion\n2,1,,48.00,0.019167,1,Ionescu Maria"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "template_apartamente.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = rows.filter((r) => r._valid).length
  const invalidCount = rows.filter((r) => !r._valid).length
  const cotaSum = rows
    .filter((r) => r._valid)
    .reduce((s, r) => s + (parseFloat(r.cota_parte) || 0), 0)
  const cotaWarning = rows.length > 0 && Math.abs(cotaSum - 1.0) > 0.0001

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Upload className="mr-1.5 size-4" />
            Import CSV
          </Button>
        }
      />

      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import apartamente din CSV</DialogTitle>
          <DialogDescription>
            Importati lista de apartamente dintr-un fisier CSV
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 px-4 transition-colors hover:border-primary/50"
            >
              <FileSpreadsheet className="size-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Trageti fisierul CSV aici</p>
                <p className="text-xs text-muted-foreground">sau click pentru a selecta</p>
              </div>
              <input
                type="file"
                accept=".csv"
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={handleFileInput}
                style={{ position: "relative" }}
              />
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" render={<span />}>
                  Selecteaza fisier
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="mr-1.5 size-4" />
                Descarca template CSV
              </Button>
              <p className="text-xs text-muted-foreground">
                Coloane: numar, etaj, scara, suprafata_m2, cota_parte, numar_persoane,
                nume_proprietar
              </p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline">
                {rows.length} randuri total
              </Badge>
              <Badge variant="default" className="bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="mr-1 size-3" />
                {validCount} valide
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">
                  {invalidCount} invalide
                </Badge>
              )}
              {cotaWarning && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  Suma cote: {cotaSum.toFixed(6)} (nu este 1.0)
                </Badge>
              )}
            </div>

            <div className="rounded-md border max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Etaj</TableHead>
                    <TableHead>Scara</TableHead>
                    <TableHead>Suprafata</TableHead>
                    <TableHead>Cota</TableHead>
                    <TableHead>Pers.</TableHead>
                    <TableHead>Proprietar</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className={!row._valid ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium">{row.numar || "—"}</TableCell>
                      <TableCell>{row.etaj || "—"}</TableCell>
                      <TableCell>{row.scara || "—"}</TableCell>
                      <TableCell>{row.suprafata_m2 || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.cota_parte || "—"}</TableCell>
                      <TableCell>{row.numar_persoane || "1"}</TableCell>
                      <TableCell>{row.nume_proprietar || "—"}</TableCell>
                      <TableCell>
                        {row._valid ? (
                          <CheckCircle2 className="size-4 text-emerald-400" />
                        ) : (
                          <span className="text-xs text-destructive">{row._error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rows.length > 50 && (
              <p className="text-xs text-muted-foreground text-center">
                Se afiseaza primele 50 din {rows.length} randuri
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Inapoi
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importa {validCount} apartament{validCount !== 1 ? "e" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-3 text-sm text-muted-foreground">Se importa apartamentele...</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 className="mb-2 size-10 text-emerald-400" />
              <p className="text-lg font-medium">Import finalizat</p>
              <p className="text-sm text-muted-foreground">
                {result.inserted} apartament{result.inserted !== 1 ? "e" : ""} importat
                {result.inserted !== 1 ? "e" : ""} cu succes
              </p>
            </div>

            {result.skipped.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Omise ({result.skipped.length}):
                </p>
                <div className="rounded-md border p-3 space-y-1 max-h-32 overflow-y-auto">
                  {result.skipped.map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Nr. {s.number}: {s.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false)
                  reset()
                  // Force page reload to refresh server data
                  window.location.reload()
                }}
              >
                Inchide
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
