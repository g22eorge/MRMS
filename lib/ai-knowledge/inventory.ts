import type { Procedure } from "./types";

/**
 * Stock and procurement.
 *
 * The recurring theme: every quantity change should carry a reason. The system
 * offers a specific document for each way stock legitimately moves — goods
 * received, issue to a job, transfer, count adjustment — and a bare quantity
 * edit is the one path that destroys the audit trail. That is repeated in
 * several entries on purpose, because it is the mistake people actually make.
 */
export const INVENTORY_PROCEDURES: Procedure[] = [
  {
    id: "inv-add-item",
    module: "inventory",
    question: "How do I add a new part or product?",
    asks: ["new item", "add stock item", "create a part", "add a product", "new SKU"],
    roles: ["ADMIN", "OPS", "MANAGER"],
    route: "/inventory",
    steps: [
      "Open Inventory from the sidebar. The list is at /inventory.",
      "Add a new item with its name, SKU, unit cost, selling price and quantity on hand.",
      "Set the reorder level. This is the number that makes the item appear in low-stock warnings.",
      "Save. The item exists with zero stock.",
      "Bring stock in with a goods-received document, not by typing a quantity.",
    ],
    notes: [
      "An item with no reorder level will never warn you it is running out. It is the most useful field on the form and the one most often skipped.",
    ],
    next: ["inv-goods-received", "inv-low-stock"],
  },
  {
    id: "inv-goods-received",
    module: "procurement",
    question: "How do I receive stock from a supplier?",
    asks: ["goods received", "receive stock", "supplier delivery", "book in stock", "GRN", "stock arrived"],
    roles: ["ADMIN", "OPS", "MANAGER"],
    route: "/inventory/goods-received",
    steps: [
      "Open Inventory then Goods Received.",
      "Create a goods-received record, against the purchase order if there was one.",
      "Enter what actually arrived — not what was ordered. Short deliveries are normal and the difference is worth recording.",
      "Save. Stock increases at the chosen location and a stock transaction is written.",
    ],
    notes: [
      "Use this rather than editing quantities. A goods-received record says what arrived, when, from whom and at what cost — which is what your stock valuation is built from.",
    ],
    next: ["inv-purchase-order", "inv-locations"],
  },
  {
    id: "inv-purchase-request",
    module: "procurement",
    question: "How do I request stock that needs ordering?",
    asks: ["purchase request", "request a part", "ask for stock", "need to order something", "requisition"],
    roles: ["ADMIN", "OPS", "TECH_MANAGER", "TECHNICIAN_INTERNAL", "MANAGER"],
    route: "/inventory/purchase-requests",
    steps: [
      "Open Inventory then Purchase Requests, and create one at /inventory/purchase-requests/new.",
      "Add the items and quantities you need, and say why — usually a job that is waiting.",
      "Submit it for approval.",
      "Once approved it can become a purchase order to a supplier.",
    ],
    notes: [
      "A request is an internal ask; a purchase order is a commitment to a supplier. Keeping them separate is what lets someone approve spending before it happens.",
    ],
    next: ["inv-purchase-order"],
  },
  {
    id: "inv-purchase-order",
    module: "procurement",
    question: "How do I raise a purchase order?",
    asks: ["purchase order", "order from supplier", "PO", "buy stock", "place an order"],
    roles: ["ADMIN", "OPS", "MANAGER"],
    route: "/inventory/purchase-orders",
    steps: [
      "Open Inventory then Purchase Orders, and create one at /inventory/purchase-orders/new.",
      "Choose the supplier and add items with quantities and agreed prices.",
      "Save and send it to the supplier.",
      "When the goods arrive, receive them against this order so ordered and received can be compared.",
    ],
    notes: [
      "Open purchase orders are counted on the AI Insights page next to low stock, because 'we are out of it' and 'it is already on order' are very different problems.",
    ],
    next: ["inv-goods-received"],
  },
  {
    id: "inv-low-stock",
    module: "inventory",
    question: "How do I see what is running out?",
    asks: ["low stock", "what needs reordering", "stock warnings", "running out", "reorder report"],
    route: "/inventory",
    steps: [
      "Open Inventory and filter for low stock. An item is low when its quantity is at or below its reorder level.",
      "The AI Insights page shows the count and the top items, alongside jobs that are waiting for parts.",
      "Cross-reference those two lists. A part that is out of stock and blocking three repairs is more urgent than one that is merely low.",
      "Raise a purchase request or order for what you need.",
    ],
    next: ["inv-purchase-request", "ai-insights-read"],
  },
  {
    id: "inv-stock-count",
    module: "inventory",
    question: "How do I do a stock count?",
    asks: ["stocktake", "count stock", "physical count", "inventory audit", "reconcile stock"],
    roles: ["ADMIN", "OPS", "MANAGER"],
    route: "/inventory/stock-counts",
    steps: [
      "Open Inventory then Stock Counts, and start one at /inventory/stock-counts/new.",
      "Pick the location, then for each item type in how many you actually counted.",
      "The system shows the variance between counted and expected.",
      "Review the variances before applying. A large one usually means a movement was never recorded, and applying the count hides that.",
      "Apply the count. Stock adjusts and the adjustment is recorded as a transaction.",
    ],
    notes: [
      "A count that always matches perfectly is a count nobody is really doing. Variances are information.",
    ],
    next: ["inv-locations"],
  },
  {
    id: "inv-transfer",
    module: "inventory",
    question: "How do I move stock between locations?",
    asks: ["stock transfer", "move stock", "send parts to another branch", "transfer between shops"],
    roles: ["ADMIN", "OPS", "MANAGER"],
    route: "/inventory/transfers",
    steps: [
      "Open Inventory then Transfers.",
      "Create a transfer, choosing the source and destination locations.",
      "Add the items and quantities.",
      "Save. Stock decreases at the source and increases at the destination, with a transaction at both ends.",
    ],
    notes: [
      "Transferring is not the same as adjusting twice. A transfer keeps the total constant and explains where the stock went.",
    ],
    next: ["inv-locations"],
  },
  {
    id: "inv-locations",
    module: "inventory",
    question: "How do I set up stock locations?",
    asks: ["stock locations", "warehouse", "branches and stock", "where stock is held", "add a location"],
    roles: ["ADMIN", "MANAGER"],
    route: "/inventory/locations",
    steps: [
      "Open Inventory then Locations.",
      "Add a location for each place stock physically sits — a shop floor, a store room, a branch.",
      "Stock is tracked per location, so the same item can have different quantities in different places.",
      "Item quantity overall is the sum of its locations.",
    ],
    next: ["inv-transfer"],
  },
  {
    id: "inv-suppliers",
    module: "procurement",
    question: "How do I manage suppliers?",
    asks: ["add a supplier", "supplier list", "vendor", "who we buy from", "supplier prices"],
    roles: ["ADMIN", "OPS", "MANAGER"],
    route: "/inventory",
    steps: [
      "Suppliers are reached from the Inventory area in the sidebar.",
      "Add a supplier with their contact details.",
      "Supplier prices can be recorded per item, so purchase orders price themselves.",
      "Supplier bills feed the payables figures in finance.",
    ],
    notes: [
      "Overdue supplier bills appear on the AI Insights page next to overdue customer invoices — what you owe and what you are owed, side by side.",
    ],
    next: ["fin-payables"],
  },
];
