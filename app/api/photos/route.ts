// app/api/photos/route.ts
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const user = auth(req)
  const body = await req.json()

  await db.photo.create({
    data: {
      orderId: body.orderId,
      authenticatorId: user.id,
      category: body.category,
      url: body.url
    }
  })

  return Response.json({ ok: true })
}
