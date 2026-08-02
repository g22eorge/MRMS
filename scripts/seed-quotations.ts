import { PrismaClient, QuotationStatus } from "@prisma/client";
import { nextDocumentNumber } from "../lib/commercial/document-workflow";

const prisma = new PrismaClient();

async function seed() {
  // Use ORG_ID from env or pick first org
  const orgId = process.env.ORG_ID;
  if (!orgId) {
    const orgs = await prisma.organization.findMany({ select: { id: true }, take: 1 });
    if (orgs.length === 0) throw new Error("No organization found. Create an org first.");
    process.env.ORG_ID = orgs[0].id;
  }
  const targetOrgId = orgId!;

  // Ensure a client exists for the quotations
  let client = await prisma.client.findFirst({
    where: { orgId: targetOrgId },
    select: { id: true },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        orgId: targetOrgId,
        fullName: "Test Client",
        phone: "+256700000000",
        email: "test@example.com",
        address: "Kampala, Uganda",
      },
    });
  }

  const statuses: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];
  for (const status of statuses) {
    const quoteNumber = await nextDocumentNumber(prisma, "QT", "quotation", targetOrgId);

    const items = [
      { description: "Service Item 1", quantity: 1, unitPrice: 100000, discount: 0, lineTotal: 100000 },
      { description: "Service Item 2", quantity: 2, unitPrice: 50000, discount: 10000, lineTotal: 90000 },
    ];

    const totalAmount = items.reduce((sum, it) => sum + it.lineTotal, 0);

    await prisma.quotation.create({
      data: {
        orgId: targetOrgId,
        quoteNumber,
        status,
        currency: "UGX",
        totalAmount,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: status === "DRAFT" ? "Draft notes" : undefined,
        clientId: client.id,
        items: { create: items },
      },
    });

    console.log(`Created quotation ${quoteNumber} (${status})`);
  }

  console.log("Seeding complete.");
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
