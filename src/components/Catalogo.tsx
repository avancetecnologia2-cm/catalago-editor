'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import html2canvas from 'html2canvas'
import Editor from '@/components/Editor'
import { supabase } from '@/lib/supabase'
import { getPdfImagePlacement } from '@/lib/catalog-utils'

interface CatalogoProps {
  params: {
    id: string
  }
}

interface Page {
  id: string
  image_url: string
}

interface Price {
  id: string
  page_id: string
  text: string
  x: number
  y: number
}

interface Catalog {
  id: string
  name: string
  slug: string
}

interface StoredCanvasState {
  objects?: unknown[]
}

interface CatalogPageArtworkProps {
  page: Page
  pageLabel: string
  showImage: boolean
  prices: Price[]
}

function CatalogPageArtwork({ page, pageLabel, showImage, prices }: CatalogPageArtworkProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [stateObjects, setStateObjects] = useState<unknown[] | null>(null)
  const [size, setSize] = useState({
    naturalWidth: 800,
    naturalHeight: 600,
    renderedWidth: 800,
    renderedHeight: 600,
  })

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(`/api/editor-state/${page.id}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        setStateObjects(null)
        return
      }

      const data = (await response.json()) as StoredCanvasState
      setStateObjects(Array.isArray(data.objects) ? data.objects : [])
    } catch {
      setStateObjects(null)
    }
  }, [page.id])

  useEffect(() => {
    let isActive = true

    const safeLoadState = async () => {
      try {
        await loadState()
      } catch {
        if (isActive) {
          setStateObjects(null)
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void safeLoadState()
      }
    }

    const handlePageShow = () => {
      void safeLoadState()
    }

    void safeLoadState()
    window.addEventListener('focus', handlePageShow)
    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isActive = false
      window.removeEventListener('focus', handlePageShow)
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadState])

  useEffect(() => {
    const imageElement = imageRef.current

    if (!imageElement) {
      return
    }

    const syncSize = () => {
      setSize({
        naturalWidth: imageElement.naturalWidth || 800,
        naturalHeight: imageElement.naturalHeight || 600,
        renderedWidth: imageElement.clientWidth || imageElement.naturalWidth || 800,
        renderedHeight: imageElement.clientHeight || imageElement.naturalHeight || 600,
      })
    }

    syncSize()

    const observer = new ResizeObserver(() => {
      syncSize()
    })

    observer.observe(imageElement)
    return () => {
      observer.disconnect()
    }
  }, [showImage, page.image_url])

  useEffect(() => {
    let mounted = true
    let staticCanvas: { dispose?: () => void } | null = null

    const renderState = async () => {
      if (!canvasRef.current || !stateObjects || stateObjects.length === 0) {
        return
      }

      const { StaticCanvas } = await import('fabric')
      if (!mounted || !canvasRef.current) {
        return
      }

      staticCanvas = new StaticCanvas(canvasRef.current, {
        width: size.naturalWidth,
        height: size.naturalHeight,
        backgroundColor: 'transparent',
      })

      const canvasWithLoader = staticCanvas as typeof staticCanvas & {
        loadFromJSON: (json: unknown) => Promise<unknown>
        requestRenderAll: () => void
      }

      await canvasWithLoader.loadFromJSON({ objects: stateObjects })
      canvasWithLoader.requestRenderAll()
    }

    void renderState()

    return () => {
      mounted = false
      staticCanvas?.dispose?.()
    }
  }, [size.naturalHeight, size.naturalWidth, stateObjects])

  const hasSavedState = !!stateObjects && stateObjects.length > 0

  return (
    <div
      className="relative"
      style={{
        width: showImage ? 'fit-content' : `${size.renderedWidth}px`,
        margin: '0 auto',
        backgroundColor: showImage ? 'transparent' : '#f3f4f6',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imageRef}
        src={page.image_url}
        alt={pageLabel}
        className={`max-w-full block ${showImage ? '' : 'invisible absolute pointer-events-none'}`}
        crossOrigin="anonymous"
      />

      {hasSavedState ? (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            width: size.renderedWidth,
            height: size.renderedHeight,
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            width: showImage ? '100%' : `${size.renderedWidth}px`,
            height: showImage ? '100%' : `${size.renderedHeight}px`,
            position: showImage ? 'absolute' : 'relative',
            margin: showImage ? 0 : '0 auto',
            backgroundColor: showImage ? 'transparent' : '#f3f4f6',
          }}
        >
          {prices.map((price) => (
            <span
              key={price.id}
              className="absolute text-red-600 font-bold text-lg whitespace-nowrap"
              style={{
                left: price.x,
                top: price.y,
                textShadow: showImage ? '1px 1px 2px white, -1px -1px 2px white' : 'none',
              }}
            >
              {price.text}
            </span>
          ))}

          {prices.length === 0 && !showImage && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <p>Sem precos nesta pagina</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Catalogo({ params }: CatalogoProps) {
  const [pages, setPages] = useState<Page[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImage, setShowImage] = useState(true)
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const pageRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const loadData = useCallback(async () => {
    setLoading(true)

    const [{ data: pagesData, error: pagesError }, { data: catalogData, error: catalogError }] =
      await Promise.all([
        supabase.from('pages').select('*').eq('catalog_id', params.id),
        supabase.from('catalogs').select('*').eq('id', params.id).single(),
      ])

    if (pagesError) {
      alert('Erro ao carregar paginas: ' + pagesError.message)
      setLoading(false)
      return
    }

    if (catalogError) {
      alert('Erro ao carregar catalogo: ' + catalogError.message)
      setLoading(false)
      return
    }

    const pageIds = (pagesData || []).map((page) => page.id)
    const { data: pricesData, error: pricesError } = pageIds.length
      ? await supabase.from('prices').select('*').in('page_id', pageIds)
      : { data: [] as Price[], error: null }

    if (pricesError) {
      alert('Erro ao carregar precos: ' + pricesError.message)
      setLoading(false)
      return
    }

    setPages(pagesData || [])
    setPrices(pricesData || [])
    setCatalog(catalogData)
    setLoading(false)
  }, [params.id])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const getPagePrices = (pageId: string) => prices.filter((price) => price.page_id === pageId)

  const exportPageAsPNG = async (page: Page) => {
    const element = pageRefs.current[page.id]
    if (!element) return

    setExporting('png')
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })

      const link = document.createElement('a')
      link.download = `${catalog?.name || 'catalogo'}_pagina_${page.id.slice(0, 8)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch {
      alert('Erro ao exportar PNG')
    }
    setExporting(null)
  }

  const exportCatalogAsPDF = async () => {
    if (pages.length === 0) return

    setExporting('pdf')
    try {
      const { default: jsPDF } = await import('jspdf/dist/jspdf.es.min.js')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index]
        const element = pageRefs.current[page.id]

        if (!element) continue

        if (index > 0) {
          pdf.addPage()
        }

        const canvas = await html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
        })

        const imageData = canvas.toDataURL('image/png')
        const imageProps = pdf.getImageProperties(imageData)
        const placement = getPdfImagePlacement(
          imageProps.width,
          imageProps.height,
          pdfWidth,
          pdfHeight
        )

        pdf.addImage(imageData, 'PNG', 0, placement.y, placement.width, placement.height)
      }

      pdf.save(`${catalog?.name || 'catalogo'}.pdf`)
    } catch {
      alert('Erro ao exportar PDF')
    }
    setExporting(null)
  }

  const exportAllAsPNG = async () => {
    setExporting('png')
    for (const page of pages) {
      await exportPageAsPNG(page)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    setExporting(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando catalogo...</p>
        </div>
      </div>
    )
  }

  if (pages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">Nenhuma pagina neste catalogo.</p>
          <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white shadow-md border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{catalog?.name || 'Catalogo'}</h1>
              <p className="text-sm text-gray-500">
                {pages.length} paginas - {prices.length} precos
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {pages[0] && (
                <button
                  type="button"
                  onClick={() => setEditingPageId(pages[0].id)}
                  className="px-3 py-2 bg-amber-100 text-amber-800 rounded text-sm font-medium hover:bg-amber-200"
                >
                  Editar paginas
                </button>
              )}
              <button
                onClick={() => setShowImage((current) => !current)}
                className={`px-3 py-2 rounded text-sm font-medium transition ${
                  showImage
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {showImage ? 'Ocultar imagem' : 'Apenas precos'}
              </button>

              <button
                onClick={() => void exportAllAsPNG()}
                disabled={exporting !== null}
                className="px-3 py-2 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200 disabled:opacity-50"
              >
                {exporting === 'png' ? 'Exportando...' : 'PNG'}
              </button>

              <button
                onClick={() => void exportCatalogAsPDF()}
                disabled={exporting !== null}
                className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 disabled:opacity-50"
              >
                {exporting === 'pdf' ? 'Gerando PDF...' : 'PDF'}
              </button>

              <Link
                href="/"
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200"
              >
                Voltar
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {pages.map((page, index) => (
          <div key={page.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-100 border-b flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Pagina {index + 1}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPageId(page.id)}
                  className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                >
                  Editar esta pagina
                </button>
                <button
                  onClick={() => void exportPageAsPNG(page)}
                  disabled={exporting !== null}
                  className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
                >
                  Exportar esta pagina
                </button>
              </div>
            </div>

            <div
              ref={(element) => {
                pageRefs.current[page.id] = element
              }}
              className="relative"
            >
              <CatalogPageArtwork
                page={page}
                pageLabel={`Pagina ${index + 1}`}
                showImage={showImage}
                prices={getPagePrices(page.id)}
              />
            </div>
          </div>
        ))}
      </main>

      {editingPageId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <button
            type="button"
            aria-label="Fechar editor"
            className="flex-1 cursor-default"
            onClick={() => setEditingPageId(null)}
          />
          <aside className="h-full w-full overflow-y-auto bg-white shadow-2xl sm:max-w-[720px]">
            <div className="sticky top-0 z-10 border-b bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <h2 className="font-semibold text-zinc-900">Editar pagina</h2>
                  <p className="text-sm text-zinc-500">
                    Ajuste textos, formas e posicoes sem sair do visualizador.
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <Link
                    href={`/edit/${editingPageId}`}
                    className="rounded bg-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-200"
                  >
                    Tela cheia
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEditingPageId(null)}
                    className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Paginas do catalogo</h3>
                    <p className="text-xs text-zinc-500">
                      Selecione rapidamente a pagina que voce quer ajustar.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    Ativa:{' '}
                    {pages.findIndex((page) => page.id === editingPageId) >= 0
                      ? `Pagina ${pages.findIndex((page) => page.id === editingPageId) + 1}`
                      : 'Nenhuma'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {pages.map((page, index) => {
                    const isActive = editingPageId === page.id

                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => setEditingPageId(page.id)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        Pagina {index + 1}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-2 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-zinc-900">
                      {pages.findIndex((page) => page.id === editingPageId) >= 0
                        ? `Editando pagina ${pages.findIndex((page) => page.id === editingPageId) + 1}`
                        : 'Editor'}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      As alteracoes ficam salvas e podem ser exportadas depois.
                    </p>
                  </div>
                </div>

                <Editor params={{ id: editingPageId }} />
              </div>
            </div>
          </aside>
        </div>
      )}

      <footer className="bg-white border-t mt-8 py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>
            {catalog?.name} - Exportado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </footer>
    </div>
  )
}
