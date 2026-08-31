import { NextRequest } from "next/server";

import { ensureDefaultAiKnowledge, formatKnowledgeContext, retrieveAiKnowledge } from "@/lib/ai-knowledge";
import { matchProcedure, renderProcedure } from "@/lib/ai-knowledge";
import { askGuide, guideConfigured, guideModel, guideErrorMessage, type GuideTurn } from "@/lib/ai/guide-model";
import { getAiSettings, logAiPrompt, redactPii } from "@/lib/ai-governance";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCurrentUserRoleOptional } from "@/lib/session";

// ── System prompt ─────────────────────────────────────────────────────────────



// ── Route handler ─────────────────────────────────────────────────────────────

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "model"; text?: string; parts?: [{ text: string }] };

type GuideIntent = {
  any: string[];
  all?: string[];
  actionAny?: string[];
  answer: string[];
};

const GUIDE_INTENTS: GuideIntent[] = [
  {
    any: [
      "management focus",
      "focus on today",
      "focus today",
      "business focus",
      "decision",
      "ai insights",
      "business copilot",
      "what should management",
      "what should i focus",
      "what needs attention",
    ],
    answer: [
      "For management decision-making, use AI Insights rather than the general help guide:",
      "1. Open AI Insights from the sidebar, or go to /ai-insights.",
      "2. Review the top KPI cards first: revenue signal, cash margin signal, open pipeline, and inventory risk.",
      "3. Check Needs your attention for overdue jobs, stale jobs, awaiting approvals, low stock, overdue invoices, and overdue supplier bills.",
      "4. Use What to do next to decide what to assign today.",
      "5. Ask the AI Business Copilot questions like: What should management focus on today? Which repairs are stuck? What inventory risks should we fix first? Why is cash margin under pressure?",
      "A good daily management focus is usually: clear stuck repairs, follow up client approvals, collect overdue receivables, reorder critical low-stock items, and review expenses if cash margin is weak.",
    ],
  },
  {
    any: ["revenue", "profit", "cash flow", "cash margin", "receivables", "payables", "overdue invoice", "financial risk"],
    answer: [
      "For revenue, profit, cash flow, receivables, and payables analysis:",
      "1. Open AI Insights -> AI Business Copilot.",
      "2. Ask a focused question, for example: Why might revenue or profit be under pressure?",
      "3. The copilot uses tenant-scoped aggregate numbers from repairs, POS, paid invoices, expenses, receivables, supplier bills, and targets.",
      "4. Then open Finance -> Reports for formal P&L, Cash Flow, Aged Receivables, Balance Sheet, and Inventory Value reports.",
      "Management should prioritise overdue receivables, negative cash margin, falling revenue versus last month, and expenses growing faster than revenue.",
    ],
  },
  {
    any: ["part", "parts", "stock item", "inventory item"],
    actionAny: ["add", "create", "new", "register"],
    answer: [
      "To add inventory items to inventory:",
      "1. Open Inventory -> Inventory Items.",
      "2. Choose Add Item.",
      "3. Enter the item name, SKU/code, manufacturer if available, unit cost, quantity on hand, and reorder level.",
      "4. If your setup uses locations, choose the stock location where the item is stored.",
      "5. Save the item. It will appear in inventory and can be used for repairs, POS sales, purchase orders, stock counts, and reorder alerts.",
      "6. If the item is being bought from a supplier, use Inventory -> Purchase Orders, then Inventory -> Goods Received to increase stock cleanly.",
      "If you cannot see the add button, check that your role has inventory/admin permissions.",
    ],
  },
  {
    any: ["supplier", "vendor"],
    actionAny: ["add", "create", "new", "register"],
    answer: [
      "To add a supplier:",
      "1. Open Inventory -> Suppliers.",
      "2. Choose New Supplier or Add Supplier.",
      "3. Enter supplier name, contact person, phone, email, address, and notes if available.",
      "4. Save the supplier.",
      "5. Use that supplier later on Purchase Orders, Goods Received, Supplier Bills, and supplier payment workflows.",
      "If the button is missing, check inventory/admin permissions.",
    ],
  },
  {
    any: ["purchase order", "po"],
    answer: [
      "To create a purchase order:",
      "1. Open Inventory -> Purchase Orders.",
      "2. Choose New Purchase Order.",
      "3. Select the supplier and add the inventory items, quantities, expected cost, and notes.",
      "4. Save or submit the PO depending on your workflow.",
      "5. When items arrive, open Inventory -> Goods Received to receive stock against the PO.",
      "6. Record the supplier invoice under Inventory -> Supplier Bills if applicable.",
    ],
  },
  {
    any: ["goods received", "receive stock", "receive items", "grn"],
    answer: [
      "To receive stock:",
      "1. Open Inventory -> Goods Received.",
      "2. Choose New Goods Received or open the related Purchase Order and click Receive.",
      "3. Confirm supplier, PO, receiving location, quantities received, and any notes.",
      "4. Save the receipt. Stock quantities increase from this transaction.",
      "5. If the supplier sent an invoice, record it under Supplier Bills.",
      "Use Goods Received instead of manually editing stock when stock comes from suppliers.",
    ],
  },
  {
    any: ["stock count", "count stock", "adjust stock", "reconcile stock"],
    answer: [
      "To do a stock count:",
      "1. Open Inventory -> Stock Counts.",
      "2. Choose New Stock Count.",
      "3. Select the location and enter the physical counted quantities.",
      "4. Review variances between system quantity and counted quantity.",
      "5. Submit/approve the count according to your permissions.",
      "Use stock counts for reconciliation, not for supplier receiving.",
    ],
  },
  {
    any: ["expense", "expenses"],
    actionAny: ["add", "create", "new", "record"],
    answer: [
      "To record an expense:",
      "1. Open Finance -> Expenses.",
      "2. Choose Add Expense.",
      "3. Enter date, amount, category/account, payment method, supplier/payee, and description.",
      "4. Attach or reference supporting documents if your workflow requires it.",
      "5. Save the expense. It will feed finance reporting where configured.",
    ],
  },
  {
    any: ["invoice", "invoices"],
    actionAny: ["create", "generate", "new", "make", "issue"],
    answer: [
      "To create or generate an invoice:",
      "1. For repair jobs, open the job and go to the Documents/Financials area, then generate the invoice when the job is ready for billing.",
      "2. For manual/service invoices, open Documents -> Invoices and choose New Invoice if available for your role.",
      "3. Confirm client, line items, tax/VAT, totals, and due date.",
      "4. Save or issue the invoice.",
      "5. Record payment through receipts/payment controls when the client pays.",
      "If invoice generation fails, check job status, client bill/final cost, branding settings, and finance permissions.",
    ],
  },
  {
    any: ["receipt", "payment"],
    all: ["record"],
    answer: [
      "To record a customer payment/receipt:",
      "1. Open Documents -> Receipts or the related invoice/job payment area.",
      "2. Select the client/invoice/sale being paid.",
      "3. Enter amount, payment method, reference, and payment date.",
      "4. Save the payment/receipt.",
      "5. Confirm the invoice or customer statement reflects the new balance.",
    ],
  },
  {
    any: ["pos", "counter sale", "walk-in sale"],
    answer: [
      "To make a POS sale:",
      "1. Open POS.",
      "2. Add products/services to the sale.",
      "3. Confirm quantities, discounts, tax/VAT, and total.",
      "4. Record payment method: cash, card, mobile money, or other configured method.",
      "5. Complete the sale and issue a receipt if needed.",
    ],
  },
  {
    any: ["lead", "prospect"],
    actionAny: ["create", "add", "new", "register"],
    answer: [
      "To create a sales lead:",
      "1. Open Sales -> Leads.",
      "2. Choose New Lead.",
      "3. Enter name, phone, email, organisation, interest/source, estimated value, and notes.",
      "4. Assign a salesperson or follow-up date if required.",
      "5. Save the lead and update activities as follow-ups happen.",
    ],
  },
  {
    any: ["campaign", "marketing"],
    answer: [
      "To create a campaign:",
      "1. Open Sales -> Campaigns.",
      "2. Choose New Campaign.",
      "3. Set campaign name, type/channel, target audience, message/template, and schedule if supported.",
      "4. Review recipients before sending.",
      "5. Track delivery/results from the campaign and notification/outbox pages.",
      "If WhatsApp messages fail, check template names, WhatsApp config, recipient phone format, and outbox status.",
    ],
  },
  {
    any: ["user", "staff", "employee", "technician"],
    actionAny: ["add", "create", "new", "register", "invite"],
    answer: [
      "To add a staff user:",
      "1. Open Settings -> Users.",
      "2. Choose Create User.",
      "3. Enter name, email, phone, temporary password, and role.",
      "4. Save the user.",
      "5. Select the user to adjust permissions or reset their password later.",
      "Only tenant admins can manage users inside their organisation. Platform admins manage organisations separately.",
    ],
  },
  {
    any: ["password", "reset password"],
    answer: [
      "To reset a user's password:",
      "1. Open Settings -> Users.",
      "2. Select the user.",
      "3. Use Reset Password.",
      "4. Enter and confirm the new temporary password.",
      "5. Tell the user to sign in and change it if your process requires that.",
      "For security, do not share passwords in public chat or tickets.",
    ],
  },
  {
    any: ["company", "organisation", "organization", "tenant"],
    actionAny: ["create", "add", "new", "register", "onboard"],
    answer: [
      "To create a company/tenant:",
      "1. Sign in as platform admin.",
      "2. Open Platform Admin -> Organisations.",
      "3. Use the create-company/onboarding flow if enabled, or direct the company to /company signup.",
      "4. Enter company name, slug, admin contact, plan, phone/email, and default settings.",
      "5. Create the first admin user for that company.",
      "6. Confirm the company appears in Platform Admin and the admin can log into their tenant workspace.",
    ],
  },
  {
    any: ["job", "repair", "intake"],
    actionAny: ["create", "add", "new", "open", "register"],
    answer: [
      "To create a repair job:",
      "1. Open Jobs -> New Job, or use the intake/new repair shortcut if your sidebar shows it.",
      "2. Search the client by phone first to avoid duplicates.",
      "3. Enter client details, device type, brand, model, serial/IMEI, accessories, and physical condition notes.",
      "4. Enter the customer's issue description in their own words.",
      "5. Upload before-repair photos if needed.",
      "6. Review and submit. The system creates the job number and starts the job as RECEIVED.",
      "Only ADMIN/OPS-style roles can create jobs unless your tenant permissions were customised.",
    ],
  },
  {
    any: ["technician", "tech", "assignee", "assign"],
    actionAny: ["assign", "send", "refer", "allocate"],
    answer: [
      "To assign a technician:",
      "1. Open the job detail page.",
      "2. Use the assignment/action panel or edit job screen, depending on your role.",
      "3. Select an internal technician for in-house work, or choose an external technician when the job is referred out.",
      "4. Save the assignment. The audit timeline should record who assigned the technician and when.",
      "5. For external technicians, confirm only device and diagnosis details are visible; client details and pricing history must remain hidden.",
      "If a technician cannot see the job, confirm they are active, assigned to that job, and using the correct tenant account.",
    ],
  },
];

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function hasAll(text: string, words: string[]) {
  return words.every((word) => text.includes(word));
}

