"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

type Status = "loading" | "needs_signup" | "needs_login" | "success" | "error"

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  )
}

function AcceptInviteContent() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <CardDescription>Accesati portalul locatarului</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Se verifica invitatia...
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <XCircle className="size-8 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                onClick={() => router.push("/auth/login")}
              >
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
                  onChange={(e) =>
                    setForm((p) => ({ ...p, fullName: e.target.value }))
                  }
                  placeholder="Ion Popescu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-pass">Parola *</Label>
                <Input
                  id="inv-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder="Minim 8 caractere"
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? "Se creeaza contul..."
                  : "Creeaza cont si acceseaza portalul"}
              </Button>
            </form>
          )}

          {status === "needs_login" && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">
                  Apartamentul a fost asociat contului dvs!
                </p>
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
              <p className="text-xs text-muted-foreground">
                Redirectionare catre portal...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
