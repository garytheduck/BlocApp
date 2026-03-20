import { getResidentProfile } from "@/lib/get-resident-profile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default async function PaymentSuccessPage() {
  await getResidentProfile() // ensure auth

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle2 className="size-12 text-emerald-500 mx-auto mb-3" />
          <CardTitle>Plata procesata!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Plata dvs. a fost inregistrata cu succes. Poate dura cateva momente
            pana cand soldul se actualizeaza.
          </p>
          <Link href="/resident/charges">
            <Button variant="outline">Inapoi la intretinere</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
