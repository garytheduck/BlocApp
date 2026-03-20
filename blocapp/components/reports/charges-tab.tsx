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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { calculateReport } from "@/app/(dashboard)/dashboard/reports/report-actions"
import { toast } from "sonner"
import { Fragment } from "react"
import { Calculator, ChevronDown, ChevronRight } from "lucide-react"
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog"
import type { Database } from "@/types/database"

type ApartmentCharge = Database["public"]["Tables"]["apartment_charges"]["Row"]
type Apartment = Database["public"]["Tables"]["apartments"]["Row"]

const PAYMENT_STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  unpaid: { label: "Neplatit", variant: "destructive" },
  partial: { label: "Partial", variant: "secondary" },
  paid: { label: "Platit", variant: "default" },
}

interface ChargesTabProps {
  reportId: string
  charges: (ApartmentCharge & { apartment?: Apartment })[]
  canCalculate: boolean
  reportStatus: string
}

type BreakdownItem = {
  expense_item_id: string
  category: string
  amount: number
  distribution_method: string
}

export function ChargesTab({ reportId, charges: initialCharges, canCalculate, reportStatus }: ChargesTabProps) {
  const [charges, setCharges] = useState(initialCharges)
  const [calculating, setCalculating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function handleCalculate() {
    setCalculating(true)
    const result = await calculateReport(reportId)
    setCalculating(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Lista calculata pentru ${result.count} apartamente.`)
      window.location.reload()
    }
  }

  return (
    <div className="space-y-4">
      {canCalculate && (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">Genereaza lista</p>
            <p className="text-xs text-muted-foreground">
              Calculeaza sumele pentru fiecare apartament pe baza cheltuielilor si indicilor
            </p>
          </div>
          <Button onClick={handleCalculate} disabled={calculating}>
            <Calculator className="size-4 mr-2" />
            {calculating ? "Se calculeaza..." : "Calculeaza"}
          </Button>
        </div>
      )}

      {charges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
          <Calculator className="size-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Lista nu a fost generata</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adaugati cheltuielile si apasati &quot;Calculeaza&quot;
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Apartament</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Fond rulment</TableHead>
                <TableHead className="text-right">Fond rep.</TableHead>
                <TableHead className="text-right font-semibold">Total</TableHead>
                <TableHead>Status</TableHead>
                {reportStatus === "published" && <TableHead className="w-20">Plata</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {charges.map((charge) => {
                const isExpanded = expandedId === charge.id
                const breakdown = charge.charges_breakdown as BreakdownItem[]
                const statusInfo = PAYMENT_STATUS_LABELS[charge.payment_status]

                return (
                  <Fragment key={charge.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(isExpanded ? null : charge.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="size-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        #{charge.apartment?.number ?? "?"}
                        {charge.apartment?.owner_name && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {charge.apartment.owner_name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(charge.subtotal).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(charge.fond_rulment).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(charge.fond_reparatii).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {Number(charge.total_due).toLocaleString("ro-RO", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo?.variant ?? "secondary"}>
                          {statusInfo?.label ?? charge.payment_status}
                        </Badge>
                      </TableCell>
                      {reportStatus === "published" && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {charge.payment_status !== "paid" && (
                            <RecordPaymentDialog
                              chargeId={charge.id}
                              apartmentNumber={charge.apartment?.number ?? "?"}
                              totalDue={Number(charge.total_due)}
                              amountPaid={Number(charge.amount_paid)}
                            />
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    {isExpanded && breakdown && breakdown.length > 0 && (
                      <TableRow className="bg-muted/20">
                        <TableCell />
                        <TableCell colSpan={reportStatus === "published" ? 7 : 6} className="py-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Detaliu cheltuieli:</p>
                            {breakdown.map((b, idx) => (
                              <div key={idx} className="flex justify-between text-xs px-2">
                                <span>{b.category}</span>
                                <span className="font-mono">
                                  {Number(b.amount).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {charges.length > 0 && (
        <div className="flex justify-end gap-4 text-sm font-medium pt-2">
          <span className="text-muted-foreground">
            Total de plata:{" "}
            <span className="text-foreground font-mono">
              {charges
                .reduce((s, c) => s + Number(c.total_due), 0)
                .toLocaleString("ro-RO", { minimumFractionDigits: 2 })}{" "}
              RON
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
