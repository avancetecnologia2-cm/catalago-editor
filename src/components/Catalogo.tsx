'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import html2canvas from 'html2canvas'
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

export default function Catalogo({ params }: CatalogoProps) {
  const [pages, setPages] = useState<Page[]>([])
  const [prices, setPrices] = useState<Price[]>([])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [showImage, setShowImage] = useState(true)
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)
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
              <button
                onClick={() => void exportPageAsPNG(page)}
                disabled={exporting !== null}
                className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50"
              >
                Exportar esta pagina
              </button>
            </div>

            <div
              ref={(element) => {
                pageRefs.current[page.id] = element
              }}
              className="relative"
              style={{
                width: 'fit-content',
                margin: '0 auto',
                backgroundColor: showImage ? 'transparent' : '#f3f4f6',
              }}
            >
              {showImage && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.image_url}
                    alt={`Pagina ${index + 1}`}
                    className="max-w-full block"
                    crossOrigin="anonymous"
                  />
                </>
              )}

              <div
                className="absolute inset-0"
                style={{
                  width: showImage ? '100%' : '800px',
                  height: showImage ? '100%' : '600px',
                  position: showImage ? 'absolute' : 'relative',
                  margin: showImage ? 0 : '0 auto',
                  backgroundColor: showImage ? 'transparent' : '#f3f4f6',
                }}
              >
                {getPagePrices(page.id).map((price) => (
                  <span
                    key={price.id}
                    className="absolute text-red-600 font-bold text-lg whitespace-nowrap"
                    style={{
                      left: price.x,
                      top: price.y,
                      textShadow: showImage
                        ? '1px 1px 2px white, -1px -1px 2px white'
                        : 'none',
                    }}
                  >
                    {price.text}
                  </span>
                ))}

                {getPagePrices(page.id).length === 0 && !showImage && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <p>Sem precos nesta pagina</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </main>

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
