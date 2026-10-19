import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NetworkError, isNetworkError, matchApi, roomApi, userApi } from './api'
import { getOrganizerToken, setOrganizerToken } from './local-store'

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
    const result = await roomApi.removeParticipant('s1', 'p1')
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

  it('fetch の reject (オフライン等) は利用者向け文言の NetworkError になる', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await userApi.get('x').catch((e) => e)
    expect(err).toBeInstanceOf(NetworkError)
    expect(isNetworkError(err)).toBe(true)
    expect(err.message).toContain('ネットワークに繋がらない')
  })

  it('isNetworkError はシリアライズでクラス情報が落ちても name で判定できる', () => {
    const revived = new Error('ネットワークに繋がらないようです。')
    revived.name = 'NetworkError'
    expect(isNetworkError(revived)).toBe(true)
    expect(isNetworkError(new ApiError(404, 'not found'))).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})

describe('運営者トークン', () => {
  const ROOM = 'room-1'

  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  const room = (extra: Record<string, unknown> = {}) => ({
    quickCreated: true,
    id: ROOM,
    shareCode: 'abcd2345',
    title: '練習会',
    heldAt: '2026-08-01T09:00:00Z',
    location: null,
    capacity: null,
    courtCount: 2,
    status: 'GENERATED',
    createdBy: 'u1',
    participantCount: 0,
    participants: [],
    fixedPairs: [],
    ...extra,
  })

  const headerOf = (init: RequestInit | undefined) =>
    (init?.headers as Record<string, string> | undefined)?.['X-Organizer-Token']

  it('かんたん作成のレスポンスに含まれるトークンを端末に保存する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okJson(room({ organizerToken: 'secret-token' }), 201),
    )

    await roomApi.quickCreate({
      title: '練習会',
      courtCount: 2,
      participantCount: 8,
      createdBy: 'u1',
    })

    expect(getOrganizerToken(ROOM)).toBe('secret-token')
  })

  it('運営者専用の操作には保存したトークンを X-Organizer-Token で添える', async () => {
    setOrganizerToken(ROOM, 'secret-token')
    // Response の body は一度しか読めないため、呼び出しごとに新しく作る
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(okJson(room())))

    await roomApi.close(ROOM)
    expect(headerOf(fetchMock.mock.calls[0][1])).toBe('secret-token')

    await matchApi.replan(ROOM)
    expect(headerOf(fetchMock.mock.calls[1][1])).toBe('secret-token')
  })

  it('トークンを持っていなければヘッダを送らない(サーバーが 403 で弾く)', async () => {
    // Response の body は一度しか読めないため、呼び出しごとに新しく作る
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(okJson(room())))

    await roomApi.close(ROOM)

    expect(headerOf(fetchMock.mock.calls[0][1])).toBeUndefined()
  })

  it('早退・復帰(一括を含む)は運営操作なのでトークンを添える', async () => {
    setOrganizerToken(ROOM, 'secret-token')
    // Response の body は一度しか読めないため、呼び出しごとに新しく作る
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(okJson(room())))

    await roomApi.markParticipantLeft(ROOM, 'p1')
    await roomApi.markParticipantsLeft(ROOM, ['p1'])
    await roomApi.reactivateParticipant(ROOM, 'p1')
    await roomApi.reactivateParticipants(ROOM, ['p1'])

    for (const call of fetchMock.mock.calls) {
      expect(headerOf(call[1])).toBe('secret-token')
    }
  })

  it('名前の変更・「参加する」・参照はトークンを送らない(参加者本人も使う/共有リンクで見られる)', async () => {
    setOrganizerToken(ROOM, 'secret-token')
    // Response の body は一度しか読めないため、呼び出しごとに新しく作る
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(okJson({ ...room(), participantId: 'p1', number: 1, room: room() })),
      )

    await roomApi.renameParticipant(ROOM, 'p1', 'たろう')
    await roomApi.claimNext(ROOM, 'たろう')
    await roomApi.get(ROOM)

    for (const call of fetchMock.mock.calls) {
      expect(headerOf(call[1])).toBeUndefined()
    }
  })
})
