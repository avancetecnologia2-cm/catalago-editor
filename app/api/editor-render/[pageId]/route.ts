import { buildEditorRenderFilePath } from '@/lib/catalog-utils'
import { supabaseServer } from '@/lib/supabase-server'

export async function PUT(
  request: Request,
  context: RouteContext<'/api/editor-render/[pageId]'>
) {
  const { pageId } = await context.params
  const imageBuffer = await request.arrayBuffer()
  const renderPath = buildEditorRenderFilePath(pageId)
  const renderBlob = new Blob([imageBuffer], {
    type: 'image/png',
  })

  const { error } = await supabaseServer.storage.from('catalogos').upload(renderPath, renderBlob, {
    upsert: true,
    contentType: 'image/png',
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
