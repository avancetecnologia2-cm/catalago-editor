import Editor from '@/components/Editor'

interface EditPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPage({ params }: EditPageProps) {
  const { id } = await params

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Editar pagina</h1>
      <Editor params={{ id }} />
    </div>
  )
}
