'use client'

import { useFabricCanvas } from '@/hooks/useFabricCanvas'

export default function FabricCanvas() {
  const { canvasRef, fabricRef, isReady } = useFabricCanvas()

  const addRectangle = async () => {
    if (!fabricRef.current) return

    const { Rect } = await import('fabric')
    const rectangle = new Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: '#3b82f6',
    })

    fabricRef.current.add(rectangle)
  }

  const addCircle = async () => {
    if (!fabricRef.current) return

    const { Circle } = await import('fabric')
    const circle = new Circle({
      left: 200,
      top: 200,
      radius: 50,
      fill: '#ef4444',
    })

    fabricRef.current.add(circle)
  }

  const clearCanvas = () => {
    if (!fabricRef.current) return

    fabricRef.current.clear()
    fabricRef.current.backgroundColor = '#f3f4f6'
    fabricRef.current.requestRenderAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => void addRectangle()}
          disabled={!isReady}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Retangulo
        </button>
        <button
          onClick={() => void addCircle()}
          disabled={!isReady}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          Circulo
        </button>
        <button
          onClick={clearCanvas}
          disabled={!isReady}
          className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          Limpar
        </button>
      </div>
      <canvas ref={canvasRef} className="border rounded shadow-sm" />
      {!isReady && <p className="text-gray-500">Carregando canvas...</p>}
    </div>
  )
}
