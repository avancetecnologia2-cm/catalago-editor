import { buildEditorStateFilePath } from '@/lib/catalog-utils'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(
  _request: Request,
  context: RouteContext<'/api/editor-state/[pageId]'>
) {
  const { pageId } = await context.params
  const statePath = buildEditorStateFilePath(pageId)
  const { data, error } = await supabaseServer.storage.from('catalogos').download(statePath)

  if (error || !data) {
    return Response.json({ objects: [] }, { status: 404 })
  }

  const text = await data.text()

  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

export async function PUT(
  request: Request,
  context: RouteContext<'/api/editor-state/[pageId]'>
) {
  const { pageId } = await context.params
  const payload = await request.text()
  const statePath = buildEditorStateFilePath(pageId)

  const { error } = await supabaseServer.storage.from('catalogos').upload(statePath, payload, {
    upsert: true,
    contentType: 'application/json',
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
