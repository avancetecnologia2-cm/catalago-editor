# Catalogo Editor

Aplicacao em Next.js 16 para montar catalogos de paginas hospedadas no Supabase, posicionar precos com Fabric.js e exportar o resultado em PNG ou PDF.

## Requisitos

- Node.js 20+
- Um projeto Supabase com:
  - tabela `catalogs`
  - tabela `pages`
  - tabela `prices`
  - bucket `catalogos`

## Variaveis de ambiente

Crie um arquivo `.env.local` com:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Fluxo do app

1. Crie um catalogo na tela inicial.
2. Envie uma imagem para esse catalogo.
3. Abra a pagina no editor.
4. Adicione, mova ou remova precos sobre a arte.
5. Salve e exporte o catalogo em PNG ou PDF.

## Observacoes

- O editor usa `fabric` no cliente.
- A exportacao usa `html2canvas` e `jspdf`.
- Neste ambiente de sandbox, o `next build` pode terminar com `spawn EPERM` depois da compilacao, mesmo com lint e TypeScript validos.
