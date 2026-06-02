import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const user = process.env.BASIC_AUTH_USER || 'samurai'
  const pass = process.env.BASIC_AUTH_PASS || 'molts2024'
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')
  if (auth === expected) return NextResponse.next()
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  })
}

export const config = { matcher: ['/((?!api).*)'] }
