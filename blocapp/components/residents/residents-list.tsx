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
import {
  revokeInvite,
  unlinkResident,
} from "@/app/(dashboard)/dashboard/residents/resident-actions"
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
    else {
      toast.success("Invitatie revocata.")
      setRevokeTarget(null)
    }
  }

  async function handleUnlink() {
    if (!unlinkTarget) return
    setLoading(true)
    const result = await unlinkResident(unlinkTarget.profileId)
    setLoading(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Locatar dezasociat.")
      setUnlinkTarget(null)
    }
  }

  const linked = rows.filter((r): r is LinkedResident => r.type === "linked")
  const pending = rows.filter((r): r is PendingInvite => r.type === "pending")

  return (
    <div className="space-y-6">
      {/* Linked residents */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          Locatari activi ({linked.length})
        </h3>
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
                    <TableCell className="font-medium">
                      Ap. {r.apartmentNumber}
                    </TableCell>
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
          <h3 className="text-sm font-medium mb-3">
            Invitatii in asteptare ({pending.length})
          </h3>
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
                      <TableCell className="font-medium">
                        Ap. {r.apartmentNumber}
                      </TableCell>
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
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocati invitatia?</AlertDialogTitle>
            <AlertDialogDescription>
              Invitatia pentru {revokeTarget?.email} (Ap.{" "}
              {revokeTarget?.apartmentNumber}) va fi anulata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuleaza</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={loading}
            >
              {loading ? "Se revoaca..." : "Revoca"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink dialog */}
      <AlertDialog
        open={!!unlinkTarget}
        onOpenChange={() => setUnlinkTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dezasociati locatarul?</AlertDialogTitle>
            <AlertDialogDescription>
              {unlinkTarget?.fullName ?? "Locatarul"} nu va mai avea acces la Ap.{" "}
              {unlinkTarget?.apartmentNumber}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuleaza</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={loading}
            >
              {loading ? "Se dezasociaza..." : "Dezasociaza"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
