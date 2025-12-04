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
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']

