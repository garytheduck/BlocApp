export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = "super_admin" | "admin" | "resident"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled"
export type SubscriptionPlan = "starter" | "pro"
export type ReportStatus = "draft" | "collecting_meters" | "published" | "closed"
export type DistributionMethod = "per_cota" | "per_person" | "per_apartment" | "per_consumption"
export type ConsumptionType = "apa_rece" | "apa_calda" | "gaz"
export type MeterSubmittedBy = "resident" | "admin"
export type PaymentMethod = "online" | "cash" | "transfer"
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded"
export type ChargePaymentStatus = "unpaid" | "partial" | "paid"

export interface Database {
  public: {
    Tables: {
      associations: {
        Row: {
          id: string
          name: string
          address: string | null
          cui: string | null
          bank_account: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: SubscriptionStatus
          plan: SubscriptionPlan
          stripe_connect_account_id: string | null
          stripe_connect_onboarded: boolean
          trial_ends_at: string
          canceled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          cui?: string | null
          bank_account?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: SubscriptionStatus
          plan?: SubscriptionPlan
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean
          trial_ends_at?: string
          canceled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          cui?: string | null
          bank_account?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: SubscriptionStatus
          plan?: SubscriptionPlan
          stripe_connect_account_id?: string | null
          stripe_connect_onboarded?: boolean
          trial_ends_at?: string
          canceled_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          id: string
          association_id: string
          name: string
          address: string | null
          floors: number | null
          staircase_count: number | null
        }
        Insert: {
          id?: string
          association_id: string
          name: string
          address?: string | null
          floors?: number | null
          staircase_count?: number | null
        }
        Update: {
          id?: string
          association_id?: string
          name?: string
          address?: string | null
          floors?: number | null
          staircase_count?: number | null
        }
        Relationships: []
      }
      apartments: {
        Row: {
          id: string
          association_id: string
          building_id: string | null
          number: string
          floor: number | null
          staircase: string | null
          surface_m2: number | null
          cota_parte: number
          persons_count: number
          owner_name: string | null
          is_vacant: boolean
        }
        Insert: {
          id?: string
          association_id: string
          building_id?: string | null
          number: string
          floor?: number | null
          staircase?: string | null
          surface_m2?: number | null
          cota_parte?: number
          persons_count?: number
          owner_name?: string | null
          is_vacant?: boolean
        }
        Update: {
          id?: string
          association_id?: string
          building_id?: string | null
          number?: string
          floor?: number | null
          staircase?: string | null
          surface_m2?: number | null
          cota_parte?: number
          persons_count?: number
          owner_name?: string | null
          is_vacant?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          association_id: string | null
          apartment_id: string | null
          role: UserRole
          full_name: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id: string
          association_id?: string | null
          apartment_id?: string | null
          role?: UserRole
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          association_id?: string | null
          apartment_id?: string | null
          role?: UserRole
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      resident_invites: {
        Row: {
          id: string
          association_id: string
          apartment_id: string
          email: string
          token: string
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          association_id: string
          apartment_id: string
          email: string
          token: string
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          association_id?: string
          apartment_id?: string
          email?: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          id: string
          association_id: string
          period_month: number
          period_year: number
          status: ReportStatus
          total_expenses: number
          fond_rulment_pct: number
          fond_reparatii_pct: number
          penalty_rate_per_day: number
          meter_deadline: string | null
          due_date: string | null
          published_at: string | null
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          association_id: string
          period_month: number
          period_year: number
          status?: ReportStatus
          total_expenses?: number
          fond_rulment_pct?: number
          fond_reparatii_pct?: number
          penalty_rate_per_day?: number
          meter_deadline?: string | null
          due_date?: string | null
          published_at?: string | null
          closed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          association_id?: string
          period_month?: number
          period_year?: number
          status?: ReportStatus
          total_expenses?: number
          fond_rulment_pct?: number
          fond_reparatii_pct?: number
          penalty_rate_per_day?: number
          meter_deadline?: string | null
          due_date?: string | null
          published_at?: string | null
          closed_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      expense_items: {
        Row: {
          id: string
          report_id: string
          association_id: string
          category: string
          description: string | null
          amount: number
          distribution_method: DistributionMethod
          consumption_type: ConsumptionType | null
          sort_order: number
        }
        Insert: {
          id?: string
          report_id: string
          association_id: string
          category: string
          description?: string | null
          amount: number
          distribution_method: DistributionMethod
          consumption_type?: ConsumptionType | null
          sort_order?: number
        }
        Update: {
          id?: string
          report_id?: string
          association_id?: string
          category?: string
          description?: string | null
          amount?: number
          distribution_method?: DistributionMethod
          consumption_type?: ConsumptionType | null
          sort_order?: number
        }
        Relationships: []
      }
      meter_readings: {
        Row: {
          id: string
          association_id: string
          apartment_id: string
          report_id: string
          type: ConsumptionType
          index_previous: number
          index_current: number
          consumption: number
          submitted_by: MeterSubmittedBy
          is_estimate: boolean
          submitted_at: string
        }
        Insert: {
          id?: string
          association_id: string
          apartment_id: string
          report_id: string
          type: ConsumptionType
          index_previous: number
          index_current: number
          submitted_by?: MeterSubmittedBy
          is_estimate?: boolean
          submitted_at?: string
        }
        Update: {
          id?: string
          association_id?: string
          apartment_id?: string
          report_id?: string
          type?: ConsumptionType
          index_previous?: number
          index_current?: number
          submitted_by?: MeterSubmittedBy
          is_estimate?: boolean
          submitted_at?: string
        }
        Relationships: []
      }
      apartment_charges: {
        Row: {
          id: string
          association_id: string
          report_id: string
          apartment_id: string
          charges_breakdown: Json
          subtotal: number
          fond_rulment: number
          fond_reparatii: number
          balance_previous: number
          penalties: number
          penalties_waived: boolean
          total_due: number
          amount_paid: number
          payment_status: ChargePaymentStatus
          last_penalty_date: string | null
        }
        Insert: {
          id?: string
          association_id: string
          report_id: string
          apartment_id: string
          charges_breakdown?: Json
          subtotal?: number
          fond_rulment?: number
          fond_reparatii?: number
          balance_previous?: number
          penalties?: number
          penalties_waived?: boolean
          total_due?: number
          amount_paid?: number
          payment_status?: ChargePaymentStatus
          last_penalty_date?: string | null
        }
        Update: {
          id?: string
          association_id?: string
          report_id?: string
          apartment_id?: string
          charges_breakdown?: Json
          subtotal?: number
          fond_rulment?: number
          fond_reparatii?: number
          balance_previous?: number
          penalties?: number
          penalties_waived?: boolean
          total_due?: number
          amount_paid?: number
          payment_status?: ChargePaymentStatus
          last_penalty_date?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          association_id: string
          apartment_id: string
          apartment_charge_id: string
          amount: number
          method: PaymentMethod
          stripe_payment_intent_id: string | null
          stripe_application_fee: number | null
          stripe_event_id: string | null
          status: PaymentStatus
          paid_at: string | null
          recorded_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          association_id: string
          apartment_id: string
          apartment_charge_id: string
          amount: number
          method: PaymentMethod
          stripe_payment_intent_id?: string | null
          stripe_application_fee?: number | null
          stripe_event_id?: string | null
          status?: PaymentStatus
          paid_at?: string | null
          recorded_by?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          association_id?: string
          apartment_id?: string
          apartment_charge_id?: string
          amount?: number
          method?: PaymentMethod
          stripe_payment_intent_id?: string | null
          stripe_application_fee?: number | null
          stripe_event_id?: string | null
          status?: PaymentStatus
          paid_at?: string | null
          recorded_by?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          id: string
          association_id: string
          author_id: string | null
          title: string
          body: string
          is_pinned: boolean
          created_at: string
        }
        Insert: {
          id?: string
          association_id: string
          author_id?: string | null
          title: string
          body: string
          is_pinned?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          association_id?: string
          author_id?: string | null
          title?: string
          body?: string
          is_pinned?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      auth_association_id: {
        Args: Record<string, never>
        Returns: string
      }
      auth_user_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      subscription_status: SubscriptionStatus
      subscription_plan: SubscriptionPlan
      user_role: UserRole
      report_status: ReportStatus
      distribution_method: DistributionMethod
      consumption_type: ConsumptionType
      meter_submitted_by: MeterSubmittedBy
      payment_method: PaymentMethod
      payment_status: PaymentStatus
      charge_payment_status: ChargePaymentStatus
    }
  }
}
