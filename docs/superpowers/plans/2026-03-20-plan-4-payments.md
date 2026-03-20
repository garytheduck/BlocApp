# Plan 4 — Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable admins to record cash/transfer payments for apartment charges and prepare the Stripe Connect onboarding flow so residents can pay online in the future.

**Architecture:** Server Actions handle all payment mutations with admin ownership validation (same pattern as reports). The admin `/dashboard/payments` page shows all payments across reports with filtering. A new "Plati" tab in Settings handles Stripe Connect onboarding. Stripe webhooks are handled via a Route Handler at `/api/webhooks/stripe`. Cash/transfer recording is available both from the payments page and from the charges tab within individual reports.

**Tech Stack:** Next.js 16 App Router, Supabase (existing), Stripe SDK (`stripe` npm package), Server Actions, shadcn/ui v4 (base-ui)

**Scope note:** This plan covers 2 subsystems that build on each other:
1. **Cash/Transfer recording** (admin-only, no Stripe dependency) — fully functional standalone
2. **Stripe Connect onboarding + online payment infrastructure** — requires Stripe account setup

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `blocapp/lib/stripe.ts` | Stripe SDK singleton, helper to get connected account |
| `blocapp/lib/admin-ctx.ts` | Shared getAdminCtx() for all Server Actions |
| `blocapp/app/(dashboard)/dashboard/payments/page.tsx` | Admin payments list page (server component) |
| `blocapp/app/(dashboard)/dashboard/payments/payment-actions.ts` | Server Actions: record, delete, list payments |
| `blocapp/components/payments/payments-table.tsx` | Client component: table with filters |
| `blocapp/components/payments/record-payment-dialog.tsx` | Dialog for cash/transfer recording |
| `blocapp/components/payments/delete-payment-dialog.tsx` | Confirm delete payment with reversal |
| `blocapp/components/settings/stripe-connect-card.tsx` | Stripe Connect onboarding card in settings |
| `blocapp/app/(dashboard)/dashboard/settings/stripe-actions.ts` | Server Actions: create Connect account, get onboarding link |
| `blocapp/app/api/webhooks/stripe/route.ts` | Stripe webhook handler (Connect events) |

### Modified Files
| File | Change |
|------|--------|
| `blocapp/components/reports/charges-tab.tsx` | Add "Inregistreaza plata" button per charge row |
| `blocapp/components/settings/association-form.tsx` | Replace static Stripe Connect card with interactive component |
| `blocapp/app/(dashboard)/dashboard/settings/page.tsx` | Add Plati tab to settings tabs |
| `blocapp/package.json` | Add `stripe` dependency |
| `blocapp/.env.local` | Add Stripe keys (manual step) |

---

## Task 1: Install Stripe SDK & Create Library Helper

**Files:**
- Create: `blocapp/lib/stripe.ts`
- Modify: `blocapp/package.json`

- [ ] **Step 1: Install stripe package**

```bash
cd C:/Users/Samuel/Desktop/Proiect\ asociatie/blocapp && npm install stripe
```

- [ ] **Step 2: Create Stripe server-side helper**

Create `blocapp/lib/stripe.ts`:

```typescript
import Stripe from "stripe"

// Singleton — one instance per cold start
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
    stripeInstance = new Stripe(key, { apiVersion: "2025-04-30.basil" })
  }
  return stripeInstance
}

/** Platform fee: 1.5% of amount, rounded up to nearest cent */
export function calculateApplicationFee(amountInBani: number): number {
  return Math.ceil(amountInBani * 0.015)
}

/** Minimum online payment in RON */
export const MIN_ONLINE_PAYMENT_RON = 10
```

- [ ] **Step 3: Add placeholder env vars**

User must manually add to `blocapp/.env.local`:
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> **NOTE TO USER:** You need to create a Stripe account at https://dashboard.stripe.com and get your test-mode API keys. Enable Stripe Connect in the dashboard. The webhook secret comes from setting up a webhook endpoint later.

- [ ] **Step 4: Commit**

```bash
git add blocapp/lib/stripe.ts blocapp/package.json blocapp/package-lock.json
git commit -m "feat: add Stripe SDK and server helper"
```

