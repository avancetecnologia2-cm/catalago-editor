'use client'

import { useEffect, useRef, useState } from 'react'
import type { Canvas as FabricCanvas } from 'fabric'

export function useFabricCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !canvasRef.current) return

    const canvasElement = canvasRef.current

    const setupCanvas = async () => {
      const { Canvas } = await import('fabric')
      const canvas = new Canvas(canvasElement, {
        width: 800,
        height: 600,
        backgroundColor: '#f3f4f6',
      })

      fabricRef.current = canvas
      setIsReady(true)
    }

    void setupCanvas()

    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose()
        fabricRef.current = null
      }
    }
  }, [])

  return { canvasRef, fabricRef, isReady }
}
