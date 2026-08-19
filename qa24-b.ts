import { prisma } from "@/lib/prisma";
const inv = await prisma.invoice.findUnique({ where: { id: "cmrrwashj00012lbrhfmc5kk9" }, select: { invoiceNumber: true, totalAmount: true } });
const part = await prisma.part.findUnique({ where: { id: "cmrrv7zn300032lorsti1dmxt" }, select: { name: true, sku: true } });
const sale = await prisma.sale.findUnique({ where: { id: "cmsaft9fg00002lmp8h6mhgkh" }, select: { saleNumber: true, totalAmount: true } });
console.log(JSON.stringify({ inv, part, sale }));
