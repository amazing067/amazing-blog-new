export interface BlogPost {
  id: string
  user_id: string
  topic: string
  keywords: string | null
  product: string | null
  tone: string | null
  template: string | null
  html_content: string
  plain_text: string | null
  title: string | null
  word_count: number | null
  status: 'draft' | 'published' | 'archived'
  published_to: string[] | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface BlogFormData {
  topic: string
  keywords: string
  product: string
  tone: string
  template: string
}

