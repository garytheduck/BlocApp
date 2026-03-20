"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError("Email sau parola incorecte.")
      setLoading(false)
      return
    }

    const token = data.session?.access_token
    if (token) {
      const claims = JSON.parse(atob(token.split(".")[1]))
      if (claims.user_role === "admin") {
        router.push("/dashboard")
      } else if (claims.user_role === "resident") {
        router.push("/resident")
      } else {
        router.push("/")
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intra in cont</CardTitle>
        <CardDescription>Foloseste emailul si parola asociatiei tale.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@asociatia.ro"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parola</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Se proceseaza..." : "Intra in cont"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nu ai cont?{" "}
          <Link href="/auth/register" className="text-primary hover:underline">
            Inregistreaza asociatia
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