---

## Task 2: Shared Admin Context Helper

**Files:**
- Create: `blocapp/lib/admin-ctx.ts`

- [ ] **Step 1: Extract shared getAdminCtx**

Create `blocapp/lib/admin-ctx.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"

/**
 * Shared admin context helper for Server Actions.
 * Returns authenticated supabase client, association ID, and user ID.
 * Returns null if user is not an authenticated admin.
 */
export async function getAdminCtx() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin" || !profile.association_id) return null
  return { supabase, associationId: profile.association_id, userId: user.id }
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/lib/admin-ctx.ts
git commit -m "refactor: extract shared getAdminCtx helper"
```

---

## Task 3: Payment Server Actions (Cash/Transfer Recording)

**Files:**
- Create: `blocapp/app/(dashboard)/dashboard/payments/payment-actions.ts`

- [ ] **Step 1: Create payment server actions**

Create `blocapp/app/(dashboard)/dashboard/payments/payment-actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { getAdminCtx } from "@/lib/admin-ctx"

export async function recordPayment(formData: {
  apartment_charge_id: string
  amount: number
  method: "cash" | "transfer"
  paid_at: string
  notes: string | null
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  if (formData.amount <= 0) return { error: "Suma trebuie sa fie pozitiva." }

  // Verify charge belongs to this association and get current state
  const { data: charge } = await ctx.supabase
    .from("apartment_charges")
    .select("id, apartment_id, association_id, total_due, amount_paid, payment_status")
    .eq("id", formData.apartment_charge_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!charge) return { error: "Cheltuiala nu a fost gasita." }
  if (charge.payment_status === "paid") return { error: "Aceasta cheltuiala este deja platita integral." }

  // Verify report is published (payments only on published reports)
  const { data: chargeWithReport } = await ctx.supabase
    .from("apartment_charges")
    .select("report_id, monthly_reports!inner(status)")
    .eq("id", formData.apartment_charge_id)
    .single()

  if (!chargeWithReport) return { error: "Cheltuiala nu a fost gasita." }
  const reportStatus = (chargeWithReport as { monthly_reports: { status: string } }).monthly_reports.status
  if (reportStatus !== "published") {
    return { error: "Platile se pot inregistra doar pe liste publicate." }
  }

  const remaining = Number(charge.total_due) - Number(charge.amount_paid)
  if (formData.amount > remaining + 0.01) {
    return { error: `Suma depaseste restul de plata (${remaining.toFixed(2)} RON).` }
  }

  // Insert payment
  const { error: payError } = await ctx.supabase.from("payments").insert({
    association_id: ctx.associationId,
    apartment_id: charge.apartment_id,
    apartment_charge_id: charge.id,
    amount: formData.amount,
    method: formData.method,
    status: "succeeded",
    paid_at: formData.paid_at || new Date().toISOString(),
    recorded_by: ctx.userId,
    notes: formData.notes || null,
  })

  if (payError) return { error: payError.message }

  // Update charge amount_paid and payment_status
  const newAmountPaid = Number(charge.amount_paid) + formData.amount
  const newStatus =
    newAmountPaid >= Number(charge.total_due) - 0.01 ? "paid" : "partial"

  const { error: updateError } = await ctx.supabase
    .from("apartment_charges")
    .update({
      amount_paid: Math.round(newAmountPaid * 100) / 100,
      payment_status: newStatus,
    })
    .eq("id", charge.id)
    .eq("association_id", ctx.associationId)

  if (updateError) return { error: updateError.message }

  revalidatePath("/dashboard/payments")
  revalidatePath(`/dashboard/reports/${chargeWithReport.report_id}`)
  return { success: true }
}

export async function deletePayment(paymentId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Get the payment
  const { data: payment } = await ctx.supabase
    .from("payments")
    .select("id, amount, apartment_charge_id, status, method")
    .eq("id", paymentId)
    .eq("association_id", ctx.associationId)
    .single()

  if (!payment) return { error: "Plata nu a fost gasita." }
  if (payment.status !== "succeeded") return { error: "Doar platile cu succes pot fi sterse." }
  if (payment.method === "online") return { error: "Platile online nu pot fi sterse manual. Folositi refund din Stripe." }

  // Get the charge
  const { data: charge } = await ctx.supabase
    .from("apartment_charges")
    .select("id, amount_paid, total_due, report_id")
    .eq("id", payment.apartment_charge_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!charge) return { error: "Cheltuiala asociata nu a fost gasita." }

  // Verify report is still published
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("status")
    .eq("id", charge.report_id)
    .single()

  if (!report || report.status !== "published") {
    return { error: "Platile pot fi sterse doar pe liste publicate." }
  }

  // Delete the payment
  const { error: delError } = await ctx.supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("association_id", ctx.associationId)

  if (delError) return { error: delError.message }

  // Reverse charge update
  const newAmountPaid = Math.max(0, Number(charge.amount_paid) - Number(payment.amount))
  const newStatus = newAmountPaid <= 0.01 ? "unpaid" : "partial"

  await ctx.supabase
    .from("apartment_charges")
    .update({
      amount_paid: Math.round(newAmountPaid * 100) / 100,
      payment_status: newStatus,
    })
    .eq("id", charge.id)
    .eq("association_id", ctx.associationId)

  revalidatePath("/dashboard/payments")
  revalidatePath(`/dashboard/reports/${charge.report_id}`)
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/payments/payment-actions.ts
git commit -m "feat: add payment server actions for cash/transfer recording"
```

