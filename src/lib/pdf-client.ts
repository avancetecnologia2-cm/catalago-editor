const PDF_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.min.mjs'
const PDF_JS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs'

export const PDF_FILE_ACCEPT = 'application/pdf,.pdf'

interface PdfJsPageViewport {
  width: number
  height: number
}

interface PdfJsRenderTask {
  promise: Promise<void>
}

interface PdfJsPage {
  getViewport: (params: { scale: number }) => PdfJsPageViewport
  render: (params: {
    canvasContext: CanvasRenderingContext2D
    viewport: PdfJsPageViewport
  }) => PdfJsRenderTask
}

interface PdfJsDocument {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfJsPage>
}

interface PdfJsModule {
  GlobalWorkerOptions: {
    workerSrc: string
  }
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<PdfJsDocument>
  }
}

let pdfJsModulePromise: Promise<PdfJsModule> | null = null

async function loadPdfJs() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import(/* webpackIgnore: true */ PDF_JS_URL).then((module) => {
      const pdfJs = module as PdfJsModule
      pdfJs.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL
      return pdfJs
    })
  }

  return pdfJsModulePromise
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Falha ao gerar imagem da pagina do PDF'))
        return
      }

      resolve(blob)
    }, type, quality)
  })
}

export async function convertPdfToImageFiles(file: File) {
  const pdfJs = await loadPdfJs()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdfDocument = await pdfJs.getDocument({ data: bytes }).promise
  const output: File[] = []
  const baseName = file.name.replace(/\.pdf$/i, '')

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = window.document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Falha ao preparar o canvas para o PDF')
    }

    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)

    await page.render({ canvasContext: context, viewport }).promise

    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
    output.push(
      new File([blob], `${baseName}_pagina_${String(pageNumber).padStart(3, '0')}.jpg`, {
        type: 'image/jpeg',
      })
    )
  }

  return output
}

export async function getPdfPageCount(file: File) {
  const pdfJs = await loadPdfJs()
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdfDocument = await pdfJs.getDocument({ data: bytes }).promise

  return pdfDocument.numPages
}
