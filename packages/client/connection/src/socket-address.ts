/** Canonical socket IPs for address-bound login and wildcard-listener Host checks. @module */
import { isIP } from 'node:net'
import type { ConnectionTrustRequest } from './rpc.ts'

/**
 * Normalize a literal supplied by a trusted socket, including mapped IPv4.
 * @param address - Socket address; absent or nonliteral values are refused.
 * @returns Canonical IP without an IPv6 interface zone, or undefined.
 */
export function socketIp(address: string | undefined): string | undefined {
  if (address === undefined || isIP(address) === 0) return undefined
  const literal = address.split('%', 1)[0]!
  if (isIP(literal) === 4) return literal
  const canonical = new URL(`http://[${literal}]/`).hostname.slice(1, -1)
  const mapped = /^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/u.exec(canonical)
  if (mapped === null) return canonical
  const high = Number.parseInt(mapped[1]!, 16); const low = Number.parseInt(mapped[2]!, 16)
  return [high >>> 8, high & 255, low >>> 8, low & 255].join('.')
}

/**
 * Read the authenticated transport's peer address, ignoring forwarding headers.
 * @param request - Node socket facts or an in-process request without them.
 * @returns Canonical peer IP; requests without a real address cannot use key login.
 */
export function clientIp(request: ConnectionTrustRequest): string | undefined { return socketIp(request.socket?.remoteAddress) }
