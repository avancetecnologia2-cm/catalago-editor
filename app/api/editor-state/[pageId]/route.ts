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

  const payload = (await data.json().catch(async () => JSON.parse(await data.text()))) as unknown

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function PUT(
  request: Request,
  context: RouteContext<'/api/editor-state/[pageId]'>
) {
  const { pageId } = await context.params
  const payload = await request.json()
  const statePath = buildEditorStateFilePath(pageId)
  const stateBlob = new Blob([JSON.stringify(payload)], {
    type: 'application/json',
  })

  const { error } = await supabaseServer.storage.from('catalogos').upload(statePath, stateBlob, {
    upsert: true,
    contentType: 'application/json',
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
