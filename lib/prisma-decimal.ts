import { Prisma } from "@prisma/client";

/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with: node scripts/pg/generate-decimal-extension.mjs
 *
 * Maps every `Decimal` column to `number` at the Prisma boundary.
 *
 * Money is stored as exact `numeric` in Postgres (see
 * docs/pg-migration/numeric-classification.json: 93 columns across
 * 41 models) while the application reads and writes plain numbers. A
 * `result` extension is what makes those two facts consistent: it changes the
 * field's declared type as well as its value, so TypeScript and the runtime
 * agree. Without it the generated types promise `Decimal` while the code —
 * ~3150 references across ~197 files — treats money as `number`.
 *
 * Optional columns keep `null`; they do not become `0`.
 */

export const decimalToNumberExtension = Prisma.defineExtension({
  name: "decimal-to-number",
  result: {
    bankAccount: {
      currentBalance: {
        needs: { currentBalance: true },
        compute(r) {
          return Number(r.currentBalance);
        },
      },
      openingBalance: {
        needs: { openingBalance: true },
        compute(r) {
          return Number(r.openingBalance);
        },
      },
    },
    bankTransaction: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
    },
    billingEvent: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
    },
    cashierShift: {
      closingCash: {
        needs: { closingCash: true },
        compute(r) {
          return r.closingCash === null || r.closingCash === undefined ? null : Number(r.closingCash);
        },
      },
      openingCash: {
        needs: { openingCash: true },
        compute(r) {
          return Number(r.openingCash);
        },
      },
    },
    creditNote: {
      totalAmount: {
        needs: { totalAmount: true },
        compute(r) {
          return Number(r.totalAmount);
        },
      },
    },
    creditNoteItem: {
      lineTotal: {
        needs: { lineTotal: true },
        compute(r) {
          return Number(r.lineTotal);
        },
      },
      saleUomFactor: {
        needs: { saleUomFactor: true },
        compute(r) {
          return r.saleUomFactor === null || r.saleUomFactor === undefined ? null : Number(r.saleUomFactor);
        },
      },
      unitPrice: {
        needs: { unitPrice: true },
        compute(r) {
          return Number(r.unitPrice);
        },
      },
    },
    customerApproval: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return r.amount === null || r.amount === undefined ? null : Number(r.amount);
        },
      },
    },
    documentBrandingSettings: {
      vatRatePercent: {
        needs: { vatRatePercent: true },
        compute(r) {
          return Number(r.vatRatePercent);
        },
      },
    },
    documentTaxLine: {
      taxableAmount: {
        needs: { taxableAmount: true },
        compute(r) {
          return Number(r.taxableAmount);
        },
      },
      taxAmount: {
        needs: { taxAmount: true },
        compute(r) {
          return Number(r.taxAmount);
        },
      },
      taxRate: {
        needs: { taxRate: true },
        compute(r) {
          return Number(r.taxRate);
        },
      },
    },
    expense: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
      exchangeRateToBase: {
        needs: { exchangeRateToBase: true },
        compute(r) {
          return r.exchangeRateToBase === null || r.exchangeRateToBase === undefined ? null : Number(r.exchangeRateToBase);
        },
      },
    },
    goodsReceivedItem: {
      unitCost: {
        needs: { unitCost: true },
        compute(r) {
          return Number(r.unitCost);
        },
      },
    },
    invoice: {
      paidAmount: {
        needs: { paidAmount: true },
        compute(r) {
          return Number(r.paidAmount);
        },
      },
      totalAmount: {
        needs: { totalAmount: true },
        compute(r) {
          return Number(r.totalAmount);
        },
      },
    },
    invoiceLine: {
      costAtSale: {
        needs: { costAtSale: true },
        compute(r) {
          return r.costAtSale === null || r.costAtSale === undefined ? null : Number(r.costAtSale);
        },
      },
      discountAmount: {
        needs: { discountAmount: true },
        compute(r) {
          return Number(r.discountAmount);
        },
      },
      lineTotal: {
        needs: { lineTotal: true },
        compute(r) {
          return Number(r.lineTotal);
        },
      },
      quantity: {
        needs: { quantity: true },
        compute(r) {
          return Number(r.quantity);
        },
      },
      saleUomFactor: {
        needs: { saleUomFactor: true },
        compute(r) {
          return r.saleUomFactor === null || r.saleUomFactor === undefined ? null : Number(r.saleUomFactor);
        },
      },
      taxAmount: {
        needs: { taxAmount: true },
        compute(r) {
          return Number(r.taxAmount);
        },
      },
      unitPrice: {
        needs: { unitPrice: true },
        compute(r) {
          return Number(r.unitPrice);
        },
      },
    },
    job: {
      clientBill: {
        needs: { clientBill: true },
        compute(r) {
          return r.clientBill === null || r.clientBill === undefined ? null : Number(r.clientBill);
        },
      },
      externalTechBill: {
        needs: { externalTechBill: true },
        compute(r) {
          return r.externalTechBill === null || r.externalTechBill === undefined ? null : Number(r.externalTechBill);
        },
      },
      externalTechFee: {
        needs: { externalTechFee: true },
        compute(r) {
          return r.externalTechFee === null || r.externalTechFee === undefined ? null : Number(r.externalTechFee);
        },
      },
    },
    journalEntry: {
      totalAmount: {
        needs: { totalAmount: true },
        compute(r) {
          return Number(r.totalAmount);
        },
      },
    },
    journalLine: {
      credit: {
        needs: { credit: true },
        compute(r) {
          return Number(r.credit);
        },
      },
      debit: {
        needs: { debit: true },
        compute(r) {
          return Number(r.debit);
        },
      },
    },
    lead: {
      estimatedValue: {
        needs: { estimatedValue: true },
        compute(r) {
          return r.estimatedValue === null || r.estimatedValue === undefined ? null : Number(r.estimatedValue);
        },
      },
    },
    oneTimeExternalTechAssignment: {
      agreedRepairCost: {
        needs: { agreedRepairCost: true },
        compute(r) {
          return r.agreedRepairCost === null || r.agreedRepairCost === undefined ? null : Number(r.agreedRepairCost);
        },
      },
      expectedPartsCost: {
        needs: { expectedPartsCost: true },
        compute(r) {
          return r.expectedPartsCost === null || r.expectedPartsCost === undefined ? null : Number(r.expectedPartsCost);
        },
      },
    },
    orgSubscriptionEvent: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return r.amount === null || r.amount === undefined ? null : Number(r.amount);
        },
      },
    },
    part: {
      purchaseUomFactor: {
        needs: { purchaseUomFactor: true },
        compute(r) {
          return r.purchaseUomFactor === null || r.purchaseUomFactor === undefined ? null : Number(r.purchaseUomFactor);
        },
      },
      qtyOnHand: {
        needs: { qtyOnHand: true },
        compute(r) {
          return Number(r.qtyOnHand);
        },
      },
      saleUomFactor: {
        needs: { saleUomFactor: true },
        compute(r) {
          return r.saleUomFactor === null || r.saleUomFactor === undefined ? null : Number(r.saleUomFactor);
        },
      },
      sellingPrice: {
        needs: { sellingPrice: true },
        compute(r) {
          return r.sellingPrice === null || r.sellingPrice === undefined ? null : Number(r.sellingPrice);
        },
      },
      taxRate: {
        needs: { taxRate: true },
        compute(r) {
          return r.taxRate === null || r.taxRate === undefined ? null : Number(r.taxRate);
        },
      },
      unitCost: {
        needs: { unitCost: true },
        compute(r) {
          return r.unitCost === null || r.unitCost === undefined ? null : Number(r.unitCost);
        },
      },
    },
    partReservation: {
      unitCostSnapshot: {
        needs: { unitCostSnapshot: true },
        compute(r) {
          return r.unitCostSnapshot === null || r.unitCostSnapshot === undefined ? null : Number(r.unitCostSnapshot);
        },
      },
    },
    partStockTransaction: {
      quantity: {
        needs: { quantity: true },
        compute(r) {
          return Number(r.quantity);
        },
      },
      unitCost: {
        needs: { unitCost: true },
        compute(r) {
          return r.unitCost === null || r.unitCost === undefined ? null : Number(r.unitCost);
        },
      },
    },
    payment: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
      exchangeRateToBase: {
        needs: { exchangeRateToBase: true },
        compute(r) {
          return r.exchangeRateToBase === null || r.exchangeRateToBase === undefined ? null : Number(r.exchangeRateToBase);
        },
      },
    },
    paymentAllocation: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
    },
    posSession: {
      actualClosingBalance: {
        needs: { actualClosingBalance: true },
        compute(r) {
          return r.actualClosingBalance === null || r.actualClosingBalance === undefined ? null : Number(r.actualClosingBalance);
        },
      },
      cardTotal: {
        needs: { cardTotal: true },
        compute(r) {
          return Number(r.cardTotal);
        },
      },
      cashTotal: {
        needs: { cashTotal: true },
        compute(r) {
          return Number(r.cashTotal);
        },
      },
      closingCash: {
        needs: { closingCash: true },
        compute(r) {
          return r.closingCash === null || r.closingCash === undefined ? null : Number(r.closingCash);
        },
      },
      mobileTotal: {
        needs: { mobileTotal: true },
        compute(r) {
          return Number(r.mobileTotal);
        },
      },
      openingFloat: {
        needs: { openingFloat: true },
        compute(r) {
          return Number(r.openingFloat);
        },
      },
      totalSales: {
        needs: { totalSales: true },
        compute(r) {
          return Number(r.totalSales);
        },
      },
    },
    purchaseOrderItem: {
      unitCost: {
        needs: { unitCost: true },
        compute(r) {
          return Number(r.unitCost);
        },
      },
    },
    purchaseRequestItem: {
      estimatedUnitCost: {
        needs: { estimatedUnitCost: true },
        compute(r) {
          return r.estimatedUnitCost === null || r.estimatedUnitCost === undefined ? null : Number(r.estimatedUnitCost);
        },
      },
    },
    quotation: {
      discountAmount: {
        needs: { discountAmount: true },
        compute(r) {
          return Number(r.discountAmount);
        },
      },
      subtotal: {
        needs: { subtotal: true },
        compute(r) {
          return Number(r.subtotal);
        },
      },
      taxRate: {
        needs: { taxRate: true },
        compute(r) {
          return r.taxRate === null || r.taxRate === undefined ? null : Number(r.taxRate);
        },
      },
      totalAmount: {
        needs: { totalAmount: true },
        compute(r) {
          return Number(r.totalAmount);
        },
      },
      vatAmount: {
        needs: { vatAmount: true },
        compute(r) {
          return Number(r.vatAmount);
        },
      },
    },
    quotationItem: {
      discount: {
        needs: { discount: true },
        compute(r) {
          return Number(r.discount);
        },
      },
      lineTotal: {
        needs: { lineTotal: true },
        compute(r) {
          return Number(r.lineTotal);
        },
      },
      unitPrice: {
        needs: { unitPrice: true },
        compute(r) {
          return Number(r.unitPrice);
        },
      },
    },
    receipt: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
    },
    recurringInvoiceItem: {
      discountAmount: {
        needs: { discountAmount: true },
        compute(r) {
          return Number(r.discountAmount);
        },
      },
      lineTotal: {
        needs: { lineTotal: true },
        compute(r) {
          return Number(r.lineTotal);
        },
      },
      quantity: {
        needs: { quantity: true },
        compute(r) {
          return Number(r.quantity);
        },
      },
      unitPrice: {
        needs: { unitPrice: true },
        compute(r) {
          return Number(r.unitPrice);
        },
      },
    },
    refund: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
      exchangeRateToBase: {
        needs: { exchangeRateToBase: true },
        compute(r) {
          return r.exchangeRateToBase === null || r.exchangeRateToBase === undefined ? null : Number(r.exchangeRateToBase);
        },
      },
    },
    sale: {
      discountAmount: {
        needs: { discountAmount: true },
        compute(r) {
          return Number(r.discountAmount);
        },
      },
      paidAmount: {
        needs: { paidAmount: true },
        compute(r) {
          return Number(r.paidAmount);
        },
      },
      subtotal: {
        needs: { subtotal: true },
        compute(r) {
          return Number(r.subtotal);
        },
      },
      totalAmount: {
        needs: { totalAmount: true },
        compute(r) {
          return Number(r.totalAmount);
        },
      },
      vatAmount: {
        needs: { vatAmount: true },
        compute(r) {
          return Number(r.vatAmount);
        },
      },
    },
    saleItem: {
      costAtSale: {
        needs: { costAtSale: true },
        compute(r) {
          return r.costAtSale === null || r.costAtSale === undefined ? null : Number(r.costAtSale);
        },
      },
      lineTotal: {
        needs: { lineTotal: true },
        compute(r) {
          return Number(r.lineTotal);
        },
      },
      saleUomFactor: {
        needs: { saleUomFactor: true },
        compute(r) {
          return r.saleUomFactor === null || r.saleUomFactor === undefined ? null : Number(r.saleUomFactor);
        },
      },
      unitPrice: {
        needs: { unitPrice: true },
        compute(r) {
          return Number(r.unitPrice);
        },
      },
    },
    salesTarget: {
      targetRevenue: {
        needs: { targetRevenue: true },
        compute(r) {
          return Number(r.targetRevenue);
        },
      },
    },
    supplierBill: {
      paidAmount: {
        needs: { paidAmount: true },
        compute(r) {
          return Number(r.paidAmount);
        },
      },
      subtotal: {
        needs: { subtotal: true },
        compute(r) {
          return Number(r.subtotal);
        },
      },
      taxAmount: {
        needs: { taxAmount: true },
        compute(r) {
          return Number(r.taxAmount);
        },
      },
      totalAmount: {
        needs: { totalAmount: true },
        compute(r) {
          return Number(r.totalAmount);
        },
      },
    },
    supplierBillItem: {
      lineTotal: {
        needs: { lineTotal: true },
        compute(r) {
          return Number(r.lineTotal);
        },
      },
      unitCost: {
        needs: { unitCost: true },
        compute(r) {
          return Number(r.unitCost);
        },
      },
    },
    supplierPayment: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
    },
    supplierPrice: {
      unitCost: {
        needs: { unitCost: true },
        compute(r) {
          return Number(r.unitCost);
        },
      },
    },
    taxRate: {
      rate: {
        needs: { rate: true },
        compute(r) {
          return Number(r.rate);
        },
      },
    },
    technicianPayout: {
      amount: {
        needs: { amount: true },
        compute(r) {
          return Number(r.amount);
        },
      },
    },
  },
});
