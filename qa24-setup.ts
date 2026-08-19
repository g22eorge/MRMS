import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { makeSignature } from "better-auth/crypto";
const A = "org_eis_01";
const admin = await prisma.user.findFirst({ where: { role: "ADMIN", orgId: A }, select: { id: true } });
const token = randomBytes(24).toString("hex");
await prisma.session.create({ data: { token, userId: admin!.id, expiresAt: new Date(Date.now()+864e5), createdAt: new Date(), updatedAt: new Date(), ipAddress: "127.0.0.1", userAgent: "qa24" } });
const cookie = encodeURIComponent(`${token}.${await makeSignature(token, process.env.BETTER_AUTH_SECRET!)}`);
// resources belonging to a DIFFERENT org
const otherOrg = await prisma.organization.findFirst({ where: { id: { not: A } }, select: { id: true, name: true } });
const B = otherOrg!.id;
const out = {
  cookie, orgA: A, orgB: B, orgBName: otherOrg!.name,
  client: (await prisma.client.findFirst({ where: { orgId: B }, select: { id: true } }))?.id,
  job: (await prisma.job.findFirst({ where: { orgId: B }, select: { id: true } }))?.id,
  invoice: (await prisma.invoice.findFirst({ where: { orgId: B }, select: { id: true } }))?.id,
  part: (await prisma.part.findFirst({ where: { orgId: B }, select: { id: true } }))?.id,
  sale: (await prisma.sale.findFirst({ where: { orgId: B }, select: { id: true } }))?.id,
};
console.log(JSON.stringify(out));
