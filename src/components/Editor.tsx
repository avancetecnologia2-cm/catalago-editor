'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Canvas as FabricCanvas,
  TPointerEvent,
  TPointerEventInfo,
} from 'fabric'
import { supabase } from '@/lib/supabase'
import { extractPricePayload } from '@/lib/catalog-utils'

interface EditorProps {
  params: {
    id: string
  }
}

interface PageRecord {
  image_url: string
}

interface PriceRecord {
  id: string
  text: string
  x: number
  y: number
}

export default function Editor({ params }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const addPrice = useCallback(async () => {
    if (!fabricRef.current) return

    const { Textbox } = await import('fabric')
    const canvas = fabricRef.current
    const text = new Textbox('R$ 0,00', {
      left: 40,
      top: 40,
      width: 180,
      fill: '#dc2626',
      fontSize: 20,
    })

    canvas.add(text)
    canvas.setActiveObject(text)
    canvas.requestRenderAll()
  }, [])

  const removeSelected = useCallback(() => {
    if (!fabricRef.current) return

    const canvas = fabricRef.current
    const activeObject = canvas.getActiveObject()
    if (!activeObject) return

    canvas.remove(activeObject)
    canvas.requestRenderAll()
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return

    let isActive = true

    const setupEditor = async () => {
      setLoading(true)

      const [{ Canvas, FabricImage, Textbox }, pageResponse, pricesResponse] = await Promise.all([
        import('fabric'),
        supabase.from('pages').select('image_url').eq('id', params.id).single<PageRecord>(),
        supabase.from('prices').select('id, text, x, y').eq('page_id', params.id),
      ])

      if (!isActive || !canvasRef.current) {
        return
      }

      if (pageResponse.error) {
        alert('Erro ao carregar pagina: ' + pageResponse.error.message)
        setLoading(false)
        return
      }

      if (pricesResponse.error) {
        alert('Erro ao carregar precos: ' + pricesResponse.error.message)
        setLoading(false)
        return
      }

      const canvas = new Canvas(canvasRef.current, {
        width: 800,
        height: 1000,
        backgroundColor: '#f3f4f6',
      })

      fabricRef.current = canvas

      const pageData = pageResponse.data
      if (pageData?.image_url) {
        const backgroundImage = await FabricImage.fromURL(pageData.image_url, {
          crossOrigin: 'anonymous',
        })

        if (!isActive) {
          canvas.dispose()
          return
        }

        const imageWidth = backgroundImage.width || 800
        const imageHeight = backgroundImage.height || 1000

        canvas.setDimensions({ width: imageWidth, height: imageHeight })
        backgroundImage.set({
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        })
        canvas.backgroundImage = backgroundImage
      }

      for (const price of (pricesResponse.data || []) as PriceRecord[]) {
        const text = new Textbox(price.text, {
          left: price.x,
          top: price.y,
          width: 180,
          fill: '#dc2626',
          fontSize: 20,
        })

        canvas.add(text)
      }

      canvas.on('mouse:dblclick', (event: TPointerEventInfo<TPointerEvent>) => {
        const pointer = canvas.getScenePoint(event.e)
        const text = new Textbox('R$ 0,00', {
          left: pointer.x,
          top: pointer.y,
          width: 180,
          fill: '#dc2626',
          fontSize: 20,
        })

        canvas.add(text)
        canvas.setActiveObject(text)
        canvas.requestRenderAll()
      })

      canvas.requestRenderAll()
      setLoading(false)
    }

    void setupEditor()

    return () => {
      isActive = false
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [params.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        removeSelected()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [removeSelected])

  const savePrices = useCallback(async () => {
    if (!fabricRef.current) return

    setSaving(true)

    const payload = extractPricePayload(params.id, fabricRef.current.getObjects())

    const { error: deleteError } = await supabase.from('prices').delete().eq('page_id', params.id)
    if (deleteError) {
      setSaving(false)
      alert('Erro ao limpar precos: ' + deleteError.message)
      return
    }

    if (payload.length > 0) {
      const { error: insertError } = await supabase.from('prices').insert(payload)
      if (insertError) {
        setSaving(false)
        alert('Erro ao salvar precos: ' + insertError.message)
        return
      }
    }

    setSaving(false)
    alert('Precos salvos!')
  }, [params.id])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => void addPrice()}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Adicionar preco
        </button>
        <button
          onClick={removeSelected}
          disabled={loading}
          className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded hover:bg-zinc-300 disabled:opacity-50"
        >
          Remover selecionado
        </button>
        <button
          onClick={() => void savePrices()}
          disabled={loading || saving}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar precos'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Dica: use duplo clique para criar um preco novo e Delete/Backspace para remover o item
        selecionado.
      </p>

      {loading && <p className="text-sm text-gray-500">Carregando pagina...</p>}

      <div className="overflow-auto border rounded bg-white p-2">
        <canvas ref={canvasRef} className="border rounded shadow-sm" />
      </div>
    </div>
  )
}
