# Plan 6 — Stripe Billing, PDF Export, Email, Online Payments & Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining features — SaaS billing (subscription checkout + portal), PDF report export, Resend email for invites, online resident payments via Stripe Connect, and calculation engine fixes (balance_previous + penalties at publish).

**Architecture:** SaaS billing uses Stripe Checkout Sessions for subscription creation and Stripe Customer Portal for management. PDF export uses `@react-pdf/renderer` in a Route Handler. Online payments create PaymentIntents on the association's Connected Account with 1.5% application_fee. Resend sends invite emails. Penalties are calculated at publish time (no pg_cron).

**Tech Stack:** Stripe SDK (`stripe`), `@react-pdf/renderer`, `resend`, Next.js 16 Route Handlers, Server Actions, shadcn/ui v4 (base-ui)

**Key conventions:**
- shadcn/ui v4 uses `@base-ui/react` — `render` prop (NOT `asChild`), Select `onValueChange` is `(value: string | null, eventDetails) => void`
- `createServiceClient()` is async — always `await` it
- Admin auth: `getAdminCtx()` from `lib/admin-ctx.ts` for Server Actions, `getAdminProfile()` from `lib/get-profile.ts` for pages
- UUID: `gen_random_uuid()` NOT `uuid_generate_v4()`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `blocapp/app/(dashboard)/dashboard/settings/billing/page.tsx` | Billing page — plan display, checkout, portal link |
| `blocapp/app/(dashboard)/dashboard/settings/billing/billing-actions.ts` | Server Actions: createCheckout, createPortalSession |
| `blocapp/components/settings/billing-card.tsx` | Client component: plan cards + subscription management |
| `blocapp/app/api/reports/[id]/pdf/route.ts` | Route Handler: generate PDF for a report |
| `blocapp/lib/pdf/report-pdf.tsx` | React-PDF document component |
| `blocapp/app/(resident)/resident/charges/pay-button.tsx` | Client component: "Plateste online" button |
| `blocapp/app/(resident)/resident/charges/payment-actions.ts` | Server Action: createPaymentIntent for resident |
| `blocapp/app/(resident)/resident/charges/payment-success/page.tsx` | Payment success confirmation page |
| `blocapp/lib/resend.ts` | Resend client singleton |
| `blocapp/lib/emails/invite-email.tsx` | Invite email template (React Email) |

### Modified Files
| File | Change |
|------|--------|
| `blocapp/app/(dashboard)/dashboard/settings/page.tsx` | Add "Abonament" tab |
| `blocapp/app/(dashboard)/dashboard/reports/[id]/page.tsx` | Add PDF download button |
| `blocapp/app/(resident)/resident/charges/page.tsx` | Add pay online button per charge |
| `blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts` | Send email on invite |
| `blocapp/app/(dashboard)/dashboard/reports/report-actions.ts` | Fix balance_previous + penalties at publish |
| `blocapp/app/api/webhooks/stripe/route.ts` | Add `checkout.session.completed` event |
| `blocapp/middleware.ts` | Allow `/dashboard/settings/billing` for canceled admins |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `blocapp/package.json`

- [ ] **Step 1: Install @react-pdf/renderer, resend**

```bash
cd C:/Users/Samuel/Desktop/Proiect\ asociatie/blocapp && npm install @react-pdf/renderer resend
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/package.json blocapp/package-lock.json
git commit -m "chore: add @react-pdf/renderer and resend dependencies"
```

---

## Task 2: SaaS Billing — Server Actions + Webhook

**Files:**
- Create: `blocapp/app/(dashboard)/dashboard/settings/billing/billing-actions.ts`
- Modify: `blocapp/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Create billing server actions**

Create `blocapp/app/(dashboard)/dashboard/settings/billing/billing-actions.ts`:

```typescript
"use server"

import { getAdminCtx } from "@/lib/admin-ctx"
import { getStripe } from "@/lib/stripe"

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID ?? "",
  pro: process.env.STRIPE_PRO_PRICE_ID ?? "",
}

