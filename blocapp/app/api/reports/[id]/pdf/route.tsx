import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { ReportPDF } from "@/lib/pdf/report-pdf"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin" || !profile.association_id) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 })
  }

  // Fetch report
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("*, associations(name, address)")
    .eq("id", id)
    .eq("association_id", profile.association_id)
    .single()

  if (!report) {
    return NextResponse.json({ error: "Lista nu a fost gasita." }, { status: 404 })
  }

  if (report.status === "draft") {
    return NextResponse.json({ error: "Nu puteti exporta o lista draft." }, { status: 400 })
  }

  // Fetch expenses
  const { data: expenses } = await supabase
    .from("expense_items")
    .select("category, amount, distribution_method")
    .eq("report_id", id)
    .order("sort_order")

  // Fetch charges with apartment numbers and owner
  const { data: charges } = await supabase
    .from("apartment_charges")
    .select("subtotal, fond_rulment, fond_reparatii, balance_previous, penalties, total_due, amount_paid, apartments!inner(number, owner_name)")
    .eq("report_id", id)
    .order("apartments(number)")

  const assoc = report.associations as unknown as { name: string; address: string | null }

  const pdfBuffer = await renderToBuffer(
    <ReportPDF
      associationName={assoc.name}
      address={assoc.address}
      periodMonth={report.period_month}
      periodYear={report.period_year}
      expenses={(expenses ?? []).map((e) => ({
        category: e.category,
        amount: Number(e.amount),
        distribution_method: e.distribution_method,
      }))}
      charges={(charges ?? []).map((c) => {
        const apt = c.apartments as unknown as { number: string; owner_name: string | null }
        return {
          apartment_number: apt.number,
          owner_name: apt.owner_name ?? "",
          subtotal: Number(c.subtotal),
          fond_rulment: Number(c.fond_rulment),
          fond_reparatii: Number(c.fond_reparatii),
          balance_previous: Number(c.balance_previous),
          penalties: Number(c.penalties),
          total_due: Number(c.total_due),
          amount_paid: Number(c.amount_paid),
        }
      })}
      totalExpenses={Number(report.total_expenses ?? 0)}
    />
  )

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lista-${report.period_month}-${report.period_year}.pdf"`,
    },
  })
}
