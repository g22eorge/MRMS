import type { Procedure } from "./types";

/**
 * Orientation, and the reports area.
 *
 * Both were gaps the coverage report found after the first six files were
 * written — which is the reason the corpus counts itself.
 */
export const GETTING_STARTED_PROCEDURES: Procedure[] = [
  {
    id: "start-what-is-this",
    module: "getting-started",
    question: "What can this system do?",
    asks: ["what is this system", "overview", "what does it do", "modules", "features", "getting started"],
    route: "/dashboard",
    steps: [
      "Repairs — book devices in, diagnose, quote, repair, hand back. This is the spine of the system.",
      "Clients — one record per customer, with their whole history attached.",
      "Documents — quotations, invoices, receipts, delivery notes, credit notes and refunds.",
      "POS — walk-in sales paid on the spot.",
      "Inventory — parts and products, with purchase requests, orders, goods received, counts and transfers.",
      "Finance — expenses, bank accounts, the ledger and the statements.",
      "Sales — leads, campaigns and targets.",
      "Service — field visits, complaints, technicians and payouts.",
      "Communications — WhatsApp and email to customers, with an outbox showing what actually went.",
      "Settings — users and roles, branches, branding, notifications and billing.",
    ],
    next: ["start-first-week", "start-navigate"],
  },
  {
    id: "start-first-week",
    module: "getting-started",
    question: "I am setting this up for the first time — what order should I do things in?",
    asks: ["first time setup", "new workspace", "where do I start", "initial setup", "onboarding", "set up my business"],
    roles: ["ADMIN"],
    route: "/settings",
    steps: [
      "Branding first, at /settings/branding. Your name, address, contact details, tax number and logo print on every document — get this right before you send anything to a customer.",
      "Branches at /settings/branches, if you have more than one location.",
      "Stock locations at /inventory/locations, so stock has somewhere to live.",
      "Tax rates at /finance/tax-rates, if you charge tax.",
      "Bank and cash accounts at /finance/bank — one for each real place money sits.",
      "Users at /settings/users. Give each person the narrowest role that lets them work.",
      "Inventory items, then bring stock in with a goods-received record rather than typing quantities.",
      "WhatsApp at /communications/whatsapp if you want customers messaged automatically, then set which statuses message them under Policies.",
      "Now book in a test repair end to end — intake, diagnose, quote, invoice, receipt — and check the document looks right before going live.",
    ],
    notes: [
      "Do branding before anything customer-facing. An invoice sent with the wrong details is hard to unsend.",
    ],
    next: ["set-branding", "job-create"],
  },
  {
    id: "start-navigate",
    module: "getting-started",
    question: "How do I find my way around?",
    asks: ["navigation", "where is everything", "sidebar", "search", "command palette", "find a page", "keyboard shortcut"],
    route: "/dashboard",
    steps: [
      "The sidebar groups the system by area — repairs, documents, inventory, finance, sales, communications, settings.",
      "The search box in the header is the fastest route to a specific record; it takes job numbers, client names and document numbers.",
      "The dashboard is the daily starting point: what is in progress and what needs attention.",
      "AI Insights at /ai-insights is the management view — what is stuck and what to do about it.",
      "More at /more lists anything not on the main sidebar.",
    ],
    next: ["ai-insights-read", "ai-guide-scope"],
  },
  {
    id: "start-daily",
    module: "getting-started",
    question: "What should I check every morning?",
    asks: ["daily routine", "morning checks", "what to do first", "daily workflow", "start of day"],
    route: "/dashboard",
    steps: [
      "Dashboard — what came in and what is in progress.",
      "Jobs filtered to AWAITING_APPROVAL — clients who have been quoted and not answered. These stall silently.",
      "Jobs filtered to READY_FOR_PICKUP — finished work not yet collected or paid for.",
      "Invoices filtered by aging — who owes money and for how long.",
      "Inventory low stock — anything about to block a repair.",
      "AI Insights pulls all of these into one page if you would rather read one screen.",
    ],
    next: ["ai-insights-read", "inv-overdue"],
  },
  {
    id: "reports-overview",
    module: "reports",
    question: "What reports are available and which should I use?",
    asks: ["reports", "analytics", "business reports", "kpi", "export data", "management reports"],
    roles: ["ADMIN", "FINANCE", "MANAGER", "OPS"],
    route: "/reports",
    steps: [
      "Reports at /reports covers operational performance — repairs, sales and activity.",
      "Financial statements live separately under /finance/reports: profit and loss, balance sheet, cash flow, trial balance and VAT.",
      "AI Insights at /ai-insights is not a report — it is the shortlist of what needs attention today.",
      "Set the date range deliberately on any report. Two people disagreeing about a number are usually looking at two different periods.",
      "Check whether a branch or location filter is applied before concluding a figure is wrong.",
    ],
    notes: [
      "Ask what decision the number is for. Operational reports answer 'how are we doing'; financial statements answer 'what is our position'; insights answers 'what do I do today'.",
    ],
    next: ["fin-reports", "ai-insights-read"],
  },
  {
    id: "pos-deposit",
    module: "pos",
    question: "How do I take a deposit or part payment?",
    asks: ["deposit", "part payment", "partial payment", "pay half now", "advance payment", "installment"],
    roles: ["ADMIN", "OPS", "FINANCE", "FRONT_DESK", "MANAGER"],
    route: "/documents/invoices",
    steps: [
      "For a repair or anything being billed, raise an invoice rather than putting it through POS — POS assumes the money has all arrived.",
      "Record the payment for the amount actually received.",
      "The invoice keeps a balance and stays outstanding; it is not marked paid until the balance reaches zero.",
      "Issue a receipt for the amount received, not the invoice total.",
      "Record the remainder as a second payment when it arrives.",
    ],
    notes: [
      "Do not discount the invoice down to the deposit to make it balance. The debt disappears from your receivables and nobody chases the rest.",
    ],
    next: ["pay-collect", "inv-overdue"],
  },
];
