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
  const sanitizedFileName = fileName.trim().replace(/\s+/g, '_')
  return `${timestamp}_${sanitizedFileName}`
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
