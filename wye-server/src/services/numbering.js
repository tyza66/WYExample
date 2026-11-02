// 单据号生成：用 wye_sequence 表在事务内自增，保证并发不重号
import { prisma } from '../db/prisma.js'

/** 在给定事务里取下一个序列值 */
export async function nextSequence(tx, key) {
  const client = tx || prisma
  const row = await client.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } }
  })
  return row.value
}

/** 账单号 B + yyyyMM + 6 位流水 */
export async function nextBillNo(tx, period) {
  const month = String(period).replace('-', '')
  const seq = await nextSequence(tx, `bill:${month}`)
  return `B${month}${String(seq).padStart(6, '0')}`
}

/** 收款单号 P + yyyyMMdd + 6 位流水 */
export async function nextPaymentNo(tx, day) {
  const date = String(day).replace(/-/g, '')
  const seq = await nextSequence(tx, `payment:${date}`)
  return `P${date}${String(seq).padStart(6, '0')}`
}