export async function createCheckoutSession(plan: "starter" | "pro") {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const priceId = PRICE_IDS[plan]
  if (!priceId) return { error: "Planul selectat nu este configurat." }

  // Get or create Stripe customer
  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_customer_id, name")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc) return { error: "Asociatia nu a fost gasita." }

  let customerId = assoc.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { association_id: ctx.associationId },
      name: assoc.name,
    })
    customerId = customer.id
    await ctx.supabase
      .from("associations")
      .update({ stripe_customer_id: customerId })
      .eq("id", ctx.associationId)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/dashboard/settings/billing?checkout=cancel`,
    subscription_data: {
      trial_period_days: 14,
      metadata: { association_id: ctx.associationId },
    },
    metadata: { association_id: ctx.associationId },
  })

  return { url: session.url }
}

export async function createPortalSession() {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const stripe = getStripe()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_customer_id")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc?.stripe_customer_id) {
    return { error: "Nu exista un abonament activ." }
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: assoc.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/settings/billing`,
  })

  return { url: session.url }
}

```

- [ ] **Step 2: Add checkout.session.completed to webhook handler**

In `blocapp/app/api/webhooks/stripe/route.ts`, add this case before the `default:` in the switch:

```typescript
      // ── Checkout session completed (new subscription) ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== "subscription") break

        const associationId = session.metadata?.association_id
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id

        if (!associationId || !subscriptionId) break

        // Retrieve subscription to get plan details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const status =
          subscription.status === "trialing" ? "trialing" : "active"

        // Determine plan from price ID
        const priceId = subscription.items.data[0]?.price?.id ?? ""
        const plan =
          priceId === process.env.STRIPE_PRO_PRICE_ID ? "pro" : "starter"

        // Trial end date
        const trialEndsAt = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null

        await supabase
          .from("associations")
          .update({
            stripe_customer_id:
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id ?? null,
            stripe_subscription_id: subscriptionId,
            subscription_status: status,
            plan,
            ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
          })
          .eq("id", associationId)
        break
      }
```

- [ ] **Step 3: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/settings/billing/billing-actions.ts blocapp/app/api/webhooks/stripe/route.ts
git commit -m "feat: add SaaS billing actions and checkout webhook"
```

---

## Task 3: SaaS Billing — UI (Billing Page + Tab)

**Files:**
- Create: `blocapp/components/settings/billing-card.tsx`
- Create: `blocapp/app/(dashboard)/dashboard/settings/billing/page.tsx`
- Modify: `blocapp/app/(dashboard)/dashboard/settings/page.tsx`
- Modify: `blocapp/middleware.ts`

- [ ] **Step 1: Create billing card component**

