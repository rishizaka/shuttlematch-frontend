import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, sessionApi, userApi } from './api'

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /users に name/email を JSON で送る', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ id: 'u1', name: '太郎', email: 't@example.com' }, 201))

    const user = await userApi.create({ name: '太郎', email: 't@example.com', password: 'abcd1234' })

    expect(user.id).toBe('u1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/v1\/users$/)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      name: '太郎',
      email: 't@example.com',
      password: 'abcd1234',
    })
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('204 No Content は undefined を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    const result = await sessionApi.removeParticipant('s1', 'p1')
    expect(result).toBeUndefined()
  })

  it('ProblemDetail の detail を ApiError として投げる', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson({ title: 'Conflict', detail: '既に参加しています', status: 409 }, 409),
    )

    await expect(userApi.get('missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: '既に参加しています',
    })
  })

  it('JSON でないエラーボディでも ApiError になる', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )
    const err = await userApi.get('x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(500)
  })
})
