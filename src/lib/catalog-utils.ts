export interface PriceLikeObject {
  type?: string
  text?: string | null
  left?: number | null
  top?: number | null
}

export interface PriceInsertPayload {
  page_id: string
  text: string
  x: number
  y: number
}

export function createCatalogSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildStorageFileName(fileName: string, timestamp: number) {
  const trimmedFileName = fileName.trim()
  const extensionIndex = trimmedFileName.lastIndexOf('.')
  const hasExtension = extensionIndex > 0 && extensionIndex < trimmedFileName.length - 1
  const baseName = hasExtension ? trimmedFileName.slice(0, extensionIndex) : trimmedFileName
  const extension = hasExtension ? trimmedFileName.slice(extensionIndex + 1).toLowerCase() : ''

  const normalizedBaseName = baseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  const fallbackBaseName = normalizedBaseName || 'arquivo'
  return extension
    ? `${timestamp}_${fallbackBaseName}.${extension}`
    : `${timestamp}_${fallbackBaseName}`
}

export function buildEditorStateFilePath(pageId: string) {
  return `editor-state/${pageId}.json`
}

export function filterPagesByCatalog<T extends { catalog_id: string }>(
  pages: T[],
  catalogId: string
) {
  return pages.filter((page) => page.catalog_id === catalogId)
}

export function extractPricePayload(
  pageId: string,
  objects: PriceLikeObject[]
): PriceInsertPayload[] {
  return objects
    .filter((object) =>
      object.type === 'Textbox' || object.type === 'text' || object.type === 'i-text'
    )
    .map((object) => ({
      page_id: pageId,
      text: object.text?.trim() || '',
      x: object.left || 0,
      y: object.top || 0,
    }))
    .filter((object) => object.text.length > 0)
}

export function getPdfImagePlacement(
  imageWidth: number,
  imageHeight: number,
  pageWidth: number,
  pageHeight: number
) {
  const renderedWidth = pageWidth
  const renderedHeight = (imageHeight * renderedWidth) / imageWidth
  const y = renderedHeight < pageHeight ? (pageHeight - renderedHeight) / 2 : 0

  return {
    width: renderedWidth,
    height: Math.min(renderedHeight, pageHeight),
    y,
  }
}
