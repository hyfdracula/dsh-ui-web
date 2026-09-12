/**
 * Request-identity helpers for the pairing routes and the phone data
 * channel: cookie parsing plus the loopback classification the /api/pair
 * mint endpoints fence on.
 *
 * The `api/gate` waterfall this module also served is gone in 0.1.5 (the
 * connection plugin removed the event and turned the /api fence into a real
 * authentication layer), so the pairing gate is now the phone channel's own
 * paired-cookie check in `mobile-api.ts`.
 */

import type { IncomingMessage } from 'node:http'

/**
 * Whether a normalized URL hostname names the local loopback authority.
 * Semantics mirror the connection package's internal predicate (localhost,
 * IPv6 loopback, any IPv4 address in 127/8); it is reimplemented here because
 * the connection package no longer exports it — the fence now lives inside
 * the connection plugin, and external host plugins only need the
 * classification, not the whole trust decision.
 * @param hostname - WHATWG URL hostname (IPv6 literals retain brackets).
 * @returns true for localhost, IPv6 loopback, or any IPv4 address in 127/8.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Whether a socket remote address names the loopback range (127/8, ::1, IPv4-mapped). */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice('::ffff:'.length))
  return isIPv4Loopback(normalized)
}

/** IPv4 127/8 predicate (four decimal octets, first == 127). */
function isIPv4Loopback(v4: string): boolean {
  const parts = v4.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Read one cookie value from a Cookie header.
 * @param header - the raw Cookie header value (or undefined).
 * @param name - the cookie name.
 * @returns the value, or undefined when absent.
 */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    if (key === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

/**
 * The effective Host hostname of a request.
 * @param request - node HTTP request.
 * @returns the normalized hostname, or undefined when unparsable.
 */
export function hostnameOf(request: IncomingMessage): string | undefined {
  const host = request.headers.host
  if (typeof host !== 'string') return undefined
  try {
    return new URL(`http://${host}`).hostname
  } catch {
    return undefined
  }
}

/** Whether a request comes from the desktop loopback client (loopback socket AND loopback Host). */
export function isLoopbackClient(request: IncomingMessage): boolean {
  const hostname = hostnameOf(request)
  if (hostname === undefined || !isLoopbackHostname(hostname)) return false
  const socket = request.socket as { remoteAddress?: string } | undefined
  return isLoopbackAddress(socket?.remoteAddress)
}