function intentAnswer(message: string) {
  const text = message.toLowerCase();
  const normalized = text
    .replace(/how do i|how to|where do i|can i|please|\?/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const intent of GUIDE_INTENTS) {
    if (
      hasAny(normalized, intent.any) &&
      (!intent.all || hasAll(normalized, intent.all)) &&
      (!intent.actionAny || hasAny(normalized, intent.actionAny))
    ) {
      return intent.answer.join("\n");
    }
  }

  return null;
}

function _fallbackAnswer(message: string) {
  const text = message.toLowerCase();

  const knownIntent = intentAnswer(message);
  if (knownIntent) return knownIntent;

  if (text.includes("job") && (text.includes("create") || text.includes("new") || text.includes("intake"))) {
    return [
      "To create a repair job in Duuka ProMax:",
      "1. Open Jobs -> New Job.",
      "2. Enter the client name, phone, email, and organisation if available. Search by phone first to avoid duplicates.",
      "3. Add the device type, brand, model, serial/IMEI, accessories, and physical condition notes.",
      "4. Enter the customer's issue description in their own words.",
      "5. Review and submit. The system creates/updates the client, generates the job number, saves the device, and starts the job as RECEIVED.",
      "If submission fails, check required fields, duplicate phone handling, and whether your role can create jobs.",
    ].join("\n");
  }

  if (text.includes("external") || text.includes("technician")) {
    return [
      "External technician access is intentionally restricted for client privacy:",
      "1. They only see assigned jobs.",
      "2. They can view job number, device type, brand, model, serial/IMEI, accessories, diagnosis summary, parts needed, estimate, and timeline.",
      "3. They must not see client name, phone, email, organisation, invoices, client bill, or pricing history.",
      "4. They can submit/update external diagnosis, parts needed, their estimate, and expected timeline.",
      "If an external technician sees client details, treat it as a security issue and check the job detail component/API route immediately.",
    ].join("\n");
  }

  if (text.includes("status") || text.includes("workflow")) {
    return [
      "The repair workflow should be moved from the job detail page so every change is audited:",
      "1. RECEIVED -> DIAGNOSING when a technician starts checking the device.",
      "2. DIAGNOSING -> IN_REPAIR for in-house work, or REFERRED when external repair is needed.",
      "3. REFERRED/external states -> AWAITING_APPROVAL after the estimate/timeline is ready.",
      "4. AWAITING_APPROVAL -> IN_REPAIR if the client approves, or CLOSED if declined/unrepairable.",
      "5. IN_REPAIR -> READY_FOR_PICKUP or COMPLETED when work is done.",
      "Use notes and the audit timeline to explain why a status changed.",
    ].join("\n");
  }

  if (text.includes("invoice") || text.includes("quotation") || text.includes("quote")) {
    return [
      "Quotations and invoices are controlled financial documents:",
      "1. Generate a quotation after diagnosis when the client-facing estimate is ready.",
      "2. Use the job Documents tab or Documents -> Quotations, depending on the workflow screen.",
      "3. Only authorised admin/finance/OPS users should see or generate client pricing documents.",
      "4. Generate an invoice when the job is completed or ready for billing.",
      "5. If a document cannot generate, check job status, client bill/final cost, user permissions, and document branding settings.",
    ].join("\n");
  }

  if (text.includes("client") || text.includes("customer")) {
    return [
      "Clients are managed from the Clients section by authorised front-desk, OPS, and admin users.",
      "Search by phone before creating a job to avoid duplicate client records.",
    ].join("\n");
  }

  if (text.includes("report") || text.includes("finance")) {
    return [
      "Finance in Duuka ProMax covers accounting, cash tracking, expenses, invoices, and reports:",
      "1. Finance -> Expenses records business costs against categories/accounts.",
      "2. Finance -> Bank tracks bank accounts and transactions.",
      "3. Finance -> Reports contains P&L, Balance Sheet, Cash Flow, Aged Receivables, Customer Statements, and Inventory Value.",
      "4. Use Documents -> Invoices/Receipts/Credit Notes/Refunds for client-facing financial documents.",
      "If totals look wrong, check invoice status, payments, refunds, expense dates, and account mappings.",
    ].join("\n");
  }

  if (text.includes("part") && (text.includes("add") || text.includes("create") || text.includes("new"))) {
    return [
      "To add inventory items to inventory:",
      "1. Open Inventory -> Inventory Items.",
      "2. Choose Add Item.",
      "3. Enter the item name, SKU/code, manufacturer if available, unit cost, quantity on hand, and reorder level.",
      "4. If your setup uses locations, choose the stock location where the item is stored.",
      "5. Save the item. It will appear in inventory and can be used for repairs, sales, purchase orders, stock counts, and reorder alerts.",
      "6. For supplier purchases, create a Purchase Order, then receive stock through Goods Received instead of manually increasing quantity.",
      "If you cannot see the add button, check that your role has inventory/admin permissions.",
    ].join("\n");
  }

  if (text.includes("inventory") || text.includes("stock") || text.includes("part") || text.includes("supplier") || text.includes("purchase")) {
    return [
      "Inventory and procurement workflow:",
      "1. Inventory -> Inventory Items shows items, quantities, costs, and reorder levels.",
      "2. Inventory -> Purchase Requests captures internal requests before buying.",
      "3. Inventory -> Purchase Orders sends/records orders to suppliers.",
      "4. Inventory -> Goods Received records stock received against a PO.",
      "5. Inventory -> Supplier Bills tracks supplier invoices and payment status.",
      "6. Inventory -> Stock Counts reconciles physical counts with system quantities.",
      "7. Inventory -> Transfers moves stock between locations.",
      "If stock is wrong, review goods received, stock counts, transfers, sales, and item reservations.",
    ].join("\n");
  }

  if (text.includes("pos") || text.includes("cashier") || text.includes("sale")) {
    return [
      "Sales and POS workflow:",
      "1. POS handles walk-in counter sales and payments.",
      "2. Sales CRM tracks leads, quotations, campaigns, and sales visits.",
      "3. Documents can issue invoices, receipts, delivery notes, credit notes, and refunds.",
      "4. Sales managers can review targets and team performance where permissions allow.",
      "Cash is reconciled day-by-day in Finance (cash received vs expenses), not per shift.",
      "If a sale cannot be completed, check payment method, stock availability, and user role.",
    ].join("\n");
  }

  if (text.includes("campaign") || text.includes("lead") || text.includes("crm") || text.includes("whatsapp") || text.includes("message")) {
    return [
      "CRM and communications workflow:",
      "1. Sales -> Leads records prospects and follow-ups.",
      "2. Sales -> Campaigns sends or tracks marketing outreach to leads/clients.",
      "3. Settings -> Notifications controls templates, policies, WhatsApp settings, and outbox review.",
      "4. WhatsApp/email messages are queued in the outbox and can be retried if delivery fails.",
      "5. Use approved templates for structured repair updates and campaign messages.",
      "If messages are not sending, check WhatsApp config, template names, recipient phone format, outbox status, and retry logs.",
    ].join("\n");
  }

  if (text.includes("platform") || text.includes("organisation") || text.includes("organization") || text.includes("company") || text.includes("tenant")) {
    return [
      "Platform administration manages the multi-tenant side of Duuka ProMax:",
      "1. Platform Admin -> Organisations lists all companies/tenants.",
      "2. Open an organisation to review users, jobs, plan, SMS usage, billing history, and company details.",
      "3. Platform admin can activate/deactivate organisations and adjust plans.",
      "4. Tenant admins manage users/settings only inside their own organisation.",
      "5. If a user gets org_inactive, check the user's orgId and whether that organisation is active.",
    ].join("\n");
  }

  if (text.includes("page") || text.includes("menu") || text.includes("module") || text.includes("tour")) {
    return [
      "Duuka ProMax page tour:",
      "1. Dashboard: operational summary and shortcuts.",
      "2. Jobs: repair job list, filters, status tracking, assignments, photos, documents, and audit timeline.",
      "3. Intake: handles repair requests before they become jobs.",
      "4. Clients: customer directory and job history for authorised roles.",
      "5. Technicians: technician assignments, external technician views, and payouts.",
      "6. Field Visits: onsite visit scheduling, assignment, and sign-off.",
      "7. Inventory: items, stock alerts, suppliers, purchase requests/orders, goods received, stock counts, and transfers.",
      "8. POS and Sales: counter sales, leads, campaigns, visits, quotations, and targets.",
      "9. Documents: job cards, invoices, quotations, receipts, delivery notes, credit notes, and refunds.",
      "10. Finance: expenses, bank, recurring billing, accounts, and financial reports.",
      "11. Reports: operational and technician performance reporting.",
      "12. Settings: users, profile, branding, notifications, audit logs, and maintenance tools.",
      "13. Platform Admin: organisations, plans, activation, billing, audit, and platform settings.",
      "Pages shown depend on the user's role and permissions.",
    ].join("\n");
  }

  return [
    "I can help with system-wide Duuka ProMax workflows. Tell me the task you want to complete and I will give detailed steps.",
    "Areas I can guide you through:",
    "1. Creating jobs and intake requests.",
    "2. Assigning internal or external technicians.",
    "3. Moving jobs through diagnosis, approval, repair, and completion.",
    "4. Managing clients without duplicates.",
    "5. Inventory, suppliers, purchase requests, purchase orders, goods received, and stock counts.",
    "6. POS, sales, leads, campaigns, quotations, and targets.",
    "7. Finance, expenses, bank, invoices, receipts, refunds, and reports.",
    "8. WhatsApp/email templates, outbox, notifications, and customer communication.",
    "9. Platform admin, organisations, plans, users, branding, and settings.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`ai-guide:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return new Response("Rate limit exceeded. Please wait a moment.", { status: 429 });
  }
  const { user } = await getCurrentUserRoleOptional();

  // The proxy only checks that a session COOKIE is present — getSessionCookie()
  // does no signature validation — so any request carrying an arbitrary cookie
  // value reached this handler with user === null. That served the org's Gemini
  // quota to anonymous callers and, because getAiSettings(undefined) falls back
  // to permissive defaults, bypassed every per-org AI kill switch as well.
  // The sibling AI routes already return 401 here.
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { message: string; history?: ChatMessage[]; page?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return new Response("Message is required.", { status: 400 });
  }
  if (message.length > 2000) {
    return new Response("Message is too long (max 2000 characters).", { status: 400 });
  }

  try {
    const settings = await getAiSettings(user?.orgId);
    if (!settings.aiEnabled || !settings.guideEnabled) {
      return new Response("AI Guide is disabled for this workspace.", { status: 403 });
    }
    await ensureDefaultAiKnowledge();
    const safeMessage = redactPii(message);
    const pageContext = body.page ? `Current page: ${redactPii(body.page).slice(0, 200)}` : "";
    const knowledgeContext = formatKnowledgeContext(await retrieveAiKnowledge(`${safeMessage}\n${pageContext}`, user?.orgId, 4));
    // Which screen they are on, carried with the question. The workspace's own
    // articles go separately, after the cached corpus — see askGuide.
    const askedFrom = pageContext ? `${safeMessage.trim()}\n\n(${pageContext})` : safeMessage.trim();

    // The stored chat history still uses Gemini's "model" for assistant turns.
    const trimmedHistory: GuideTurn[] = history
      .filter((m) => m.role === "user" || m.role === "model")
      .slice(-10)
      .map((m) => ({
        // "model" was Gemini's name for the assistant turn. The stored chat
        // history still uses it, so it is translated here rather than migrated.
        role: (m.role === "model" ? "assistant" : "user") as GuideTurn["role"],
        text: String(m.text ?? m.parts?.[0]?.text ?? ""),
      }));

    // The corpus answers a well-phrased question on its own, for nothing. Only
    // what it cannot match confidently is worth paying a model for — and the
    // matcher returns null rather than guess, so a near-miss still gets the
    // model's answer instead of a confidently wrong scripted one.
    const matched = matchProcedure(message);
    if (matched) {
      await logAiPrompt({
        orgId: user?.orgId, userId: user?.id, feature: "AI_GUIDE",
        question: message, contextSummary: knowledgeContext, mode: "matched",
      });
      return new Response(renderProcedure(matched), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-ai-guide-mode": "matched",
          // Which procedure answered, so feedback can be attributed to it.
          "x-ai-guide-procedure": matched.id,
        },
      });
    }

    if (!guideConfigured()) {
      await logAiPrompt({
        orgId: user?.orgId, userId: user?.id, feature: "AI_GUIDE",
        question: message, contextSummary: knowledgeContext, mode: "fallback",
      });
      return new Response(
        "I do not have a documented answer for that yet, and the AI Guide is not configured in this environment.\n\n" +
          "Try rephrasing it, or ask an administrator to add a knowledge article under Settings then AI Knowledge.",
        {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-ai-guide-mode": "no-key",
          },
        },
      );
    }

    await logAiPrompt({
      orgId: user?.orgId, userId: user?.id, feature: "AI_GUIDE",
      model: guideModel(), question: message, contextSummary: knowledgeContext, mode: "anthropic",
    });

    const { textStream, usage } = await askGuide({
      question: askedFrom,
      history: trimmedHistory,
      orgKnowledge: knowledgeContext,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          // Logged, not returned: a cache read of zero across repeated
          // questions means the cached prefix is being invalidated by
          // something, and that is worth noticing before the bill does.
          const u = usage();
          if (u) {
            console.info(
              `[ai-guide] ${guideModel()} in=${u.input} out=${u.output} cacheRead=${u.cacheRead} cacheWrite=${u.cacheWrite}`,
            );
          }
        } catch (streamErr) {
          controller.enqueue(encoder.encode(`\n\n${guideErrorMessage(streamErr)}`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
        "cache-control": "no-store",
        "x-ai-guide-mode": "anthropic",
      },
    });
  } catch (err) {
    console.error("[ai-guide] error:", err instanceof Error ? err.message : String(err));
    return new Response(guideErrorMessage(err), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-ai-guide-mode": "error",
      },
    });
  }
}
