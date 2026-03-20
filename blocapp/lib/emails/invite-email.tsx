interface InviteEmailProps {
  inviteUrl: string
  associationName: string
  apartmentNumber: string
}

export function inviteEmailHtml({
  inviteUrl,
  associationName,
  apartmentNumber,
}: InviteEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #171717; border-radius: 12px; padding: 32px; border: 1px solid #262626;">
    <div style="font-size: 13px; font-weight: 900; background: linear-gradient(to right, #818cf8, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 24px;">
      BlocApp
    </div>
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #fafafa;">Invitatie pentru portalul locatarului</h2>
    <p style="color: #a3a3a3; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      Ati fost invitat sa accesati portalul asociatiei <strong style="color: #fafafa;">${associationName}</strong>
      pentru apartamentul <strong style="color: #fafafa;">#${apartmentNumber}</strong>.
    </p>
    <a href="${inviteUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
      Accepta invitatia
    </a>
    <p style="color: #737373; font-size: 12px; margin-top: 24px; line-height: 1.5;">
      Link-ul expira in 7 zile. Daca nu ati solicitat aceasta invitatie, ignorati acest email.
    </p>
  </div>
</body>
</html>`
}