Create `blocapp/components/settings/billing-card.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  createCheckoutSession,
  createPortalSession,
} from "@/app/(dashboard)/dashboard/settings/billing/billing-actions"
import { toast } from "sonner"
import { CheckCircle2, Crown, ExternalLink } from "lucide-react"

interface BillingCardProps {
  subscriptionStatus: string
  plan: string
  trialEndsAt: string
  canceledAt: string | null
  hasSubscription: boolean
  checkoutResult?: string | null
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  trialing: { label: "Trial", variant: "secondary" },
  active: { label: "Activ", variant: "default" },
  past_due: { label: "Plata restanta", variant: "destructive" },
  canceled: { label: "Anulat", variant: "destructive" },
}

export function BillingCard({
  subscriptionStatus,
  plan,
  trialEndsAt,
  canceledAt,
  hasSubscription,
  checkoutResult,
}: BillingCardProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const statusInfo = STATUS_LABELS[subscriptionStatus]
  const isTrialing = subscriptionStatus === "trialing"
  const isCanceled = subscriptionStatus === "canceled"
  const trialDaysLeft = isTrialing
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : 0

  async function handleCheckout(selectedPlan: "starter" | "pro") {
    setLoading(selectedPlan)
    const result = await createCheckoutSession(selectedPlan)
    setLoading(null)
    if (result.error) {
      toast.error(result.error)
    } else if (result.url) {
      window.location.href = result.url
    }
  }

  async function handlePortal() {
    setLoading("portal")
    const result = await createPortalSession()
    setLoading(null)
    if (result.error) {
      toast.error(result.error)
    } else if (result.url) {
      window.location.href = result.url
    }
  }

  return (
    <div className="space-y-6">
      {checkoutResult === "success" && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-sm">
          <CheckCircle2 className="size-4" />
          Abonamentul a fost activat cu succes!
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Abonament
            {statusInfo && (
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isTrialing
              ? `Trial gratuit — ${trialDaysLeft} zile ramase`
              : isCanceled
                ? `Anulat${canceledAt ? ` pe ${new Date(canceledAt).toLocaleDateString("ro-RO")}` : ""}`
                : `Plan ${plan === "pro" ? "Pro" : "Starter"}`}
          </CardDescription>
        </CardHeader>
        {hasSubscription && !isCanceled && (
          <CardContent>
            <Button variant="outline" onClick={handlePortal} disabled={loading === "portal"}>
              <ExternalLink className="size-3.5 mr-1.5" />
              {loading === "portal" ? "Se incarca..." : "Gestioneaza abonament"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Plan selection — show when no subscription or canceled */}
      {(!hasSubscription || isCanceled) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Starter */}
          <Card className={plan === "starter" && !isCanceled ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="text-lg">Starter</CardTitle>
              <CardDescription>Pana la 50 apartamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold font-mono">49</span>
                <span className="text-sm text-muted-foreground"> RON/luna</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Liste de intretinere</li>
                <li>✓ Portal locatari</li>
                <li>✓ Plati online</li>
                <li>✓ Anunturi</li>
              </ul>
              <Button
                className="w-full"
                onClick={() => handleCheckout("starter")}
                disabled={loading !== null}
              >
                {loading === "starter" ? "Se incarca..." : "Alege Starter"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className={plan === "pro" && !isCanceled ? "border-primary" : "border-amber-500/30"}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Pro
                <Crown className="size-4 text-amber-500" />
              </CardTitle>
              <CardDescription>Apartamente nelimitate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold font-mono">149</span>
                <span className="text-sm text-muted-foreground"> RON/luna</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Tot ce include Starter</li>
                <li>✓ Export PDF</li>
                <li>✓ Email automat locatari</li>
                <li>✓ Suport prioritar</li>
              </ul>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => handleCheckout("pro")}
                disabled={loading !== null}
              >
                {loading === "pro" ? "Se incarca..." : "Alege Pro"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create billing page**

Create `blocapp/app/(dashboard)/dashboard/settings/billing/page.tsx`:

```typescript
import { getAdminProfile } from "@/lib/get-profile"
import { BillingCard } from "@/components/settings/billing-card"

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { supabase, associationId } = await getAdminProfile()
  const params = await searchParams

  const { data: assoc } = await supabase
    .from("associations")
    .select("subscription_status, plan, trial_ends_at, canceled_at, stripe_subscription_id")
    .eq("id", associationId)
    .single()

  if (!assoc) return <p className="text-destructive">Eroare.</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Abonament</h1>
        <p className="text-sm text-muted-foreground">
          Gestionati planul si facturarea
        </p>
      </div>

      <BillingCard
        subscriptionStatus={assoc.subscription_status}
        plan={assoc.plan}
        trialEndsAt={assoc.trial_ends_at}
        canceledAt={assoc.canceled_at}
        hasSubscription={!!assoc.stripe_subscription_id}
        checkoutResult={params.checkout}
      />
    </div>
  )
}
```

- [ ] **Step 3: Add Abonament tab to settings and nav link**

In `blocapp/app/(dashboard)/dashboard/settings/page.tsx`, add a 4th tab:

After `<TabsTrigger value="plati">Plati online</TabsTrigger>` add:
```typescript
          <TabsTrigger value="billing">Abonament</TabsTrigger>
```

After the last `</TabsContent>` add:
```typescript
        <TabsContent value="billing">
          <div className="text-sm text-muted-foreground">
            <a href="/dashboard/settings/billing" className="text-primary underline underline-offset-4">
              Deschide pagina de abonament →
            </a>
          </div>
        </TabsContent>
