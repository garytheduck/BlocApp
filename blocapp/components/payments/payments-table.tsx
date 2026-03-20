"use client"

import { useState, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DeletePaymentDialog } from "@/components/payments/delete-payment-dialog"
import {
  Banknote,
  ArrowLeftRight,
  CreditCard,
  Search,
  Trash2,
} from "lucide-react"

export interface PaymentRow {
  id: string
  apartment_number: string
  report_period: string
  amount: number
  method: "cash" | "transfer" | "online"
  status: "pending" | "succeeded" | "failed" | "refunded"
  paid_at: string | null
  notes: string | null
}

const METHOD_CONFIG = {
  cash: {
    label: "Numerar",
    icon: Banknote,
    variant: "outline" as const,
  },
  transfer: {
    label: "Transfer",
    icon: ArrowLeftRight,
    variant: "secondary" as const,
  },
  online: {
    label: "Online",
    icon: CreditCard,
    variant: "default" as const,
  },
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "In asteptare", variant: "outline" },
  succeeded: { label: "Reusita", variant: "default" },
  failed: { label: "Esuata", variant: "destructive" },
  refunded: { label: "Rambursata", variant: "secondary" },
}

interface PaymentsTableProps {
  payments: PaymentRow[]
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const [search, setSearch] = useState("")
  const [methodFilter, setMethodFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null)

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        !search ||
        p.apartment_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.notes ?? "").toLowerCase().includes(search.toLowerCase())
      const matchMethod = methodFilter === "all" || p.method === methodFilter
      return matchSearch && matchMethod
    })
  }, [payments, search, methodFilter])

  const totalSucceeded = filtered
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cauta dupa apartament sau note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={methodFilter}
          onValueChange={(val: string | null) => {
            if (val) setMethodFilter(val)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Metoda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate metodele</SelectItem>
            <SelectItem value="cash">Numerar</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {filtered.length} plati — Total incasat:{" "}
        <span className="font-medium text-foreground">
          {totalSucceeded.toFixed(2)} RON
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Apartament</TableHead>
              <TableHead>Perioada</TableHead>
              <TableHead className="text-right">Suma</TableHead>
              <TableHead>Metoda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-8"
                >
                  Nicio plata inregistrata.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((payment) => {
                const methodCfg = METHOD_CONFIG[payment.method]
                const statusCfg =
                  STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.pending
                const Icon = methodCfg.icon
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      Ap. {payment.apartment_number}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.report_period}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {payment.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={methodCfg.variant} className="gap-1">
                        <Icon className="size-3" />
                        {methodCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString("ro-RO")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                      {payment.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      {payment.status === "succeeded" &&
                        payment.method !== "online" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(payment)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeletePaymentDialog
          open={!!deleteTarget}
          onOpenChange={() => setDeleteTarget(null)}
          paymentId={deleteTarget.id}
          amount={deleteTarget.amount}
          apartmentNumber={deleteTarget.apartment_number}
        />
      )}
    </div>
  )
}
