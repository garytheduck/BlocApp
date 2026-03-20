"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { updateAssociation } from "@/app/(dashboard)/dashboard/settings/actions"
import { toast } from "sonner"
import type { Database } from "@/types/database"

type Association = Database["public"]["Tables"]["associations"]["Row"]

interface AssociationFormProps {
  association: Association
}

export function AssociationForm({ association }: AssociationFormProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: association.name,
    address: association.address ?? "",
    cui: association.cui ?? "",
    bank_account: association.bank_account ?? "",
  })

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const result = await updateAssociation({
      name: form.name,
      address: form.address || null,
      cui: form.cui || null,
      bank_account: form.bank_account || null,
    })

    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Setarile au fost salvate.")
    }
  }

  const subscriptionLabel: Record<string, string> = {
    trialing: "Perioada de proba",
    active: "Activ",
    past_due: "Restant",
    canceled: "Anulat",
  }

  const subscriptionVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    trialing: "outline",
    active: "default",
    past_due: "destructive",
    canceled: "destructive",
  }

  const trialDaysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(association.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  )

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalii asociatie</CardTitle>
            <CardDescription>Informatii generale despre asociatia de proprietari</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Numele asociatiei *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={update("name")}
                  required
                  placeholder="Asociatia de Proprietari Bloc 12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cui">CUI / CIF</Label>
                <Input
                  id="cui"
                  value={form.cui}
                  onChange={update("cui")}
                  placeholder="RO12345678"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresa</Label>
              <Input
                id="address"
                value={form.address}
                onChange={update("address")}
                placeholder="Str. Exemplu nr. 12, Bucuresti"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account">Cont bancar (IBAN)</Label>
              <Input
                id="bank_account"
                value={form.bank_account}
                onChange={update("bank_account")}
                placeholder="RO49AAAA1B31007593840000"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Se salveaza..." : "Salveaza modificarile"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Abonament</CardTitle>
          <CardDescription>Informatii despre planul curent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Plan: </span>
              <span className="font-medium capitalize">{association.plan}</span>
            </div>
            <Badge variant={subscriptionVariant[association.subscription_status]}>
              {subscriptionLabel[association.subscription_status]}
            </Badge>
            {association.subscription_status === "trialing" && (
              <span className="text-sm text-muted-foreground">
                {trialDaysLeft} zile ramase
              </span>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