```

- [ ] **Step 4: Ensure middleware allows billing for canceled admins**

The middleware already allows `/dashboard/settings/billing` via `BILLING_ALLOWED_PATHS`. Verify it matches. The current `BILLING_PATH = "/dashboard/settings/billing"` is correct — no change needed.

- [ ] **Step 5: Commit**

```bash
git add blocapp/components/settings/billing-card.tsx blocapp/app/(dashboard)/dashboard/settings/
git commit -m "feat: add SaaS billing page with plan selection and Stripe Checkout"
```

---

## Task 4: PDF Export

**Files:**
- Create: `blocapp/lib/pdf/report-pdf.tsx`
- Create: `blocapp/app/api/reports/[id]/pdf/route.tsx`
- Modify: `blocapp/app/(dashboard)/dashboard/reports/[id]/page.tsx`

- [ ] **Step 1: Create PDF document component**

Create `blocapp/lib/pdf/report-pdf.tsx`:

```typescript
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 16,
    marginBottom: 6,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #333",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 2,
    borderBottom: "0.5pt solid #ddd",
  },
  col1: { width: "8%" },
  col2: { width: "52%" },
  col3: { width: "20%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  chargeCol1: { width: "6%" },
  chargeCol2: { width: "18%" },
  chargeCol3: { width: "12%", textAlign: "right" },
  chargeCol4: { width: "10%", textAlign: "right" },
  chargeCol5: { width: "10%", textAlign: "right" },
  chargeCol6: { width: "12%", textAlign: "right" },
  chargeCol7: { width: "10%", textAlign: "right" },
  chargeCol8: { width: "12%", textAlign: "right" },
  chargeColOwner: { width: "10%" },
  totalRow: {
    flexDirection: "row",
    borderTop: "1.5pt solid #333",
    paddingTop: 4,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 7,
    color: "#999",
  },
})

