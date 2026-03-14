import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

    let adminClient: ReturnType<typeof createAdminClient> | null = null
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/[\r\n\t]/g, '').replace(/\s+/g, '')
      if (key.length >= 50 && key.startsWith('eyJ')) {
        adminClient = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key) as ReturnType<typeof createAdminClient>
      }
    }
    const client = adminClient || supabase

    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    if (!sessionId) {
      const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') || '7', 10)))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)))
      const since = new Date()
      since.setDate(since.getDate() - days)

      const { data: rows, error } = await client
        .from('usage_logs')
        .select('id, user_id, type, total_tokens, prompt_tokens, completion_tokens, meta, created_at')
        .eq('type', 'qa')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const userIds = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))]
      const { data: profiles } = await client.from('profiles').select('id, username, full_name').in('id', userIds)
      const profileMap = new Map((profiles || []).map(p => [p.id, p]))

      const sessions = (rows || []).map(r => {
        const p = profileMap.get(r.user_id)
        const meta = r.meta as any
        return {
          id: r.id,
          created_at: r.created_at,
          username: p?.username ?? '-',
          full_name: p?.full_name ?? '-',
          questionTitle: meta?.questionTitle ?? null,
          totalScore: meta?.qualityGate?.totalScore ?? null,
          failureTags: Array.isArray(meta?.failureTags) ? meta.failureTags : [],
          latencyMs: meta?.latencyMs ?? null,
          isDesignSheetMode: meta?.isDesignSheetMode ?? false,
          productName: meta?.productName ?? null,
        }
      })

      return NextResponse.json({ success: true, sessions })
    }

    // Single session detail
    const { data: row, error } = await client
      .from('usage_logs')
      .select('id, user_id, type, total_tokens, prompt_tokens, completion_tokens, meta, created_at')
      .eq('id', sessionId)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 })
    }

    const { data: sessionProfile } = await client
      .from('profiles')
      .select('id, username, full_name')
      .eq('id', row.user_id)
      .single()

    return NextResponse.json({
      success: true,
      session: {
        id: row.id,
        created_at: row.created_at,
        user: {
          id: row.user_id,
          username: sessionProfile?.username ?? '-',
          full_name: sessionProfile?.full_name ?? '-',
        },
        type: row.type,
        total_tokens: row.total_tokens,
        prompt_tokens: row.prompt_tokens,
        completion_tokens: row.completion_tokens,
        meta: row.meta,
      },
    })
  } catch (err: unknown) {
    console.error('[admin/quality-sessions] 오류:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '서버 오류' }, { status: 500 })
  }
}