---

## Task 4: Record Payment Dialog Component

**Files:**
- Create: `blocapp/components/payments/record-payment-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `blocapp/components/payments/record-payment-dialog.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { recordPayment } from "@/app/(dashboard)/dashboard/payments/payment-actions"
import { toast } from "sonner"
import { Plus } from "lucide-react"

interface RecordPaymentDialogProps {
  chargeId: string
  apartmentNumber: string
  totalDue: number
  amountPaid: number
  /** Render prop for custom trigger button. If omitted, uses default button. */
  trigger?: React.ReactNode
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
    setForm({
      amount: remaining.toString(),
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
      toast.success(`Plata de ${amount.toFixed(2)} RON inregistrata pentru Ap. ${apartmentNumber}.`)
      resetForm()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) resetForm() }}>
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
            Rest de plata: <span className="font-medium text-foreground">{remaining.toFixed(2)} RON</span>
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
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-method">Metoda *</Label>
              <Select
                value={form.method}
                onValueChange={(val: string | null) => {
                  if (val) setForm((p) => ({ ...p, method: val as "cash" | "transfer" }))
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
              onChange={(e) => setForm((p) => ({ ...p, paid_at: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-notes">Note (optional)</Label>
            <Textarea
              id="pay-notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Nr. chitanta, detalii transfer..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/components/payments/record-payment-dialog.tsx
git commit -m "feat: add record payment dialog component"
```

---

## Task 5: Delete Payment Dialog Component

**Files:**
- Create: `blocapp/components/payments/delete-payment-dialog.tsx`

- [ ] **Step 1: Create delete payment dialog**

Create `blocapp/components/payments/delete-payment-dialog.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { deletePayment } from "@/app/(dashboard)/dashboard/payments/payment-actions"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

interface DeletePaymentDialogProps {
  paymentId: string
  amount: number
  apartmentNumber: string
}

export function DeletePaymentDialog({ paymentId, amount, apartmentNumber }: DeletePaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deletePayment(paymentId)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Plata de ${amount.toFixed(2)} RON pentru Ap. ${apartmentNumber} a fost stearsa.`)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sterge plata</AlertDialogTitle>
          <AlertDialogDescription>
            Sigur doriti sa stergeti plata de <strong>{amount.toFixed(2)} RON</strong> pentru
            Ap. <strong>{apartmentNumber}</strong>? Suma va fi scazuta din totalul platit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Anuleaza
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Se sterge..." : "Sterge plata"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/components/payments/delete-payment-dialog.tsx
git commit -m "feat: add delete payment dialog with reversal"
```

---

## Task 6: Payments Table Component

**Files:**
- Create: `blocapp/components/payments/payments-table.tsx`

- [ ] **Step 1: Create the payments table with filters**

Create `blocapp/components/payments/payments-table.tsx`:

```typescript
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DeletePaymentDialog } from "@/components/payments/delete-payment-dialog"
import { Banknote, ArrowLeftRight, CreditCard, Search } from "lucide-react"
import type { Database } from "@/types/database"

type Payment = Database["public"]["Tables"]["payments"]["Row"]
type Apartment = Database["public"]["Tables"]["apartments"]["Row"]

interface PaymentWithApartment extends Payment {
  apartment?: Pick<Apartment, "number"> | null
  report_period?: string // e.g. "Martie 2026"
}

const METHOD_CONFIG = {
  cash: { label: "Numerar", icon: Banknote, variant: "outline" as const },
  transfer: { label: "Transfer", icon: ArrowLeftRight, variant: "secondary" as const },
  online: { label: "Online", icon: CreditCard, variant: "default" as const },
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "In asteptare", variant: "outline" },
  succeeded: { label: "Reusita", variant: "default" },
  failed: { label: "Esuata", variant: "destructive" },
  refunded: { label: "Rambursata", variant: "secondary" },
}

interface PaymentsTableProps {
  payments: PaymentWithApartment[]
}

export function PaymentsTable({ payments: initialPayments }: PaymentsTableProps) {
  const [search, setSearch] = useState("")
  const [methodFilter, setMethodFilter] = useState("all")

  const filtered = useMemo(() => {
    return initialPayments.filter((p) => {
      const matchSearch =
        !search ||
        (p.apartment?.number ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.notes ?? "").toLowerCase().includes(search.toLowerCase())
      const matchMethod = methodFilter === "all" || p.method === methodFilter
      return matchSearch && matchMethod
    })
  }, [initialPayments, search, methodFilter])

  const totalSucceeded = filtered
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + Number(p.amount), 0)

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
        <Select value={methodFilter} onValueChange={(val: string | null) => { if (val) setMethodFilter(val) }}>
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
        {filtered.length} plati — Total incasat: <span className="font-medium text-foreground">{totalSucceeded.toFixed(2)} RON</span>
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
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nicio plata inregistrata.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((payment) => {
                const methodCfg = METHOD_CONFIG[payment.method]
                const statusCfg = STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.pending
                const Icon = methodCfg.icon
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      Ap. {payment.apartment?.number ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.report_period ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(payment.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={methodCfg.variant} className="gap-1">
                        <Icon className="size-3" />
                        {methodCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
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
                      {payment.status === "succeeded" && payment.method !== "online" && (
                        <DeletePaymentDialog
                          paymentId={payment.id}
                          amount={Number(payment.amount)}
                          apartmentNumber={payment.apartment?.number ?? "?"}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/components/payments/payments-table.tsx
git commit -m "feat: add payments table component with filters"
```

---

## Task 7: Payments Page (Server Component)

**Files:**
- Create: `blocapp/app/(dashboard)/dashboard/payments/page.tsx`

- [ ] **Step 1: Create the payments page**

Create `blocapp/app/(dashboard)/dashboard/payments/page.tsx`:

```typescript
import { getAdminProfile } from "@/lib/get-profile"
import { PaymentsTable } from "@/components/payments/payments-table"

const MONTH_NAMES = [
  "", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

export default async function PaymentsPage() {
  const { supabase, associationId } = await getAdminProfile()

  // Fetch all payments with apartment info
  const { data: payments } = await supabase
    .from("payments")
    .select(`
      *,
      apartments!inner(number),
      apartment_charges!inner(report_id, monthly_reports!inner(period_month, period_year))
    `)
    .eq("association_id", associationId)
    .order("paid_at", { ascending: false })

  // Transform data for the table
  const tablePayments = (payments ?? []).map((p) => {
    const apt = p.apartments as unknown as { number: string } | null
    const charge = p.apartment_charges as unknown as {
      report_id: string
      monthly_reports: { period_month: number; period_year: number }
    } | null
    const period = charge?.monthly_reports
      ? `${MONTH_NAMES[charge.monthly_reports.period_month]} ${charge.monthly_reports.period_year}`
      : undefined

    return {
      ...p,
      apartment: apt ? { number: apt.number } : null,
      report_period: period,
    }
  })

  // Summary stats
  const totalCollected = tablePayments
    .filter((p) => p.status === "succeeded")
    .reduce((s, p) => s + Number(p.amount), 0)

  const cashCount = tablePayments.filter((p) => p.method === "cash" && p.status === "succeeded").length
  const transferCount = tablePayments.filter((p) => p.method === "transfer" && p.status === "succeeded").length
  const onlineCount = tablePayments.filter((p) => p.method === "online" && p.status === "succeeded").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plati</h1>
        <p className="text-sm text-muted-foreground">
          Toate platile inregistrate pentru asociatie
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total incasat</div>
          <div className="text-2xl font-bold font-mono">{totalCollected.toFixed(2)} RON</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Numar plati</div>
          <div className="text-2xl font-bold">{tablePayments.filter((p) => p.status === "succeeded").length}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {cashCount} numerar · {transferCount} transfer · {onlineCount} online
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Ultima plata</div>
          <div className="text-lg font-medium">
            {tablePayments.length > 0 && tablePayments[0].paid_at
              ? new Date(tablePayments[0].paid_at).toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </div>
        </div>
      </div>

      <PaymentsTable payments={tablePayments} />
    </div>
  )
}
```

- [ ] **Step 2: Verify page loads**

Navigate to http://localhost:3000/dashboard/payments — should show empty state with "Nicio plata inregistrata."

- [ ] **Step 3: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/payments/page.tsx
git commit -m "feat: add admin payments page with summary cards"
```

---

## Task 8: Add Payment Recording to Charges Tab

**Files:**
- Modify: `blocapp/components/reports/charges-tab.tsx`

- [ ] **Step 1: Import and add payment button to each charge row**

In `blocapp/components/reports/charges-tab.tsx`, add the import at the top:

```typescript
import { RecordPaymentDialog } from "@/components/payments/record-payment-dialog"
```

Then in the table row for each charge (inside the map), add a new `<TableCell>` after the payment_status cell containing the RecordPaymentDialog trigger. The dialog should only show when the charge is not fully paid and the report is published.

Add a `reportStatus` prop to `ChargesTabProps`:

```typescript
interface ChargesTabProps {
  reportId: string
  charges: (ApartmentCharge & { apartment?: Apartment })[]
  canCalculate: boolean
  reportStatus: string
}
```

In each charge row, after the payment status badge cell, add:

```typescript
<TableCell>
  {charge.payment_status !== "paid" && reportStatus === "published" && (
    <RecordPaymentDialog
      chargeId={charge.id}
      apartmentNumber={charge.apartment?.number ?? "?"}
      totalDue={Number(charge.total_due)}
      amountPaid={Number(charge.amount_paid)}
    />
  )}
</TableCell>
```

Also add a header `<TableHead>Plata</TableHead>` to match.

- [ ] **Step 2: Update the report detail page to pass reportStatus**

In `blocapp/app/(dashboard)/dashboard/reports/[id]/page.tsx`, pass the `reportStatus` prop when rendering `<ChargesTab>`:

```typescript
<ChargesTab
  reportId={report.id}
  charges={chargesWithApts}
  canCalculate={...}
  reportStatus={report.status}
/>
```

- [ ] **Step 3: Commit**

```bash
git add blocapp/components/reports/charges-tab.tsx blocapp/app/(dashboard)/dashboard/reports/[id]/page.tsx
git commit -m "feat: add inline payment recording from charges tab"
```

---

## Task 9: Stripe Connect Onboarding Card

**Files:**
- Create: `blocapp/components/settings/stripe-connect-card.tsx`
- Create: `blocapp/app/(dashboard)/dashboard/settings/stripe-actions.ts`
- Modify: `blocapp/components/settings/association-form.tsx`
- Modify: `blocapp/app/(dashboard)/dashboard/settings/page.tsx`

- [ ] **Step 1: Create Stripe Connect server actions**

Create `blocapp/app/(dashboard)/dashboard/settings/stripe-actions.ts`:

```typescript
"use server"

import { getStripe } from "@/lib/stripe"
import { getAdminCtx } from "@/lib/admin-ctx"

export async function createConnectOnboardingLink() {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Check if Stripe keys are configured
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: "Stripe nu este configurat. Contactati administratorul platformei." }
  }

  const stripe = getStripe()

  // Get current association
  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_connect_account_id, name")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc) return { error: "Asociatia nu a fost gasita." }

  let accountId = assoc.stripe_connect_account_id

  // Create Connect Express account if none exists
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "RO",
      business_type: "non_profit",
      metadata: { association_id: ctx.associationId },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    })

    accountId = account.id

    await ctx.supabase
      .from("associations")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", ctx.associationId)
  }

  // Create onboarding link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/settings?tab=plati&connect=refresh`,
    return_url: `${baseUrl}/dashboard/settings?tab=plati&connect=success`,
    type: "account_onboarding",
  })

  return { url: accountLink.url }
}

