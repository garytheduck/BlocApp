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
