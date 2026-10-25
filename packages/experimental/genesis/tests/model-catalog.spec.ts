import { expect, it } from 'vitest'
import { catalogModels, modelCatalogUrl, modelJson } from '../src/model-endpoint.ts'

it('uses the decisions catalog for OpenRouter System One without changing other providers', () => {
  expect(modelCatalogUrl({ kind: 'jev', url: 'https://openrouter.ai/api/v1/systemone', model: 'inception/mercury-decide:free' }).href)
    .toBe('https://openrouter.ai/api/v1/models?output_modalities=decisions')
  expect(modelCatalogUrl({ kind: 'jev', url: 'https://api.typesafe.ai/v1/systemone', model: 'jev-latest' }).href)
    .toBe('https://api.typesafe.ai/v1/models')
  expect(modelCatalogUrl({ kind: 'openai', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'writer' }).href)
    .toBe('https://openrouter.ai/api/v1/models')
})

it('reads both catalog protocols and refuses an unrelated JSON document', () => {
  expect(catalogModels({ models: [{ name: 'jev-latest' }] })).toEqual(['jev-latest'])
  expect(catalogModels({ data: [{ id: 'inception/mercury-decide:free' }] })).toEqual(['inception/mercury-decide:free'])
  expect(() => catalogModels({})).toThrow()
})

it('contains an oversized catalog stream and names its own limit rather than the inference limit', async () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(1000))) },
    cancel() { cancelled = true },
  })
  await expect(modelJson(new Response(body), 128, 'modelCatalogChars')).rejects.toThrow('modelCatalogChars (128 characters')
  expect(cancelled).toBe(true)
  await expect(modelJson(new Response(JSON.stringify({ content: 'x'.repeat(150) })), 128, 'memory.outputChars'))
    .rejects.toThrow('memory.outputChars (128 characters')
})
