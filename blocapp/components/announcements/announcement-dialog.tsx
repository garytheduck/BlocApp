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
