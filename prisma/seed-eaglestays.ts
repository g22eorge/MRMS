import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function generateInvoiceNumber(orgId: string): Promise<string> {
  const last = await prisma.invoice.findFirst({
    where: { orgId },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  let next = 1;
  if (last?.invoiceNumber?.startsWith(prefix)) {
    const lastNum = parseInt(last.invoiceNumber.replace(prefix, ''), 10);
    next = lastNum + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: 'eaglestays' },
  });
  if (!org) throw new Error('Organization with slug "eaglestays" not found');

  console.log(`Seeding EagleStays (org: ${org.id})`);

  // 1) Ensure VAT tax rate
  let taxRate = await prisma.taxRate.findFirst({
    where: { orgId: org.id, code: 'VAT' },
  });
  if (!taxRate) {
    taxRate = await prisma.taxRate.create({
      data: {
        orgId: org.id,
        code: 'VAT',
        name: 'Value Added Tax',
        rate: 18,
        isDefault: true,
      },
    });
  }

  // 2) Seed parts
  const partsData = [
    { sku: 'LAB-001', name: 'General Labour', unitCost: 50000, qtyOnHand: 999 },
    { sku: 'SCR-001', name: 'Phone Screen', unitCost: 150000, qtyOnHand: 10 },
    { sku: 'BAT-001', name: 'Phone Battery', unitCost: 75000, qtyOnHand: 15 },
    { sku: 'CHG-001', name: 'Charger', unitCost: 35000, qtyOnHand: 20 },
    { sku: 'KBD-001', name: 'Keyboard', unitCost: 120000, qtyOnHand: 12 },
    { sku: 'MB-001', name: 'Motherboard', unitCost: 250000, qtyOnHand: 5 },
  ];
  const parts: any[] = [];
  for (const p of partsData) {
    const existing = await prisma.part.findFirst({
      where: { sku: p.sku, orgId: org.id },
    });
    if (existing) {
      parts.push(existing);
    } else {
      const created = await prisma.part.create({
        data: { ...p, orgId: org.id, isActive: true },
      });
      parts.push(created);
    }
  }

  // 3) Seed clients (idempotent: match by email or phone)
  const clientsData = [
    { fullName: 'Alice Ayo', phone: '+256700111111', email: 'alice@eagelstays.com', organization: 'Acme Ltd', address: 'Kampala' },
    { fullName: 'Bob Mwaka', phone: '+256700222222', email: 'bob@eagelstays.com', organization: 'Beta Inc', address: 'Entebbe' },
    { fullName: 'Caroline Nam', phone: '+256700333333', email: 'caroline@eagelstays.com', organization: 'Gamma Co', address: 'Jinja' },
  ];
  const clients = [];
  for (const c of clientsData) {
    let existing = await prisma.client.findFirst({
      where: { email: c.email, orgId: org.id },
    });
    if (!existing) {
      existing = await prisma.client.findFirst({
        where: { phone: c.phone, orgId: org.id },
      });
    }
    if (existing) {
      clients.push(existing);
    } else {
      const created = await prisma.client.create({
        data: { ...c, orgId: org.id },
      });
      clients.push(created);
    }
  }

  // 4) Find admin user for audit (optional)
  const admin = await prisma.user.findFirst({
    where: { orgId: org.id, role: 'ADMIN' },
  });
  // createdById is not used on Invoice, so we can omit

  // 5) Seed standalone invoices
  const invoiceTemplates = [
    {
      client: clients[0],
      type: 'SERVICE' as const,
      totalAmount: 300000,
      lines: [
        { description: 'Monthly maintenance service', quantity: 1, unitPrice: 300000, taxAmount: 54000 },
      ],
    },
    {
      client: clients[1],
      type: 'SERVICE' as const,
      totalAmount: 180000,
      lines: [
        { description: 'Consulting service', quantity: 2, unitPrice: 90000, taxAmount: 32400 },
      ],
    },
    {
      client: clients[2],
      type: 'REPAIR' as const,
      totalAmount: 250000,
      lines: [
        { description: 'Screen & battery replacement', quantity: 1, unitPrice: 250000, taxAmount: 0 },
      ],
    },
  ];

  for (const tpl of invoiceTemplates) {
    const invoiceNumber = await generateInvoiceNumber(org.id);
    await prisma.invoice.create({
      data: {
        orgId: org.id,
        clientId: tpl.client.id,
        invoiceType: tpl.type,
        invoiceNumber,
        status: 'ISSUED',
        totalAmount: tpl.totalAmount,
        issuedAt: new Date(),
        currency: 'UGX',
        lines: {
          create: tpl.lines.map((line) => ({
            orgId: org.id,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxAmount: line.taxAmount,
            lineTotal: line.quantity * line.unitPrice + line.taxAmount,
          })),
        },
      },
    });
  }

  console.log('✅ Seeded EagleStays with parts, clients, and sample invoices');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
