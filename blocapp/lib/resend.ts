import { Resend } from "resend"

let resendInstance: Resend | null = null

export function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@blocapp.ro"
