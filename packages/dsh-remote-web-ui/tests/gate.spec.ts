/**
 * The request-identity helpers the pairing routes and the phone data channel
 * use: cookie parsing and the loopback classification the /api/pair mint
 * endpoints fence on. The `api/gate` listener these helpers also served is
 * gone in 0.1.5 (the harness authenticates /api itself and exposes no global
 * veto seam), so the pairing gate now lives in the phone channel
 * (`mobile-api.ts` → paired-device cookie).
 */
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { isLoopbackAddress, isLoopbackClient, isLoopbackHostname, readCookie } from '../src/gate.ts'

function request(headers: Record<string, string>, remoteAddress = '127.0.0.1'): IncomingMessage {
  const req = Readable.from([]) as unknown as IncomingMessage
  Object.assign(req, { headers, socket: { remoteAddress } })
  return req
}

describe('readCookie', () => {
  it('finds a cookie among others and trims whitespace', () => {
    expect(readCookie('a=1; dsh_pair=  abc ; b=2', 'dsh_pair')).toBe('abc')
    expect(readCookie(undefined, 'dsh_pair')).toBeUndefined()
    expect(readCookie('a=1', 'dsh_pair')).toBeUndefined()
  })
})

describe('loopback classification', () => {
  it('accepts localhost names and 127/8 literals only', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('127.9.9.9')).toBe(true)
    expect(isLoopbackHostname('192.168.1.5')).toBe(false)
    expect(isLoopbackHostname('127.0.0.256')).toBe(false)
    expect(isLoopbackHostname('127.0.0')).toBe(false)
  })

  it('accepts loopback socket addresses, including IPv4-mapped ones', () => {
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('203.0.113.7')).toBe(false)
    expect(isLoopbackAddress(undefined)).toBe(false)
  })

  it('requires both a loopback Host and a loopback socket for a desktop client', () => {
    expect(isLoopbackClient(request({ host: '127.0.0.1:3080' }))).toBe(true)
    expect(isLoopbackClient(request({ host: 'localhost:3080' }))).toBe(true)
    // A spoofed loopback Host from a real remote socket is not a desktop.
    expect(isLoopbackClient(request({ host: '127.0.0.1:3080' }, '203.0.113.7'))).toBe(false)
    expect(isLoopbackClient(request({ host: '192.168.1.5:3080' }))).toBe(false)
    expect(isLoopbackClient(request({ host: ':::' }))).toBe(false)
    expect(isLoopbackClient(request({}))).toBe(false)
  })
})
