// app/api/scans/route.ts
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const user = auth(req)
  const body = await req.json()

  const order = await db.order.findUnique({ where: { id: body.orderId } })
  if (!order || order.lockedAt) {
    return new Response('Order locked', { status: 400 })
  }

  await db.scan.create({
    data: {
      orderId: body.orderId,
      authenticatorId: user.id,
      componentType: body.componentType,
      scanValue: body.scanValue,
      deviceMetadata: body.device
    }
  })

  return Response.json({ ok: true })
}
