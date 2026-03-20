"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    associationName: "",
    associationAddress: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // 1. Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    })

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? "Eroare la inregistrare.")
      setLoading(false)
      return
    }

    // 2. Create association via API route (needs service role to set profile role)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: authData.user.id,
        fullName: form.fullName,
        associationName: form.associationName,
        associationAddress: form.associationAddress,
      }),
    })

    if (!res.ok) {
      const { message } = await res.json()
      setError(message ?? "Eroare la crearea asociatiei.")
      setLoading(false)
      return
    }

    // 3. Refresh session to get updated JWT claims
    await supabase.auth.refreshSession()
    router.push("/dashboard")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inregistreaza asociatia</CardTitle>
        <CardDescription>14 zile gratuit, fara card bancar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Numele tau</Label>
            <Input id="fullName" value={form.fullName} onChange={update("fullName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={update("email")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parola</Label>
            <Input id="password" type="password" value={form.password} onChange={update("password")} minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assocName">Numele asociatiei</Label>
            <Input id="assocName" placeholder="Asociatia de Proprietari Bloc 12" value={form.associationName} onChange={update("associationName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assocAddress">Adresa</Label>
            <Input id="assocAddress" placeholder="Str. Exemplu nr. 12, Bucuresti" value={form.associationAddress} onChange={update("associationAddress")} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Se proceseaza..." : "Creaza contul"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Ai deja cont?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Intra in cont
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
