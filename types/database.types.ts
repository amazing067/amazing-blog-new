export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string
          email: string
          phone: string
          is_approved: boolean
          role: string
          created_at: string
          membership_status: 'active' | 'pending' | 'suspended' | 'deleted' | null
          paid_until: string | null
          suspended_at: string | null
          deleted_at: string | null
          last_payment_at: string | null
          grace_period_until: string | null
          payment_note: string | null
        }
        Insert: {
          id: string
          username: string
          full_name: string
          email: string
          phone: string
          is_approved?: boolean
          role?: string
          created_at?: string
          membership_status?: 'active' | 'pending' | 'suspended' | 'deleted' | null
          paid_until?: string | null
          suspended_at?: string | null
          deleted_at?: string | null
          last_payment_at?: string | null
          grace_period_until?: string | null
          payment_note?: string | null
        }
        Update: {
          id?: string
          username?: string
          full_name?: string
          email?: string
          phone?: string
          is_approved?: boolean
          role?: string
          created_at?: string
          membership_status?: 'active' | 'pending' | 'suspended' | 'deleted' | null
          paid_until?: string | null
          suspended_at?: string | null
          deleted_at?: string | null
          last_payment_at?: string | null
          grace_period_until?: string | null
          payment_note?: string | null
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']

