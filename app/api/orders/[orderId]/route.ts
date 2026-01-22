// app/api/orders/[orderId]/route.ts
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(req: Request, { params }: any) {
  auth(req)
  const order = await db.order.findUnique({
    where: { id: params.orderId },
    include: { scans: true, photos: true }
  })

  if (!order) return new Response('Not found', { status: 404 })
  return Response.json(order)
}
