'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface NovoCatalogoProps {
  catalogId?: string
  onUploaded?: () => Promise<void> | void
}

export default function NovoCatalogo({ catalogId, onUploaded }: NovoCatalogoProps) {
  const [file, setFile] = useState<File | null>(null)
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
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`

    const { error } = await supabase.storage.from('catalogos').upload(fileName, file)

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

    setUploading(false)

    if (insertError) {
      alert('Erro ao salvar pagina: ' + insertError.message)
      return
    }

    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    await onUploaded?.()
    alert('Upload feito!')
  }

  return (
    <div className="p-4 space-y-4 border rounded">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files?.[0] || null)}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100"
      />
      <button
        onClick={() => void upload()}
        disabled={uploading || !file}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {uploading ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  )
}
