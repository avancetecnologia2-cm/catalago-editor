import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildEditorStateFilePath,
  buildStorageFileName,
  createCatalogSlug,
  extractPricePayload,
  filterPagesByCatalog,
  getPdfImagePlacement,
} from '../src/lib/catalog-utils'

test('createCatalogSlug normalizes spaces, accents and punctuation', () => {
  assert.equal(createCatalogSlug('  Cat\u00E1logo Premium 2026  '), 'catalogo-premium-2026')
  assert.equal(createCatalogSlug('Mesa & Banho'), 'mesa-banho')
})

test('buildStorageFileName preserves timestamp and sanitizes spaces', () => {
  assert.equal(buildStorageFileName('foto de capa.png', 12345), '12345_foto_de_capa.png')
})

test('buildStorageFileName removes accents and combining marks from invalid storage keys', () => {
  assert.equal(
    buildStorageFileName(`CATA${'\u0301'}LOGO especial.jpg`, 12345),
    '12345_CATALOGO_especial.jpg'
  )
})

test('buildEditorStateFilePath uses deterministic storage path', () => {
  assert.equal(buildEditorStateFilePath('page-123'), 'editor-state/page-123.json')
})

test('filterPagesByCatalog returns only matching pages', () => {
  const pages = [
    { id: '1', catalog_id: 'a' },
    { id: '2', catalog_id: 'b' },
    { id: '3', catalog_id: 'a' },
  ]

  assert.deepEqual(filterPagesByCatalog(pages, 'a'), [
    { id: '1', catalog_id: 'a' },
    { id: '3', catalog_id: 'a' },
  ])
})

test('extractPricePayload keeps only text objects with content', () => {
  const payload = extractPricePayload('page-1', [
    { type: 'Textbox', text: ' R$ 9,99 ', left: 12, top: 16 },
    { type: 'textbox', text: 'R$ 89,00', left: 20, top: 24 },
    { type: 'rect', text: 'ignorar', left: 0, top: 0 },
    { type: 'i-text', text: '   ', left: 2, top: 3 },
    { type: 'text', text: 'R$ 19,99', left: undefined, top: undefined },
  ])

  assert.deepEqual(payload, [
    { page_id: 'page-1', text: 'R$ 9,99', x: 12, y: 16 },
    { page_id: 'page-1', text: 'R$ 89,00', x: 20, y: 24 },
    { page_id: 'page-1', text: 'R$ 19,99', x: 0, y: 0 },
  ])
})

test('getPdfImagePlacement centers shorter images vertically', () => {
  assert.deepEqual(getPdfImagePlacement(1000, 500, 210, 297), {
    width: 210,
    height: 105,
    y: 96,
  })
})

test('getPdfImagePlacement clamps tall images to page height', () => {
  assert.deepEqual(getPdfImagePlacement(1000, 3000, 210, 297), {
    width: 210,
    height: 297,
    y: 0,
  })
})
