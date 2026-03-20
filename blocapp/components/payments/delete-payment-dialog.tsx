"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { deletePayment } from "@/app/(dashboard)/dashboard/payments/payment-actions"
import { toast } from "sonner"

interface DeletePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentId: string
  amount: number
  apartmentNumber: string
}

export function DeletePaymentDialog({
  open,
  onOpenChange,
  paymentId,
  amount,
  apartmentNumber,
}: DeletePaymentDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deletePayment(paymentId)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(
        `Plata de ${amount.toFixed(2)} RON pentru Ap. ${apartmentNumber} a fost stearsa.`
      )
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sterge plata</AlertDialogTitle>
          <AlertDialogDescription>
            Sigur doriti sa stergeti plata de{" "}
            <strong>{amount.toFixed(2)} RON</strong> pentru Ap.{" "}
            <strong>{apartmentNumber}</strong>? Suma va fi scazuta din totalul
            platit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuleaza</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Se sterge..." : "Sterge plata"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
