'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Canvas as FabricCanvas,
  FabricObject,
  TPointerEvent,
  TPointerEventInfo,
} from 'fabric'
import { supabase } from '@/lib/supabase'
import {
  extractPricePayload,
} from '@/lib/catalog-utils'

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

interface StoredCanvasState {
  objects?: unknown[]
}

const DEFAULT_TEXT_COLOR = '#dc2626'
const DEFAULT_SHAPE_COLOR = '#2563eb'
const DEFAULT_FONT_SIZE = 20

function clampFontSize(value: number) {
  return Math.min(Math.max(value, 10), 96)
}

export default function Editor({ params }: EditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [fillColor, setFillColor] = useState(DEFAULT_TEXT_COLOR)
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE)
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal')

  const syncSelectionState = useCallback(() => {
    const canvas = fabricRef.current
    const activeObject = canvas?.getActiveObject()

    if (!activeObject) {
      setSelectedType(null)
      setFillColor(DEFAULT_TEXT_COLOR)
      setFontSize(DEFAULT_FONT_SIZE)
      setFontWeight('normal')
      return
    }

    setSelectedType(activeObject.type || 'objeto')

    const currentFill =
      typeof activeObject.get('fill') === 'string'
        ? (activeObject.get('fill') as string)
        : activeObject.type === 'line' && typeof activeObject.get('stroke') === 'string'
          ? (activeObject.get('stroke') as string)
          : activeObject.type === 'textbox'
            ? DEFAULT_TEXT_COLOR
            : DEFAULT_SHAPE_COLOR

    setFillColor(currentFill)

    if (activeObject.type === 'textbox') {
      const currentFontSize = activeObject.get('fontSize')
      const currentFontWeight = activeObject.get('fontWeight')
      setFontSize(typeof currentFontSize === 'number' ? currentFontSize : DEFAULT_FONT_SIZE)
      setFontWeight(currentFontWeight === 'bold' ? 'bold' : 'normal')
      return
    }

    setFontSize(DEFAULT_FONT_SIZE)
    setFontWeight('normal')
  }, [])

  const attachCanvasListeners = useCallback(
    (canvas: FabricCanvas) => {
      canvas.on('selection:created', syncSelectionState)
      canvas.on('selection:updated', syncSelectionState)
      canvas.on('selection:cleared', syncSelectionState)
      canvas.on('object:modified', syncSelectionState)
      canvas.on('object:added', syncSelectionState)
      canvas.on('object:removed', syncSelectionState)
    },
    [syncSelectionState]
  )

  const addTextbox = useCallback(
    async (text: string, options?: { left?: number; top?: number }) => {
      if (!fabricRef.current) return

      const { Textbox } = await import('fabric')
      const canvas = fabricRef.current
      const textbox = new Textbox(text, {
        left: options?.left ?? 40,
        top: options?.top ?? 40,
        width: 180,
        fill: DEFAULT_TEXT_COLOR,
        fontSize: DEFAULT_FONT_SIZE,
        fontWeight: 'normal',
      })

      canvas.add(textbox)
      canvas.setActiveObject(textbox)
      canvas.requestRenderAll()
      syncSelectionState()
    },
    [syncSelectionState]
  )

  const addPrice = useCallback(async () => {
    await addTextbox('R$ 0,00')
  }, [addTextbox])

  const addText = useCallback(async () => {
    await addTextbox('Novo texto')
  }, [addTextbox])

  const addRectangle = useCallback(async () => {
    if (!fabricRef.current) return

    const { Rect } = await import('fabric')
    const rectangle = new Rect({
      left: 80,
      top: 80,
      width: 180,
      height: 90,
      fill: DEFAULT_SHAPE_COLOR,
      rx: 8,
      ry: 8,
    })

    fabricRef.current.add(rectangle)
    fabricRef.current.setActiveObject(rectangle)
    fabricRef.current.requestRenderAll()
    syncSelectionState()
  }, [syncSelectionState])

  const addCircle = useCallback(async () => {
    if (!fabricRef.current) return

    const { Circle } = await import('fabric')
    const circle = new Circle({
      left: 120,
      top: 120,
      radius: 50,
      fill: DEFAULT_SHAPE_COLOR,
    })

    fabricRef.current.add(circle)
    fabricRef.current.setActiveObject(circle)
    fabricRef.current.requestRenderAll()
    syncSelectionState()
  }, [syncSelectionState])

  const addLine = useCallback(async () => {
    if (!fabricRef.current) return

    const { Line } = await import('fabric')
    const line = new Line([80, 80, 260, 80], {
      stroke: DEFAULT_SHAPE_COLOR,
      strokeWidth: 4,
      fill: DEFAULT_SHAPE_COLOR,
    })

    fabricRef.current.add(line)
    fabricRef.current.setActiveObject(line)
    fabricRef.current.requestRenderAll()
    syncSelectionState()
  }, [syncSelectionState])

  const removeSelected = useCallback(() => {
    if (!fabricRef.current) return

    const canvas = fabricRef.current
    const activeObject = canvas.getActiveObject()
    if (!activeObject) return

    canvas.remove(activeObject)
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    syncSelectionState()
  }, [syncSelectionState])

  const duplicateSelected = useCallback(async () => {
    const canvas = fabricRef.current
    const activeObject = canvas?.getActiveObject()

    if (!canvas || !activeObject) return

    const clonedObject = await activeObject.clone()
    clonedObject.set({
      left: (activeObject.left || 0) + 24,
      top: (activeObject.top || 0) + 24,
    })

    canvas.add(clonedObject)
    canvas.setActiveObject(clonedObject)
    canvas.requestRenderAll()
    syncSelectionState()
  }, [syncSelectionState])

  const updateSelectedObject = useCallback(
    (updater: (activeObject: FabricObject) => void) => {
      const canvas = fabricRef.current
      const activeObject = canvas?.getActiveObject()

      if (!canvas || !activeObject) {
        return
      }

      updater(activeObject)
      activeObject.setCoords()
      canvas.requestRenderAll()
      syncSelectionState()
    },
    [syncSelectionState]
  )

  const loadStoredCanvasState = useCallback(async (canvas: FabricCanvas) => {
    const response = await fetch(`/api/editor-state/${params.id}`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      return false
    }

    const rawState = (await response.text()) || '{}'
    const parsedState = JSON.parse(rawState) as StoredCanvasState
    const serializedState = {
      objects: Array.isArray(parsedState.objects) ? parsedState.objects : [],
    }

    const canvasWithLoader = canvas as FabricCanvas & {
      loadFromJSON: (json: unknown) => Promise<unknown>
    }

    await canvasWithLoader.loadFromJSON(serializedState)
    canvas.requestRenderAll()
    return true
  }, [params.id])

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

      attachCanvasListeners(canvas)
      fabricRef.current = canvas

      const pageData = pageResponse.data
      let backgroundImage: InstanceType<typeof FabricImage> | null = null
      if (pageData?.image_url) {
        backgroundImage = await FabricImage.fromURL(pageData.image_url, {
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

      let restoredStoredState = false

      try {
        restoredStoredState = await loadStoredCanvasState(canvas)
      } catch {
        restoredStoredState = false
      }

      if (!restoredStoredState) {
        for (const price of (pricesResponse.data || []) as PriceRecord[]) {
          const text = new Textbox(price.text, {
            left: price.x,
            top: price.y,
            width: 180,
            fill: DEFAULT_TEXT_COLOR,
            fontSize: DEFAULT_FONT_SIZE,
            fontWeight: 'normal',
          })

          canvas.add(text)
        }
      }

      if (backgroundImage) {
        backgroundImage.set({
          left: 0,
          top: 0,
          selectable: false,
          evented: false,
        })
        canvas.backgroundImage = backgroundImage
      }

      canvas.on('mouse:dblclick', (event: TPointerEventInfo<TPointerEvent>) => {
        const pointer = canvas.getScenePoint(event.e)
        const text = new Textbox('R$ 0,00', {
          left: pointer.x,
          top: pointer.y,
          width: 180,
          fill: DEFAULT_TEXT_COLOR,
          fontSize: DEFAULT_FONT_SIZE,
          fontWeight: 'normal',
        })

        canvas.add(text)
        canvas.setActiveObject(text)
        canvas.requestRenderAll()
        syncSelectionState()
      })

      canvas.requestRenderAll()
      syncSelectionState()
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
  }, [attachCanvasListeners, loadStoredCanvasState, params.id, syncSelectionState])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
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

    const canvas = fabricRef.current
    const payload = extractPricePayload(params.id, canvas.getObjects())

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

    const serializedCanvas = canvas.toJSON()
    const storedState: StoredCanvasState = {
      objects: Array.isArray(serializedCanvas.objects) ? serializedCanvas.objects : [],
    }

    const response = await fetch(`/api/editor-state/${params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(storedState),
    })

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null
      const message = errorPayload?.error || 'Falha ao salvar layout completo'
      setSaving(false)
      alert('Os precos foram salvos, mas falhou ao salvar o layout completo: ' + message)
      return
    }

    setSaving(false)
    alert('Edicao completa salva! Agora textos, formas e estilos voltam ao reabrir a pagina.')
  }, [params.id])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void addPrice()}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Adicionar preco
          </button>
          <button
            onClick={() => void addText()}
            disabled={loading}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            Texto livre
          </button>
          <button
            onClick={() => void addRectangle()}
            disabled={loading}
            className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 disabled:opacity-50"
          >
            Retangulo
          </button>
          <button
            onClick={() => void addCircle()}
            disabled={loading}
            className="px-4 py-2 bg-fuchsia-500 text-white rounded hover:bg-fuchsia-600 disabled:opacity-50"
          >
            Circulo
          </button>
          <button
            onClick={() => void addLine()}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
          >
            Linha
          </button>
          <button
            onClick={() => void duplicateSelected()}
            disabled={loading || !selectedType}
            className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-800 disabled:opacity-50"
          >
            Duplicar
          </button>
          <button
            onClick={removeSelected}
            disabled={loading || !selectedType}
            className="px-4 py-2 bg-zinc-200 text-zinc-800 rounded hover:bg-zinc-300 disabled:opacity-50"
          >
            Remover selecionado
          </button>
          <button
            onClick={() => void savePrices()}
            disabled={loading || saving}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar edicao'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Cor
            <input
              type="color"
              value={fillColor}
              disabled={!selectedType}
              onChange={(event) => {
                const nextColor = event.target.value
                setFillColor(nextColor)
                updateSelectedObject((activeObject) => {
                  if (activeObject.type === 'line') {
                    activeObject.set('stroke', nextColor)
                    activeObject.set('fill', nextColor)
                    return
                  }

                  activeObject.set('fill', nextColor)
                })
              }}
              className="h-10 w-16 rounded border bg-white disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Tamanho
            <input
              type="range"
              min="10"
              max="96"
              step="1"
              value={fontSize}
              disabled={selectedType !== 'textbox'}
              onChange={(event) => {
                const nextSize = clampFontSize(Number(event.target.value))
                setFontSize(nextSize)
                updateSelectedObject((activeObject) => {
                  if (activeObject.type === 'textbox') {
                    activeObject.set('fontSize', nextSize)
                  }
                })
              }}
              className="w-40 disabled:opacity-50"
            />
          </label>

          <button
            onClick={() => {
              const nextWeight = fontWeight === 'bold' ? 'normal' : 'bold'
              setFontWeight(nextWeight)
              updateSelectedObject((activeObject) => {
                if (activeObject.type === 'textbox') {
                  activeObject.set('fontWeight', nextWeight)
                }
              })
            }}
            disabled={selectedType !== 'textbox'}
            className="px-4 py-2 bg-white border rounded hover:bg-zinc-50 disabled:opacity-50"
          >
            {fontWeight === 'bold' ? 'Texto normal' : 'Negrito'}
          </button>

          <div className="text-sm text-zinc-500">
            {selectedType ? `Selecionado: ${selectedType}` : 'Selecione um item para editar estilo'}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Dica: use duplo clique para criar um preco novo. O salvamento agora guarda o layout completo
        do canvas e tambem mantem a tabela de precos atualizada.
      </p>

      {loading && <p className="text-sm text-gray-500">Carregando pagina...</p>}

      <div className="overflow-auto border rounded bg-white p-2">
        <canvas ref={canvasRef} className="border rounded shadow-sm" />
      </div>
    </div>
  )
}
