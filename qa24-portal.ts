import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import { makeSignature } from "better-auth/crypto";
const org = "org_eis_01";
const clients = await prisma.client.findMany({ where: { orgId: org }, select: { id: true, fullName: true }, take: 2 });
const [mine, other] = clients;
let pu = await prisma.portalUser.findFirst({ where: { orgId: org, clientId: mine.id }, select: { id: true } });
if (!pu) pu = await prisma.portalUser.create({ data: { orgId: org, clientId: mine.id, name: "QA Portal", email: `qa-portal-idor-${Date.now()}@example.com`, passwordHash: "x", role: "ORG_ADMIN", isActive: true }, select: { id: true } });
const t = randomBytes(24).toString("hex");
await prisma.portalSession.create({ data: { token: t, portalUserId: pu.id, expiresAt: new Date(Date.now()+3600_000) } });
const sig = (await makeSignature(t, process.env.BETTER_AUTH_SECRET!)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
// a job belonging to the OTHER client
const otherJob = await prisma.job.findFirst({ where: { orgId: org, clientId: other.id }, select: { id: true, jobNumber: true } });
const myJob = await prisma.job.findFirst({ where: { orgId: org, clientId: mine.id }, select: { id: true, jobNumber: true } });
console.log(JSON.stringify({ cookie: `${t}.${sig}`, mine: mine.fullName, other: other.fullName, otherJob, myJob }));