export async function getConnectAccountStatus() {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_connect_account_id, stripe_connect_onboarded")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc) return { error: "Asociatia nu a fost gasita." }

  if (!assoc.stripe_connect_account_id) {
    return { status: "not_created" as const }
  }

  if (assoc.stripe_connect_onboarded) {
    return { status: "active" as const }
  }

  // Account exists but not onboarded — check with Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe()
      const account = await stripe.accounts.retrieve(assoc.stripe_connect_account_id)
      if (account.charges_enabled) {
        // Update our DB
        await ctx.supabase
          .from("associations")
          .update({ stripe_connect_onboarded: true })
          .eq("id", ctx.associationId)
        return { status: "active" as const }
      }
    } catch {
      // Stripe error — fall through to pending
    }
  }

  return { status: "pending" as const }
}
```

- [ ] **Step 2: Create the Stripe Connect card component**

Create `blocapp/components/settings/stripe-connect-card.tsx`:

```typescript
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  createConnectOnboardingLink,
  getConnectAccountStatus,
} from "@/app/(dashboard)/dashboard/settings/stripe-actions"
import { toast } from "sonner"
import { ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react"

interface StripeConnectCardProps {
  initialOnboarded: boolean
  connectReturn?: string | null
}

export function StripeConnectCard({ initialOnboarded, connectReturn }: StripeConnectCardProps) {
  const [status, setStatus] = useState<"not_created" | "pending" | "active">(
    initialOnboarded ? "active" : "not_created"
  )
  const [loading, setLoading] = useState(false)

  // On mount, if we just returned from Stripe, re-check status
  useEffect(() => {
    if (connectReturn === "success" || connectReturn === "refresh") {
      checkStatus()
    }
  }, [connectReturn])

  async function checkStatus() {
    const result = await getConnectAccountStatus()
    if (result.status) setStatus(result.status)
  }

  async function handleOnboard() {
    setLoading(true)
    const result = await createConnectOnboardingLink()
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.url) {
      window.location.href = result.url
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Plati online (Stripe Connect)
          {status === "active" && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="size-3" /> Activ
            </Badge>
          )}
          {status === "pending" && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="size-3" /> In curs
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Permite locatarilor sa plateasca intretinerea online cu cardul. Platforma retine un comision de 1.5%.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === "active" ? (
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm">
              Configurat — locatarii pot plati online
            </span>
          </div>
        ) : status === "pending" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-400">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <span>
                Procesul de onboarding nu a fost finalizat. Continuati configurarea pentru a activa platile online.
              </span>
            </div>
            <Button onClick={handleOnboard} disabled={loading} variant="outline">
              <ExternalLink className="size-3.5 mr-1.5" />
              {loading ? "Se incarca..." : "Continua configurarea"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Conectati un cont Stripe pentru a permite locatarilor sa plateasca online.
              Procesul dureaza cateva minute si necesita date despre asociatie.
            </p>
            <Button onClick={handleOnboard} disabled={loading}>
              <ExternalLink className="size-3.5 mr-1.5" />
              {loading ? "Se incarca..." : "Configureaza Stripe Connect"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Remove old static Stripe card from association-form.tsx**

In `blocapp/components/settings/association-form.tsx`, delete the entire last `<Card>` block (lines 157-178, the "Plati online (Stripe Connect)" card). This is now handled by the dedicated `StripeConnectCard` component.

- [ ] **Step 4: Add Plati tab to settings page**

Update `blocapp/app/(dashboard)/dashboard/settings/page.tsx` to add a third tab:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssociationForm } from "@/components/settings/association-form"
import { BuildingsList } from "@/components/settings/buildings-list"
import { StripeConnectCard } from "@/components/settings/stripe-connect-card"
import { getAdminProfile } from "@/lib/get-profile"

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connect?: string }>
}) {
  const { supabase, associationId } = await getAdminProfile()
  const params = await searchParams

  const { data: association } = await supabase
    .from("associations")
    .select("*")
    .eq("id", associationId)
    .single()

  if (!association) {
    return <p className="text-destructive">Eroare la incarcarea asociatiei.</p>
  }

  const { data: buildingsRaw } = await supabase
    .from("buildings")
    .select("*")
    .eq("association_id", associationId)
    .order("name")

  const buildings = await Promise.all(
    (buildingsRaw ?? []).map(async (b) => {
      const { count } = await supabase
        .from("apartments")
        .select("id", { count: "exact", head: true })
        .eq("building_id", b.id)
      return { ...b, apartment_count: count ?? 0 }
    })
  )

  const defaultTab = params.tab ?? "general"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Setari</h1>
        <p className="text-sm text-muted-foreground">
          Configurati asociatia si gestionati blocurile
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">Asociatie</TabsTrigger>
          <TabsTrigger value="buildings">Blocuri / Scari</TabsTrigger>
          <TabsTrigger value="plati">Plati online</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <AssociationForm association={association} />
        </TabsContent>

        <TabsContent value="buildings">
          <BuildingsList buildings={buildings} />
        </TabsContent>

        <TabsContent value="plati">
          <StripeConnectCard
            initialOnboarded={association.stripe_connect_onboarded}
            connectReturn={params.connect}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add blocapp/components/settings/stripe-connect-card.tsx blocapp/app/(dashboard)/dashboard/settings/stripe-actions.ts blocapp/components/settings/association-form.tsx blocapp/app/(dashboard)/dashboard/settings/page.tsx
git commit -m "feat: add Stripe Connect onboarding in settings"
```

---

## Task 10: Stripe Webhook Handler

**Files:**
- Create: `blocapp/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Create webhook route handler**

Create `blocapp/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import Stripe from "stripe"

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = await createServiceClient()

  try {
    switch (event.type) {
      // ── Stripe Connect: account onboarding complete ──
      case "account.updated": {
        const account = event.data.object as Stripe.Account
        await supabase
          .from("associations")
          .update({ stripe_connect_onboarded: account.charges_enabled ?? false })
          .eq("stripe_connect_account_id", account.id)
        break
      }

      // ── Stripe Connect: account deauthorized ──
      case "account.application.deauthorized": {
        const account = event.data.object as Stripe.Account
        await supabase
          .from("associations")
          .update({ stripe_connect_onboarded: false })
          .eq("stripe_connect_account_id", account.id)
        break
      }

      // ── Payment succeeded (online payment from resident) ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent

        // Idempotency: check if we already processed this event
        const { data: existing } = await supabase
          .from("payments")
          .select("id")
          .eq("stripe_event_id", event.id)
          .maybeSingle()

        if (existing) break // Already processed

        // Extract metadata
        const chargeId = pi.metadata?.apartment_charge_id
        const associationId = pi.metadata?.association_id
        const apartmentId = pi.metadata?.apartment_id

        if (!chargeId || !associationId || !apartmentId) {
          console.error("Payment intent missing metadata:", pi.id)
          break
        }

        const amountRon = pi.amount / 100 // Stripe uses bani (cents)
        const applicationFee = pi.application_fee_amount
          ? pi.application_fee_amount / 100
          : null

        // Insert payment
        await supabase.from("payments").insert({
          association_id: associationId,
          apartment_id: apartmentId,
          apartment_charge_id: chargeId,
          amount: amountRon,
          method: "online",
          stripe_payment_intent_id: pi.id,
          stripe_application_fee: applicationFee,
          stripe_event_id: event.id,
          status: "succeeded",
          paid_at: new Date().toISOString(),
        })

        // Update charge amount_paid
        const { data: charge } = await supabase
          .from("apartment_charges")
          .select("amount_paid, total_due")
          .eq("id", chargeId)
          .single()

        if (charge) {
          const newAmountPaid = Number(charge.amount_paid) + amountRon
          const newStatus =
            newAmountPaid >= Number(charge.total_due) - 0.01 ? "paid" : "partial"

          await supabase
            .from("apartment_charges")
            .update({
              amount_paid: Math.round(newAmountPaid * 100) / 100,
              payment_status: newStatus,
            })
            .eq("id", chargeId)
        }
        break
      }

      // ── SaaS subscription updated ──
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status === "active"
          ? "active"
          : sub.status === "trialing"
          ? "trialing"
          : sub.status === "past_due"
          ? "past_due"
          : "canceled"

        await supabase
          .from("associations")
          .update({ subscription_status: status })
          .eq("stripe_customer_id", sub.customer as string)
        break
      }

      // ── SaaS subscription deleted ──
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        await supabase
          .from("associations")
          .update({
            subscription_status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", sub.customer as string)
        break
      }

      default:
        // Unhandled event type — ignore
        break
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/app/api/webhooks/stripe/route.ts
git commit -m "feat: add Stripe webhook handler for Connect + subscription events"
```

---

## Task 11: Add Re-publish Guard (Payment Safety Check)

**Files:**
- Modify: `blocapp/app/(dashboard)/dashboard/reports/report-actions.ts`

- [ ] **Step 1: Add payment check to calculateReport**

In `blocapp/app/(dashboard)/dashboard/reports/report-actions.ts`, inside `calculateReport()`, add a check right after the `report.status === "closed"` check:

```typescript
// Check for existing succeeded payments — cannot recalculate if payments exist
const { count: paymentCount } = await ctx.supabase
  .from("payments")
  .select("id, apartment_charges!inner(report_id)", { count: "exact", head: true })
  .eq("apartment_charges.report_id", reportId)
  .eq("status", "succeeded")

if (paymentCount && paymentCount > 0) {
  return {
    error: "Nu puteti recalcula lista deoarece exista plati inregistrate. Stergeti platile mai intai.",
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/reports/report-actions.ts
git commit -m "feat: add re-publish guard — block recalculation when payments exist"
```

---

## Task 12: Verify & Test End-to-End

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/Samuel/Desktop/Proiect\ asociatie/blocapp && npm run dev
```

- [ ] **Step 2: Test payments page loads**

Navigate to http://localhost:3000/dashboard/payments — should show empty state with summary cards (all zeros).

- [ ] **Step 3: Test record payment from charges tab**

1. Go to a published report at `/dashboard/reports/[id]`
2. Click "Cheltuieli" tab → ensure charges are calculated
3. On a charge row, click "Plata" button
4. Fill in amount (e.g., 50 RON), method "Numerar", date, optional notes
5. Submit — toast should confirm success
6. Charge row should now show "Partial" or "Platit" status

- [ ] **Step 4: Test payment shows in payments page**

Navigate to `/dashboard/payments` — the payment should appear in the table.

- [ ] **Step 5: Test delete payment**

Click the trash icon on the payment → confirm → payment should disappear, charge status should revert.

- [ ] **Step 6: Test Stripe Connect card in settings**

Navigate to `/dashboard/settings` → click "Plati online" tab → should show "Configureaza Stripe Connect" button (if Stripe keys are set) or show unconfigured state.

- [ ] **Step 7: Test re-publish guard**

After recording a payment, try to recalculate the report → should show error about existing payments.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: Plan 4 complete — payments recording, Stripe Connect, webhooks"
```

---

## Environment Variables Required (Manual Setup)

The following must be added to `blocapp/.env.local` by the user:

```env
# Stripe (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook (get after creating webhook endpoint in Stripe dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL (for Stripe Connect return URLs)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Stripe Dashboard Setup:**
1. Create account at https://dashboard.stripe.com
2. Enable Connect: Settings → Connect → Get Started
3. Create webhook endpoint: Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events: `account.updated`, `account.application.deauthorized`, `payment_intent.succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
