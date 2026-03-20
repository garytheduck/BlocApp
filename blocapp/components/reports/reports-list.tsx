"use client"

import { useState } from "react"
import Link from "next/link"
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
import { deleteReport } from "@/app/(dashboard)/dashboard/reports/report-actions"
import { toast } from "sonner"
import { formatPeriod } from "@/lib/utils/months"
import { FileText, Trash2, ChevronRight } from "lucide-react"
import type { Database } from "@/types/database"

type Report = Database["public"]["Tables"]["monthly_reports"]["Row"]

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  collecting_meters: { label: "Indici", variant: "default" },
  published: { label: "Publicat", variant: "default" },
  closed: { label: "Inchis", variant: "outline" },
}

export function ReportsList({ reports: initialReports }: { reports: Report[] }) {
  const [reports, setReports] = useState(initialReports)
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteReport(deleteTarget.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Lista a fost stearsa.")
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed rounded-lg">
        <FileText className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Nu exista liste de intretinere</p>
        <p className="text-xs text-muted-foreground mt-1">
          Creati prima lista pentru a incepe
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perioada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total cheltuieli</TableHead>
              <TableHead>Scadenta</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => {
              const statusInfo = STATUS_LABELS[report.status] ?? STATUS_LABELS.draft
              return (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {formatPeriod(report.period_month, report.period_year)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {report.total_expenses > 0
                      ? `${Number(report.total_expenses).toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {report.due_date
                      ? new Date(report.due_date).toLocaleDateString("ro-RO")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {report.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(report)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        nativeButton={false}
                        render={<Link href={`/dashboard/reports/${report.id}`} />}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stergi lista?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `Lista pentru ${formatPeriod(deleteTarget.period_month, deleteTarget.period_year)} va fi stearsa definitiv impreuna cu toate cheltuielile si indicii.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuleaza</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Se sterge..." : "Sterge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
