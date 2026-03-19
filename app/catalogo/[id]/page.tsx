import Catalogo from '@/components/Catalogo'

interface CatalogoPageProps {
  params: Promise<{ id: string }>
}

export default async function CatalogoPage({ params }: CatalogoPageProps) {
  const { id } = await params
  return <Catalogo params={{ id }} />
}
