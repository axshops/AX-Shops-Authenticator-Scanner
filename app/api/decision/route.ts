// app/api/decision/route.ts
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const user = auth(req)
  const body = await req.json()

  const order = await db.order.findUnique({ where: { id: body.orderId } })
  if (!order || order.lockedAt) {
    return new Response('Order locked', { status: 400 })
  }

  await db.$transaction([
    db.decision.create({
      data: {
        orderId: body.orderId,
        authenticatorId: user.id,
        decision: body.decision
      }
    }),
    db.order.update({
      where: { id: body.orderId },
      data: {
        status: body.decision === 'AUTHENTIC' ? 'authenticated' : 'rejected',
        lockedAt: new Date()
      }
    })
  ])

  return Response.json({ ok: true })
}
