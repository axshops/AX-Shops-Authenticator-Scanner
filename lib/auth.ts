import jwt from 'jsonwebtoken'

export function auth(req: Request) {
  const header = req.headers.get('authorization')
  if (!header) throw new Error('Unauthorized')

  const token = header.replace('Bearer ', '')
  return jwt.verify(token, process.env.JWT_SECRET!) as {
    id: string
  }
}