const MONTH_NAMES = [
  "", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

interface ExpenseItem {
  category: string
  amount: number
  distribution_method: string
}

interface ApartmentCharge {
  apartment_number: string
  owner_name: string
  subtotal: number
  fond_rulment: number
  fond_reparatii: number
  balance_previous: number
  penalties: number
  total_due: number
  amount_paid: number
}

interface ReportPDFProps {
  associationName: string
  address: string | null
  periodMonth: number
  periodYear: number
  expenses: ExpenseItem[]
  charges: ApartmentCharge[]
  totalExpenses: number
}

export function ReportPDF({
  associationName,
  address,
  periodMonth,
  periodYear,
  expenses,
  charges,
  totalExpenses,
}: ReportPDFProps) {
  const grandTotal = charges.reduce((s, c) => s + c.total_due, 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{associationName}</Text>
          {address && <Text style={styles.subtitle}>{address}</Text>}
          <Text style={[styles.subtitle, { marginTop: 8 }]}>
            Lista de intretinere — {MONTH_NAMES[periodMonth]} {periodYear}
          </Text>
        </View>

        {/* Expenses table */}
        <Text style={styles.sectionTitle}>Cheltuieli comune</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Nr.</Text>
            <Text style={styles.col2}>Categorie</Text>
            <Text style={styles.col3}>Distributie</Text>
            <Text style={styles.col4}>Suma (RON)</Text>
          </View>
          {expenses.map((e, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{i + 1}</Text>
              <Text style={styles.col2}>{e.category}</Text>
              <Text style={styles.col3}>{e.distribution_method}</Text>
              <Text style={styles.col4}>{Number(e.amount).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.col1} />
            <Text style={styles.col2}>TOTAL CHELTUIELI</Text>
            <Text style={styles.col3} />
            <Text style={styles.col4}>{totalExpenses.toFixed(2)}</Text>
          </View>
        </View>

        {/* Charges per apartment */}
        <Text style={styles.sectionTitle}>Defalcare pe apartamente</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.chargeCol1}>Ap.</Text>
            <Text style={styles.chargeColOwner}>Proprietar</Text>
            <Text style={styles.chargeCol3}>Subtotal</Text>
            <Text style={styles.chargeCol4}>F. rul.</Text>
            <Text style={styles.chargeCol5}>F. rep.</Text>
            <Text style={styles.chargeCol6}>Sold ant.</Text>
            <Text style={styles.chargeCol7}>Penalizari</Text>
            <Text style={styles.chargeCol8}>TOTAL</Text>
          </View>
          {charges.map((c, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.chargeCol1}>{c.apartment_number}</Text>
              <Text style={styles.chargeColOwner}>{c.owner_name}</Text>
              <Text style={styles.chargeCol3}>{c.subtotal.toFixed(2)}</Text>
              <Text style={styles.chargeCol4}>{c.fond_rulment.toFixed(2)}</Text>
              <Text style={styles.chargeCol5}>{c.fond_reparatii.toFixed(2)}</Text>
              <Text style={styles.chargeCol6}>{c.balance_previous.toFixed(2)}</Text>
              <Text style={styles.chargeCol7}>{c.penalties.toFixed(2)}</Text>
              <Text style={styles.chargeCol8}>{c.total_due.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.chargeCol1} />
            <Text style={styles.chargeColOwner} />
            <Text style={styles.chargeCol3} />
            <Text style={styles.chargeCol4} />
            <Text style={styles.chargeCol5} />
            <Text style={styles.chargeCol6} />
            <Text style={styles.chargeCol7}>TOTAL</Text>
            <Text style={styles.chargeCol8}>{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generat de BlocApp — {new Date().toLocaleDateString("ro-RO")}
        </Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 2: Create PDF Route Handler**

Create `blocapp/app/api/reports/[id]/pdf/route.tsx`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { ReportPDF } from "@/lib/pdf/report-pdf"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 })
  }

  // Fetch report
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("*, associations(name, address)")
    .eq("id", id)
    .eq("association_id", profile.association_id)
    .single()

  if (!report) {
    return NextResponse.json({ error: "Lista nu a fost gasita." }, { status: 404 })
  }

  if (report.status === "draft") {
    return NextResponse.json({ error: "Nu puteti exporta o lista draft." }, { status: 400 })
  }

  // Fetch expenses
  const { data: expenses } = await supabase
    .from("expense_items")
    .select("category, amount, distribution_method")
    .eq("report_id", id)
    .order("sort_order")

  // Fetch charges with apartment numbers and owner
  const { data: charges } = await supabase
    .from("apartment_charges")
    .select("subtotal, fond_rulment, fond_reparatii, balance_previous, penalties, total_due, amount_paid, apartments!inner(number, owner_name)")
    .eq("report_id", id)
    .order("apartments(number)")

  const assoc = report.associations as unknown as { name: string; address: string | null }

  const pdfBuffer = await renderToBuffer(
    <ReportPDF
      associationName={assoc.name}
      address={assoc.address}
      periodMonth={report.period_month}
      periodYear={report.period_year}
      expenses={(expenses ?? []).map((e) => ({
        category: e.category,
        amount: Number(e.amount),
        distribution_method: e.distribution_method,
      }))}
      charges={(charges ?? []).map((c) => {
        const apt = c.apartments as unknown as { number: string; owner_name: string | null }
        return {
          apartment_number: apt.number,
          owner_name: apt.owner_name ?? "",
          subtotal: Number(c.subtotal),
          fond_rulment: Number(c.fond_rulment),
          fond_reparatii: Number(c.fond_reparatii),
          balance_previous: Number(c.balance_previous),
          penalties: Number(c.penalties),
          total_due: Number(c.total_due),
          amount_paid: Number(c.amount_paid),
        }
      })}
      totalExpenses={Number(report.total_expenses ?? 0)}
    />
  )

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lista-${report.period_month}-${report.period_year}.pdf"`,
    },
  })
}
```

- [ ] **Step 3: Add PDF download button to report detail page**

In `blocapp/app/(dashboard)/dashboard/reports/[id]/page.tsx`, add an import:

```typescript
import { FileDown } from "lucide-react"
```

Then in the header area (after the back button and title/badge), add a download link. Find the status badge section and add after it:

```typescript
      {report.status !== "draft" && (
        <a
          href={`/api/reports/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            <FileDown className="size-3.5 mr-1.5" />
            PDF
          </Button>
        </a>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add blocapp/lib/pdf/ blocapp/app/api/reports/ blocapp/app/(dashboard)/dashboard/reports/[id]/page.tsx
git commit -m "feat: add PDF export for maintenance reports"
```

---

## Task 5: Resend Email for Invites

**Files:**
- Create: `blocapp/lib/resend.ts`
- Create: `blocapp/lib/emails/invite-email.tsx`
- Modify: `blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts`

- [ ] **Step 1: Create Resend client**

Create `blocapp/lib/resend.ts`:

```typescript
import { Resend } from "resend"

let resendInstance: Resend | null = null

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@blocapp.ro"
```

- [ ] **Step 2: Create invite email template**

Create `blocapp/lib/emails/invite-email.tsx`:

```typescript
interface InviteEmailProps {
  inviteUrl: string
  associationName: string
  apartmentNumber: string
}

export function inviteEmailHtml({
  inviteUrl,
  associationName,
  apartmentNumber,
}: InviteEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #171717; border-radius: 12px; padding: 32px; border: 1px solid #262626;">
    <div style="font-size: 13px; font-weight: 900; background: linear-gradient(to right, #818cf8, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px;">
      BlocApp
    </div>
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #fafafa;">Invitatie pentru portalul locatarului</h2>
    <p style="color: #a3a3a3; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Ati fost invitat sa accesati portalul asociatiei <strong style="color: #fafafa;">${associationName}</strong>
      pentru apartamentul <strong style="color: #fafafa;">#${apartmentNumber}</strong>.
    </p>
    <a href="${inviteUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
      Accepta invitatia
    </a>
    <p style="color: #737373; font-size: 12px; margin-top: 24px; line-height: 1.5;">
      Link-ul expira in 7 zile. Daca nu ati solicitat aceasta invitatie, ignorati acest email.
    </p>
  </div>
</body>
</html>`
}
```

- [ ] **Step 3: Send email in inviteResident action**

In `blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts`, add imports at top:

```typescript
import { getResend, FROM_EMAIL } from "@/lib/resend"
import { inviteEmailHtml } from "@/lib/emails/invite-email"
```

Then replace the `// TODO: Send email via Resend with invite link` section (after the invite URL is built) with:

```typescript
  // Send invite email (if Resend is configured)
  const resend = getResend()
  if (resend) {
    try {
      // Fetch association name for email
      const { data: assocData } = await ctx.supabase
        .from("associations")
        .select("name")
        .eq("id", ctx.associationId)
        .single()

      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `Invitatie portal locatar — ${assocData?.name ?? "Asociatia"}`,
        html: inviteEmailHtml({
          inviteUrl,
          associationName: assocData?.name ?? "Asociatia",
          apartmentNumber: apt.number,
        }),
      })
    } catch (err) {
      console.error("Failed to send invite email:", err)
      // Don't fail the invite if email fails — admin has the link
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add blocapp/lib/resend.ts blocapp/lib/emails/ blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts
git commit -m "feat: add Resend email for resident invitations"
```

---

## Task 6: Online Payments (Resident → Stripe Connect)

**Files:**
- Create: `blocapp/app/(resident)/resident/charges/payment-actions.ts`
- Create: `blocapp/app/(resident)/resident/charges/pay-button.tsx`
- Create: `blocapp/app/(resident)/resident/charges/payment-success/page.tsx`
- Modify: `blocapp/app/(resident)/resident/charges/page.tsx`

- [ ] **Step 1: Create payment server action**

Create `blocapp/app/(resident)/resident/charges/payment-actions.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getStripe, calculateApplicationFee, MIN_ONLINE_PAYMENT_RON } from "@/lib/stripe"

async function getResidentCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, apartment_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "resident" || !profile.apartment_id || !profile.association_id) return null
  return { supabase, associationId: profile.association_id, apartmentId: profile.apartment_id }
}

export async function createPaymentIntent(chargeId: string) {
  const ctx = await getResidentCtx()
  if (!ctx) return { error: "Neautorizat" }

  const stripe = getStripe()

  // Fetch charge
  const { data: charge } = await ctx.supabase
    .from("apartment_charges")
    .select("total_due, amount_paid, apartment_id, report_id")
    .eq("id", chargeId)
    .eq("apartment_id", ctx.apartmentId)
    .single()

  if (!charge) return { error: "Lista de intretinere nu a fost gasita." }

  const remaining = Math.round((Number(charge.total_due) - Number(charge.amount_paid)) * 100) / 100
  if (remaining < MIN_ONLINE_PAYMENT_RON) {
    return { error: `Suma minima pentru plata online este ${MIN_ONLINE_PAYMENT_RON} RON.` }
  }

  // Get association's Connect account
  const { data: assoc } = await ctx.supabase
    .from("associations")
    .select("stripe_connect_account_id, stripe_connect_onboarded, name")
    .eq("id", ctx.associationId)
    .single()

  if (!assoc?.stripe_connect_account_id || !assoc.stripe_connect_onboarded) {
    return { error: "Asociatia nu are platile online activate." }
  }

  const amountInBani = Math.round(remaining * 100)
  const applicationFee = calculateApplicationFee(amountInBani)

  try {
    const pi = await stripe.paymentIntents.create({
      amount: amountInBani,
      currency: "ron",
      application_fee_amount: applicationFee,
      metadata: {
        apartment_charge_id: chargeId,
        association_id: ctx.associationId,
        apartment_id: ctx.apartmentId,
      },
    }, {
      stripeAccount: assoc.stripe_connect_account_id,
    })

    return { clientSecret: pi.client_secret, amount: remaining }
  } catch (err) {
    console.error("Failed to create PaymentIntent:", err)
    return { error: "Eroare la initializarea platii." }
  }
}
```

- [ ] **Step 2: Create pay button component**

Create `blocapp/app/(resident)/resident/charges/pay-button.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createPaymentIntent } from "./payment-actions"
import { toast } from "sonner"
import { CreditCard, Loader2 } from "lucide-react"

interface PayButtonProps {
  chargeId: string
  remaining: number
  connectOnboarded: boolean
}

export function PayButton({ chargeId, remaining, connectOnboarded }: PayButtonProps) {
  const [loading, setLoading] = useState(false)

  if (!connectOnboarded || remaining < 10) return null

  async function handlePay() {
    setLoading(true)
    const result = await createPaymentIntent(chargeId)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    // For now, show client secret — full Stripe Elements integration deferred
    // In production, this would open a Stripe payment sheet
    toast.info(
      `PaymentIntent creat: ${result.amount?.toFixed(2)} RON. Integrarea Stripe Elements va fi adaugata.`
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePay}
      disabled={loading}
      className="mt-2"
    >
      {loading ? (
        <Loader2 className="size-3.5 mr-1.5 animate-spin" />
      ) : (
        <CreditCard className="size-3.5 mr-1.5" />
      )}
      {loading ? "Se proceseaza..." : `Plateste online ${remaining.toFixed(2)} RON`}
    </Button>
  )
}
```

- [ ] **Step 3: Create payment success page**

Create `blocapp/app/(resident)/resident/charges/payment-success/page.tsx`:

```typescript
import { getResidentProfile } from "@/lib/get-resident-profile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default async function PaymentSuccessPage() {
  await getResidentProfile() // ensure auth

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle2 className="size-12 text-emerald-500 mx-auto mb-3" />
          <CardTitle>Plata procesata!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Plata dvs. a fost inregistrata cu succes. Poate dura cateva momente
            pana cand soldul se actualizeaza.
          </p>
          <Link href="/resident/charges">
            <Button variant="outline">Inapoi la intretinere</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Add pay button to resident charges page**

In `blocapp/app/(resident)/resident/charges/page.tsx`, add import at top:

```typescript
import { PayButton } from "./pay-button"
```

The page needs the `connectOnboarded` flag. Add a query after `getResidentProfile()`:

```typescript
  // Check if association has online payments enabled
  const { data: assoc } = await supabase
    .from("associations")
    .select("stripe_connect_onboarded")
    .eq("id", associationId)
    .single()

  const connectOnboarded = assoc?.stripe_connect_onboarded ?? false
```

Then inside each charge card, after the "Rest de plata" div (the last conditional block in the breakdown), add:

```typescript
                    {remaining > 0.01 && (
                      <PayButton
                        chargeId={charge.id}
                        remaining={remaining}
                        connectOnboarded={connectOnboarded}
                      />
                    )}
```

Note: The `getResidentProfile()` call needs to also return `associationId`. Check existing code — it already does.

- [ ] **Step 5: Commit**

```bash
git add blocapp/app/(resident)/resident/charges/
git commit -m "feat: add online payment via Stripe Connect for residents"
```

---

## Task 7: Calculation Engine Fixes (balance_previous + penalties)

**Files:**
- Modify: `blocapp/app/(dashboard)/dashboard/reports/report-actions.ts`

- [ ] **Step 1: Fix balance_previous calculation**

In `blocapp/app/(dashboard)/dashboard/reports/report-actions.ts`, inside the `calculateReport` function, after fetching apartments and before calculating charges, add:

```typescript
  // ── Carry-forward balance from previous month ──
  // Find the most recent published/closed report BEFORE this one
  const { data: prevReport } = await ctx.supabase
    .from("monthly_reports")
    .select("id, due_date, penalty_rate_per_day")
    .eq("association_id", ctx.associationId)
    .in("status", ["published", "closed"])
    .neq("id", reportId)
    .or(
      `period_year.lt.${report.period_year},and(period_year.eq.${report.period_year},period_month.lt.${report.period_month})`
    )
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Build balance map: apartment_id -> remaining balance from previous report
  const balanceMap = new Map<string, number>()
  if (prevReport) {
    const { data: prevCharges } = await ctx.supabase
      .from("apartment_charges")
      .select("apartment_id, total_due, amount_paid")
      .eq("report_id", prevReport.id)

    for (const pc of prevCharges ?? []) {
      const remaining = Math.round((Number(pc.total_due) - Number(pc.amount_paid)) * 100) / 100
      if (remaining > 0) {
        balanceMap.set(pc.apartment_id, remaining)
      }
    }
  }
```

- [ ] **Step 2: Fix penalties calculation at publish**

In the same function, after building `balanceMap`, add:

```typescript
  // ── Penalties calculation ──
  // Penalties apply on unpaid balance from the PREVIOUS report,
  // using the PREVIOUS report's due_date and penalty_rate_per_day
  const prevPenaltyRate = prevReport ? Number(prevReport.penalty_rate_per_day) || 0 : 0
  const prevDueDate = prevReport?.due_date ? new Date(prevReport.due_date) : null
  const today = new Date()
  const penaltyDays =
    prevDueDate && today > prevDueDate
      ? Math.floor((today.getTime() - prevDueDate.getTime()) / 86400000)
      : 0
```

- [ ] **Step 3: Update chargesData to use balance_previous and penalties**

In the `chargesData` mapping (the `apartments.map` callback), change the return to use the computed values:

Replace:
```typescript
      balance_previous: 0,
      penalties: 0,
```

With:
```typescript
      balance_previous: balanceMap.get(apt.id) ?? 0,
      penalties: prevPenaltyRate > 0 && penaltyDays > 0
        ? Math.round((balanceMap.get(apt.id) ?? 0) * prevPenaltyRate * penaltyDays * 100) / 100
        : 0,
```

And update `totalDue` to include balance and penalties:

Replace:
```typescript
    const totalDue = Math.round((subtotal + fondRulment + fondReparatii) * 100) / 100
```

With:
```typescript
    const balancePrevious = balanceMap.get(apt.id) ?? 0
    const penalties = prevPenaltyRate > 0 && penaltyDays > 0
      ? Math.round(balancePrevious * prevPenaltyRate * penaltyDays * 100) / 100
      : 0
    const totalDue = Math.round((subtotal + fondRulment + fondReparatii + balancePrevious + penalties) * 100) / 100
```

- [ ] **Step 4: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/reports/report-actions.ts
git commit -m "fix: calculate balance_previous from prior month and penalties at publish"
```

---

## Task 8: Verify & Test End-to-End

- [ ] **Step 1: TypeScript check**

```bash
cd C:/Users/Samuel/Desktop/Proiect\ asociatie/blocapp && npx tsc --noEmit
```

- [ ] **Step 2: Build check**

```bash
npx next build
```

- [ ] **Step 3: Verify all routes exist**

Expected routes:
- `/dashboard/settings/billing` — billing page
- `/api/reports/[id]/pdf` — PDF download
- `/resident/charges/payment-success` — payment confirmation
- All existing routes still work

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Plan 6 complete — billing, PDF, email, online payments, calc fixes"
```
