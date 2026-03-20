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
              <Button
                variant="outline"
                onClick={() => {
                  resetForm()
                  setOpen(false)
                }}
              >
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
