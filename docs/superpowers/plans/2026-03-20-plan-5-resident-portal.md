# Plan 5 — Resident Portal & Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the resident-facing portal (view charges, announcements, submit meter readings) and the admin announcements CRUD + resident invitation system.

**Architecture:** Resident portal uses the existing `(resident)` route group with layout already in place. Admin invitation management lives at `/dashboard/residents`. Accept-invite flow at `/auth/accept-invite` uses a Route Handler with service-role client to create profiles. All resident pages are Server Components reading data via RLS (apartment_id scoping). Announcements are simple CRUD shared between admin and resident views.

**Tech Stack:** Next.js 16 App Router, Supabase (Auth + RLS), Server Actions, shadcn/ui v4 (base-ui, render prop — NOT asChild)

**Deferred:** Online payment via Stripe (PaymentIntent creation) — blocked until Stripe webhook is configured. Resend email sending — can be added later without changing the invite architecture.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `blocapp/lib/get-resident-profile.ts` | Resident auth helper (parallel to `get-profile.ts`) |
| `blocapp/app/(resident)/resident/page.tsx` | Resident dashboard — balance summary + recent announcements |
| `blocapp/app/(resident)/resident/charges/page.tsx` | View charges per published report |
| `blocapp/app/(resident)/resident/announcements/page.tsx` | Association announcements feed |
| `blocapp/app/(resident)/resident/meters/page.tsx` | Submit meter readings |
| `blocapp/app/(resident)/resident/meters/meter-actions.ts` | Server Actions for resident meter submission |
| `blocapp/app/(dashboard)/dashboard/announcements/page.tsx` | Admin announcements list |
| `blocapp/app/(dashboard)/dashboard/announcements/announcement-actions.ts` | Server Actions: create, update, delete announcements |
| `blocapp/components/announcements/announcements-list.tsx` | Client component: announcements table (admin) |
| `blocapp/components/announcements/announcement-dialog.tsx` | Create/edit announcement dialog |
| `blocapp/app/(dashboard)/dashboard/residents/page.tsx` | Admin resident management |
| `blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts` | Server Actions: invite, revoke |
| `blocapp/components/residents/residents-list.tsx` | Client component: residents + invites table |
| `blocapp/components/residents/invite-dialog.tsx` | Invite resident dialog |
| `blocapp/app/auth/accept-invite/page.tsx` | Accept invite flow (overwrite placeholder) |
| `blocapp/app/api/auth/accept-invite/route.ts` | Route Handler: validate token + create/link profile |

