import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/accept-invite"]
const PUBLIC_ROUTES = ["/", ...AUTH_ROUTES]
const ADMIN_PREFIX = "/dashboard"
const RESIDENT_PREFIX = "/resident"
const BILLING_PATH = "/dashboard/settings/billing"

const BILLING_ALLOWED_PATHS = [BILLING_PATH, "/auth/login"]

export async function middleware(request: NextRequest) {
  // Skip auth checks if Supabase is not configured yet
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Not logged in -> redirect to login (except public routes)
  if (!user && !PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"))) {
    if (pathname.startsWith(ADMIN_PREFIX) || pathname.startsWith(RESIDENT_PREFIX)) {
      return NextResponse.redirect(new URL("/auth/login", request.url))
    }
  }

  if (user) {
    const { data: { session } } = await supabase.auth.getSession()
    const claims = session?.access_token
      ? JSON.parse(atob(session.access_token.split(".")[1]))
      : {}
    const role = claims.user_role as string | undefined
    const subscriptionStatus = claims.subscription_status as string | undefined

    // Admin trying to access resident portal
    if (role === "admin" && pathname.startsWith(RESIDENT_PREFIX)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Resident trying to access admin dashboard
    if (role === "resident" && pathname.startsWith(ADMIN_PREFIX)) {
      return NextResponse.redirect(new URL("/resident", request.url))
    }

    // Subscription enforcement for admins
    if (role === "admin" && pathname.startsWith(ADMIN_PREFIX)) {
      if (
        subscriptionStatus === "canceled" &&
        !BILLING_ALLOWED_PATHS.some(p => pathname.startsWith(p))
      ) {
        return NextResponse.redirect(new URL(BILLING_PATH, request.url))
      }
      if (
        subscriptionStatus === "past_due" &&
        !BILLING_ALLOWED_PATHS.some(p => pathname.startsWith(p))
      ) {
        supabaseResponse.headers.set("x-subscription-warning", "past_due")
      }
    }

    // Logged in user hitting auth pages -> redirect to their home
    // Exception: accept-invite should be accessible to logged-in users
    if (AUTH_ROUTES.some(r => pathname.startsWith(r)) && !pathname.startsWith("/auth/accept-invite")) {
      if (role === "admin") return NextResponse.redirect(new URL("/dashboard", request.url))
      if (role === "resident") return NextResponse.redirect(new URL("/resident", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
