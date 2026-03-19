'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildStorageFileName } from '@/lib/catalog-utils'
import { convertPdfToImageFiles, getPdfPageCount, PDF_FILE_ACCEPT } from '@/lib/pdf-client'

interface NovoCatalogoProps {
  catalogId?: string
  onUploaded?: () => Promise<void> | void
}

export default function NovoCatalogo({ catalogId, onUploaded }: NovoCatalogoProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploadMode, setUploadMode] = useState<'image' | 'pdf'>('image')
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const upload = async () => {
    if (!file) {
      alert('Selecione um arquivo')
      return
    }

    if (!catalogId) {
      alert('Selecione um catalogo primeiro')
      return
    }

    setUploading(true)

    try {
      const filesToUpload =
        uploadMode === 'pdf'
          ? await convertPdfToImageFiles(file)
          : [file]

      for (const currentFile of filesToUpload) {
        const fileName = buildStorageFileName(currentFile.name, Date.now())
        const { error } = await supabase.storage.from('catalogos').upload(fileName, currentFile)

        if (error) {
          setUploading(false)
          alert('Erro no upload: ' + error.message)
          return
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('catalogos').getPublicUrl(fileName)

        const { error: insertError } = await supabase.from('pages').insert({
          catalog_id: catalogId,
          image_url: publicUrl,
        })

        if (insertError) {
          setUploading(false)
          alert('Erro ao salvar pagina: ' + insertError.message)
          return
        }
      }
    } catch (error) {
      setUploading(false)
      const message = error instanceof Error ? error.message : 'Falha ao processar o arquivo'
      alert(uploadMode === 'pdf' ? `Erro ao processar PDF: ${message}` : message)
      return
    }

    setUploading(false)

    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    await onUploaded?.()
    alert(uploadMode === 'pdf' ? 'PDF enviado com sucesso!' : 'Upload feito!')
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

  return (
    <div className="p-4 space-y-4 border rounded">
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
          className={`px-3 py-2 rounded text-sm ${
            uploadMode === 'image' ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-700'
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
          className={`px-3 py-2 rounded text-sm ${
            uploadMode === 'pdf' ? 'bg-blue-500 text-white' : 'bg-zinc-100 text-zinc-700'
          }`}
        >
          PDF
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={uploadMode === 'image' ? 'image/*' : PDF_FILE_ACCEPT}
        onChange={(event) => void handleFileChange(event.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      {uploadMode === 'pdf' && file && pdfPageCount !== null && (
        <p className="text-sm text-blue-700">
          O PDF selecionado tem {pdfPageCount} {pdfPageCount === 1 ? 'pagina' : 'paginas'}.
        </p>
      )}
      <button
        onClick={() => void upload()}
        disabled={uploading || !file}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {uploading ? 'Enviando...' : uploadMode === 'pdf' ? 'Enviar PDF' : 'Enviar imagem'}
      </button>
    </div>
  )
}
