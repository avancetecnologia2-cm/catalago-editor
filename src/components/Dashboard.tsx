'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Editor from '@/components/Editor'
import { supabase } from '@/lib/supabase'
import {
  buildStorageFileName,
  createCatalogSlug,
  filterPagesByCatalog,
} from '@/lib/catalog-utils'
import {
  convertPdfToImageFiles,
  getPdfPageCount,
  PDF_FILE_ACCEPT,
} from '@/lib/pdf-client'

interface Catalog {
  id: string
  name: string
  slug: string
}

interface Page {
  id: string
  catalog_id: string
  image_url: string
}

export default function Dashboard() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [newCatalogName, setNewCatalogName] = useState('')
  const [selectedCatalog, setSelectedCatalog] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'image' | 'pdf'>('image')
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [creatingCatalog, setCreatingCatalog] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchCatalogs = useCallback(async () => {
    return supabase.from('catalogs').select('*').order('name')
  }, [])

  const fetchPages = useCallback(async () => {
    return supabase.from('pages').select('*')
  }, [])

  const loadCatalogs = useCallback(async () => {
    const { data, error } = await fetchCatalogs()
    if (error) {
      alert('Erro ao carregar catalogos: ' + error.message)
      return
    }

    setCatalogs(data || [])
  }, [fetchCatalogs])

  const loadPages = useCallback(async () => {
    const { data, error } = await fetchPages()
    if (error) {
      alert('Erro ao carregar paginas: ' + error.message)
      return
    }

    setPages(data || [])
  }, [fetchPages])

  useEffect(() => {
    let cancelled = false

    const loadInitialData = async () => {
      setInitialLoading(true)
      const [catalogsResponse, pagesResponse] = await Promise.all([fetchCatalogs(), fetchPages()])

      if (cancelled) {
        return
      }

      if (catalogsResponse.error) {
        alert('Erro ao carregar catalogos: ' + catalogsResponse.error.message)
      } else {
        setCatalogs(catalogsResponse.data || [])
      }

      if (pagesResponse.error) {
        alert('Erro ao carregar paginas: ' + pagesResponse.error.message)
      } else {
        setPages(pagesResponse.data || [])
      }

      setInitialLoading(false)
    }

    void loadInitialData()

    return () => {
      cancelled = true
    }
  }, [fetchCatalogs, fetchPages])

  const createCatalog = async () => {
    const trimmedName = newCatalogName.trim()
    if (!trimmedName) {
      alert('Digite um nome')
      return
    }

    setCreatingCatalog(true)
    const slug = createCatalogSlug(trimmedName)
    const { error } = await supabase.from('catalogs').insert({
      name: trimmedName,
      slug,
    })

    if (error) {
      setCreatingCatalog(false)
      alert('Erro ao criar catalogo: ' + error.message)
      return
    }

    setNewCatalogName('')
    setCreatingCatalog(false)
    await loadCatalogs()
    alert('Catalogo criado!')
  }

  const uploadPage = async () => {
    if (!file || !selectedCatalog) {
      alert('Selecione um arquivo e um catalogo')
      return
    }

    setLoading(true)

    try {
      const filesToUpload =
        uploadMode === 'pdf'
          ? await convertPdfToImageFiles(file)
          : [file]

      for (const currentFile of filesToUpload) {
        const fileName = buildStorageFileName(currentFile.name, Date.now())

        const { error: uploadError } = await supabase.storage
          .from('catalogos')
          .upload(fileName, currentFile)

        if (uploadError) {
          setLoading(false)
          alert('Erro no upload: ' + uploadError.message)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('catalogos').getPublicUrl(fileName)

        const { error: insertError } = await supabase.from('pages').insert({
          catalog_id: selectedCatalog,
          image_url: publicUrl,
        })

        if (insertError) {
          setLoading(false)
          alert('Erro ao salvar pagina: ' + insertError.message)
          return
        }
      }
    } catch (error) {
      setLoading(false)
      const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo'
      alert(uploadMode === 'pdf' ? `Erro ao processar PDF: ${message}` : message)
      return
    }

    setLoading(false)

    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    await loadPages()
    alert(uploadMode === 'pdf' ? 'PDF enviado e paginas adicionadas!' : 'Pagina adicionada!')
  }

  const handleFileChange = async (nextFile: File | null) => {
    setFile(nextFile)
    setPdfPageCount(null)

    if (!nextFile) {
      return
    }

    if (uploadMode === 'pdf') {
      if (nextFile.type !== 'application/pdf' && !nextFile.name.toLowerCase().endsWith('.pdf')) {
        alert('Selecione um arquivo PDF valido')
        setFile(null)
        return
      }

      try {
        const pageCount = await getPdfPageCount(nextFile)
        setPdfPageCount(pageCount)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao ler o PDF'
        alert(`Erro ao ler PDF: ${message}`)
        setFile(null)
      }
    }
  }

  const getCatalogPages = (catalogId: string) => {
    return filterPagesByCatalog(pages, catalogId)
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Editor de Catalogo</h1>
        <p className="text-sm text-gray-600">
          Crie catalogos, envie paginas e ajuste os elementos direto no dashboard ou na tela de edicao.
        </p>
      </header>

      <div className="p-4 border rounded bg-white">
        <h2 className="text-xl font-semibold mb-4">Novo Catalogo</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nome do catalogo"
            value={newCatalogName}
            onChange={(event) => setNewCatalogName(event.target.value)}
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            onClick={() => void createCatalog()}
            disabled={creatingCatalog}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {creatingCatalog ? 'Criando...' : 'Criar'}
          </button>
        </div>
      </div>

      <div className="p-4 border rounded bg-white">
        <h2 className="text-xl font-semibold mb-4">Adicionar Pagina</h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setUploadMode('image')
                setFile(null)
                setPdfPageCount(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className={`px-4 py-2 rounded ${
                uploadMode === 'image'
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              Imagem
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMode('pdf')
                setFile(null)
                setPdfPageCount(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className={`px-4 py-2 rounded ${
                uploadMode === 'pdf'
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              PDF multipagina
            </button>
          </div>
          <select
            value={selectedCatalog}
            onChange={(event) => setSelectedCatalog(event.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Selecione um catalogo</option>
            {catalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>
                {catalog.name}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept={uploadMode === 'image' ? 'image/*' : PDF_FILE_ACCEPT}
            onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
            className="block w-full"
          />
          <p className="text-sm text-gray-500">
            {uploadMode === 'image'
              ? 'Envie JPG, PNG ou outra imagem para criar uma pagina.'
              : 'Envie um PDF e cada pagina sera convertida em imagem e adicionada ao catalogo.'}
          </p>
          {uploadMode === 'pdf' && file && pdfPageCount !== null && (
            <p className="text-sm text-blue-700">
              O PDF selecionado tem {pdfPageCount} {pdfPageCount === 1 ? 'pagina' : 'paginas'}.
            </p>
          )}
          <button
            onClick={() => void uploadPage()}
            disabled={loading || !file || !selectedCatalog}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {loading
              ? uploadMode === 'pdf'
                ? 'Processando PDF...'
                : 'Enviando...'
              : uploadMode === 'pdf'
                ? 'Enviar PDF'
                : 'Enviar Pagina'}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Catalogos</h2>
          <span className="text-sm text-gray-500">
            {catalogs.length} catalogos • {pages.length} paginas
          </span>
        </div>

        {initialLoading && (
          <div className="p-6 border rounded bg-white text-sm text-gray-500">
            Carregando catalogos...
          </div>
        )}

        {!initialLoading && catalogs.length === 0 && (
          <p className="text-gray-500">Nenhum catalogo criado ainda.</p>
        )}

        {!initialLoading &&
          catalogs.map((catalog) => (
            <div key={catalog.id} className="p-4 border rounded bg-white">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="font-semibold">{catalog.name}</h3>
                  <p className="text-sm text-gray-500">Slug: {catalog.slug}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/catalogo/${catalog.id}`}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Ver
                  </Link>
                </div>
              </div>

              <div className="flex gap-3 flex-wrap">
                {getCatalogPages(catalog.id).length === 0 && (
                  <p className="text-sm text-gray-500">Nenhuma pagina enviada ainda.</p>
                )}

                {getCatalogPages(catalog.id).map((page) => (
                  <div key={page.id} className="w-32 rounded-lg border border-zinc-200 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.image_url} alt="" className="h-24 w-full rounded object-cover" />
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingPageId((current) => (current === page.id ? null : page.id))
                        }
                        className={`w-full rounded px-2 py-1 text-xs font-medium ${
                          editingPageId === page.id
                            ? 'bg-zinc-800 text-white hover:bg-zinc-900'
                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                        }`}
                      >
                        {editingPageId === page.id ? 'Fechar editor' : 'Editar aqui'}
                      </button>
                      <Link
                        href={`/edit/${page.id}`}
                        className="block w-full rounded bg-blue-100 px-2 py-1 text-center text-xs font-medium text-blue-700 hover:bg-blue-200"
                      >
                        Tela cheia
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {editingPageId &&
                getCatalogPages(catalog.id).some((page) => page.id === editingPageId) && (
                  <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-zinc-900">Edicao inline da pagina</h4>
                        <p className="text-sm text-zinc-600">
                          Posicione textos, formas e estilos sem sair do dashboard.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingPageId(null)}
                        className="rounded bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50"
                      >
                        Fechar
                      </button>
                    </div>
                    <Editor params={{ id: editingPageId }} />
                  </div>
                )}
            </div>
          ))}
      </div>
    </div>
  )
}