### Modified Files
| File | Change |
|------|--------|
| `blocapp/middleware.ts` | Allow `/auth/accept-invite` for logged-in users (don't redirect) |
| `blocapp/components/admin-nav.tsx` | Add "Locatari" nav item |

---

## Task 1: Resident Auth Helper

**Files:**
- Create: `blocapp/lib/get-resident-profile.ts`

- [ ] **Step 1: Create getResidentProfile helper**

Create `blocapp/lib/get-resident-profile.ts`:

```typescript
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function getResidentProfile() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, association_id, apartment_id, role, full_name")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "resident") redirect("/auth/login")
  if (!profile.association_id || !profile.apartment_id) redirect("/auth/login")

  return {
    user,
    profile,
    supabase,
    associationId: profile.association_id,
    apartmentId: profile.apartment_id,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add blocapp/lib/get-resident-profile.ts
git commit -m "feat: add resident auth helper"
```

---

## Task 2: Admin Announcements CRUD

**Files:**
- Create: `blocapp/app/(dashboard)/dashboard/announcements/announcement-actions.ts`
- Create: `blocapp/components/announcements/announcement-dialog.tsx`
- Create: `blocapp/components/announcements/announcements-list.tsx`
- Create: `blocapp/app/(dashboard)/dashboard/announcements/page.tsx`

- [ ] **Step 1: Create announcement server actions**

Create `blocapp/app/(dashboard)/dashboard/announcements/announcement-actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { getAdminCtx } from "@/lib/admin-ctx"

export async function createAnnouncement(formData: {
  title: string
  body: string
  is_pinned: boolean
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  if (!formData.title.trim()) return { error: "Titlul este obligatoriu." }
  if (!formData.body.trim()) return { error: "Continutul este obligatoriu." }

  const { error } = await ctx.supabase.from("announcements").insert({
    association_id: ctx.associationId,
    author_id: ctx.userId,
    title: formData.title.trim(),
    body: formData.body.trim(),
    is_pinned: formData.is_pinned,
  })

  if (error) return { error: error.message }

  revalidatePath("/dashboard/announcements")
  return { success: true }
}

export async function updateAnnouncement(
  id: string,
  formData: { title: string; body: string; is_pinned: boolean }
) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("announcements")
    .update({
      title: formData.title.trim(),
      body: formData.body.trim(),
      is_pinned: formData.is_pinned,
    })
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/announcements")
  return { success: true }
}

export async function deleteAnnouncement(id: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("association_id", ctx.associationId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/announcements")
  return { success: true }
}
```

- [ ] **Step 2: Create announcement dialog component**

Create `blocapp/components/announcements/announcement-dialog.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  createAnnouncement,
  updateAnnouncement,
} from "@/app/(dashboard)/dashboard/announcements/announcement-actions"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"
import type { Database } from "@/types/database"

type Announcement = Database["public"]["Tables"]["announcements"]["Row"]

interface AnnouncementDialogProps {
  mode: "create" | "edit"
  announcement?: Announcement
}

export function AnnouncementDialog({ mode, announcement }: AnnouncementDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: announcement?.title ?? "",
    body: announcement?.body ?? "",
    is_pinned: announcement?.is_pinned ?? false,
  })

  function resetForm() {
    setForm({
      title: announcement?.title ?? "",
      body: announcement?.body ?? "",
      is_pinned: announcement?.is_pinned ?? false,
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result =
      mode === "create"
        ? await createAnnouncement(form)
        : await updateAnnouncement(announcement!.id, form)

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(mode === "create" ? "Anunt creat." : "Anunt actualizat.")
      resetForm()
      setOpen(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) resetForm()
      }}
    >
      <DialogTrigger
        render={
          mode === "create" ? (
            <Button>
              <Plus className="size-4 mr-2" />
              Anunt nou
            </Button>
          ) : (
            <Button size="icon" variant="ghost" className="size-7">
              <Pencil className="size-3.5" />
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Anunt nou" : "Editeaza anunt"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ann-title">Titlu *</Label>
            <Input
              id="ann-title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Titlul anuntului"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-body">Continut *</Label>
            <Textarea
              id="ann-body"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              placeholder="Textul anuntului..."
              rows={5}
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ann-pinned"
              checked={form.is_pinned}
              onCheckedChange={(checked: boolean) =>
                setForm((p) => ({ ...p, is_pinned: checked }))
              }
            />
            <Label htmlFor="ann-pinned" className="text-sm">
              Fixeaza in partea de sus
            </Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuleaza
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "Se salveaza..."
                : mode === "create"
                  ? "Creeaza"
                  : "Salveaza"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create announcements list component**

Create `blocapp/components/announcements/announcements-list.tsx`:

```typescript
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { AnnouncementDialog } from "./announcement-dialog"
import { deleteAnnouncement } from "@/app/(dashboard)/dashboard/announcements/announcement-actions"
import { toast } from "sonner"
import { Pin, Trash2 } from "lucide-react"
import type { Database } from "@/types/database"

type Announcement = Database["public"]["Tables"]["announcements"]["Row"]

interface AnnouncementsListProps {
  announcements: Announcement[]
}

export function AnnouncementsList({ announcements }: AnnouncementsListProps) {
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteAnnouncement(deleteTarget.id)
    setDeleting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Anunt sters.")
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-lg">
          <p className="text-sm font-medium">Niciun anunt</p>
          <p className="text-xs text-muted-foreground mt-1">
            Creati primul anunt pentru locatari.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titlu</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-16">Fixat</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{a.title}</span>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {a.body}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("ro-RO")}
                  </TableCell>
                  <TableCell>
                    {a.is_pinned && (
                      <Badge variant="outline" className="gap-1">
                        <Pin className="size-3" />
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <AnnouncementDialog mode="edit" announcement={a} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stergeti anuntul?</AlertDialogTitle>
            <AlertDialogDescription>
              Sunteti sigur ca doriti sa stergeti anuntul &quot;{deleteTarget?.title}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuleaza</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Se sterge..." : "Sterge"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 4: Create admin announcements page**

Create `blocapp/app/(dashboard)/dashboard/announcements/page.tsx`:

```typescript
import { getAdminProfile } from "@/lib/get-profile"
import { AnnouncementsList } from "@/components/announcements/announcements-list"
import { AnnouncementDialog } from "@/components/announcements/announcement-dialog"

export default async function AnnouncementsPage() {
  const { supabase, associationId } = await getAdminProfile()

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .eq("association_id", associationId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anunturi</h1>
          <p className="text-sm text-muted-foreground">
            Comunicati cu locatarii asociatiei
          </p>
        </div>
        <AnnouncementDialog mode="create" />
      </div>

      <AnnouncementsList announcements={announcements ?? []} />
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/announcements/ blocapp/components/announcements/
git commit -m "feat: add admin announcements CRUD"
```

---

## Task 3: Admin Resident Management + Invite System

**Files:**
- Create: `blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts`
- Create: `blocapp/components/residents/invite-dialog.tsx`
- Create: `blocapp/components/residents/residents-list.tsx`
- Create: `blocapp/app/(dashboard)/dashboard/residents/page.tsx`
- Modify: `blocapp/components/admin-nav.tsx`

- [ ] **Step 1: Create resident management server actions**

Create `blocapp/app/(dashboard)/dashboard/residents/resident-actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { getAdminCtx } from "@/lib/admin-ctx"
import { randomBytes } from "crypto"

export async function inviteResident(formData: {
  apartment_id: string
  email: string
}) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const email = formData.email.trim().toLowerCase()
  if (!email) return { error: "Email-ul este obligatoriu." }

  // Verify apartment belongs to this association
  const { data: apt } = await ctx.supabase
    .from("apartments")
    .select("id, number")
    .eq("id", formData.apartment_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!apt) return { error: "Apartamentul nu a fost gasit." }

  // Check if apartment already has a linked resident
  const { data: existingProfile } = await ctx.supabase
    .from("profiles")
    .select("id, full_name")
    .eq("apartment_id", apt.id)
    .eq("role", "resident")
    .maybeSingle()

  if (existingProfile) {
    return { error: `Apartamentul #${apt.number} are deja un locatar asociat (${existingProfile.full_name ?? "anonim"}).` }
  }

  // Revoke any existing pending invites for this apartment
  await ctx.supabase
    .from("resident_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("apartment_id", apt.id)
    .eq("association_id", ctx.associationId)
    .is("accepted_at", null)
    .is("revoked_at", null)

  // Create new invite
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await ctx.supabase.from("resident_invites").insert({
    association_id: ctx.associationId,
    apartment_id: apt.id,
    email,
    token,
    expires_at: expiresAt,
    created_by: ctx.userId,
  })

  if (error) return { error: error.message }

  // TODO: Send email via Resend with invite link
  // For now, return the token so admin can share the link manually
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/accept-invite?token=${token}`

  revalidatePath("/dashboard/residents")
  return { success: true, inviteUrl }
}

export async function revokeInvite(inviteId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("resident_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("association_id", ctx.associationId)
    .is("accepted_at", null)
    .is("revoked_at", null)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/residents")
  return { success: true }
}

export async function unlinkResident(profileId: string) {
  const ctx = await getAdminCtx()
  if (!ctx) return { error: "Neautorizat" }

  const { error } = await ctx.supabase
    .from("profiles")
    .update({ apartment_id: null })
    .eq("id", profileId)
    .eq("association_id", ctx.associationId)
    .eq("role", "resident")

  if (error) return { error: error.message }

  revalidatePath("/dashboard/residents")
  return { success: true }
}
```

- [ ] **Step 2: Create invite dialog**

Create `blocapp/components/residents/invite-dialog.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { inviteResident } from "@/app/(dashboard)/dashboard/residents/resident-actions"
import { toast } from "sonner"
import { UserPlus, Copy } from "lucide-react"

interface InviteDialogProps {
  apartments: { id: string; number: string }[]
}

export function InviteDialog({ apartments }: InviteDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [form, setForm] = useState({ apartment_id: "", email: "" })

  function resetForm() {
    setForm({ apartment_id: "", email: "" })
    setInviteUrl(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.apartment_id) {
      toast.error("Selectati un apartament.")
      return
    }
    setLoading(true)
    const result = await inviteResident(form)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Invitatie trimisa!")
      if (result.inviteUrl) {
        setInviteUrl(result.inviteUrl)
      }
    }
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    toast.success("Link copiat in clipboard!")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) resetForm()
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4 mr-2" />
            Invita locatar
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invita locatar</DialogTitle>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invitatia a fost creata. Trimiteti acest link locatarului:
            </p>
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="text-xs font-mono" />
              <Button size="icon" variant="outline" onClick={copyLink}>
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Link-ul expira in 7 zile. Cand implementam Resend, locatarul va primi email automat.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => { resetForm(); setOpen(false) }}>
                Inchide
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inv-apt">Apartament *</Label>
              <Select
                value={form.apartment_id}
                onValueChange={(val: string | null) => {
                  if (val) setForm((p) => ({ ...p, apartment_id: val }))
                }}
              >
                <SelectTrigger id="inv-apt">
                  <SelectValue placeholder="Selecteaza apartament" />
                </SelectTrigger>
                <SelectContent>
                  {apartments.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      Ap. {a.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email locatar *</Label>
              <Input
                id="inv-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="locatar@exemplu.ro"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Anuleaza
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Se trimite..." : "Trimite invitatie"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Create residents list component**

Create `blocapp/components/residents/residents-list.tsx`:

```typescript
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { revokeInvite, unlinkResident } from "@/app/(dashboard)/dashboard/residents/resident-actions"
import { toast } from "sonner"
import { X, UserMinus } from "lucide-react"

interface LinkedResident {
  type: "linked"
  profileId: string
  fullName: string | null
  apartmentNumber: string
}

interface PendingInvite {
  type: "pending"
  inviteId: string
  email: string
  apartmentNumber: string
  expiresAt: string
}

export type ResidentRow = LinkedResident | PendingInvite

interface ResidentsListProps {
  rows: ResidentRow[]
}

export function ResidentsList({ rows }: ResidentsListProps) {
  const [revokeTarget, setRevokeTarget] = useState<PendingInvite | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedResident | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleRevoke() {
    if (!revokeTarget) return
    setLoading(true)
    const result = await revokeInvite(revokeTarget.inviteId)
    setLoading(false)
    if (result.error) toast.error(result.error)
    else { toast.success("Invitatie revocata."); setRevokeTarget(null) }
  }

  async function handleUnlink() {
    if (!unlinkTarget) return
    setLoading(true)
    const result = await unlinkResident(unlinkTarget.profileId)
    setLoading(false)
    if (result.error) toast.error(result.error)
    else { toast.success("Locatar dezasociat."); setUnlinkTarget(null) }
  }

  const linked = rows.filter((r): r is LinkedResident => r.type === "linked")
  const pending = rows.filter((r): r is PendingInvite => r.type === "pending")

  return (
    <div className="space-y-6">
      {/* Linked residents */}
      <div>
        <h3 className="text-sm font-medium mb-3">Locatari activi ({linked.length})</h3>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
            Niciun locatar asociat inca.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apartament</TableHead>
                  <TableHead>Nume</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linked.map((r) => (
                  <TableRow key={r.profileId}>
                    <TableCell className="font-medium">Ap. {r.apartmentNumber}</TableCell>
                    <TableCell>{r.fullName ?? "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setUnlinkTarget(r)}
                      >
                        <UserMinus className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Invitatii in asteptare ({pending.length})</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apartament</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r) => {
                  const expired = new Date(r.expiresAt) < new Date()
                  return (
                    <TableRow key={r.inviteId}>
                      <TableCell className="font-medium">Ap. {r.apartmentNumber}</TableCell>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell>
                        <Badge variant={expired ? "destructive" : "secondary"}>
                          {expired
                            ? "Expirata"
                            : new Date(r.expiresAt).toLocaleDateString("ro-RO")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!expired && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setRevokeTarget(r)}
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Revoke dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocati invitatia?</AlertDialogTitle>
            <AlertDialogDescription>
              Invitatia pentru {revokeTarget?.email} (Ap. {revokeTarget?.apartmentNumber}) va fi anulata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuleaza</AlertDialogCancel>
            <Button variant="destructive" onClick={handleRevoke} disabled={loading}>
              {loading ? "Se revoaca..." : "Revoca"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink dialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={() => setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dezasociati locatarul?</AlertDialogTitle>
            <AlertDialogDescription>
              {unlinkTarget?.fullName ?? "Locatarul"} nu va mai avea acces la Ap. {unlinkTarget?.apartmentNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuleaza</AlertDialogCancel>
            <Button variant="destructive" onClick={handleUnlink} disabled={loading}>
              {loading ? "Se dezasociaza..." : "Dezasociaza"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 4: Create admin residents page**

Create `blocapp/app/(dashboard)/dashboard/residents/page.tsx`:

```typescript
import { getAdminProfile } from "@/lib/get-profile"
import { ResidentsList } from "@/components/residents/residents-list"
import { InviteDialog } from "@/components/residents/invite-dialog"
import type { ResidentRow } from "@/components/residents/residents-list"

export default async function ResidentsPage() {
  const { supabase, associationId } = await getAdminProfile()

  // Fetch linked residents (profiles with apartment_id set)
  const { data: residents } = await supabase
    .from("profiles")
    .select("id, full_name, apartment_id, apartments!inner(number)")
    .eq("association_id", associationId)
    .eq("role", "resident")
    .not("apartment_id", "is", null)

  // Fetch pending invites
  const { data: invites } = await supabase
    .from("resident_invites")
    .select("id, email, apartment_id, expires_at, apartments!inner(number)")
    .eq("association_id", associationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })

  // Fetch apartments for invite dialog
  const { data: apartments } = await supabase
    .from("apartments")
    .select("id, number")
    .eq("association_id", associationId)
    .order("number")

  // Build rows
  const rows: ResidentRow[] = [
    ...(residents ?? []).map((r) => ({
      type: "linked" as const,
      profileId: r.id,
      fullName: r.full_name,
      apartmentNumber: (r.apartments as unknown as { number: string }).number,
    })),
    ...(invites ?? []).map((i) => ({
      type: "pending" as const,
      inviteId: i.id,
      email: i.email,
      apartmentNumber: (i.apartments as unknown as { number: string }).number,
      expiresAt: i.expires_at,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locatari</h1>
          <p className="text-sm text-muted-foreground">
            Gestionati accesul locatarilor la portal
          </p>
        </div>
        <InviteDialog apartments={apartments ?? []} />
      </div>

      <ResidentsList rows={rows} />
    </div>
  )
}
```

- [ ] **Step 5: Add Locatari to admin navigation**

In `blocapp/components/admin-nav.tsx`, add the nav item after Apartments:

```typescript
import { Users } from "lucide-react"
```

Then in NAV_ITEMS array, after the apartments entry:

```typescript
{ href: "/dashboard/residents", label: "Locatari", icon: Users },
```

- [ ] **Step 6: Commit**

```bash
git add blocapp/app/(dashboard)/dashboard/residents/ blocapp/components/residents/ blocapp/components/admin-nav.tsx
git commit -m "feat: add admin resident management with invite system"
```

---

## Task 4: Accept Invite Flow

**Files:**
- Create: `blocapp/app/api/auth/accept-invite/route.ts`
- Modify: `blocapp/app/auth/accept-invite/page.tsx` (overwrite placeholder)
- Modify: `blocapp/middleware.ts`

- [ ] **Step 1: Fix middleware to allow accept-invite for logged-in users**

In `blocapp/middleware.ts`, the current code (line 84) redirects logged-in users away from ALL auth routes, including accept-invite. Fix this by excluding accept-invite:

Change:
```typescript
if (AUTH_ROUTES.some(r => pathname.startsWith(r))) {
```
To:
```typescript
if (AUTH_ROUTES.some(r => pathname.startsWith(r)) && !pathname.startsWith("/auth/accept-invite")) {
```

- [ ] **Step 2: Create accept-invite Route Handler**

Create `blocapp/app/api/auth/accept-invite/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const { token, fullName, password } = await req.json()

  if (!token) {
    return NextResponse.json({ error: "Token lipsa." }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Validate invite token
  const { data: invite } = await supabase
    .from("resident_invites")
    .select("id, association_id, apartment_id, email, expires_at, accepted_at, revoked_at")
    .eq("token", token)
    .single()

  if (!invite) {
    return NextResponse.json({ error: "Invitatie invalida." }, { status: 400 })
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Aceasta invitatie a fost deja acceptata." }, { status: 400 })
  }

  if (invite.revoked_at) {
    return NextResponse.json({ error: "Aceasta invitatie a fost revocata." }, { status: 400 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Aceasta invitatie a expirat." }, { status: 400 })
  }

  // Check if a user with this email already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === invite.email.toLowerCase()
  )

  let userId: string

  if (existingUser) {
    // Existing user — link apartment to their profile
    userId = existingUser.id

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        apartment_id: invite.apartment_id,
        association_id: invite.association_id,
        role: "resident",
      })
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json({ error: "Eroare la asocierea apartamentului." }, { status: 500 })
    }
  } else {
    // New user — create account
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Parola trebuie sa aiba minim 8 caractere." }, { status: 400 })
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (signUpError || !signUpData.user) {
      return NextResponse.json(
        { error: signUpError?.message ?? "Eroare la crearea contului." },
        { status: 500 }
      )
    }

    userId = signUpData.user.id

    // Create profile
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      apartment_id: invite.apartment_id,
      association_id: invite.association_id,
      role: "resident",
      full_name: fullName || null,
    })

    if (profileError) {
      return NextResponse.json({ error: "Eroare la crearea profilului." }, { status: 500 })
    }
  }

  // Mark invite as accepted
  await supabase
    .from("resident_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)

  return NextResponse.json({
    success: true,
    isExisting: !!existingUser,
    email: invite.email,
  })
}
```

- [ ] **Step 3: Build accept-invite page**

Overwrite `blocapp/app/auth/accept-invite/page.tsx`:

```typescript
"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

type Status = "loading" | "needs_signup" | "needs_login" | "success" | "error"

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<Status>("loading")
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [form, setForm] = useState({ fullName: "", password: "" })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setError("Link de invitatie invalid — lipseste token-ul.")
      return
    }
    validateToken()
  }, [token])

  async function validateToken() {
    // Try accepting without password (for existing users)
    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()

    if (res.ok && data.success) {
      if (data.isExisting) {
        setEmail(data.email)
        setStatus("needs_login")
      } else {
        // Shouldn't happen — new users need password
        setStatus("success")
      }
    } else if (data.error === "Parola trebuie sa aiba minim 8 caractere.") {
      // New user — show signup form
      setStatus("needs_signup")
    } else {
      setStatus("error")
      setError(data.error ?? "Eroare necunoscuta.")
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch("/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        fullName: form.fullName,
        password: form.password,
      }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (res.ok && data.success) {
      // Auto-login the new user
      const supabase = createClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: form.password,
      })
      if (loginError) {
        setEmail(data.email)
        setStatus("needs_login")
      } else {
        setStatus("success")
        setTimeout(() => router.push("/resident"), 1500)
      }
    } else {
      setError(data.error ?? "Eroare la crearea contului.")
    }
  }

  async function handleLogin() {
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-sm font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-2">
            BlocApp
          </div>
          <CardTitle className="text-xl">Accepta invitatia</CardTitle>
          <CardDescription>
            Accesati portalul locatarului
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Se verifica invitatia...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <XCircle className="size-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={() => router.push("/auth/login")}>
                Inapoi la login
              </Button>
            </div>
          )}

          {status === "needs_signup" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Creati un cont pentru a accesa portalul locatarului.
              </p>
              <div className="space-y-2">
                <Label htmlFor="inv-name">Nume complet</Label>
                <Input
                  id="inv-name"
                  value={form.fullName}
                  onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Ion Popescu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-pass">Parola *</Label>
                <Input
                  id="inv-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Minim 8 caractere"
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Se creeaza contul..." : "Creeaza cont si acceseaza portalul"}
              </Button>
            </form>
          )}

          {status === "needs_login" && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Apartamentul a fost asociat contului dvs!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Conectati-va cu {email} pentru a accesa portalul.
                </p>
              </div>
              <Button onClick={handleLogin}>Conecteaza-te</Button>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-sm font-medium">Cont creat cu succes!</p>
              <p className="text-xs text-muted-foreground">Redirectionare catre portal...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add blocapp/app/api/auth/accept-invite/ blocapp/app/auth/accept-invite/page.tsx blocapp/middleware.ts
git commit -m "feat: add accept-invite flow with new user signup and existing user linking"
```

---

## Task 5: Resident Portal Pages

**Files:**
- Modify: `blocapp/app/(resident)/resident/page.tsx` (overwrite placeholder)
- Create: `blocapp/app/(resident)/resident/charges/page.tsx`
- Create: `blocapp/app/(resident)/resident/announcements/page.tsx`
- Create: `blocapp/app/(resident)/resident/meters/page.tsx`
- Create: `blocapp/app/(resident)/resident/meters/meter-actions.ts`

- [ ] **Step 1: Build resident dashboard**

Overwrite `blocapp/app/(resident)/resident/page.tsx`:

```typescript
import { getResidentProfile } from "@/lib/get-resident-profile"

const MONTH_NAMES = [
  "", "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
  "Iul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

export default async function ResidentDashboard() {
  const { supabase, associationId, apartmentId } = await getResidentProfile()

  // Fetch latest charges (from published/closed reports)
  const { data: charges } = await supabase
    .from("apartment_charges")
    .select("total_due, amount_paid, payment_status, monthly_reports!inner(period_month, period_year, status)")
    .eq("apartment_id", apartmentId)
    .in("monthly_reports.status", ["published", "closed"])
    .order("monthly_reports(period_year)", { ascending: false })
    .limit(6)

  // Calculate balance
  const totalDue = (charges ?? []).reduce((s, c) => s + Number(c.total_due), 0)
  const totalPaid = (charges ?? []).reduce((s, c) => s + Number(c.amount_paid), 0)
  const balance = totalDue - totalPaid

  // Fetch recent announcements
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_pinned, created_at")
    .eq("association_id", associationId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3)

  // Check for open meter collection
  const { data: meterReport } = await supabase
    .from("monthly_reports")
    .select("id, period_month, period_year, meter_deadline")
    .eq("association_id", associationId)
    .eq("status", "collecting_meters")
    .maybeSingle()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portal locatar</h1>

      {/* Balance card */}
      <div className="rounded-lg border bg-card p-5">
        <div className="text-sm text-muted-foreground">Sold restant</div>
        <div className={`text-3xl font-bold font-mono mt-1 ${balance > 0 ? "text-destructive" : "text-emerald-500"}`}>
          {balance.toFixed(2)} RON
        </div>
        {balance <= 0 && (
          <p className="text-xs text-emerald-500 mt-1">Totul este achitat!</p>
        )}
      </div>

      {/* Meter reading alert */}
      {meterReport && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-400">
            Trimiteti indicii contoarelor pentru {MONTH_NAMES[meterReport.period_month]} {meterReport.period_year}
          </p>
          {meterReport.meter_deadline && (
            <p className="text-xs text-muted-foreground mt-1">
              Termen: {new Date(meterReport.meter_deadline).toLocaleDateString("ro-RO")}
            </p>
          )}
        </div>
      )}

      {/* Recent charges */}
      {charges && charges.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3">Ultimele liste</h2>
          <div className="space-y-2">
            {charges.map((c, i) => {
              const report = c.monthly_reports as unknown as { period_month: number; period_year: number }
              const remaining = Number(c.total_due) - Number(c.amount_paid)
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm">
                    {MONTH_NAMES[report.period_month]} {report.period_year}
                  </span>
                  <div className="text-right">
                    <span className="font-mono text-sm font-medium">
                      {Number(c.total_due).toFixed(2)} RON
                    </span>
                    {remaining > 0.01 && (
                      <span className="text-xs text-destructive block">
                        rest: {remaining.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent announcements */}
      {announcements && announcements.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3">Anunturi recente</h2>
          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{a.title}</span>
                  {a.is_pinned && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Fixat</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(a.created_at).toLocaleDateString("ro-RO")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build resident charges page**

Create `blocapp/app/(resident)/resident/charges/page.tsx`:

```typescript
import { getResidentProfile } from "@/lib/get-resident-profile"
import { Badge } from "@/components/ui/badge"

const MONTH_NAMES = [
  "", "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  unpaid: { label: "Neplatit", variant: "destructive" },
  partial: { label: "Partial", variant: "secondary" },
  paid: { label: "Platit", variant: "default" },
}

type BreakdownItem = {
  category: string
  amount: number
}

export default async function ResidentChargesPage() {
  const { supabase, apartmentId } = await getResidentProfile()

  const { data: charges } = await supabase
    .from("apartment_charges")
    .select("*, monthly_reports!inner(period_month, period_year, status, due_date)")
    .eq("apartment_id", apartmentId)
    .in("monthly_reports.status", ["published", "closed"])
    .order("monthly_reports(period_year)", { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Detalii intretinere</h1>

      {(!charges || charges.length === 0) ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nu exista liste publicate inca.
        </p>
      ) : (
        <div className="space-y-4">
          {charges.map((charge) => {
            const report = charge.monthly_reports as unknown as {
              period_month: number
              period_year: number
              due_date: string | null
            }
            const breakdown = charge.charges_breakdown as BreakdownItem[]
            const remaining = Number(charge.total_due) - Number(charge.amount_paid)
            const statusInfo = STATUS_MAP[charge.payment_status]

            return (
              <div key={charge.id} className="rounded-lg border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-muted/30">
                  <div>
                    <span className="font-medium">
                      {MONTH_NAMES[report.period_month]} {report.period_year}
                    </span>
                    {report.due_date && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Scadenta: {new Date(report.due_date).toLocaleDateString("ro-RO")}
                      </span>
                    )}
                  </div>
                  <Badge variant={statusInfo?.variant ?? "secondary"}>
                    {statusInfo?.label ?? charge.payment_status}
                  </Badge>
                </div>

                {/* Breakdown */}
                <div className="p-4 space-y-1">
                  {breakdown?.map((b, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{b.category}</span>
                      <span className="font-mono">{Number(b.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 space-y-1">
                    {Number(charge.fond_rulment) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fond rulment</span>
                        <span className="font-mono">{Number(charge.fond_rulment).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(charge.fond_reparatii) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fond reparatii</span>
                        <span className="font-mono">{Number(charge.fond_reparatii).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(charge.penalties) > 0 && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Penalizari</span>
                        <span className="font-mono">{Number(charge.penalties).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span className="font-mono">{Number(charge.total_due).toFixed(2)} RON</span>
                    </div>
                    {Number(charge.amount_paid) > 0 && (
                      <div className="flex justify-between text-sm text-emerald-500 mt-1">
                        <span>Platit</span>
                        <span className="font-mono">-{Number(charge.amount_paid).toFixed(2)}</span>
                      </div>
                    )}
                    {remaining > 0.01 && (
                      <div className="flex justify-between text-sm font-medium text-destructive mt-1">
                        <span>Rest de plata</span>
                        <span className="font-mono">{remaining.toFixed(2)} RON</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Build resident announcements page**

Create `blocapp/app/(resident)/resident/announcements/page.tsx`:

```typescript
import { getResidentProfile } from "@/lib/get-resident-profile"

export default async function ResidentAnnouncementsPage() {
  const { supabase, associationId } = await getResidentProfile()

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_pinned, created_at")
    .eq("association_id", associationId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Anunturi</h1>

      {(!announcements || announcements.length === 0) ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Niciun anunt de la administratie.
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{a.title}</h3>
                {a.is_pinned && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                    Fixat
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                {a.body}
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                {new Date(a.created_at).toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build resident meter submission page**

Create `blocapp/app/(resident)/resident/meters/meter-actions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

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

export async function submitMeterReading(formData: {
  report_id: string
  type: string
  index_current: number
}) {
  const ctx = await getResidentCtx()
  if (!ctx) return { error: "Neautorizat" }

  // Verify report is in collecting_meters state
  const { data: report } = await ctx.supabase
    .from("monthly_reports")
    .select("id, status, meter_deadline")
    .eq("id", formData.report_id)
    .eq("association_id", ctx.associationId)
    .single()

  if (!report) return { error: "Lista nu a fost gasita." }
  if (report.status !== "collecting_meters") {
    return { error: "Colectarea indicilor nu este activa." }
  }

  if (report.meter_deadline && new Date(report.meter_deadline) < new Date()) {
    return { error: "Termenul de trimitere a indicilor a expirat." }
  }

  // Get previous reading for this meter type
  const { data: prevReading } = await ctx.supabase
    .from("meter_readings")
    .select("index_current")
    .eq("apartment_id", ctx.apartmentId)
    .eq("type", formData.type)
    .neq("report_id", formData.report_id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const indexPrevious = prevReading?.index_current ?? 0

  if (formData.index_current < indexPrevious) {
    return { error: `Indexul curent (${formData.index_current}) nu poate fi mai mic decat cel anterior (${indexPrevious}).` }
  }

  const consumption = formData.index_current - indexPrevious

  // Upsert meter reading
  const { error } = await ctx.supabase
    .from("meter_readings")
    .upsert(
      {
        association_id: ctx.associationId,
        apartment_id: ctx.apartmentId,
        report_id: formData.report_id,
        type: formData.type as "apa_rece" | "apa_calda" | "gaz",
        index_previous: indexPrevious,
        index_current: formData.index_current,
        consumption,
        submitted_by: "resident",
      },
      { onConflict: "report_id,apartment_id,type" }
    )

  if (error) return { error: error.message }

  revalidatePath("/resident/meters")
  return { success: true, consumption }
}
```

Create `blocapp/app/(resident)/resident/meters/page.tsx`:

```typescript
import { getResidentProfile } from "@/lib/get-resident-profile"
import { MeterForm } from "./meter-form"

const TYPE_LABELS: Record<string, string> = {
  apa_rece: "Apa rece",
  apa_calda: "Apa calda",
  gaz: "Gaz",
}

export default async function ResidentMetersPage() {
  const { supabase, associationId, apartmentId } = await getResidentProfile()

  // Find active collecting_meters report
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("id, period_month, period_year, meter_deadline, status")
    .eq("association_id", associationId)
    .eq("status", "collecting_meters")
    .maybeSingle()

  if (!report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Apometre</h1>
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nu exista o colectare de indici activa in acest moment.
        </p>
      </div>
    )
  }

  // Get required consumption types from expense items
  const { data: expenseItems } = await supabase
    .from("expense_items")
    .select("consumption_type")
    .eq("report_id", report.id)
    .eq("distribution_method", "per_consumption")
    .not("consumption_type", "is", null)

  const requiredTypes = [...new Set((expenseItems ?? []).map((e) => e.consumption_type!))]

  // Get existing readings for this report
  const { data: readings } = await supabase
    .from("meter_readings")
    .select("type, index_previous, index_current, consumption, submitted_at")
    .eq("report_id", report.id)
    .eq("apartment_id", apartmentId)

  const readingsMap = new Map((readings ?? []).map((r) => [r.type, r]))
  const deadlinePassed = report.meter_deadline
    ? new Date(report.meter_deadline) < new Date()
    : false

  // Get previous readings for each type
  const previousIndexes: Record<string, number> = {}
  for (const type of requiredTypes) {
    const existing = readingsMap.get(type)
    if (existing) {
      previousIndexes[type] = existing.index_previous
    } else {
      const { data: prev } = await supabase
        .from("meter_readings")
        .select("index_current")
        .eq("apartment_id", apartmentId)
        .eq("type", type)
        .neq("report_id", report.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      previousIndexes[type] = prev?.index_current ?? 0
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Apometre</h1>

      {report.meter_deadline && (
        <p className={`text-sm ${deadlinePassed ? "text-destructive" : "text-muted-foreground"}`}>
          {deadlinePassed
            ? "Termenul de trimitere a expirat."
            : `Termen: ${new Date(report.meter_deadline).toLocaleDateString("ro-RO")}`}
        </p>
      )}

      {requiredTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          Nu exista contoare necesare pentru aceasta perioada.
        </p>
      ) : (
        <div className="space-y-4">
          {requiredTypes.map((type) => {
            const existing = readingsMap.get(type)
            return (
              <MeterForm
                key={type}
                reportId={report.id}
                type={type}
                label={TYPE_LABELS[type] ?? type}
                previousIndex={previousIndexes[type] ?? 0}
                currentIndex={existing?.index_current ?? undefined}
                submitted={!!existing}
                disabled={deadlinePassed}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
```

Create `blocapp/app/(resident)/resident/meters/meter-form.tsx`:

```typescript
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
  type: string
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
          <Label className="text-xs text-muted-foreground">Index anterior</Label>
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
```

- [ ] **Step 5: Redirect /resident/payments to /resident/charges**

The resident nav has "Plati" linking to `/resident/payments`. For now, since online payments aren't implemented yet, redirect to charges. Create `blocapp/app/(resident)/resident/payments/page.tsx`:

```typescript
import { redirect } from "next/navigation"

export default function ResidentPaymentsRedirect() {
  redirect("/resident/charges")
}
```

- [ ] **Step 6: Commit**

```bash
git add blocapp/app/(resident)/resident/ blocapp/lib/get-resident-profile.ts
git commit -m "feat: add resident portal — dashboard, charges, announcements, meters"
```

---

## Task 6: Verify & Test End-to-End

- [ ] **Step 1: TypeScript check**

```bash
cd C:/Users/Samuel/Desktop/Proiect\ asociatie/blocapp && npx tsc --noEmit
```

- [ ] **Step 2: Start dev server and verify admin pages**

Navigate to:
- `http://localhost:3000/dashboard/announcements` — create an announcement
- `http://localhost:3000/dashboard/residents` — invite a resident (copy invite link)

- [ ] **Step 3: Test accept-invite flow**

Open invite link in incognito/different browser → should show signup form → create account → redirect to /resident.

- [ ] **Step 4: Test resident portal**

Login as resident → verify:
- Dashboard shows balance + recent charges + announcements
- `/resident/charges` shows charge breakdown
- `/resident/announcements` shows announcements list
- `/resident/meters` shows meter forms if a report is collecting meters

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Plan 5 complete — resident portal, announcements, invitations"
```
