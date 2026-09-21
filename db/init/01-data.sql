--
-- PostgreSQL database dump
--

\restrict hATBZhmc20SfXWo8WgZHxBJQVcXHWOoMMe7ueOM2otFgwAdsG5BMBD2a46CAP44

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public."WarrantyClaim" DROP CONSTRAINT IF EXISTS "WarrantyClaim_warrantyJobId_fkey";
ALTER TABLE IF EXISTS ONLY public."WarrantyClaim" DROP CONSTRAINT IF EXISTS "WarrantyClaim_originalJobId_fkey";
ALTER TABLE IF EXISTS ONLY public."WarrantyClaim" DROP CONSTRAINT IF EXISTS "WarrantyClaim_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_departmentId_fkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserPermission" DROP CONSTRAINT IF EXISTS "UserPermission_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserInvite" DROP CONSTRAINT IF EXISTS "UserInvite_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserInvite" DROP CONSTRAINT IF EXISTS "UserInvite_invitedById_fkey";
ALTER TABLE IF EXISTS ONLY public."UserGroup" DROP CONSTRAINT IF EXISTS "UserGroup_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserGroupPermission" DROP CONSTRAINT IF EXISTS "UserGroupPermission_groupId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserGroupMember" DROP CONSTRAINT IF EXISTS "UserGroupMember_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserGroupMember" DROP CONSTRAINT IF EXISTS "UserGroupMember_groupId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserAccessAudit" DROP CONSTRAINT IF EXISTS "UserAccessAudit_targetUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."UserAccessAudit" DROP CONSTRAINT IF EXISTS "UserAccessAudit_actorUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."TechnicianPayout" DROP CONSTRAINT IF EXISTS "TechnicianPayout_recordedById_fkey";
ALTER TABLE IF EXISTS ONLY public."TechnicianPayout" DROP CONSTRAINT IF EXISTS "TechnicianPayout_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."TaxRate" DROP CONSTRAINT IF EXISTS "TaxRate_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Supplier" DROP CONSTRAINT IF EXISTS "Supplier_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_billId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBill" DROP CONSTRAINT IF EXISTS "SupplierBill_supplierId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBill" DROP CONSTRAINT IF EXISTS "SupplierBill_poId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBill" DROP CONSTRAINT IF EXISTS "SupplierBill_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBill" DROP CONSTRAINT IF EXISTS "SupplierBill_grnId_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBill" DROP CONSTRAINT IF EXISTS "SupplierBill_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBillItem" DROP CONSTRAINT IF EXISTS "SupplierBillItem_billId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_receivedById_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_dispatchedById_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_approvedById_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransferItem" DROP CONSTRAINT IF EXISTS "StockTransferItem_transferId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockTransferItem" DROP CONSTRAINT IF EXISTS "StockTransferItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockCount" DROP CONSTRAINT IF EXISTS "StockCount_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockCount" DROP CONSTRAINT IF EXISTS "StockCount_locationId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockCount" DROP CONSTRAINT IF EXISTS "StockCount_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."StockCount" DROP CONSTRAINT IF EXISTS "StockCount_approvedById_fkey";
ALTER TABLE IF EXISTS ONLY public."StockCountItem" DROP CONSTRAINT IF EXISTS "StockCountItem_stockCountId_fkey";
ALTER TABLE IF EXISTS ONLY public."StockCountItem" DROP CONSTRAINT IF EXISTS "StockCountItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_setById_fkey";
ALTER TABLE IF EXISTS ONLY public."SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_departmentId_fkey";
ALTER TABLE IF EXISTS ONLY public."SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."Sale" DROP CONSTRAINT IF EXISTS "Sale_posSessionId_fkey";
ALTER TABLE IF EXISTS ONLY public."Sale" DROP CONSTRAINT IF EXISTS "Sale_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Sale" DROP CONSTRAINT IF EXISTS "Sale_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Sale" DROP CONSTRAINT IF EXISTS "Sale_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Sale" DROP CONSTRAINT IF EXISTS "Sale_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."SaleItem" DROP CONSTRAINT IF EXISTS "SaleItem_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."SaleItem" DROP CONSTRAINT IF EXISTS "SaleItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."RepairRequest" DROP CONSTRAINT IF EXISTS "RepairRequest_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."RepairRequestSequence" DROP CONSTRAINT IF EXISTS "RepairRequestSequence_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Refund" DROP CONSTRAINT IF EXISTS "Refund_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."Refund" DROP CONSTRAINT IF EXISTS "Refund_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Refund" DROP CONSTRAINT IF EXISTS "Refund_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Refund" DROP CONSTRAINT IF EXISTS "Refund_creditNoteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Refund" DROP CONSTRAINT IF EXISTS "Refund_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringInvoice" DROP CONSTRAINT IF EXISTS "RecurringInvoice_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringInvoice" DROP CONSTRAINT IF EXISTS "RecurringInvoice_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringInvoice" DROP CONSTRAINT IF EXISTS "RecurringInvoice_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringInvoiceItem" DROP CONSTRAINT IF EXISTS "RecurringInvoiceItem_recurringInvoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringExpense" DROP CONSTRAINT IF EXISTS "RecurringExpense_supplierId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringExpense" DROP CONSTRAINT IF EXISTS "RecurringExpense_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."RecurringExpense" DROP CONSTRAINT IF EXISTS "RecurringExpense_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_paymentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_issuedById_fkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_leadId_fkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_approvedById_fkey";
ALTER TABLE IF EXISTS ONLY public."QuotationItem" DROP CONSTRAINT IF EXISTS "QuotationItem_quotationId_fkey";
ALTER TABLE IF EXISTS ONLY public."QuotationItem" DROP CONSTRAINT IF EXISTS "QuotationItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequest" DROP CONSTRAINT IF EXISTS "PurchaseRequest_supplierId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequest" DROP CONSTRAINT IF EXISTS "PurchaseRequest_reviewedById_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequest" DROP CONSTRAINT IF EXISTS "PurchaseRequest_requestedById_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequest" DROP CONSTRAINT IF EXISTS "PurchaseRequest_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequest" DROP CONSTRAINT IF EXISTS "PurchaseRequest_convertedPoId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequestItem" DROP CONSTRAINT IF EXISTS "PurchaseRequestItem_requestId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequestItem" DROP CONSTRAINT IF EXISTS "PurchaseRequestItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_supplierId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrderItem" DROP CONSTRAINT IF EXISTS "PurchaseOrderItem_poId_fkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrderItem" DROP CONSTRAINT IF EXISTS "PurchaseOrderItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."PosSession" DROP CONSTRAINT IF EXISTS "PosSession_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."PosSession" DROP CONSTRAINT IF EXISTS "PosSession_operatorId_fkey";
ALTER TABLE IF EXISTS ONLY public."PosSession" DROP CONSTRAINT IF EXISTS "PosSession_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."PortalUser" DROP CONSTRAINT IF EXISTS "PortalUser_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."PortalUser" DROP CONSTRAINT IF EXISTS "PortalUser_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."PortalUserClient" DROP CONSTRAINT IF EXISTS "PortalUserClient_portalUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."PortalUserClient" DROP CONSTRAINT IF EXISTS "PortalUserClient_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."PortalSession" DROP CONSTRAINT IF EXISTS "PortalSession_portalUserId_fkey";
ALTER TABLE IF EXISTS ONLY public."Photo" DROP CONSTRAINT IF EXISTS "Photo_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."PaymentReminderSettings" DROP CONSTRAINT IF EXISTS "PaymentReminderSettings_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."PaymentAllocation" DROP CONSTRAINT IF EXISTS "PaymentAllocation_paymentId_fkey";
ALTER TABLE IF EXISTS ONLY public."Part" DROP CONSTRAINT IF EXISTS "Part_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."PartStockTransaction" DROP CONSTRAINT IF EXISTS "PartStockTransaction_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."PartStockTransaction" DROP CONSTRAINT IF EXISTS "PartStockTransaction_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."PartStockTransaction" DROP CONSTRAINT IF EXISTS "PartStockTransaction_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."PartStockTransaction" DROP CONSTRAINT IF EXISTS "PartStockTransaction_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."PartReservation" DROP CONSTRAINT IF EXISTS "PartReservation_reservedById_fkey";
ALTER TABLE IF EXISTS ONLY public."PartReservation" DROP CONSTRAINT IF EXISTS "PartReservation_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."PartReservation" DROP CONSTRAINT IF EXISTS "PartReservation_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."PartLocationStock" DROP CONSTRAINT IF EXISTS "PartLocationStock_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."OutboundMessage" DROP CONSTRAINT IF EXISTS "OutboundMessage_repairRequestId_fkey";
ALTER TABLE IF EXISTS ONLY public."OutboundMessage" DROP CONSTRAINT IF EXISTS "OutboundMessage_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."OutboundMessage" DROP CONSTRAINT IF EXISTS "OutboundMessage_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."OutboundMessage" DROP CONSTRAINT IF EXISTS "OutboundMessage_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."OutboundMessage" DROP CONSTRAINT IF EXISTS "OutboundMessage_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."OrgModuleGrant" DROP CONSTRAINT IF EXISTS "OrgModuleGrant_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."OneTimeExternalTechAssignment" DROP CONSTRAINT IF EXISTS "OneTimeExternalTechAssignment_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."NotificationPreferences" DROP CONSTRAINT IF EXISTS "NotificationPreferences_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Lead" DROP CONSTRAINT IF EXISTS "Lead_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Lead" DROP CONSTRAINT IF EXISTS "Lead_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Lead" DROP CONSTRAINT IF EXISTS "Lead_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Lead" DROP CONSTRAINT IF EXISTS "Lead_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."Lead" DROP CONSTRAINT IF EXISTS "Lead_assignedToId_fkey";
ALTER TABLE IF EXISTS ONLY public."LeadActivity" DROP CONSTRAINT IF EXISTS "LeadActivity_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."LeadActivity" DROP CONSTRAINT IF EXISTS "LeadActivity_leadId_fkey";
ALTER TABLE IF EXISTS ONLY public."JournalLine" DROP CONSTRAINT IF EXISTS "JournalLine_journalEntryId_fkey";
ALTER TABLE IF EXISTS ONLY public."JournalLine" DROP CONSTRAINT IF EXISTS "JournalLine_accountId_fkey";
ALTER TABLE IF EXISTS ONLY public."JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_externalPaidById_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_deviceId_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_clientPaidById_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_assignedToId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."InvoiceLine" DROP CONSTRAINT IF EXISTS "InvoiceLine_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."InvoiceAttachment" DROP CONSTRAINT IF EXISTS "InvoiceAttachment_uploadedById_fkey";
ALTER TABLE IF EXISTS ONLY public."InvoiceAttachment" DROP CONSTRAINT IF EXISTS "InvoiceAttachment_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."InboundMessage" DROP CONSTRAINT IF EXISTS "InboundMessage_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."InboundMessage" DROP CONSTRAINT IF EXISTS "InboundMessage_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."InboundMessage" DROP CONSTRAINT IF EXISTS "InboundMessage_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceived" DROP CONSTRAINT IF EXISTS "GoodsReceived_supplierId_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceived" DROP CONSTRAINT IF EXISTS "GoodsReceived_poId_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceived" DROP CONSTRAINT IF EXISTS "GoodsReceived_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceived" DROP CONSTRAINT IF EXISTS "GoodsReceived_locationId_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceived" DROP CONSTRAINT IF EXISTS "GoodsReceived_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceivedItem" DROP CONSTRAINT IF EXISTS "GoodsReceivedItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceivedItem" DROP CONSTRAINT IF EXISTS "GoodsReceivedItem_grnId_fkey";
ALTER TABLE IF EXISTS ONLY public."FieldVisit" DROP CONSTRAINT IF EXISTS "FieldVisit_scheduledById_fkey";
ALTER TABLE IF EXISTS ONLY public."FieldVisit" DROP CONSTRAINT IF EXISTS "FieldVisit_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."FieldVisit" DROP CONSTRAINT IF EXISTS "FieldVisit_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."FieldVisit" DROP CONSTRAINT IF EXISTS "FieldVisit_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."FieldVisit" DROP CONSTRAINT IF EXISTS "FieldVisit_assignedToId_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_supplierId_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_branchId_fkey";
ALTER TABLE IF EXISTS ONLY public."ExpensePayment" DROP CONSTRAINT IF EXISTS "ExpensePayment_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."ExpensePayment" DROP CONSTRAINT IF EXISTS "ExpensePayment_expenseId_fkey";
ALTER TABLE IF EXISTS ONLY public."ExpensePayment" DROP CONSTRAINT IF EXISTS "ExpensePayment_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."DocumentBrandingSettings" DROP CONSTRAINT IF EXISTS "DocumentBrandingSettings_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Device" DROP CONSTRAINT IF EXISTS "Device_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Device" DROP CONSTRAINT IF EXISTS "Device_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Department" DROP CONSTRAINT IF EXISTS "Department_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNote" DROP CONSTRAINT IF EXISTS "DeliveryNote_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNote" DROP CONSTRAINT IF EXISTS "DeliveryNote_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNote" DROP CONSTRAINT IF EXISTS "DeliveryNote_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNote" DROP CONSTRAINT IF EXISTS "DeliveryNote_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNoteItem" DROP CONSTRAINT IF EXISTS "DeliveryNoteItem_saleItemId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNoteItem" DROP CONSTRAINT IF EXISTS "DeliveryNoteItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNoteItem" DROP CONSTRAINT IF EXISTS "DeliveryNoteItem_deliveryNoteId_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_saleId_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_itemsReceivedBackById_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_invoiceId_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNoteItem" DROP CONSTRAINT IF EXISTS "CreditNoteItem_partId_fkey";
ALTER TABLE IF EXISTS ONLY public."CreditNoteItem" DROP CONSTRAINT IF EXISTS "CreditNoteItem_creditNoteId_fkey";
ALTER TABLE IF EXISTS ONLY public."Complaint" DROP CONSTRAINT IF EXISTS "Complaint_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Complaint" DROP CONSTRAINT IF EXISTS "Complaint_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Complaint" DROP CONSTRAINT IF EXISTS "Complaint_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."Complaint" DROP CONSTRAINT IF EXISTS "Complaint_assignedToId_fkey";
ALTER TABLE IF EXISTS ONLY public."CommunicationTemplate" DROP CONSTRAINT IF EXISTS "CommunicationTemplate_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."CommunicationPolicy" DROP CONSTRAINT IF EXISTS "CommunicationPolicy_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Client" DROP CONSTRAINT IF EXISTS "Client_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."ClientNote" DROP CONSTRAINT IF EXISTS "ClientNote_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."ClientNote" DROP CONSTRAINT IF EXISTS "ClientNote_authorId_fkey";
ALTER TABLE IF EXISTS ONLY public."ChartOfAccount" DROP CONSTRAINT IF EXISTS "ChartOfAccount_parentId_fkey";
ALTER TABLE IF EXISTS ONLY public."ChartOfAccount" DROP CONSTRAINT IF EXISTS "ChartOfAccount_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Campaign" DROP CONSTRAINT IF EXISTS "Campaign_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."Campaign" DROP CONSTRAINT IF EXISTS "Campaign_createdById_fkey";
ALTER TABLE IF EXISTS ONLY public."CampaignContact" DROP CONSTRAINT IF EXISTS "CampaignContact_leadId_fkey";
ALTER TABLE IF EXISTS ONLY public."CampaignContact" DROP CONSTRAINT IF EXISTS "CampaignContact_clientId_fkey";
ALTER TABLE IF EXISTS ONLY public."CampaignContact" DROP CONSTRAINT IF EXISTS "CampaignContact_campaignId_fkey";
ALTER TABLE IF EXISTS ONLY public."Branch" DROP CONSTRAINT IF EXISTS "Branch_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."BankTransaction" DROP CONSTRAINT IF EXISTS "BankTransaction_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."BankTransaction" DROP CONSTRAINT IF EXISTS "BankTransaction_bankAccountId_fkey";
ALTER TABLE IF EXISTS ONLY public."BankAccount" DROP CONSTRAINT IF EXISTS "BankAccount_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_orgId_fkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_jobId_fkey";
ALTER TABLE IF EXISTS ONLY public."Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";
DROP INDEX IF EXISTS public."WarrantyClaim_warrantyJobId_idx";
DROP INDEX IF EXISTS public."WarrantyClaim_originalJobId_idx";
DROP INDEX IF EXISTS public."WarrantyClaim_orgId_status_openedAt_idx";
DROP INDEX IF EXISTS public."User_orgId_idx";
DROP INDEX IF EXISTS public."User_email_key";
DROP INDEX IF EXISTS public."User_departmentId_idx";
DROP INDEX IF EXISTS public."User_branchId_idx";
DROP INDEX IF EXISTS public."UserPermission_userId_permission_key";
DROP INDEX IF EXISTS public."UserPermission_permission_idx";
DROP INDEX IF EXISTS public."UserInvite_token_key";
DROP INDEX IF EXISTS public."UserInvite_token_idx";
DROP INDEX IF EXISTS public."UserInvite_orgId_idx";
DROP INDEX IF EXISTS public."UserInvite_email_orgId_idx";
DROP INDEX IF EXISTS public."UserGroup_orgId_name_key";
DROP INDEX IF EXISTS public."UserGroup_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."UserGroupPermission_permission_idx";
DROP INDEX IF EXISTS public."UserGroupPermission_groupId_permission_key";
DROP INDEX IF EXISTS public."UserGroupMember_userId_idx";
DROP INDEX IF EXISTS public."UserGroupMember_groupId_userId_key";
DROP INDEX IF EXISTS public."UserAccessAudit_targetUserId_createdAt_idx";
DROP INDEX IF EXISTS public."UserAccessAudit_actorUserId_createdAt_idx";
DROP INDEX IF EXISTS public."TechnicianPayout_orgId_paidAt_idx";
DROP INDEX IF EXISTS public."TechnicianPayout_jobId_idx";
DROP INDEX IF EXISTS public."TaxRate_orgId_idx";
DROP INDEX IF EXISTS public."TaxRate_orgId_code_key";
DROP INDEX IF EXISTS public."SystemAuditEvent_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."SystemAuditEvent_entityType_entityId_createdAt_idx";
DROP INDEX IF EXISTS public."SystemAuditEvent_actorUserId_createdAt_idx";
DROP INDEX IF EXISTS public."SystemAnnouncement_isActive_startsAt_endsAt_idx";
DROP INDEX IF EXISTS public."Supplier_orgId_idx";
DROP INDEX IF EXISTS public."SupplierPrice_partId_validFrom_idx";
DROP INDEX IF EXISTS public."SupplierPrice_orgId_supplierId_validFrom_idx";
DROP INDEX IF EXISTS public."SupplierPayment_orgId_paidAt_idx";
DROP INDEX IF EXISTS public."SupplierPayment_billId_idx";
DROP INDEX IF EXISTS public."SupplierBill_supplierId_idx";
DROP INDEX IF EXISTS public."SupplierBill_poId_idx";
DROP INDEX IF EXISTS public."SupplierBill_orgId_status_idx";
DROP INDEX IF EXISTS public."SupplierBill_orgId_issuedAt_idx";
DROP INDEX IF EXISTS public."SupplierBill_grnId_idx";
DROP INDEX IF EXISTS public."SupplierBill_billNumber_key";
DROP INDEX IF EXISTS public."SupplierBillItem_billId_idx";
DROP INDEX IF EXISTS public."StockTransfer_transferNumber_key";
DROP INDEX IF EXISTS public."StockTransfer_toLocationId_idx";
DROP INDEX IF EXISTS public."StockTransfer_orgId_status_createdAt_idx";
DROP INDEX IF EXISTS public."StockTransfer_fromLocationId_idx";
DROP INDEX IF EXISTS public."StockTransferItem_transferId_idx";
DROP INDEX IF EXISTS public."StockTransferItem_partId_idx";
DROP INDEX IF EXISTS public."StockLocation_orgId_code_key";
DROP INDEX IF EXISTS public."StockLocation_orgId_branchId_isActive_idx";
DROP INDEX IF EXISTS public."StockCount_orgId_status_countedAt_idx";
DROP INDEX IF EXISTS public."StockCount_locationId_idx";
DROP INDEX IF EXISTS public."StockCount_countNumber_key";
DROP INDEX IF EXISTS public."StockCountItem_stockCountId_idx";
DROP INDEX IF EXISTS public."StockCountItem_partId_idx";
DROP INDEX IF EXISTS public."SmsUsage_year_month_idx";
DROP INDEX IF EXISTS public."Session_token_key";
DROP INDEX IF EXISTS public."SalesTarget_userId_idx";
DROP INDEX IF EXISTS public."SalesTarget_orgId_userId_period_key";
DROP INDEX IF EXISTS public."SalesTarget_orgId_period_idx";
DROP INDEX IF EXISTS public."SalesTarget_entityType_period_periodLabel_idx";
DROP INDEX IF EXISTS public."SalesTarget_departmentId_idx";
DROP INDEX IF EXISTS public."SalesTarget_branchId_idx";
DROP INDEX IF EXISTS public."Sale_saleNumber_key";
DROP INDEX IF EXISTS public."Sale_posSessionId_idx";
DROP INDEX IF EXISTS public."Sale_orgId_status_idx";
DROP INDEX IF EXISTS public."Sale_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."Sale_clientId_idx";
DROP INDEX IF EXISTS public."Sale_branchId_idx";
DROP INDEX IF EXISTS public."SaleItem_saleId_idx";
DROP INDEX IF EXISTS public."SaleItem_partId_idx";
DROP INDEX IF EXISTS public."RepairTask_orgId_jobId_status_idx";
DROP INDEX IF EXISTS public."RepairTask_assignedToId_status_dueAt_idx";
DROP INDEX IF EXISTS public."RepairRequest_requestStatus_createdAt_idx";
DROP INDEX IF EXISTS public."RepairRequest_requestNumber_key";
DROP INDEX IF EXISTS public."RepairRequest_phone_idx";
DROP INDEX IF EXISTS public."RepairRequest_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."RepairRequest_clientId_idx";
DROP INDEX IF EXISTS public."RepairRequestSequence_orgId_year_key";
DROP INDEX IF EXISTS public."RepairMessage_orgId_jobId_idx";
DROP INDEX IF EXISTS public."RepairMessage_jobId_createdAt_idx";
DROP INDEX IF EXISTS public."ReorderRule_partId_locationId_key";
DROP INDEX IF EXISTS public."ReorderRule_orgId_isActive_idx";
DROP INDEX IF EXISTS public."Refund_saleId_idx";
DROP INDEX IF EXISTS public."Refund_orgId_refundedAt_idx";
DROP INDEX IF EXISTS public."Refund_invoiceId_idx";
DROP INDEX IF EXISTS public."Refund_creditNoteId_idx";
DROP INDEX IF EXISTS public."RecurringInvoice_orgId_isActive_nextDueAt_idx";
DROP INDEX IF EXISTS public."RecurringInvoice_clientId_idx";
DROP INDEX IF EXISTS public."RecurringInvoiceItem_recurringInvoiceId_idx";
DROP INDEX IF EXISTS public."RecurringExpense_supplierId_idx";
DROP INDEX IF EXISTS public."RecurringExpense_orgId_isActive_nextDueAt_idx";
DROP INDEX IF EXISTS public."Receipt_saleId_idx";
DROP INDEX IF EXISTS public."Receipt_receiptNumber_key";
DROP INDEX IF EXISTS public."Receipt_paymentId_idx";
DROP INDEX IF EXISTS public."Receipt_orgId_paymentId_key";
DROP INDEX IF EXISTS public."Receipt_orgId_issuedAt_idx";
DROP INDEX IF EXISTS public."Receipt_invoiceId_idx";
DROP INDEX IF EXISTS public."Receipt_clientId_idx";
DROP INDEX IF EXISTS public."RateLimit_resetAt_idx";
DROP INDEX IF EXISTS public."Quotation_quoteNumber_key";
DROP INDEX IF EXISTS public."Quotation_orgId_status_idx";
DROP INDEX IF EXISTS public."Quotation_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."Quotation_leadId_idx";
DROP INDEX IF EXISTS public."Quotation_jobId_idx";
DROP INDEX IF EXISTS public."Quotation_convertedToInvoiceId_key";
DROP INDEX IF EXISTS public."Quotation_clientId_idx";
DROP INDEX IF EXISTS public."QuotationItem_quotationId_idx";
DROP INDEX IF EXISTS public."QuotationItem_partId_idx";
DROP INDEX IF EXISTS public."QualityCheck_orgId_jobId_status_idx";
DROP INDEX IF EXISTS public."PurchaseRequest_supplierId_idx";
DROP INDEX IF EXISTS public."PurchaseRequest_requestedById_idx";
DROP INDEX IF EXISTS public."PurchaseRequest_requestNumber_key";
DROP INDEX IF EXISTS public."PurchaseRequest_orgId_status_createdAt_idx";
DROP INDEX IF EXISTS public."PurchaseRequestItem_requestId_idx";
DROP INDEX IF EXISTS public."PurchaseRequestItem_partId_idx";
DROP INDEX IF EXISTS public."PurchaseOrder_supplierId_idx";
DROP INDEX IF EXISTS public."PurchaseOrder_orgId_idx";
DROP INDEX IF EXISTS public."PurchaseOrderItem_poId_idx";
DROP INDEX IF EXISTS public."PosSession_orgId_status_idx";
DROP INDEX IF EXISTS public."PosSession_operatorId_openedAt_idx";
DROP INDEX IF EXISTS public."PosSession_branchId_idx";
DROP INDEX IF EXISTS public."PortalUser_orgId_idx";
DROP INDEX IF EXISTS public."PortalUser_orgId_email_key";
DROP INDEX IF EXISTS public."PortalUser_clientId_idx";
DROP INDEX IF EXISTS public."PortalUserClient_portalUserId_idx";
DROP INDEX IF EXISTS public."PortalUserClient_portalUserId_clientId_key";
DROP INDEX IF EXISTS public."PortalUserClient_orgId_idx";
DROP INDEX IF EXISTS public."PortalUserClient_clientId_idx";
DROP INDEX IF EXISTS public."PortalSession_token_key";
DROP INDEX IF EXISTS public."PortalSession_portalUserId_idx";
DROP INDEX IF EXISTS public."Photo_orgId_idx";
DROP INDEX IF EXISTS public."Photo_jobId_visibility_idx";
DROP INDEX IF EXISTS public."Photo_jobId_uploadedAt_idx";
DROP INDEX IF EXISTS public."Payment_saleId_idx";
DROP INDEX IF EXISTS public."Payment_orgId_receivedAt_idx";
DROP INDEX IF EXISTS public."Payment_orgId_kind_receivedAt_idx";
DROP INDEX IF EXISTS public."Payment_invoiceId_idx";
DROP INDEX IF EXISTS public."PaymentReminderSettings_orgId_key";
DROP INDEX IF EXISTS public."PaymentAllocation_targetType_targetId_idx";
DROP INDEX IF EXISTS public."PaymentAllocation_orgId_paymentId_idx";
DROP INDEX IF EXISTS public."Part_sku_orgId_key";
DROP INDEX IF EXISTS public."Part_orgId_isActive_idx";
DROP INDEX IF EXISTS public."PartStockTransaction_saleId_idx";
DROP INDEX IF EXISTS public."PartStockTransaction_partId_createdAt_idx";
DROP INDEX IF EXISTS public."PartStockTransaction_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."PartStockTransaction_jobId_idx";
DROP INDEX IF EXISTS public."PartReservation_partId_status_idx";
DROP INDEX IF EXISTS public."PartReservation_jobId_status_idx";
DROP INDEX IF EXISTS public."PartLocationStock_partId_locationId_key";
DROP INDEX IF EXISTS public."PartLocationStock_partId_idx";
DROP INDEX IF EXISTS public."PartLocationStock_orgId_locationId_idx";
DROP INDEX IF EXISTS public."OutboundMessage_templateKey_idx";
DROP INDEX IF EXISTS public."OutboundMessage_repairRequestId_idx";
DROP INDEX IF EXISTS public."OutboundMessage_providerMessageId_idx";
DROP INDEX IF EXISTS public."OutboundMessage_orgId_channel_status_nextAttemptAt_idx";
DROP INDEX IF EXISTS public."OutboundMessage_jobId_idx";
DROP INDEX IF EXISTS public."OutboundMessage_invoiceId_reminderStage_idx";
DROP INDEX IF EXISTS public."OutboundMessage_clientId_reminderStage_idx";
DROP INDEX IF EXISTS public."OutboundMessage_channel_status_nextAttemptAt_idx";
DROP INDEX IF EXISTS public."Organization_slug_key";
DROP INDEX IF EXISTS public."Organization_slug_idx";
DROP INDEX IF EXISTS public."Organization_isActive_idx";
DROP INDEX IF EXISTS public."OrgWhatsAppConfig_phoneNumberId_idx";
DROP INDEX IF EXISTS public."OrgUsageSnapshot_orgId_periodKey_metric_key";
DROP INDEX IF EXISTS public."OrgUsageSnapshot_orgId_metric_capturedAt_idx";
DROP INDEX IF EXISTS public."OrgSubscriptionEvent_provider_providerEventId_idx";
DROP INDEX IF EXISTS public."OrgSubscriptionEvent_orgId_occurredAt_idx";
DROP INDEX IF EXISTS public."OrgModuleGrant_orgId_idx";
DROP INDEX IF EXISTS public."OrgFeatureEntitlement_orgId_feature_key";
DROP INDEX IF EXISTS public."OrgFeatureEntitlement_orgId_enabled_idx";
DROP INDEX IF EXISTS public."OneTimeExternalTechAssignment_jobId_key";
DROP INDEX IF EXISTS public."OneTimeExternalTechAssignment_assignedAt_idx";
DROP INDEX IF EXISTS public."Notification_userId_isRead_idx";
DROP INDEX IF EXISTS public."Notification_orgId_isRead_createdAt_idx";
DROP INDEX IF EXISTS public."Notification_jobId_idx";
DROP INDEX IF EXISTS public."NotificationPreferences_userId_key";
DROP INDEX IF EXISTS public."Lead_orgId_updatedAt_idx";
DROP INDEX IF EXISTS public."Lead_orgId_status_idx";
DROP INDEX IF EXISTS public."Lead_createdAt_idx";
DROP INDEX IF EXISTS public."Lead_assignedToId_idx";
DROP INDEX IF EXISTS public."LeadActivity_userId_createdAt_idx";
DROP INDEX IF EXISTS public."LeadActivity_leadId_createdAt_idx";
DROP INDEX IF EXISTS public."JournalLine_journalEntryId_idx";
DROP INDEX IF EXISTS public."JournalLine_accountId_idx";
DROP INDEX IF EXISTS public."JournalEntry_orgId_status_idx";
DROP INDEX IF EXISTS public."JournalEntry_orgId_status_date_idx";
DROP INDEX IF EXISTS public."JournalEntry_orgId_reference_idx";
DROP INDEX IF EXISTS public."JournalEntry_orgId_entryNumber_key";
DROP INDEX IF EXISTS public."JournalEntry_orgId_date_idx";
DROP INDEX IF EXISTS public."Job_status_updatedAt_idx";
DROP INDEX IF EXISTS public."Job_status_receivedAt_idx";
DROP INDEX IF EXISTS public."Job_repairPath_idx";
DROP INDEX IF EXISTS public."Job_quotationNumber_key";
DROP INDEX IF EXISTS public."Job_orgId_status_idx";
DROP INDEX IF EXISTS public."Job_orgId_repairPath_status_idx";
DROP INDEX IF EXISTS public."Job_orgId_receivedAt_idx";
DROP INDEX IF EXISTS public."Job_orgId_jobNumber_idx";
DROP INDEX IF EXISTS public."Job_orgId_idx";
DROP INDEX IF EXISTS public."Job_orgId_completedAt_idx";
DROP INDEX IF EXISTS public."Job_jobNumber_key";
DROP INDEX IF EXISTS public."Job_invoiceNumber_key";
DROP INDEX IF EXISTS public."Job_deviceId_idx";
DROP INDEX IF EXISTS public."Job_createdById_idx";
DROP INDEX IF EXISTS public."Job_completedAt_idx";
DROP INDEX IF EXISTS public."Job_clientId_idx";
DROP INDEX IF EXISTS public."Job_assignedToId_status_idx";
DROP INDEX IF EXISTS public."JobStatusHistory_orgId_toStatus_changedAt_idx";
DROP INDEX IF EXISTS public."JobStatusHistory_orgId_jobId_changedAt_idx";
DROP INDEX IF EXISTS public."JobAssignmentHistory_orgId_jobId_startedAt_idx";
DROP INDEX IF EXISTS public."JobAssignmentHistory_assignedToId_startedAt_idx";
DROP INDEX IF EXISTS public."Invoice_orgId_status_idx";
DROP INDEX IF EXISTS public."Invoice_orgId_issuedAt_idx";
DROP INDEX IF EXISTS public."Invoice_orgId_invoiceType_idx";
DROP INDEX IF EXISTS public."Invoice_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."Invoice_jobId_key";
DROP INDEX IF EXISTS public."Invoice_invoiceNumber_key";
DROP INDEX IF EXISTS public."Invoice_clientId_idx";
DROP INDEX IF EXISTS public."InvoiceLine_sourceType_sourceId_idx";
DROP INDEX IF EXISTS public."InvoiceLine_orgId_invoiceId_idx";
DROP INDEX IF EXISTS public."InvoiceAttachment_orgId_idx";
DROP INDEX IF EXISTS public."InvoiceAttachment_invoiceId_idx";
DROP INDEX IF EXISTS public."InventoryCategory_orgId_name_key";
DROP INDEX IF EXISTS public."InventoryCategory_orgId_isActive_idx";
DROP INDEX IF EXISTS public."InboundMessage_wamid_key";
DROP INDEX IF EXISTS public."InboundMessage_orgId_isRead_createdAt_idx";
DROP INDEX IF EXISTS public."InboundMessage_jobId_timestamp_idx";
DROP INDEX IF EXISTS public."InboundMessage_isRead_createdAt_idx";
DROP INDEX IF EXISTS public."InboundMessage_from_timestamp_idx";
DROP INDEX IF EXISTS public."InboundMessage_clientId_isRead_idx";
DROP INDEX IF EXISTS public."GoodsReceived_supplierId_idx";
DROP INDEX IF EXISTS public."GoodsReceived_poId_idx";
DROP INDEX IF EXISTS public."GoodsReceived_orgId_receivedAt_idx";
DROP INDEX IF EXISTS public."GoodsReceived_locationId_idx";
DROP INDEX IF EXISTS public."GoodsReceived_grnNumber_key";
DROP INDEX IF EXISTS public."GoodsReceivedItem_poItemId_idx";
DROP INDEX IF EXISTS public."GoodsReceivedItem_partId_idx";
DROP INDEX IF EXISTS public."GoodsReceivedItem_grnId_idx";
DROP INDEX IF EXISTS public."FxReferenceRate_fetchedAt_idx";
DROP INDEX IF EXISTS public."FxReferenceRate_base_quote_key";
DROP INDEX IF EXISTS public."FileAsset_storageKey_idx";
DROP INDEX IF EXISTS public."FileAsset_orgId_ownerType_ownerId_idx";
DROP INDEX IF EXISTS public."FieldVisit_orgId_status_idx";
DROP INDEX IF EXISTS public."FieldVisit_jobId_idx";
DROP INDEX IF EXISTS public."FieldVisit_branchId_idx";
DROP INDEX IF EXISTS public."FieldVisit_assignedToId_scheduledAt_idx";
DROP INDEX IF EXISTS public."Expense_supplierId_idx";
DROP INDEX IF EXISTS public."Expense_orgId_paidAt_idx";
DROP INDEX IF EXISTS public."Expense_orgId_dueAt_idx";
DROP INDEX IF EXISTS public."Expense_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."Expense_orgId_category_idx";
DROP INDEX IF EXISTS public."Expense_expenseNumber_key";
DROP INDEX IF EXISTS public."ExpensePayment_orgId_paidAt_idx";
DROP INDEX IF EXISTS public."ExpensePayment_expenseId_idx";
DROP INDEX IF EXISTS public."DocumentTaxLine_orgId_documentType_documentId_idx";
DROP INDEX IF EXISTS public."DocumentSequence_orgId_type_year_month_key";
DROP INDEX IF EXISTS public."DocumentBrandingSettings_orgId_key";
DROP INDEX IF EXISTS public."DiagnosisReport_orgId_jobId_createdAt_idx";
DROP INDEX IF EXISTS public."Device_serialOrImei_idx";
DROP INDEX IF EXISTS public."Device_orgId_idx";
DROP INDEX IF EXISTS public."Device_clientId_idx";
DROP INDEX IF EXISTS public."DeviceSpecification_orgId_key_idx";
DROP INDEX IF EXISTS public."DeviceSpecification_deviceId_key_key";
DROP INDEX IF EXISTS public."Department_orgId_code_key";
DROP INDEX IF EXISTS public."DeliveryNote_saleId_idx";
DROP INDEX IF EXISTS public."DeliveryNote_orgId_deliveredAt_idx";
DROP INDEX IF EXISTS public."DeliveryNote_invoiceId_idx";
DROP INDEX IF EXISTS public."DeliveryNote_deliveryNoteNumber_key";
DROP INDEX IF EXISTS public."DeliveryNoteItem_saleItemId_idx";
DROP INDEX IF EXISTS public."DeliveryNoteItem_partId_idx";
DROP INDEX IF EXISTS public."DeliveryNoteItem_deliveryNoteId_idx";
DROP INDEX IF EXISTS public."CustomerConsent_orgId_clientId_consentType_idx";
DROP INDEX IF EXISTS public."CustomerConsent_orgId_capturedAt_idx";
DROP INDEX IF EXISTS public."CustomerApproval_orgId_requestedAt_idx";
DROP INDEX IF EXISTS public."CustomerApproval_orgId_jobId_status_idx";
DROP INDEX IF EXISTS public."CreditNote_saleId_idx";
DROP INDEX IF EXISTS public."CreditNote_orgId_issuedAt_idx";
DROP INDEX IF EXISTS public."CreditNote_invoiceId_idx";
DROP INDEX IF EXISTS public."CreditNote_creditNoteNumber_key";
DROP INDEX IF EXISTS public."CreditNoteItem_partId_idx";
DROP INDEX IF EXISTS public."CreditNoteItem_creditNoteId_idx";
DROP INDEX IF EXISTS public."Conversation_orgId_status_lastMessageAt_idx";
DROP INDEX IF EXISTS public."Conversation_jobId_idx";
DROP INDEX IF EXISTS public."Conversation_clientId_idx";
DROP INDEX IF EXISTS public."ConversationMessage_providerMessageId_idx";
DROP INDEX IF EXISTS public."ConversationMessage_orgId_conversationId_createdAt_idx";
DROP INDEX IF EXISTS public."Complaint_orgId_status_createdAt_idx";
DROP INDEX IF EXISTS public."Complaint_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."Complaint_jobId_idx";
DROP INDEX IF EXISTS public."Complaint_complaintNumber_key";
DROP INDEX IF EXISTS public."CommunicationTemplate_orgId_channel_isActive_idx";
DROP INDEX IF EXISTS public."CommunicationTemplate_key_channel_orgId_key";
DROP INDEX IF EXISTS public."CommunicationTemplateVersion_templateId_version_key";
DROP INDEX IF EXISTS public."CommunicationTemplateVersion_orgId_status_idx";
DROP INDEX IF EXISTS public."CommunicationPolicy_status_orgId_key";
DROP INDEX IF EXISTS public."CommunicationPolicy_orgId_templateKey_idx";
DROP INDEX IF EXISTS public."Client_phone_orgId_key";
DROP INDEX IF EXISTS public."Client_orgId_updatedAt_idx";
DROP INDEX IF EXISTS public."Client_orgId_idx";
DROP INDEX IF EXISTS public."ClientMergeRecord_targetClientId_idx";
DROP INDEX IF EXISTS public."ClientMergeRecord_sourceClientId_idx";
DROP INDEX IF EXISTS public."ClientMergeRecord_orgId_mergedAt_idx";
DROP INDEX IF EXISTS public."ChartOfAccount_orgId_type_idx";
DROP INDEX IF EXISTS public."ChartOfAccount_orgId_code_key";
DROP INDEX IF EXISTS public."CashierShift_orgId_branchId_status_idx";
DROP INDEX IF EXISTS public."CashierShift_cashierId_openedAt_idx";
DROP INDEX IF EXISTS public."Campaign_orgId_status_idx";
DROP INDEX IF EXISTS public."CampaignContact_orgId_idx";
DROP INDEX IF EXISTS public."CampaignContact_campaignId_status_idx";
DROP INDEX IF EXISTS public."CampaignContact_campaignId_leadId_key";
DROP INDEX IF EXISTS public."CampaignContact_campaignId_clientId_key";
DROP INDEX IF EXISTS public."Branch_orgId_idx";
DROP INDEX IF EXISTS public."BillingEvent_status_event_idx";
DROP INDEX IF EXISTS public."BillingEvent_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."BankTransaction_orgId_date_idx";
DROP INDEX IF EXISTS public."BankTransaction_bankAccountId_date_idx";
DROP INDEX IF EXISTS public."BankAccount_orgId_ledgerCode_idx";
DROP INDEX IF EXISTS public."BankAccount_orgId_idx";
DROP INDEX IF EXISTS public."AuditLog_userId_createdAt_idx";
DROP INDEX IF EXISTS public."AuditLog_orgId_createdAt_idx";
DROP INDEX IF EXISTS public."AuditLog_jobId_createdAt_idx";
DROP INDEX IF EXISTS public."AiPromptLog_promptVersion_createdAt_idx";
DROP INDEX IF EXISTS public."AiPromptLog_orgId_feature_createdAt_idx";
DROP INDEX IF EXISTS public."AiKnowledgeArticle_orgId_module_isActive_idx";
DROP INDEX IF EXISTS public."AiKnowledgeArticle_isActive_updatedAt_idx";
DROP INDEX IF EXISTS public."AiFeedback_rating_createdAt_idx";
DROP INDEX IF EXISTS public."AiFeedback_orgId_feature_createdAt_idx";
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public."WarrantyClaim" DROP CONSTRAINT IF EXISTS "WarrantyClaim_pkey";
ALTER TABLE IF EXISTS ONLY public."Verification" DROP CONSTRAINT IF EXISTS "Verification_pkey";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."UserPermission" DROP CONSTRAINT IF EXISTS "UserPermission_pkey";
ALTER TABLE IF EXISTS ONLY public."UserInvite" DROP CONSTRAINT IF EXISTS "UserInvite_pkey";
ALTER TABLE IF EXISTS ONLY public."UserGroup" DROP CONSTRAINT IF EXISTS "UserGroup_pkey";
ALTER TABLE IF EXISTS ONLY public."UserGroupPermission" DROP CONSTRAINT IF EXISTS "UserGroupPermission_pkey";
ALTER TABLE IF EXISTS ONLY public."UserGroupMember" DROP CONSTRAINT IF EXISTS "UserGroupMember_pkey";
ALTER TABLE IF EXISTS ONLY public."UserAccessAudit" DROP CONSTRAINT IF EXISTS "UserAccessAudit_pkey";
ALTER TABLE IF EXISTS ONLY public."TechnicianPayout" DROP CONSTRAINT IF EXISTS "TechnicianPayout_pkey";
ALTER TABLE IF EXISTS ONLY public."TaxRate" DROP CONSTRAINT IF EXISTS "TaxRate_pkey";
ALTER TABLE IF EXISTS ONLY public."SystemAuditEvent" DROP CONSTRAINT IF EXISTS "SystemAuditEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."SystemAnnouncement" DROP CONSTRAINT IF EXISTS "SystemAnnouncement_pkey";
ALTER TABLE IF EXISTS ONLY public."Supplier" DROP CONSTRAINT IF EXISTS "Supplier_pkey";
ALTER TABLE IF EXISTS ONLY public."SupplierPrice" DROP CONSTRAINT IF EXISTS "SupplierPrice_pkey";
ALTER TABLE IF EXISTS ONLY public."SupplierPayment" DROP CONSTRAINT IF EXISTS "SupplierPayment_pkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBill" DROP CONSTRAINT IF EXISTS "SupplierBill_pkey";
ALTER TABLE IF EXISTS ONLY public."SupplierBillItem" DROP CONSTRAINT IF EXISTS "SupplierBillItem_pkey";
ALTER TABLE IF EXISTS ONLY public."StockTransfer" DROP CONSTRAINT IF EXISTS "StockTransfer_pkey";
ALTER TABLE IF EXISTS ONLY public."StockTransferItem" DROP CONSTRAINT IF EXISTS "StockTransferItem_pkey";
ALTER TABLE IF EXISTS ONLY public."StockLocation" DROP CONSTRAINT IF EXISTS "StockLocation_pkey";
ALTER TABLE IF EXISTS ONLY public."StockCount" DROP CONSTRAINT IF EXISTS "StockCount_pkey";
ALTER TABLE IF EXISTS ONLY public."StockCountItem" DROP CONSTRAINT IF EXISTS "StockCountItem_pkey";
ALTER TABLE IF EXISTS ONLY public."SmsUsage" DROP CONSTRAINT IF EXISTS "SmsUsage_pkey";
ALTER TABLE IF EXISTS ONLY public."Session" DROP CONSTRAINT IF EXISTS "Session_pkey";
ALTER TABLE IF EXISTS ONLY public."SalesTarget" DROP CONSTRAINT IF EXISTS "SalesTarget_pkey";
ALTER TABLE IF EXISTS ONLY public."Sale" DROP CONSTRAINT IF EXISTS "Sale_pkey";
ALTER TABLE IF EXISTS ONLY public."SaleItem" DROP CONSTRAINT IF EXISTS "SaleItem_pkey";
ALTER TABLE IF EXISTS ONLY public."RepairTask" DROP CONSTRAINT IF EXISTS "RepairTask_pkey";
ALTER TABLE IF EXISTS ONLY public."RepairRequest" DROP CONSTRAINT IF EXISTS "RepairRequest_pkey";
ALTER TABLE IF EXISTS ONLY public."RepairRequestSequence" DROP CONSTRAINT IF EXISTS "RepairRequestSequence_pkey";
ALTER TABLE IF EXISTS ONLY public."RepairMessage" DROP CONSTRAINT IF EXISTS "RepairMessage_pkey";
ALTER TABLE IF EXISTS ONLY public."ReorderRule" DROP CONSTRAINT IF EXISTS "ReorderRule_pkey";
ALTER TABLE IF EXISTS ONLY public."Refund" DROP CONSTRAINT IF EXISTS "Refund_pkey";
ALTER TABLE IF EXISTS ONLY public."RecurringInvoice" DROP CONSTRAINT IF EXISTS "RecurringInvoice_pkey";
ALTER TABLE IF EXISTS ONLY public."RecurringInvoiceItem" DROP CONSTRAINT IF EXISTS "RecurringInvoiceItem_pkey";
ALTER TABLE IF EXISTS ONLY public."RecurringExpense" DROP CONSTRAINT IF EXISTS "RecurringExpense_pkey";
ALTER TABLE IF EXISTS ONLY public."Receipt" DROP CONSTRAINT IF EXISTS "Receipt_pkey";
ALTER TABLE IF EXISTS ONLY public."RateLimit" DROP CONSTRAINT IF EXISTS "RateLimit_pkey";
ALTER TABLE IF EXISTS ONLY public."Quotation" DROP CONSTRAINT IF EXISTS "Quotation_pkey";
ALTER TABLE IF EXISTS ONLY public."QuotationItem" DROP CONSTRAINT IF EXISTS "QuotationItem_pkey";
ALTER TABLE IF EXISTS ONLY public."QualityCheck" DROP CONSTRAINT IF EXISTS "QualityCheck_pkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequest" DROP CONSTRAINT IF EXISTS "PurchaseRequest_pkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseRequestItem" DROP CONSTRAINT IF EXISTS "PurchaseRequestItem_pkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_pkey";
ALTER TABLE IF EXISTS ONLY public."PurchaseOrderItem" DROP CONSTRAINT IF EXISTS "PurchaseOrderItem_pkey";
ALTER TABLE IF EXISTS ONLY public."PosSession" DROP CONSTRAINT IF EXISTS "PosSession_pkey";
ALTER TABLE IF EXISTS ONLY public."PortalUser" DROP CONSTRAINT IF EXISTS "PortalUser_pkey";
ALTER TABLE IF EXISTS ONLY public."PortalUserClient" DROP CONSTRAINT IF EXISTS "PortalUserClient_pkey";
ALTER TABLE IF EXISTS ONLY public."PortalSession" DROP CONSTRAINT IF EXISTS "PortalSession_pkey";
ALTER TABLE IF EXISTS ONLY public."PlatformSetting" DROP CONSTRAINT IF EXISTS "PlatformSetting_pkey";
ALTER TABLE IF EXISTS ONLY public."Photo" DROP CONSTRAINT IF EXISTS "Photo_pkey";
ALTER TABLE IF EXISTS ONLY public."Payment" DROP CONSTRAINT IF EXISTS "Payment_pkey";
ALTER TABLE IF EXISTS ONLY public."PaymentReminderSettings" DROP CONSTRAINT IF EXISTS "PaymentReminderSettings_pkey";
ALTER TABLE IF EXISTS ONLY public."PaymentAllocation" DROP CONSTRAINT IF EXISTS "PaymentAllocation_pkey";
ALTER TABLE IF EXISTS ONLY public."Part" DROP CONSTRAINT IF EXISTS "Part_pkey";
ALTER TABLE IF EXISTS ONLY public."PartStockTransaction" DROP CONSTRAINT IF EXISTS "PartStockTransaction_pkey";
ALTER TABLE IF EXISTS ONLY public."PartReservation" DROP CONSTRAINT IF EXISTS "PartReservation_pkey";
ALTER TABLE IF EXISTS ONLY public."PartLocationStock" DROP CONSTRAINT IF EXISTS "PartLocationStock_pkey";
ALTER TABLE IF EXISTS ONLY public."OutboundMessage" DROP CONSTRAINT IF EXISTS "OutboundMessage_pkey";
ALTER TABLE IF EXISTS ONLY public."Organization" DROP CONSTRAINT IF EXISTS "Organization_pkey";
ALTER TABLE IF EXISTS ONLY public."OrgWhatsAppConfig" DROP CONSTRAINT IF EXISTS "OrgWhatsAppConfig_pkey";
ALTER TABLE IF EXISTS ONLY public."OrgUsageSnapshot" DROP CONSTRAINT IF EXISTS "OrgUsageSnapshot_pkey";
ALTER TABLE IF EXISTS ONLY public."OrgSubscriptionEvent" DROP CONSTRAINT IF EXISTS "OrgSubscriptionEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."OrgModuleGrant" DROP CONSTRAINT IF EXISTS "OrgModuleGrant_pkey";
ALTER TABLE IF EXISTS ONLY public."OrgFeatureEntitlement" DROP CONSTRAINT IF EXISTS "OrgFeatureEntitlement_pkey";
ALTER TABLE IF EXISTS ONLY public."OneTimeExternalTechAssignment" DROP CONSTRAINT IF EXISTS "OneTimeExternalTechAssignment_pkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_pkey";
ALTER TABLE IF EXISTS ONLY public."NotificationPreferences" DROP CONSTRAINT IF EXISTS "NotificationPreferences_pkey";
ALTER TABLE IF EXISTS ONLY public."Lead" DROP CONSTRAINT IF EXISTS "Lead_pkey";
ALTER TABLE IF EXISTS ONLY public."LeadActivity" DROP CONSTRAINT IF EXISTS "LeadActivity_pkey";
ALTER TABLE IF EXISTS ONLY public."JournalLine" DROP CONSTRAINT IF EXISTS "JournalLine_pkey";
ALTER TABLE IF EXISTS ONLY public."JournalEntry" DROP CONSTRAINT IF EXISTS "JournalEntry_pkey";
ALTER TABLE IF EXISTS ONLY public."Job" DROP CONSTRAINT IF EXISTS "Job_pkey";
ALTER TABLE IF EXISTS ONLY public."JobStatusHistory" DROP CONSTRAINT IF EXISTS "JobStatusHistory_pkey";
ALTER TABLE IF EXISTS ONLY public."JobAssignmentHistory" DROP CONSTRAINT IF EXISTS "JobAssignmentHistory_pkey";
ALTER TABLE IF EXISTS ONLY public."Invoice" DROP CONSTRAINT IF EXISTS "Invoice_pkey";
ALTER TABLE IF EXISTS ONLY public."InvoiceLine" DROP CONSTRAINT IF EXISTS "InvoiceLine_pkey";
ALTER TABLE IF EXISTS ONLY public."InvoiceAttachment" DROP CONSTRAINT IF EXISTS "InvoiceAttachment_pkey";
ALTER TABLE IF EXISTS ONLY public."InventoryCategory" DROP CONSTRAINT IF EXISTS "InventoryCategory_pkey";
ALTER TABLE IF EXISTS ONLY public."InboundMessage" DROP CONSTRAINT IF EXISTS "InboundMessage_pkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceived" DROP CONSTRAINT IF EXISTS "GoodsReceived_pkey";
ALTER TABLE IF EXISTS ONLY public."GoodsReceivedItem" DROP CONSTRAINT IF EXISTS "GoodsReceivedItem_pkey";
ALTER TABLE IF EXISTS ONLY public."FxReferenceRate" DROP CONSTRAINT IF EXISTS "FxReferenceRate_pkey";
ALTER TABLE IF EXISTS ONLY public."FileAsset" DROP CONSTRAINT IF EXISTS "FileAsset_pkey";
ALTER TABLE IF EXISTS ONLY public."FieldVisit" DROP CONSTRAINT IF EXISTS "FieldVisit_pkey";
ALTER TABLE IF EXISTS ONLY public."Expense" DROP CONSTRAINT IF EXISTS "Expense_pkey";
ALTER TABLE IF EXISTS ONLY public."ExpensePayment" DROP CONSTRAINT IF EXISTS "ExpensePayment_pkey";
ALTER TABLE IF EXISTS ONLY public."DocumentTaxLine" DROP CONSTRAINT IF EXISTS "DocumentTaxLine_pkey";
ALTER TABLE IF EXISTS ONLY public."DocumentSequence" DROP CONSTRAINT IF EXISTS "DocumentSequence_pkey";
ALTER TABLE IF EXISTS ONLY public."DocumentBrandingSettings" DROP CONSTRAINT IF EXISTS "DocumentBrandingSettings_pkey";
ALTER TABLE IF EXISTS ONLY public."DiagnosisReport" DROP CONSTRAINT IF EXISTS "DiagnosisReport_pkey";
ALTER TABLE IF EXISTS ONLY public."Device" DROP CONSTRAINT IF EXISTS "Device_pkey";
ALTER TABLE IF EXISTS ONLY public."DeviceSpecification" DROP CONSTRAINT IF EXISTS "DeviceSpecification_pkey";
ALTER TABLE IF EXISTS ONLY public."Department" DROP CONSTRAINT IF EXISTS "Department_pkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNote" DROP CONSTRAINT IF EXISTS "DeliveryNote_pkey";
ALTER TABLE IF EXISTS ONLY public."DeliveryNoteItem" DROP CONSTRAINT IF EXISTS "DeliveryNoteItem_pkey";
ALTER TABLE IF EXISTS ONLY public."CustomerConsent" DROP CONSTRAINT IF EXISTS "CustomerConsent_pkey";
ALTER TABLE IF EXISTS ONLY public."CustomerApproval" DROP CONSTRAINT IF EXISTS "CustomerApproval_pkey";
ALTER TABLE IF EXISTS ONLY public."CreditNote" DROP CONSTRAINT IF EXISTS "CreditNote_pkey";
ALTER TABLE IF EXISTS ONLY public."CreditNoteItem" DROP CONSTRAINT IF EXISTS "CreditNoteItem_pkey";
ALTER TABLE IF EXISTS ONLY public."Conversation" DROP CONSTRAINT IF EXISTS "Conversation_pkey";
ALTER TABLE IF EXISTS ONLY public."ConversationMessage" DROP CONSTRAINT IF EXISTS "ConversationMessage_pkey";
ALTER TABLE IF EXISTS ONLY public."Complaint" DROP CONSTRAINT IF EXISTS "Complaint_pkey";
ALTER TABLE IF EXISTS ONLY public."CommunicationTemplate" DROP CONSTRAINT IF EXISTS "CommunicationTemplate_pkey";
ALTER TABLE IF EXISTS ONLY public."CommunicationTemplateVersion" DROP CONSTRAINT IF EXISTS "CommunicationTemplateVersion_pkey";
ALTER TABLE IF EXISTS ONLY public."CommunicationPolicy" DROP CONSTRAINT IF EXISTS "CommunicationPolicy_pkey";
ALTER TABLE IF EXISTS ONLY public."Client" DROP CONSTRAINT IF EXISTS "Client_pkey";
ALTER TABLE IF EXISTS ONLY public."ClientNote" DROP CONSTRAINT IF EXISTS "ClientNote_pkey";
ALTER TABLE IF EXISTS ONLY public."ClientMergeRecord" DROP CONSTRAINT IF EXISTS "ClientMergeRecord_pkey";
ALTER TABLE IF EXISTS ONLY public."ChartOfAccount" DROP CONSTRAINT IF EXISTS "ChartOfAccount_pkey";
ALTER TABLE IF EXISTS ONLY public."CashierShift" DROP CONSTRAINT IF EXISTS "CashierShift_pkey";
ALTER TABLE IF EXISTS ONLY public."Campaign" DROP CONSTRAINT IF EXISTS "Campaign_pkey";
ALTER TABLE IF EXISTS ONLY public."CampaignContact" DROP CONSTRAINT IF EXISTS "CampaignContact_pkey";
ALTER TABLE IF EXISTS ONLY public."Branch" DROP CONSTRAINT IF EXISTS "Branch_pkey";
ALTER TABLE IF EXISTS ONLY public."BillingEvent" DROP CONSTRAINT IF EXISTS "BillingEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."BankTransaction" DROP CONSTRAINT IF EXISTS "BankTransaction_pkey";
ALTER TABLE IF EXISTS ONLY public."BankAccount" DROP CONSTRAINT IF EXISTS "BankAccount_pkey";
ALTER TABLE IF EXISTS ONLY public."AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_pkey";
ALTER TABLE IF EXISTS ONLY public."AiPromptLog" DROP CONSTRAINT IF EXISTS "AiPromptLog_pkey";
ALTER TABLE IF EXISTS ONLY public."AiOrgSettings" DROP CONSTRAINT IF EXISTS "AiOrgSettings_pkey";
ALTER TABLE IF EXISTS ONLY public."AiKnowledgeArticle" DROP CONSTRAINT IF EXISTS "AiKnowledgeArticle_pkey";
ALTER TABLE IF EXISTS ONLY public."AiFeedback" DROP CONSTRAINT IF EXISTS "AiFeedback_pkey";
ALTER TABLE IF EXISTS ONLY public."Account" DROP CONSTRAINT IF EXISTS "Account_pkey";
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TABLE IF EXISTS public."WarrantyClaim";
DROP TABLE IF EXISTS public."Verification";
DROP TABLE IF EXISTS public."UserPermission";
DROP TABLE IF EXISTS public."UserInvite";
DROP TABLE IF EXISTS public."UserGroupPermission";
DROP TABLE IF EXISTS public."UserGroupMember";
DROP TABLE IF EXISTS public."UserGroup";
DROP TABLE IF EXISTS public."UserAccessAudit";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."TechnicianPayout";
DROP TABLE IF EXISTS public."TaxRate";
DROP TABLE IF EXISTS public."SystemAuditEvent";
DROP TABLE IF EXISTS public."SystemAnnouncement";
DROP TABLE IF EXISTS public."SupplierPrice";
DROP TABLE IF EXISTS public."SupplierPayment";
DROP TABLE IF EXISTS public."SupplierBillItem";
DROP TABLE IF EXISTS public."SupplierBill";
DROP TABLE IF EXISTS public."Supplier";
DROP TABLE IF EXISTS public."StockTransferItem";
DROP TABLE IF EXISTS public."StockTransfer";
DROP TABLE IF EXISTS public."StockLocation";
DROP TABLE IF EXISTS public."StockCountItem";
DROP TABLE IF EXISTS public."StockCount";
DROP TABLE IF EXISTS public."SmsUsage";
DROP TABLE IF EXISTS public."Session";
DROP TABLE IF EXISTS public."SalesTarget";
DROP TABLE IF EXISTS public."SaleItem";
DROP TABLE IF EXISTS public."Sale";
DROP TABLE IF EXISTS public."RepairTask";
DROP TABLE IF EXISTS public."RepairRequestSequence";
DROP TABLE IF EXISTS public."RepairRequest";
DROP TABLE IF EXISTS public."RepairMessage";
DROP TABLE IF EXISTS public."ReorderRule";
DROP TABLE IF EXISTS public."Refund";
DROP TABLE IF EXISTS public."RecurringInvoiceItem";
DROP TABLE IF EXISTS public."RecurringInvoice";
DROP TABLE IF EXISTS public."RecurringExpense";
DROP TABLE IF EXISTS public."Receipt";
DROP TABLE IF EXISTS public."RateLimit";
DROP TABLE IF EXISTS public."QuotationItem";
DROP TABLE IF EXISTS public."Quotation";
DROP TABLE IF EXISTS public."QualityCheck";
DROP TABLE IF EXISTS public."PurchaseRequestItem";
DROP TABLE IF EXISTS public."PurchaseRequest";
DROP TABLE IF EXISTS public."PurchaseOrderItem";
DROP TABLE IF EXISTS public."PurchaseOrder";
DROP TABLE IF EXISTS public."PosSession";
DROP TABLE IF EXISTS public."PortalUserClient";
DROP TABLE IF EXISTS public."PortalUser";
DROP TABLE IF EXISTS public."PortalSession";
DROP TABLE IF EXISTS public."PlatformSetting";
DROP TABLE IF EXISTS public."Photo";
DROP TABLE IF EXISTS public."PaymentReminderSettings";
DROP TABLE IF EXISTS public."PaymentAllocation";
DROP TABLE IF EXISTS public."Payment";
DROP TABLE IF EXISTS public."PartStockTransaction";
DROP TABLE IF EXISTS public."PartReservation";
DROP TABLE IF EXISTS public."PartLocationStock";
DROP TABLE IF EXISTS public."Part";
DROP TABLE IF EXISTS public."OutboundMessage";
DROP TABLE IF EXISTS public."Organization";
DROP TABLE IF EXISTS public."OrgWhatsAppConfig";
DROP TABLE IF EXISTS public."OrgUsageSnapshot";
DROP TABLE IF EXISTS public."OrgSubscriptionEvent";
DROP TABLE IF EXISTS public."OrgModuleGrant";
DROP TABLE IF EXISTS public."OrgFeatureEntitlement";
DROP TABLE IF EXISTS public."OneTimeExternalTechAssignment";
DROP TABLE IF EXISTS public."NotificationPreferences";
DROP TABLE IF EXISTS public."Notification";
DROP TABLE IF EXISTS public."LeadActivity";
DROP TABLE IF EXISTS public."Lead";
DROP TABLE IF EXISTS public."JournalLine";
DROP TABLE IF EXISTS public."JournalEntry";
DROP TABLE IF EXISTS public."JobStatusHistory";
DROP TABLE IF EXISTS public."JobAssignmentHistory";
DROP TABLE IF EXISTS public."Job";
DROP TABLE IF EXISTS public."InvoiceLine";
DROP TABLE IF EXISTS public."InvoiceAttachment";
DROP TABLE IF EXISTS public."Invoice";
DROP TABLE IF EXISTS public."InventoryCategory";
DROP TABLE IF EXISTS public."InboundMessage";
DROP TABLE IF EXISTS public."GoodsReceivedItem";
DROP TABLE IF EXISTS public."GoodsReceived";
DROP TABLE IF EXISTS public."FxReferenceRate";
DROP TABLE IF EXISTS public."FileAsset";
DROP TABLE IF EXISTS public."FieldVisit";
DROP TABLE IF EXISTS public."ExpensePayment";
DROP TABLE IF EXISTS public."Expense";
DROP TABLE IF EXISTS public."DocumentTaxLine";
DROP TABLE IF EXISTS public."DocumentSequence";
DROP TABLE IF EXISTS public."DocumentBrandingSettings";
DROP TABLE IF EXISTS public."DiagnosisReport";
DROP TABLE IF EXISTS public."DeviceSpecification";
DROP TABLE IF EXISTS public."Device";
DROP TABLE IF EXISTS public."Department";
DROP TABLE IF EXISTS public."DeliveryNoteItem";
DROP TABLE IF EXISTS public."DeliveryNote";
DROP TABLE IF EXISTS public."CustomerConsent";
DROP TABLE IF EXISTS public."CustomerApproval";
DROP TABLE IF EXISTS public."CreditNoteItem";
DROP TABLE IF EXISTS public."CreditNote";
DROP TABLE IF EXISTS public."ConversationMessage";
DROP TABLE IF EXISTS public."Conversation";
DROP TABLE IF EXISTS public."Complaint";
DROP TABLE IF EXISTS public."CommunicationTemplateVersion";
DROP TABLE IF EXISTS public."CommunicationTemplate";
DROP TABLE IF EXISTS public."CommunicationPolicy";
DROP TABLE IF EXISTS public."ClientNote";
DROP TABLE IF EXISTS public."ClientMergeRecord";
DROP TABLE IF EXISTS public."Client";
DROP TABLE IF EXISTS public."ChartOfAccount";
DROP TABLE IF EXISTS public."CashierShift";
DROP TABLE IF EXISTS public."CampaignContact";
DROP TABLE IF EXISTS public."Campaign";
DROP TABLE IF EXISTS public."Branch";
DROP TABLE IF EXISTS public."BillingEvent";
DROP TABLE IF EXISTS public."BankTransaction";
DROP TABLE IF EXISTS public."BankAccount";
DROP TABLE IF EXISTS public."AuditLog";
DROP TABLE IF EXISTS public."AiPromptLog";
DROP TABLE IF EXISTS public."AiOrgSettings";
DROP TABLE IF EXISTS public."AiKnowledgeArticle";
DROP TABLE IF EXISTS public."AiFeedback";
DROP TABLE IF EXISTS public."Account";
DROP TYPE IF EXISTS public."WorkflowReason";
DROP TYPE IF EXISTS public."UserAccessMode";
DROP TYPE IF EXISTS public."TimelineConfidence";
DROP TYPE IF EXISTS public."TechType";
DROP TYPE IF EXISTS public."TargetPeriod";
DROP TYPE IF EXISTS public."TargetMetric";
DROP TYPE IF EXISTS public."TargetEntityType";
DROP TYPE IF EXISTS public."SupplierBillStatus";
DROP TYPE IF EXISTS public."StockTransferStatus";
DROP TYPE IF EXISTS public."StockTransactionType";
DROP TYPE IF EXISTS public."StockCountStatus";
DROP TYPE IF EXISTS public."SoftwareInstallerSource";
DROP TYPE IF EXISTS public."ServiceType";
DROP TYPE IF EXISTS public."SaleStatus";
DROP TYPE IF EXISTS public."SaleBillingMode";
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."RepairRequestStatus";
DROP TYPE IF EXISTS public."RepairPath";
DROP TYPE IF EXISTS public."RepairHandoverStatus";
DROP TYPE IF EXISTS public."RecommendationOption";
DROP TYPE IF EXISTS public."QuotationStatus";
DROP TYPE IF EXISTS public."PurchaseRequestStatus";
DROP TYPE IF EXISTS public."PurchaseRequestPriority";
DROP TYPE IF EXISTS public."PurchaseOrderStatus";
DROP TYPE IF EXISTS public."PosSessionStatus";
DROP TYPE IF EXISTS public."PortalRole";
DROP TYPE IF EXISTS public."PaymentMethod";
DROP TYPE IF EXISTS public."PartReservationStatus";
DROP TYPE IF EXISTS public."OutboundMessageType";
DROP TYPE IF EXISTS public."OutboundMessageStatus";
DROP TYPE IF EXISTS public."OutboundMessageChannel";
DROP TYPE IF EXISTS public."OrgPlan";
DROP TYPE IF EXISTS public."OrgModule";
DROP TYPE IF EXISTS public."OrgBillingStatus";
DROP TYPE IF EXISTS public."NotificationType";
DROP TYPE IF EXISTS public."NotificationChannel";
DROP TYPE IF EXISTS public."LeadStatus";
DROP TYPE IF EXISTS public."LeadSource";
DROP TYPE IF EXISTS public."JournalEntryStatus";
DROP TYPE IF EXISTS public."JobStatus";
DROP TYPE IF EXISTS public."InvoiceType";
DROP TYPE IF EXISTS public."InvoiceStatus";
DROP TYPE IF EXISTS public."HandoverMethod";
DROP TYPE IF EXISTS public."GoodsReceivedStatus";
DROP TYPE IF EXISTS public."FieldVisitType";
DROP TYPE IF EXISTS public."FieldVisitStatus";
DROP TYPE IF EXISTS public."ExpenseCategory";
DROP TYPE IF EXISTS public."DeviceType";
DROP TYPE IF EXISTS public."DeliveryMethod";
DROP TYPE IF EXISTS public."ContactMethod";
DROP TYPE IF EXISTS public."ComplaintStatus";
DROP TYPE IF EXISTS public."ComplaintChannel";
DROP TYPE IF EXISTS public."ComplaintCategory";
DROP TYPE IF EXISTS public."CommunicationStatus";
DROP TYPE IF EXISTS public."CampaignType";
DROP TYPE IF EXISTS public."CampaignStatus";
DROP TYPE IF EXISTS public."CampaignContactStatus";
DROP TYPE IF EXISTS public."BankTransactionType";
DROP TYPE IF EXISTS public."AccountType";
--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AccountType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AccountType" AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
);


--
-- Name: BankTransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BankTransactionType" AS ENUM (
    'CREDIT',
    'DEBIT'
);


--
-- Name: CampaignContactStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CampaignContactStatus" AS ENUM (
    'PENDING',
    'SENT',
    'OPENED',
    'RESPONDED',
    'OPTED_OUT'
);


--
-- Name: CampaignStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CampaignStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: CampaignType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CampaignType" AS ENUM (
    'EMAIL',
    'SMS',
    'CALL',
    'WHATSAPP'
);


--
-- Name: CommunicationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CommunicationStatus" AS ENUM (
    'NONE',
    'AWAITING_RESPONSE',
    'APPROVED',
    'DECLINED'
);


--
-- Name: ComplaintCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ComplaintCategory" AS ENUM (
    'SERVICE_QUALITY',
    'REPAIR_DELAY',
    'BILLING',
    'STAFF_CONDUCT',
    'DAMAGE_CAUSED',
    'UNRESOLVED_FAULT',
    'OTHER'
);


--
-- Name: ComplaintChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ComplaintChannel" AS ENUM (
    'WEB',
    'WALK_IN',
    'PHONE',
    'WHATSAPP',
    'EMAIL'
);


--
-- Name: ComplaintStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ComplaintStatus" AS ENUM (
    'RECEIVED',
    'ACKNOWLEDGED',
    'INVESTIGATING',
    'RESOLVED',
    'CLOSED'
);


--
-- Name: ContactMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ContactMethod" AS ENUM (
    'WHATSAPP',
    'PHONE',
    'EMAIL',
    'SMS'
);


--
-- Name: DeliveryMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeliveryMethod" AS ENUM (
    'PICKUP',
    'DELIVERY',
    'COURIER'
);


--
-- Name: DeviceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DeviceType" AS ENUM (
    'PHONE_ANDROID',
    'PHONE_IPHONE',
    'TABLET',
    'WINDOWS_PC',
    'MAC',
    'OTHER'
);


--
-- Name: ExpenseCategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ExpenseCategory" AS ENUM (
    'RENT',
    'UTILITIES',
    'SALARIES',
    'SUPPLIES',
    'MARKETING',
    'TRAVEL',
    'EQUIPMENT',
    'MAINTENANCE',
    'TAXES',
    'OTHER'
);


--
-- Name: FieldVisitStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FieldVisitStatus" AS ENUM (
    'SCHEDULED',
    'EN_ROUTE',
    'ARRIVED',
    'COMPLETED',
    'CANCELLED',
    'FAILED'
);


--
-- Name: FieldVisitType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FieldVisitType" AS ENUM (
    'COLLECTION',
    'DELIVERY',
    'ONSITE_REPAIR',
    'ASSESSMENT',
    'FOLLOWUP'
);


--
-- Name: GoodsReceivedStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GoodsReceivedStatus" AS ENUM (
    'POSTED',
    'CANCELLED'
);


--
-- Name: HandoverMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."HandoverMethod" AS ENUM (
    'SELF_DROPOFF',
    'SEND_WITH_DELIVERY_PERSON',
    'REQUEST_PICKUP'
);


--
-- Name: InvoiceStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'ISSUED',
    'PAID',
    'VOID'
);


--
-- Name: InvoiceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InvoiceType" AS ENUM (
    'REPAIR',
    'SERVICE',
    'MERCHANDISE',
    'CONTRACT',
    'OTHER'
);


--
-- Name: JobStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JobStatus" AS ENUM (
    'RECEIVED',
    'DIAGNOSING',
    'REFERRED',
    'PENDING_EXTERNAL_ASSIGNMENT',
    'ASSIGNED_ONE_TIME_EXTERNAL',
    'IN_EXTERNAL_REPAIR',
    'WAITING_FOR_PARTS',
    'RETURNED_FROM_EXTERNAL',
    'AWAITING_APPROVAL',
    'IN_REPAIR',
    'READY_FOR_PICKUP',
    'DELIVERED',
    'COMPLETED',
    'CLOSED'
);


--
-- Name: JournalEntryStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."JournalEntryStatus" AS ENUM (
    'DRAFT',
    'POSTED',
    'VOID'
);


--
-- Name: LeadSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LeadSource" AS ENUM (
    'WALK_IN',
    'REFERRAL',
    'PHONE',
    'SOCIAL_MEDIA',
    'WEBSITE',
    'OTHER'
);


--
-- Name: LeadStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."LeadStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'PROPOSAL_SENT',
    'WON',
    'LOST',
    'STALE'
);


--
-- Name: NotificationChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationChannel" AS ENUM (
    'DASHBOARD',
    'WHATSAPP',
    'EMAIL'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'STATUS_CHANGE',
    'APPROVAL_NEEDED',
    'JOB_ASSIGNED',
    'ESTIMATE_SUBMITTED',
    'PAYMENT_RECEIVED',
    'PAYOUT_GENERATED',
    'TIMELINE_UPDATED',
    'DELAY_NOTE_ADDED',
    'STOCK_LOW',
    'STOCK_OUT',
    'JOB_CREATED',
    'REPAIR_REQUEST_RECEIVED',
    'QUOTATION_ACCEPTED',
    'QUOTATION_REJECTED',
    'LEAD_WON',
    'LEAD_LOST',
    'PURCHASE_REQUEST_SUBMITTED',
    'PURCHASE_REQUEST_APPROVED',
    'STOCK_RECEIVED',
    'STOCK_TRANSFER_UPDATED',
    'STOCK_COUNT_APPROVED',
    'FIELD_VISIT_COMPLETED',
    'CREDIT_NOTE_ISSUED',
    'REFUND_ISSUED',
    'BILLING',
    'PORTAL_MESSAGE',
    'PAYABLE_DUE'
);


--
-- Name: OrgBillingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrgBillingStatus" AS ENUM (
    'TRIALING',
    'ACTIVE',
    'PAST_DUE',
    'CANCELLED'
);


--
-- Name: OrgModule; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrgModule" AS ENUM (
    'JOBS',
    'INVENTORY',
    'POS',
    'PURCHASE_ORDERS',
    'INVOICING',
    'COMPLAINTS',
    'REPORTS',
    'SALES',
    'FIELD',
    'TARGETS'
);


--
-- Name: OrgPlan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrgPlan" AS ENUM (
    'STARTER',
    'STANDARD',
    'GROWTH',
    'PREMIUM',
    'ENTERPRISE'
);


--
-- Name: OutboundMessageChannel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OutboundMessageChannel" AS ENUM (
    'WHATSAPP',
    'EMAIL'
);


--
-- Name: OutboundMessageStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OutboundMessageStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED',
    'DEAD',
    'PREVIEW'
);


--
-- Name: OutboundMessageType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OutboundMessageType" AS ENUM (
    'REPAIR_REQUEST_CONFIRMATION',
    'FRONT_DESK_APPROVED',
    'FRONT_DESK_REJECTED',
    'INTAKE_APPROVED',
    'INTAKE_REJECTED',
    'JOB_CREATED',
    'JOB_COMPLETED',
    'JOB_STATUS_UPDATE',
    'READY_FOR_PICKUP_NUDGE_1',
    'READY_FOR_PICKUP_NUDGE_2',
    'REPAIR_REQUEST_EMAIL_ALERT',
    'ADMIN_TEST',
    'STAFF_REPLY',
    'INVOICE_REMINDER',
    'WARRANTY_CLAIM_UPDATE',
    'CAMPAIGN_MESSAGE'
);


--
-- Name: PartReservationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PartReservationStatus" AS ENUM (
    'RESERVED',
    'CONSUMED',
    'RELEASED'
);


--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'MOBILE_MONEY',
    'BANK_TRANSFER',
    'CARD',
    'OTHER'
);


--
-- Name: PortalRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PortalRole" AS ENUM (
    'ORG_ADMIN',
    'IT_OFFICER',
    'MEMBER'
);


--
-- Name: PosSessionStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PosSessionStatus" AS ENUM (
    'OPEN',
    'CLOSED'
);


--
-- Name: PurchaseOrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseOrderStatus" AS ENUM (
    'DRAFT',
    'ORDERED',
    'PARTIAL',
    'RECEIVED',
    'CANCELLED'
);


--
-- Name: PurchaseRequestPriority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseRequestPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);


--
-- Name: PurchaseRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseRequestStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'CONVERTED',
    'CANCELLED'
);


--
-- Name: QuotationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."QuotationStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED',
    'VOID'
);


--
-- Name: RecommendationOption; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RecommendationOption" AS ENUM (
    'PROCEED_REPAIR',
    'REPLACE_DEVICE',
    'RETURN_UNREPAIRED'
);


--
-- Name: RepairHandoverStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RepairHandoverStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'FAILED'
);


--
-- Name: RepairPath; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RepairPath" AS ENUM (
    'IN_HOUSE',
    'EXTERNAL'
);


--
-- Name: RepairRequestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."RepairRequestStatus" AS ENUM (
    'PENDING_INTAKE',
    'PENDING_FRONT_DESK',
    'APPROVED',
    'REJECTED',
    'CONVERTED_TO_JOB'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'MANAGER',
    'TECH_MANAGER',
    'FINANCE',
    'SALES',
    'SALES_MANAGER',
    'SALES_CORPORATE',
    'SALES_RETAIL',
    'SALES_POS',
    'TECH_FIELD',
    'OPS',
    'TECHNICIAN_INTERNAL',
    'TECHNICIAN_EXTERNAL',
    'FRONT_DESK',
    'INTAKE',
    'OPERATIONS_MANAGER'
);


--
-- Name: SaleBillingMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SaleBillingMode" AS ENUM (
    'CASH',
    'INVOICE'
);


--
-- Name: SaleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SaleStatus" AS ENUM (
    'OPEN',
    'PAID',
    'PARTIALLY_RETURNED',
    'RETURNED',
    'VOID'
);


--
-- Name: ServiceType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ServiceType" AS ENUM (
    'HARDWARE',
    'SOFTWARE',
    'BOTH'
);


--
-- Name: SoftwareInstallerSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SoftwareInstallerSource" AS ENUM (
    'CLIENT_PROVIDED_INSTALLER',
    'CLIENT_ACCOUNT_LOGIN',
    'COMPANY_LICENSE',
    'OPEN_SOURCE',
    'OTHER'
);


--
-- Name: StockCountStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockCountStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'CANCELLED'
);


--
-- Name: StockTransactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockTransactionType" AS ENUM (
    'IN',
    'OUT',
    'ADJUST'
);


--
-- Name: StockTransferStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockTransferStatus" AS ENUM (
    'REQUESTED',
    'APPROVED',
    'DISPATCHED',
    'RECEIVED',
    'CANCELLED'
);


--
-- Name: SupplierBillStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SupplierBillStatus" AS ENUM (
    'DRAFT',
    'POSTED',
    'PART_PAID',
    'PAID',
    'CANCELLED'
);


--
-- Name: TargetEntityType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TargetEntityType" AS ENUM (
    'USER',
    'INDIVIDUAL',
    'DEPARTMENT',
    'BRANCH',
    'COMPANY'
);


--
-- Name: TargetMetric; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TargetMetric" AS ENUM (
    'REVENUE',
    'JOBS_COMPLETED',
    'LEADS_CONVERTED',
    'SALES_COUNT',
    'QUOTATIONS_SENT',
    'POS_SALES',
    'CUSTOMER_SATISFACTION',
    'RESPONSE_TIME_HOURS'
);


--
-- Name: TargetPeriod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TargetPeriod" AS ENUM (
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'ANNUAL',
    'YEARLY'
);


--
-- Name: TechType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TechType" AS ENUM (
    'INTERNAL',
    'EXTERNAL_PERMANENT',
    'EXTERNAL_ONE_TIME',
    'FIELD'
);


--
-- Name: TimelineConfidence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TimelineConfidence" AS ENUM (
    'FIRM',
    'ESTIMATED',
    'PARTS_DEPENDENT'
);


--
-- Name: UserAccessMode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserAccessMode" AS ENUM (
    'FULL',
    'READ_ONLY'
);


--
-- Name: WorkflowReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkflowReason" AS ENUM (
    'NONE',
    'PARTS_PENDING',
    'SPECIALIST_ESCALATION',
    'CLIENT_DECLINED',
    'UNREPAIRABLE',
    'CUSTOMER_CANCELLED',
    'OTHER',
    'CLIENT_APPROVED',
    'CLIENT_APPROVED_PARTS_PENDING',
    'CLIENT_APPROVED_AWAITING_DEVICE'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp(3) without time zone,
    "refreshTokenExpiresAt" timestamp(3) without time zone,
    scope text,
    password text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiFeedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiFeedback" (
    id text NOT NULL,
    "orgId" text,
    "userId" text,
    feature text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    rating text NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AiKnowledgeArticle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiKnowledgeArticle" (
    id text NOT NULL,
    "orgId" text,
    title text NOT NULL,
    module text NOT NULL,
    content text NOT NULL,
    "embeddingJson" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiOrgSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiOrgSettings" (
    "orgId" text NOT NULL,
    "aiEnabled" boolean DEFAULT true NOT NULL,
    "guideEnabled" boolean DEFAULT true NOT NULL,
    "insightsEnabled" boolean DEFAULT true NOT NULL,
    "allowOrgKnowledge" boolean DEFAULT true NOT NULL,
    "allowPromptLogging" boolean DEFAULT true NOT NULL,
    model text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AiPromptLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AiPromptLog" (
    id text NOT NULL,
    "orgId" text,
    "userId" text,
    feature text NOT NULL,
    "promptVersion" text NOT NULL,
    model text,
    "questionRedacted" text NOT NULL,
    "contextSummary" text,
    mode text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    "userId" text NOT NULL,
    action text NOT NULL,
    detail text,
    "orgId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BankAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BankAccount" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    "accountNumber" text,
    "bankName" text NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "openingBalance" numeric(18,2) DEFAULT 0 NOT NULL,
    "currentBalance" numeric(18,2) DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "ledgerCode" text
);


--
-- Name: BankTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BankTransaction" (
    id text NOT NULL,
    "bankAccountId" text NOT NULL,
    "orgId" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    description text NOT NULL,
    amount numeric(18,2) NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    type public."BankTransactionType" NOT NULL,
    reference text,
    "reconciledAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BillingEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BillingEvent" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    event text NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    status text NOT NULL,
    "flwTxId" text,
    "txRef" text,
    plan text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Branch" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Campaign; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Campaign" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    type public."CampaignType" NOT NULL,
    status public."CampaignStatus" DEFAULT 'DRAFT'::public."CampaignStatus" NOT NULL,
    subject text,
    body text NOT NULL,
    "scheduledAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CampaignContact; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CampaignContact" (
    id text NOT NULL,
    "campaignId" text NOT NULL,
    "orgId" text NOT NULL,
    "leadId" text,
    "clientId" text,
    status public."CampaignContactStatus" DEFAULT 'PENDING'::public."CampaignContactStatus" NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "openedAt" timestamp(3) without time zone,
    "repliedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CashierShift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CashierShift" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "branchId" text,
    "posSessionId" text,
    "cashierId" text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    "shiftPin" text,
    "openingCash" numeric(18,2) DEFAULT 0 NOT NULL,
    "closingCash" numeric(18,2),
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    notes text
);


--
-- Name: ChartOfAccount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ChartOfAccount" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type public."AccountType" NOT NULL,
    "parentId" text,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    email text,
    organization text,
    address text,
    notes text,
    "orgId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ClientMergeRecord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClientMergeRecord" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "sourceClientId" text NOT NULL,
    "targetClientId" text NOT NULL,
    "mergedById" text NOT NULL,
    reason text,
    "snapshotJson" text,
    "mergedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ClientNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClientNote" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    "authorId" text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CommunicationPolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationPolicy" (
    id text NOT NULL,
    status public."JobStatus" NOT NULL,
    "dashboardEnabled" boolean DEFAULT true NOT NULL,
    "whatsappEnabled" boolean DEFAULT false NOT NULL,
    "emailEnabled" boolean DEFAULT false NOT NULL,
    "templateKey" text,
    "nudge1Hours" integer,
    "nudge2Hours" integer,
    "orgId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CommunicationTemplate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationTemplate" (
    id text NOT NULL,
    key text NOT NULL,
    channel public."OutboundMessageChannel" NOT NULL,
    label text NOT NULL,
    subject text,
    body text NOT NULL,
    variables text,
    "metaTemplateName" text,
    "metaLanguageCode" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "orgId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CommunicationTemplateVersion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CommunicationTemplateVersion" (
    id text NOT NULL,
    "orgId" text,
    "templateId" text NOT NULL,
    version integer NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    subject text,
    body text NOT NULL,
    variables text,
    "approvedAt" timestamp(3) without time zone,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Complaint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Complaint" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "complaintNumber" text NOT NULL,
    status public."ComplaintStatus" DEFAULT 'RECEIVED'::public."ComplaintStatus" NOT NULL,
    category public."ComplaintCategory" DEFAULT 'OTHER'::public."ComplaintCategory" NOT NULL,
    channel public."ComplaintChannel" DEFAULT 'WEB'::public."ComplaintChannel" NOT NULL,
    "jobId" text,
    "saleId" text,
    "clientName" text NOT NULL,
    "clientPhone" text NOT NULL,
    "clientEmail" text,
    description text NOT NULL,
    "expectedResolution" text,
    "assignedToId" text,
    "internalNotes" text,
    resolution text,
    "acknowledgedAt" timestamp(3) without time zone,
    "investigatingAt" timestamp(3) without time zone,
    "resolvedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "satisfactionRating" integer,
    "satisfactionComment" text,
    "ratedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientId" text
);


--
-- Name: Conversation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conversation" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    channel text NOT NULL,
    "clientId" text,
    "jobId" text,
    "repairRequestId" text,
    "assignedToId" text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    subject text,
    "lastMessageAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: ConversationMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ConversationMessage" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "conversationId" text NOT NULL,
    direction text NOT NULL,
    channel text NOT NULL,
    sender text,
    recipient text,
    body text,
    "outboundMessageId" text,
    "inboundMessageId" text,
    "providerMessageId" text,
    "sentAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CreditNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CreditNote" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "saleId" text,
    "invoiceId" text,
    "creditNoteNumber" text NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    "totalAmount" numeric(18,2) NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason text,
    "itemsReceivedBackAt" timestamp(3) without time zone,
    "itemsReceivedBackById" text,
    "itemsReceivedBackNote" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CreditNoteItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CreditNoteItem" (
    id text NOT NULL,
    "creditNoteId" text NOT NULL,
    "partId" text,
    description text NOT NULL,
    quantity numeric(18,2) NOT NULL,
    "unitPrice" numeric(18,2) NOT NULL,
    "lineTotal" numeric(18,2) NOT NULL,
    "saleUomFactor" numeric(18,6),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CustomerApproval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerApproval" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    "approvalType" text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    amount numeric(18,2),
    currency text,
    "exchangeRateToBase" numeric(12,6),
    "requestedById" text,
    "respondedByName" text,
    "responseNote" text,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "respondedAt" timestamp(3) without time zone
);


--
-- Name: CustomerConsent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CustomerConsent" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "clientId" text NOT NULL,
    "consentType" text NOT NULL,
    channel text,
    granted boolean DEFAULT true NOT NULL,
    source text,
    "capturedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    note text
);


--
-- Name: DeliveryNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeliveryNote" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "saleId" text,
    "invoiceId" text,
    "deliveryNoteNumber" text NOT NULL,
    "deliveredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "deliveryMethod" public."DeliveryMethod",
    "deliveredByName" text NOT NULL,
    "receivedByName" text NOT NULL,
    "receivedBySignatureText" text,
    note text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: DeliveryNoteItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeliveryNoteItem" (
    id text NOT NULL,
    "deliveryNoteId" text NOT NULL,
    "saleItemId" text,
    "partId" text,
    description text NOT NULL,
    quantity integer NOT NULL
);


--
-- Name: Department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Department" (
    id text NOT NULL,
    "orgId" text,
    name text NOT NULL,
    code text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Device; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Device" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    "orgId" text NOT NULL,
    "deviceType" public."DeviceType" NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    "serialOrImei" text,
    accessories text,
    "physicalNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DeviceSpecification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeviceSpecification" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "deviceId" text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    source text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DiagnosisReport; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DiagnosisReport" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    "authorId" text,
    visibility text DEFAULT 'INTERNAL'::text NOT NULL,
    summary text NOT NULL,
    findings text,
    "recommendedWork" text,
    "riskNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DocumentBrandingSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentBrandingSettings" (
    id text NOT NULL,
    "orgId" text,
    "companyName" text DEFAULT 'Eagle Info Solutions'::text NOT NULL,
    "companyTagline" text,
    "companyAddressLine1" text DEFAULT 'Nalubega Complex, 1st Floor'::text NOT NULL,
    "companyAddressLine2" text DEFAULT 'Shop L28, Bombo Road Opposite Watoto Church'::text NOT NULL,
    "companyContacts" text DEFAULT '+256772 006 344 | +256754 006 344'::text NOT NULL,
    "companyEmail" text,
    "companyWebsite" text,
    "companyTaxId" text,
    "companyLogoUrl" text,
    "companyLogoKey" text,
    "documentTitle" text DEFAULT 'Job Card'::text NOT NULL,
    "quotePrefix" text DEFAULT 'EIS'::text NOT NULL,
    "quoteFormat" text DEFAULT '{PREFIX} {M}/{YYYY}/{SEQ}'::text NOT NULL,
    "quoteValidityDays" integer DEFAULT 30 NOT NULL,
    "sequencePadLength" integer DEFAULT 4 NOT NULL,
    "vatDefaultApplicable" boolean DEFAULT false NOT NULL,
    "vatRatePercent" numeric(12,6) DEFAULT 18 NOT NULL,
    "vatInclusive" boolean DEFAULT false NOT NULL,
    "vatLabel" text DEFAULT 'VAT'::text NOT NULL,
    "termsText" text DEFAULT 'We supply equipment and carry out repairs; only the terms relevant to this document apply.
Goods are subject to stock availability and carry the manufacturer warranty only, where applicable.
Repair work is carried out only after approval is recorded, and parts availability may affect the timeline.
Pre-existing or hidden faults may affect the outcome of a repair.
Uncollected devices may attract storage fees after notice.'::text NOT NULL,
    "footerText" text DEFAULT 'Powered by Duuka Pro Max — Eagle Info''s repair & business management platform. care.eagleinfosolutions.com'::text NOT NULL,
    "paymentInstructions" text DEFAULT ''::text NOT NULL,
    "paymentAccounts" text DEFAULT ''::text NOT NULL,
    "signatureCompanyLabel" text DEFAULT 'Signed by: Eagle Info Solutions'::text NOT NULL,
    "signatureClientLabel" text DEFAULT 'Signed by: Client'::text NOT NULL,
    "primaryColor" text DEFAULT '#000000'::text NOT NULL,
    "secondaryColor" text DEFAULT '#D4AF37'::text NOT NULL,
    "accentColor" text DEFAULT '#D4AF37'::text NOT NULL,
    "backgroundColor" text DEFAULT '#FFFFFF'::text NOT NULL,
    "surfaceColor" text DEFAULT '#F5F5F5'::text NOT NULL,
    "borderColor" text DEFAULT '#E5E5E5'::text NOT NULL,
    "invoiceTemplateKey" text DEFAULT 'invoice_classic'::text NOT NULL,
    "quotationTemplateKey" text DEFAULT 'quote_classic'::text NOT NULL,
    "jobCardTemplateKey" text DEFAULT 'job_card_classic'::text NOT NULL,
    "receiptTemplateKey" text DEFAULT 'receipt_classic'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: DocumentSequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentSequence" (
    id text NOT NULL,
    "orgId" text,
    type text NOT NULL,
    year integer NOT NULL,
    value integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    month integer DEFAULT 0 NOT NULL
);


--
-- Name: DocumentTaxLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentTaxLine" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "documentType" text NOT NULL,
    "documentId" text NOT NULL,
    "taxLabel" text NOT NULL,
    "taxRate" numeric(12,6) NOT NULL,
    "taxableAmount" numeric(18,2) NOT NULL,
    "taxAmount" numeric(18,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Expense" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "expenseNumber" text NOT NULL,
    category public."ExpenseCategory" DEFAULT 'OTHER'::public."ExpenseCategory" NOT NULL,
    description text NOT NULL,
    amount numeric(18,2) NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    "paidAt" timestamp(3) without time zone,
    method public."PaymentMethod",
    "supplierId" text,
    "branchId" text,
    reference text,
    notes text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueAt" timestamp(3) without time zone,
    "paidAmount" numeric(18,2) DEFAULT 0 NOT NULL
);


--
-- Name: ExpensePayment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ExpensePayment" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "expenseId" text NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    amount numeric(18,2) NOT NULL,
    method public."PaymentMethod" DEFAULT 'CASH'::public."PaymentMethod" NOT NULL,
    reference text,
    "paidAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FieldVisit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FieldVisit" (
    id text NOT NULL,
    "orgId" text,
    "branchId" text,
    "jobId" text,
    "assignedToId" text NOT NULL,
    "scheduledById" text NOT NULL,
    type public."FieldVisitType" NOT NULL,
    status public."FieldVisitStatus" DEFAULT 'SCHEDULED'::public."FieldVisitStatus" NOT NULL,
    "scheduledAt" timestamp(3) without time zone NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "arrivedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    address text NOT NULL,
    "gpsLat" double precision,
    "gpsLng" double precision,
    "contactName" text,
    "contactPhone" text,
    notes text,
    "outcomeNotes" text,
    "signoffName" text,
    "signoffAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: FileAsset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FileAsset" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "ownerType" text NOT NULL,
    "ownerId" text NOT NULL,
    url text NOT NULL,
    "storageKey" text,
    "fileName" text,
    "mimeType" text,
    "sizeBytes" integer,
    label text,
    visibility text DEFAULT 'INTERNAL'::text NOT NULL,
    "uploadedById" text,
    "deletedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: FxReferenceRate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."FxReferenceRate" (
    id text NOT NULL,
    base text NOT NULL,
    quote text NOT NULL,
    rate numeric(12,6) NOT NULL,
    source text NOT NULL,
    "fetchedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: GoodsReceived; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GoodsReceived" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "grnNumber" text NOT NULL,
    status public."GoodsReceivedStatus" DEFAULT 'POSTED'::public."GoodsReceivedStatus" NOT NULL,
    "supplierId" text NOT NULL,
    "poId" text,
    "locationId" text NOT NULL,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: GoodsReceivedItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GoodsReceivedItem" (
    id text NOT NULL,
    "grnId" text NOT NULL,
    "poItemId" text,
    "partId" text,
    description text NOT NULL,
    quantity integer NOT NULL,
    "unitCost" numeric(18,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InboundMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InboundMessage" (
    id text NOT NULL,
    wamid text NOT NULL,
    "from" text NOT NULL,
    body text,
    "mediaType" text,
    "mediaId" text,
    "mediaCaption" text,
    "timestamp" timestamp(3) without time zone NOT NULL,
    "clientId" text,
    "jobId" text,
    "orgId" text,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InventoryCategory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InventoryCategory" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    "parentId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text,
    "clientId" text,
    "invoiceType" public."InvoiceType" DEFAULT 'REPAIR'::public."InvoiceType" NOT NULL,
    subject text,
    "dueDate" timestamp(3) without time zone,
    "invoiceNumber" text NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    status public."InvoiceStatus" DEFAULT 'ISSUED'::public."InvoiceStatus" NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "totalAmount" numeric(18,2) NOT NULL,
    "paidAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "paidAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: InvoiceAttachment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceAttachment" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "invoiceId" text NOT NULL,
    "fileName" text NOT NULL,
    "filePath" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text,
    "uploadedById" text,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: InvoiceLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."InvoiceLine" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "invoiceId" text NOT NULL,
    "sourceType" text,
    "sourceId" text,
    description text NOT NULL,
    quantity numeric(18,3) DEFAULT 1 NOT NULL,
    "unitPrice" numeric(18,2) NOT NULL,
    "discountAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "lineTotal" numeric(18,2) NOT NULL,
    "saleUomFactor" numeric(18,6),
    "costAtSale" numeric(18,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Job; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Job" (
    id text NOT NULL,
    "jobNumber" text NOT NULL,
    status public."JobStatus" DEFAULT 'RECEIVED'::public."JobStatus" NOT NULL,
    "repairPath" public."RepairPath",
    "orgId" text NOT NULL,
    "branchId" text,
    "clientId" text NOT NULL,
    "deviceId" text,
    "createdById" text NOT NULL,
    "assignedToId" text,
    "deviceType" public."DeviceType" NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    "serialOrImei" text,
    accessories text,
    "physicalNotes" text,
    "serviceType" public."ServiceType" DEFAULT 'HARDWARE'::public."ServiceType" NOT NULL,
    "softwareOsInstall" boolean DEFAULT false NOT NULL,
    "softwareDriversUpdates" boolean DEFAULT false NOT NULL,
    "softwareDataBackupRestore" boolean DEFAULT false NOT NULL,
    "softwareAccountSetup" boolean DEFAULT false NOT NULL,
    "softwarePerformanceTune" boolean DEFAULT false NOT NULL,
    "softwareThirdPartyApps" boolean DEFAULT false NOT NULL,
    "softwareRequestedNotes" text,
    "softwareLicenseAttested" boolean DEFAULT false NOT NULL,
    "softwareInstallerSource" public."SoftwareInstallerSource",
    "softwareInstallerSourceNote" text,
    "issueDescription" text NOT NULL,
    "workflowReason" public."WorkflowReason" DEFAULT 'NONE'::public."WorkflowReason" NOT NULL,
    "statusNote" text,
    "diagnosisNotes" text,
    "externalDiagnosis" text,
    "recommendedRepair" text,
    "recommendationOption" public."RecommendationOption",
    "communicationStatus" public."CommunicationStatus" DEFAULT 'NONE'::public."CommunicationStatus" NOT NULL,
    "clientConversationNote" text,
    "lastClientContactAt" timestamp(3) without time zone,
    "partsNeeded" text,
    "costEstimate" numeric(18,2),
    "finalCost" numeric(18,2),
    "vatApplicable" boolean DEFAULT true NOT NULL,
    "externalTechFee" numeric(18,2),
    "externalPaid" boolean DEFAULT false NOT NULL,
    "externalPaidAt" timestamp(3) without time zone,
    "externalPaidById" text,
    "externalPaymentRef" text,
    "clientPaid" boolean DEFAULT false NOT NULL,
    "clientPaidAt" timestamp(3) without time zone,
    "clientPaidById" text,
    "clientPaymentRef" text,
    "invoiceNumber" text,
    "invoiceIssuedAt" timestamp(3) without time zone,
    "clientApproved" boolean,
    "approvalDate" timestamp(3) without time zone,
    "quotedAt" timestamp(3) without time zone,
    "quotationNumber" text,
    "repairTimeline" text,
    "timelineMinMinutes" integer,
    "timelineMaxMinutes" integer,
    "timelineConfidence" public."TimelineConfidence",
    "timelineNote" text,
    "technicianNotes" text,
    "workDone" text,
    "partsReplaced" text,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "warrantyMonths" integer,
    "warrantyExpiresAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "deliveryMethod" public."DeliveryMethod",
    "deliveredTo" text,
    "closedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: JobAssignmentHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."JobAssignmentHistory" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    "assignedToId" text,
    "assignedById" text,
    "assignmentType" text DEFAULT 'PRIMARY'::text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "endedAt" timestamp(3) without time zone,
    note text
);


--
-- Name: JobStatusHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."JobStatusHistory" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    "fromStatus" text,
    "toStatus" text NOT NULL,
    reason text,
    "changedById" text,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "metadataJson" text
);


--
-- Name: JournalEntry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."JournalEntry" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "entryNumber" text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    description text NOT NULL,
    reference text,
    status public."JournalEntryStatus" DEFAULT 'DRAFT'::public."JournalEntryStatus" NOT NULL,
    "totalAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "createdById" text NOT NULL,
    "postedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: JournalLine; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."JournalLine" (
    id text NOT NULL,
    "journalEntryId" text NOT NULL,
    "accountId" text NOT NULL,
    debit numeric(18,2) DEFAULT 0 NOT NULL,
    credit numeric(18,2) DEFAULT 0 NOT NULL,
    description text
);


--
-- Name: Lead; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Lead" (
    id text NOT NULL,
    "orgId" text,
    "branchId" text,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    email text,
    organization text,
    interest text,
    source public."LeadSource" DEFAULT 'WALK_IN'::public."LeadSource" NOT NULL,
    status public."LeadStatus" DEFAULT 'NEW'::public."LeadStatus" NOT NULL,
    "estimatedValue" numeric(18,2),
    score integer DEFAULT 0 NOT NULL,
    notes text,
    "lostReason" text,
    "clientId" text,
    "assignedToId" text,
    "createdById" text,
    "convertedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "followUpAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: LeadActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LeadActivity" (
    id text NOT NULL,
    "leadId" text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    note text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "jobId" text,
    "userId" text,
    channel public."NotificationChannel" DEFAULT 'DASHBOARD'::public."NotificationChannel" NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "readAt" timestamp(3) without time zone,
    "orgId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: NotificationPreferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationPreferences" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "notifyStatusChange" boolean DEFAULT true NOT NULL,
    "notifyApprovalNeeded" boolean DEFAULT true NOT NULL,
    "notifyJobAssigned" boolean DEFAULT true NOT NULL,
    "notifyEstimateSubmitted" boolean DEFAULT true NOT NULL,
    "notifyPaymentReceived" boolean DEFAULT true NOT NULL,
    "notifyPayoutGenerated" boolean DEFAULT true NOT NULL,
    "notifyTimelineUpdated" boolean DEFAULT true NOT NULL,
    "notifyDelayNote" boolean DEFAULT true NOT NULL,
    "notifyStockAlert" boolean DEFAULT true NOT NULL,
    "notifyJobCreated" boolean DEFAULT true NOT NULL,
    "notifyRepairRequest" boolean DEFAULT true NOT NULL,
    "notifyQuotationStatus" boolean DEFAULT true NOT NULL,
    "notifyLeadStatus" boolean DEFAULT true NOT NULL,
    "notifyPurchaseRequest" boolean DEFAULT true NOT NULL,
    "notifyStockMovement" boolean DEFAULT true NOT NULL,
    "notifyFieldVisit" boolean DEFAULT true NOT NULL,
    "notifyCreditNote" boolean DEFAULT true NOT NULL,
    "whatsappEnabled" boolean DEFAULT true NOT NULL,
    "emailEnabled" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OneTimeExternalTechAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OneTimeExternalTechAssignment" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    "technicianName" text NOT NULL,
    phone text NOT NULL,
    specialization text,
    "agreedRepairCost" numeric(18,2),
    "partsNotes" text,
    "expectedPartsCost" numeric(18,2),
    "assignedAt" timestamp(3) without time zone NOT NULL,
    "expectedReturnAt" timestamp(3) without time zone,
    "returnedAt" timestamp(3) without time zone,
    instructions text,
    "progressNotes" text,
    "finalOutcome" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OrgFeatureEntitlement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrgFeatureEntitlement" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    feature text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "limitValue" double precision,
    "metadataJson" text,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OrgModuleGrant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrgModuleGrant" (
    "orgId" text NOT NULL,
    module public."OrgModule" NOT NULL
);


--
-- Name: OrgSubscriptionEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrgSubscriptionEvent" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    provider text NOT NULL,
    "eventType" text NOT NULL,
    "providerEventId" text,
    plan text,
    status text,
    amount numeric(18,2),
    currency text,
    "payloadJson" text,
    "occurredAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: OrgUsageSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrgUsageSnapshot" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "periodKey" text NOT NULL,
    metric text NOT NULL,
    value double precision NOT NULL,
    "capturedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "metadataJson" text
);


--
-- Name: OrgWhatsAppConfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrgWhatsAppConfig" (
    "orgId" text NOT NULL,
    "businessNumber" text NOT NULL,
    "phoneNumberId" text NOT NULL,
    "accessToken" text NOT NULL,
    "businessAccountId" text,
    provider text DEFAULT 'meta'::text NOT NULL,
    "atApiKey" text,
    "atUsername" text,
    "atSenderId" text,
    "smsFallback" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organization" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    plan public."OrgPlan" DEFAULT 'STARTER'::public."OrgPlan" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "billingStatus" public."OrgBillingStatus" DEFAULT 'TRIALING'::public."OrgBillingStatus" NOT NULL,
    "flwCustomerId" text,
    "flwSubscriptionId" text,
    "flwPlanId" text,
    "trialEndsAt" timestamp(3) without time zone,
    "planRenewsAt" timestamp(3) without time zone,
    "planCancelledAt" timestamp(3) without time zone,
    "aiModel" text,
    "baseCurrency" text DEFAULT 'UGX'::text NOT NULL,
    "supportedCurrencies" text DEFAULT 'UGX'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: OutboundMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OutboundMessage" (
    id text NOT NULL,
    channel public."OutboundMessageChannel" NOT NULL,
    status public."OutboundMessageStatus" DEFAULT 'PENDING'::public."OutboundMessageStatus" NOT NULL,
    type public."OutboundMessageType" NOT NULL,
    "to" text NOT NULL,
    subject text,
    body text NOT NULL,
    "templateKey" text,
    "templateVars" text,
    "metaTemplateName" text,
    "metaTemplateLanguage" text,
    "metaTemplateVars" text,
    provider text,
    "providerMessageId" text,
    "providerDeliveryStatus" text,
    "providerDeliveryAt" timestamp(3) without time zone,
    "providerDeliveryErrorCode" text,
    "providerDeliveryError" text,
    "attemptCount" integer DEFAULT 0 NOT NULL,
    "lastAttemptAt" timestamp(3) without time zone,
    "nextAttemptAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sentAt" timestamp(3) without time zone,
    "lastErrorCode" text,
    "lastError" text,
    "lockedAt" timestamp(3) without time zone,
    "repairRequestId" text,
    "jobId" text,
    "invoiceId" text,
    "clientId" text,
    "reminderStage" text,
    "orgId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Part; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Part" (
    id text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    manufacturer text,
    "unitCost" numeric(18,2),
    "sellingPrice" numeric(18,2),
    category text,
    description text,
    taxable boolean DEFAULT true NOT NULL,
    "taxRate" numeric(12,6),
    "baseUom" text,
    "saleUom" text,
    "purchaseUom" text,
    "saleUomFactor" numeric(18,6),
    "purchaseUomFactor" numeric(18,6),
    "qtyOnHand" numeric(18,3) DEFAULT 0 NOT NULL,
    "qtyReserved" integer DEFAULT 0 NOT NULL,
    "reorderLevel" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "orgId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "shortDescription" text
);


--
-- Name: PartLocationStock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartLocationStock" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "partId" text NOT NULL,
    "locationId" text NOT NULL,
    "qtyOnHand" integer DEFAULT 0 NOT NULL,
    "qtyReserved" integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PartReservation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartReservation" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    "partId" text NOT NULL,
    quantity integer NOT NULL,
    status public."PartReservationStatus" DEFAULT 'RESERVED'::public."PartReservationStatus" NOT NULL,
    "unitCostSnapshot" numeric(18,2),
    "reservedById" text,
    "reservedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "releasedAt" timestamp(3) without time zone,
    note text
);


--
-- Name: PartStockTransaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PartStockTransaction" (
    id text NOT NULL,
    "partId" text NOT NULL,
    type public."StockTransactionType" NOT NULL,
    quantity numeric(18,3) NOT NULL,
    reason text,
    "orgId" text,
    "locationId" text,
    "unitCost" numeric(18,2),
    "sourceType" text,
    "sourceId" text,
    "jobId" text,
    "saleId" text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Payment" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "invoiceId" text,
    "saleId" text,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    amount numeric(18,2) NOT NULL,
    method public."PaymentMethod" DEFAULT 'CASH'::public."PaymentMethod" NOT NULL,
    kind text DEFAULT 'PAYMENT'::text NOT NULL,
    reference text,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PaymentAllocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentAllocation" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "paymentId" text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    amount numeric(18,2) NOT NULL,
    "allocatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text
);


--
-- Name: PaymentReminderSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PaymentReminderSettings" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "dryRun" boolean DEFAULT true NOT NULL,
    "paymentTermsDays" integer DEFAULT 30 NOT NULL,
    "manualReviewAbove" numeric(18,2) DEFAULT 2000000 NOT NULL,
    "statementForMultiInvoice" boolean DEFAULT true NOT NULL,
    "quietHourStart" integer DEFAULT 8 NOT NULL,
    "quietHourEnd" integer DEFAULT 20 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Photo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Photo" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    url text NOT NULL,
    label text,
    "orgId" text,
    visibility text DEFAULT 'INTERNAL'::text NOT NULL,
    "storageKey" text,
    "mimeType" text,
    "uploadedById" text,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PlatformSetting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PlatformSetting" (
    key text NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PortalSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortalSession" (
    id text NOT NULL,
    token text NOT NULL,
    "portalUserId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PortalUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortalUser" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "clientId" text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    department text,
    "position" text,
    role public."PortalRole" DEFAULT 'IT_OFFICER'::public."PortalRole" NOT NULL,
    "passwordHash" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PortalUserClient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PortalUserClient" (
    id text NOT NULL,
    "portalUserId" text NOT NULL,
    "clientId" text NOT NULL,
    "orgId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PosSession; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PosSession" (
    id text NOT NULL,
    "orgId" text,
    "branchId" text,
    "operatorId" text NOT NULL,
    status public."PosSessionStatus" DEFAULT 'OPEN'::public."PosSessionStatus" NOT NULL,
    "openingFloat" numeric(18,2) DEFAULT 0 NOT NULL,
    "closingCash" numeric(18,2),
    "cashTotal" numeric(18,2) DEFAULT 0 NOT NULL,
    "cardTotal" numeric(18,2) DEFAULT 0 NOT NULL,
    "mobileTotal" numeric(18,2) DEFAULT 0 NOT NULL,
    "totalSales" numeric(18,2) DEFAULT 0 NOT NULL,
    "salesCount" integer DEFAULT 0 NOT NULL,
    "actualClosingBalance" numeric(18,2),
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone,
    notes text
);


--
-- Name: PurchaseOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrder" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "supplierId" text NOT NULL,
    status public."PurchaseOrderStatus" DEFAULT 'DRAFT'::public."PurchaseOrderStatus" NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    reference text,
    "orderedAt" timestamp(3) without time zone,
    "expectedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PurchaseOrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrderItem" (
    id text NOT NULL,
    "poId" text NOT NULL,
    "partId" text,
    description text NOT NULL,
    "qtyOrdered" integer NOT NULL,
    "qtyReceived" integer DEFAULT 0 NOT NULL,
    "unitCost" numeric(18,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PurchaseRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseRequest" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "requestNumber" text NOT NULL,
    status public."PurchaseRequestStatus" DEFAULT 'SUBMITTED'::public."PurchaseRequestStatus" NOT NULL,
    priority public."PurchaseRequestPriority" DEFAULT 'NORMAL'::public."PurchaseRequestPriority" NOT NULL,
    "supplierId" text,
    "neededBy" timestamp(3) without time zone,
    reason text,
    notes text,
    "requestedById" text NOT NULL,
    "reviewedById" text,
    "reviewedAt" timestamp(3) without time zone,
    "reviewNote" text,
    "convertedPoId" text,
    "convertedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: PurchaseRequestItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseRequestItem" (
    id text NOT NULL,
    "requestId" text NOT NULL,
    "partId" text,
    description text NOT NULL,
    quantity integer NOT NULL,
    "estimatedUnitCost" numeric(18,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: QualityCheck; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QualityCheck" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    "checkedById" text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    "checklistJson" text,
    notes text,
    "checkedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Quotation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Quotation" (
    id text NOT NULL,
    "orgId" text,
    "quoteNumber" text NOT NULL,
    status public."QuotationStatus" DEFAULT 'DRAFT'::public."QuotationStatus" NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    "leadId" text,
    "clientId" text,
    "jobId" text,
    subtotal numeric(18,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "vatAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "taxLabel" text,
    "taxRate" numeric(12,6),
    "totalAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    "issueDate" timestamp(3) without time zone,
    "validUntil" timestamp(3) without time zone,
    "sentAt" timestamp(3) without time zone,
    "acceptedAt" timestamp(3) without time zone,
    "rejectedAt" timestamp(3) without time zone,
    "createdById" text,
    "approvedById" text,
    "convertedToInvoiceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: QuotationItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."QuotationItem" (
    id text NOT NULL,
    "quotationId" text NOT NULL,
    "partId" text,
    description text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(18,2) NOT NULL,
    discount numeric(18,2) DEFAULT 0 NOT NULL,
    "lineTotal" numeric(18,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RateLimit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RateLimit" (
    key text NOT NULL,
    count integer NOT NULL,
    "resetAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Receipt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Receipt" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "receiptNumber" text NOT NULL,
    "paymentId" text,
    "saleId" text,
    "invoiceId" text,
    "branchId" text,
    "clientId" text,
    amount numeric(18,2) NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "issuedById" text,
    "voidedAt" timestamp(3) without time zone,
    "voidReason" text
);


--
-- Name: RecurringExpense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecurringExpense" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    description text NOT NULL,
    category public."ExpenseCategory" DEFAULT 'OTHER'::public."ExpenseCategory" NOT NULL,
    amount numeric(18,2) NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "supplierId" text,
    frequency text NOT NULL,
    "nextDueAt" timestamp(3) without time zone NOT NULL,
    "lastIssuedAt" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "autoIssue" boolean DEFAULT true NOT NULL,
    notes text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RecurringInvoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecurringInvoice" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "clientId" text NOT NULL,
    subject text NOT NULL,
    "invoiceType" public."InvoiceType" DEFAULT 'SERVICE'::public."InvoiceType" NOT NULL,
    frequency text NOT NULL,
    "nextDueAt" timestamp(3) without time zone NOT NULL,
    "lastIssuedAt" timestamp(3) without time zone,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "autoIssue" boolean DEFAULT false NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RecurringInvoiceItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RecurringInvoiceItem" (
    id text NOT NULL,
    "recurringInvoiceId" text NOT NULL,
    description text NOT NULL,
    quantity numeric(18,3) DEFAULT 1 NOT NULL,
    "unitPrice" numeric(18,2) NOT NULL,
    "discountAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "lineTotal" numeric(18,2) NOT NULL
);


--
-- Name: Refund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Refund" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "saleId" text,
    "invoiceId" text,
    "creditNoteId" text,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    amount numeric(18,2) NOT NULL,
    method public."PaymentMethod" DEFAULT 'CASH'::public."PaymentMethod" NOT NULL,
    reference text,
    "refundedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdById" text NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ReorderRule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReorderRule" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "partId" text NOT NULL,
    "locationId" text,
    "minQty" integer DEFAULT 0 NOT NULL,
    "targetQty" integer DEFAULT 0 NOT NULL,
    "preferredSupplierId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RepairMessage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RepairMessage" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    "clientId" text,
    "authorType" text NOT NULL,
    "authorId" text,
    "authorName" text NOT NULL,
    body text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RepairRequest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RepairRequest" (
    id text NOT NULL,
    "requestNumber" text NOT NULL,
    "requestStatus" public."RepairRequestStatus" DEFAULT 'PENDING_FRONT_DESK'::public."RepairRequestStatus" NOT NULL,
    "handoverStatus" public."RepairHandoverStatus" DEFAULT 'PENDING'::public."RepairHandoverStatus" NOT NULL,
    "orgId" text,
    "customerName" text NOT NULL,
    phone text NOT NULL,
    email text,
    "preferredContactMethod" public."ContactMethod" DEFAULT 'WHATSAPP'::public."ContactMethod" NOT NULL,
    "deviceType" public."DeviceType" NOT NULL,
    brand text NOT NULL,
    model text,
    "serialNumber" text,
    "problemDescription" text NOT NULL,
    "handoverMethod" public."HandoverMethod" NOT NULL,
    "preferredDropoffDate" text,
    "preferredDropoffTime" text,
    "dropoffNotes" text,
    "deliveryPersonName" text,
    "deliveryPersonPhone" text,
    "deliveryCompany" text,
    "dispatchDate" text,
    "expectedArrivalTime" text,
    "deliveryTrackingReference" text,
    "deliveryFeeResponsibility" text,
    "deliveryNotes" text,
    "pickupAddress" text,
    "pickupLandmark" text,
    "preferredPickupDate" text,
    "preferredPickupTime" text,
    "alternateContactPerson" text,
    "alternateContactPhone" text,
    "pickupNotes" text,
    "linkedJobId" text,
    "clientId" text,
    "submittedByPortalUserId" text,
    "submissionIp" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RepairRequestSequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RepairRequestSequence" (
    id text NOT NULL,
    "orgId" text,
    year integer NOT NULL,
    value integer DEFAULT 0 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: RepairTask; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RepairTask" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    priority text DEFAULT 'NORMAL'::text NOT NULL,
    "assignedToId" text,
    "dueAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Sale; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Sale" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "branchId" text,
    "clientId" text,
    "posSessionId" text,
    status public."SaleStatus" DEFAULT 'OPEN'::public."SaleStatus" NOT NULL,
    "saleNumber" text NOT NULL,
    "billingMode" public."SaleBillingMode" DEFAULT 'CASH'::public."SaleBillingMode" NOT NULL,
    "invoiceNumber" text,
    "invoicedAt" timestamp(3) without time zone,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    subtotal numeric(18,2) DEFAULT 0 NOT NULL,
    "discountAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "vatAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "taxApplicable" boolean DEFAULT false NOT NULL,
    "totalAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "paidAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "paidAt" timestamp(3) without time zone,
    notes text,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text
);


--
-- Name: SaleItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SaleItem" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "partId" text,
    description text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    "unitPrice" numeric(18,2) NOT NULL,
    "lineTotal" numeric(18,2) NOT NULL,
    "saleUomFactor" numeric(18,6),
    "costAtSale" numeric(18,2),
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SalesTarget; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SalesTarget" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "userId" text,
    "departmentId" text,
    "branchId" text,
    "setById" text,
    "entityType" public."TargetEntityType" DEFAULT 'COMPANY'::public."TargetEntityType" NOT NULL,
    metric public."TargetMetric" DEFAULT 'REVENUE'::public."TargetMetric" NOT NULL,
    period text NOT NULL,
    "periodLabel" text,
    "targetRevenue" numeric(18,2) DEFAULT 0 NOT NULL,
    "targetJobs" integer DEFAULT 0 NOT NULL,
    "targetValue" double precision DEFAULT 0 NOT NULL,
    "actualValue" double precision DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    token text NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SmsUsage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SmsUsage" (
    "orgId" text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


--
-- Name: StockCount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockCount" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "countNumber" text NOT NULL,
    status public."StockCountStatus" DEFAULT 'DRAFT'::public."StockCountStatus" NOT NULL,
    "locationId" text NOT NULL,
    "countedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "approvedAt" timestamp(3) without time zone,
    note text,
    "createdById" text NOT NULL,
    "approvedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StockCountItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockCountItem" (
    id text NOT NULL,
    "stockCountId" text NOT NULL,
    "partId" text NOT NULL,
    "systemQty" integer NOT NULL,
    "countedQty" integer NOT NULL,
    "varianceQty" integer NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: StockLocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockLocation" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "branchId" text,
    name text NOT NULL,
    code text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StockTransfer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockTransfer" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "transferNumber" text NOT NULL,
    status public."StockTransferStatus" DEFAULT 'REQUESTED'::public."StockTransferStatus" NOT NULL,
    "fromLocationId" text NOT NULL,
    "toLocationId" text NOT NULL,
    "requestedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "dispatchedAt" timestamp(3) without time zone,
    "receivedAt" timestamp(3) without time zone,
    "cancelledAt" timestamp(3) without time zone,
    note text,
    "createdById" text NOT NULL,
    "approvedById" text,
    "dispatchedById" text,
    "receivedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: StockTransferItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockTransferItem" (
    id text NOT NULL,
    "transferId" text NOT NULL,
    "partId" text NOT NULL,
    quantity integer NOT NULL,
    "qtyDispatched" integer DEFAULT 0 NOT NULL,
    "qtyReceived" integer DEFAULT 0 NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Supplier" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    "contactName" text,
    email text,
    phone text,
    address text,
    notes text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupplierBill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplierBill" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "billNumber" text NOT NULL,
    "supplierRef" text,
    status public."SupplierBillStatus" DEFAULT 'POSTED'::public."SupplierBillStatus" NOT NULL,
    "supplierId" text NOT NULL,
    "poId" text,
    "grnId" text,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    subtotal numeric(18,2) NOT NULL,
    "taxAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "totalAmount" numeric(18,2) NOT NULL,
    "paidAmount" numeric(18,2) DEFAULT 0 NOT NULL,
    "issuedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueAt" timestamp(3) without time zone,
    notes text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SupplierBillItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplierBillItem" (
    id text NOT NULL,
    "billId" text NOT NULL,
    description text NOT NULL,
    quantity integer NOT NULL,
    "unitCost" numeric(18,2) NOT NULL,
    "lineTotal" numeric(18,2) NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SupplierPayment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplierPayment" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "billId" text NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    amount numeric(18,2) NOT NULL,
    "feeAmount" numeric(18,2),
    "baseAmountSent" numeric(18,2),
    method public."PaymentMethod" DEFAULT 'CASH'::public."PaymentMethod" NOT NULL,
    reference text,
    "paidAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SupplierPrice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SupplierPrice" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "supplierId" text NOT NULL,
    "partId" text,
    sku text,
    description text NOT NULL,
    "unitCost" numeric(18,2) NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    "exchangeRateToBase" numeric(12,6),
    "minQuantity" integer,
    "leadTimeDays" integer,
    "validFrom" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "validTo" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SystemAnnouncement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemAnnouncement" (
    id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    level text DEFAULT 'INFO'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SystemAuditEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SystemAuditEvent" (
    id text NOT NULL,
    "orgId" text,
    "actorUserId" text,
    "entityType" text NOT NULL,
    "entityId" text NOT NULL,
    action text NOT NULL,
    summary text,
    "beforeJson" text,
    "afterJson" text,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TaxRate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TaxRate" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    rate numeric(12,6) NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "appliesToSales" boolean DEFAULT true NOT NULL,
    "appliesToPurchases" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: TechnicianPayout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TechnicianPayout" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "jobId" text NOT NULL,
    amount numeric(18,2) NOT NULL,
    method public."PaymentMethod" DEFAULT 'CASH'::public."PaymentMethod" NOT NULL,
    reference text,
    note text,
    "paidAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "recordedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    "emailVerified" boolean DEFAULT false NOT NULL,
    image text,
    role public."Role" DEFAULT 'OPS'::public."Role" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "accessMode" public."UserAccessMode" DEFAULT 'FULL'::public."UserAccessMode" NOT NULL,
    "orgId" text,
    "branchId" text,
    "departmentId" text,
    "techType" public."TechType",
    "employeeId" text,
    specializations text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserAccessAudit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserAccessAudit" (
    id text NOT NULL,
    "targetUserId" text NOT NULL,
    "actorUserId" text NOT NULL,
    action text NOT NULL,
    detail text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UserGroup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserGroup" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: UserGroupMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserGroupMember" (
    id text NOT NULL,
    "groupId" text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UserGroupPermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserGroupPermission" (
    id text NOT NULL,
    "groupId" text NOT NULL,
    permission text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UserInvite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserInvite" (
    id text NOT NULL,
    token text NOT NULL,
    email text NOT NULL,
    role public."Role" DEFAULT 'OPS'::public."Role" NOT NULL,
    "orgId" text NOT NULL,
    "invitedById" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: UserPermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UserPermission" (
    id text NOT NULL,
    "userId" text NOT NULL,
    permission text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Verification" (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: WarrantyClaim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."WarrantyClaim" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "originalJobId" text NOT NULL,
    "warrantyJobId" text,
    status text DEFAULT 'OPEN'::text NOT NULL,
    reason text NOT NULL,
    resolution text,
    "openedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "closedAt" timestamp(3) without time zone
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Account" (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
cmns5jc8q00022lfwjcbjm2yc	cmns5jbas00002lfw97nnwshd	credential	cmns5jbas00002lfw97nnwshd	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:12:37.178	2026-04-10 00:22:06.652
cmns5nlft00032lmetcmyn984	cmns5nkty00012lme8d0os7dx	credential	cmns5nkty00012lme8d0os7dx	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:15:55.721	2026-04-10 00:22:03.478
cmns5nmb000062lmeeowzurgm	cmns5nlp700042lmerqro7219	credential	cmns5nlp700042lmerqro7219	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:15:56.844	2026-04-10 00:22:00.407
cmns5noob000h2lme2cbgzdy0	cmns5nnzs000f2lmeblzgrvrh	credential	cmns5nnzs000f2lmeblzgrvrh	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:15:59.915	2026-04-10 00:22:07.985
cmns5vbu700022lsi3svj85uf	cmns5va4t00002lsis3rrj31k	credential	cmns5va4t00002lsis3rrj31k	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:21:56.526	2026-04-10 00:21:56.526
cmns5vcut00052lsiw1tkupwt	cmns5vc5200032lsil2f7rq0m	credential	cmns5vc5200032lsil2f7rq0m	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:21:57.845	2026-04-10 00:21:57.845
cmns5vdvo00082lsig17x0ufa	cmns5vd6400062lsig31tm6wk	credential	cmns5vd6400062lsig31tm6wk	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-04-10 00:21:59.173	2026-04-10 00:21:59.173
cmpmcqs4s0003l204bfv4ud20	cmpmcqrro0001l2042cc4lw6c	credential	cmpmcqrro0001l2042cc4lw6c	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-05-26 08:07:09.292	2026-05-26 08:07:09.292
cmpvi0u3j0003l204eil1xv5d	cmpvi0twl0001l204yd45lhqm	credential	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-06-01 17:44:52.064	2026-08-18 10:53:31.065
dWsNPet5nTHYSeH1q8fZGBF8GiztQPXP	eSpNxZMk7s8t01mkBNHCx3mMnChQBNLZ	credential	eSpNxZMk7s8t01mkBNHCx3mMnChQBNLZ	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-07-02 12:07:31.95	2026-07-02 12:07:31.95
BFWdky8guaqt1lCJCJyUhhc8iHszkLjh	Qk49HF5DKXKnKhhFenrTJkAOAnAIgLch	credential	Qk49HF5DKXKnKhhFenrTJkAOAnAIgLch	\N	\N	\N	\N	\N	\N	4c1b662e4d511621c3b8e5a54d98a21a:8ac087a86ce4fe6e32a389cb7f45b768be4d2cdc3b3924e555c2e1401341f97ac13572471d2ddfc0129664a5b7107d555af69f4fce5dda9c853ec5d353e48f17	2026-08-08 06:58:23.883	2026-08-08 06:58:23.883
\.


--
-- Data for Name: AiFeedback; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiFeedback" (id, "orgId", "userId", feature, question, answer, rating, comment, "createdAt") FROM stdin;
cmpqssp400000lb0438sebuyl	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	How do I add inventory items?	To add parts/items to inventory:\n1. Open Inventory -> Parts & Stock.\n2. Choose Add Part or New Item.\n3. Enter the part name, SKU/code, manufacturer if available, unit cost, quantity on hand, and reorder level.\n4. If your setup uses locations, choose the stock location where the part is stored.\n5. Save the part. It will appear in inventory and can be used for repairs, POS sales, purchase orders, stock counts, and reorder alerts.\n6. If the part is being bought from a supplier, use Inventory -> Purchase Orders, then Inventory -> Goods Received to increase stock [redacted].\nIf you cannot see the add button, check that your role has inventory/admin permissions.	HELPFUL	\N	2026-05-29 10:47:37.248
\.


--
-- Data for Name: AiKnowledgeArticle; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiKnowledgeArticle" (id, "orgId", title, module, content, "embeddingJson", "isActive", "createdAt", "updatedAt") FROM stdin;
ai_jobs	\N	Jobs and repair workflow	JOBS	Jobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.	\N	t	2026-05-25 13:45:34	2026-05-25 13:45:34
ai_inventory	\N	Inventory and procurement workflow	INVENTORY	Inventory manages parts, quantities, reorder levels, suppliers, purchase requests, purchase orders, goods received, stock counts, transfers, and stock locations. Use Goods Received for supplier stock arrivals instead of manually changing quantities.	\N	t	2026-05-25 13:45:34	2026-05-25 13:45:34
ai_finance	\N	Finance and documents workflow	FINANCE	Finance covers invoices, receipts, expenses, bank accounts, chart of accounts, journal entries, P&L, balance sheet, cash flow, customer statements, aged receivables, and inventory value. Quotations become invoices; invoices produce receipts and delivery notes when paid or delivered.	\N	t	2026-05-25 13:45:34	2026-05-25 13:45:34
ai_sales	\N	Sales POS and CRM workflow	SALES	Sales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.	\N	t	2026-05-25 13:45:34	2026-05-25 13:45:34
ai_ai	\N	AI Guide and AI Insights	AI	The Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.	\N	t	2026-05-25 13:45:34	2026-05-25 13:45:34
ai_security	\N	Roles and security rules	SECURITY	Roles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.	\N	t	2026-05-25 13:45:34	2026-05-25 13:45:34
cmpldhm870000lb041hsngvjt	\N	Sales, POS, and CRM workflow	SALES	Sales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.	[0,0,0,0,0,0,0,0,0,0.492366,0,0,0,0,0,0,0,0,0,0,0.123091,0,0,0,0,0,0.123091,0,0,0,0,0.123091,0.123091,0,0,0,0,0,0,0,0,0,0,0,0,0,0.123091,0,0,0,0,0,0,0,0,0.123091,0,0,0.123091,0,0,0.123091,0,0,0.123091,0,0,0,0,0,0,0,0.123091,0.615457,0,0,0,0.123091,0,0,0,0,0.123091,0.123091,0.246183,0,0.123091,0,0.123091,0,0,0,0.123091,0.123091,0,0,0,0.123091,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.123091,0,0,0,0.123091,0,0,0,0,0.123091,0,0,0,0,0,0]	t	2026-05-25 15:40:15.175	2026-05-25 15:40:15.175
\.


--
-- Data for Name: AiOrgSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiOrgSettings" ("orgId", "aiEnabled", "guideEnabled", "insightsEnabled", "allowOrgKnowledge", "allowPromptLogging", model, "updatedAt") FROM stdin;
org_eis_01	t	t	t	t	t	\N	2026-05-25 15:40:14.565
\.


--
-- Data for Name: AiPromptLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AiPromptLog" (id, "orgId", "userId", feature, "promptVersion", model, "questionRedacted", "contextSummary", mode, "createdAt") FROM stdin;
cmpldhmwm0001lb0469jskmxi	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	Upload before-repair photos if needed.	Relevant Duuka ProMax knowledge base articles:\n\n1. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.\n\n2. Jobs and repair workflow [JOBS]\nJobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.\n\n3. Sales, POS, and CRM workflow [SALES]\nSales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.\n\n4. Sales POS and CRM workflow [SALES]\nSales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.	gemini	2026-05-25 15:40:16.055
cmpldigrm0002lb04tyvf9feu	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	Creating jobs and intake Creating jobs and intake requests.	Relevant Duuka ProMax knowledge base articles:\n\n1. Jobs and repair workflow [JOBS]\nJobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.\n\n2. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.\n\n3. Inventory and procurement workflow [INVENTORY]\nInventory manages parts, quantities, reorder levels, suppliers, purchase requests, purchase orders, goods received, stock counts, transfers, and stock locations. Use Goods Received for supplier stock arrivals instead of manually changing quantities.\n\n4. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.	gemini	2026-05-25 15:40:54.755
cmq101au00002jv046ybska00	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	Hey		gemini	2026-06-05 14:07:57.721
cmq101xn90000l2041veh4w84	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	How do I create a new job?	Relevant Duuka ProMax knowledge base articles:\n\n1. Jobs and repair workflow [JOBS]\nJobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.\n\n2. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.\n\n3. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n4. Finance and documents workflow [FINANCE]\nFinance covers invoices, receipts, expenses, bank accounts, chart of accounts, journal entries, P&L, balance sheet, cash flow, customer statements, aged receivables, and inventory value. Quotations become invoices; invoices produce receipts and delivery notes when paid or delivered.	gemini	2026-06-05 14:08:27.285
cmq124csu000akz04e0x703kf	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	hey		gemini	2026-06-05 15:06:19.471
cmq24j9c50000l504gi0zpodl	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	How do I generate an invoice?	Relevant Duuka ProMax knowledge base articles:\n\n1. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n2. Finance and documents workflow [FINANCE]\nFinance covers invoices, receipts, expenses, bank accounts, chart of accounts, journal entries, P&L, balance sheet, cash flow, customer statements, aged receivables, and inventory value. Quotations become invoices; invoices produce receipts and delivery notes when paid or delivered.\n\n3. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.\n\n4. Jobs and repair workflow [JOBS]\nJobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.	gemini	2026-06-06 09:01:40.23
cmq3j4mx10000jx049febd9fw	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	How do I add inventory items?	Relevant Duuka ProMax knowledge base articles:\n\n1. Inventory and procurement workflow [INVENTORY]\nInventory manages parts, quantities, reorder levels, suppliers, purchase requests, purchase orders, goods received, stock counts, transfers, and stock locations. Use Goods Received for supplier stock arrivals instead of manually changing quantities.\n\n2. Finance and documents workflow [FINANCE]\nFinance covers invoices, receipts, expenses, bank accounts, chart of accounts, journal entries, P&L, balance sheet, cash flow, customer statements, aged receivables, and inventory value. Quotations become invoices; invoices produce receipts and delivery notes when paid or delivered.\n\n3. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n4. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.	gemini	2026-06-07 08:37:58.406
cmq45ptzm0000jv048xqufvpa	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	How do I create a new job?	Relevant Duuka ProMax knowledge base articles:\n\n1. Jobs and repair workflow [JOBS]\nJobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.\n\n2. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.\n\n3. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n4. Finance and documents workflow [FINANCE]\nFinance covers invoices, receipts, expenses, bank accounts, chart of accounts, journal entries, P&L, balance sheet, cash flow, customer statements, aged receivables, and inventory value. Quotations become invoices; invoices produce receipts and delivery notes when paid or delivered.	gemini	2026-06-07 19:10:18.898
cmsb081hf0000li04d5b9etfc	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_GUIDE	duuka-ai-2026-05-25-v2	gemini-1.5-flash	How do I add inventory items?	Relevant Duuka ProMax knowledge base articles:\n\n1. Inventory and procurement workflow [INVENTORY]\nInventory manages parts, quantities, reorder levels, suppliers, purchase requests, purchase orders, goods received, stock counts, transfers, and stock locations. Use Goods Received for supplier stock arrivals instead of manually changing quantities.\n\n2. Finance and documents workflow [FINANCE]\nFinance covers invoices, receipts, expenses, bank accounts, chart of accounts, journal entries, P&L, balance sheet, cash flow, customer statements, aged receivables, and inventory value. Quotations become invoices; invoices produce receipts and delivery notes when paid or delivered.\n\n3. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n4. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.	gemini	2026-08-01 23:30:18.627
cmsg8k0eo0000jz042a6jkvd8	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EI-[phone]\nDevice: LENOVO Unknown (WINDOWS_PC)\nReported issue: Computer has issue with charging System\nTechnician diagnosis: Machine doesn't Power on Power line components check OK\nRecommended repair: Reprogrammed the Bios, machine powers as expected\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-05 15:22:24.913
cmsg91pcs000wla04w5t8rkqu	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EI-[phone]\nDevice: DELL INC DELL (WINDOWS_PC)\nReported issue: LAPTOP NOT CHARGING\nTechnician diagnosis: Machine wont power on\nRecommended repair: Found a Bios Firmware Issue\nParts involved: Only flashes an amber light\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-05 15:36:10.397
cmsg9arrj0003la0481a8q6vt	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EI-[phone]\nDevice: lenovo Unknown (WINDOWS_PC)\nReported issue: Broken Hinges\nTechnician diagnosis: Broken Hinges and Screen Bazel\nRecommended repair: Replace Bezel\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-05 15:43:13.424
cmsg9xogt0010jr0491r3nnx1	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EI-[phone]\nDevice: LENOVO THINKPAD ThinkPad (WINDOWS_PC)\nReported issue: Laptop wasn't powering\nTechnician diagnosis: Machine failed to power on\nRecommended repair: Cant find LogicBoard components\nParts involved: We cant find board repair components,\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-05 16:01:02.237
cmsh7pvul000sl80470ayyqhv	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EAGLE-INFO-SOLUTIONS-EI-[phone]\nDevice: Hp Hp 450 G8 (WINDOWS_PC)\nReported issue: Machine is slow, faulty touchPad and with Keyboard issues\nTechnician diagnosis: Machine visibly seen to delay action of operations Keyboard keys off and also the touch pad drags\nRecommended repair: The Machine needs multi-part replacement\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-06 07:46:45.501
cmt7xtt2h000hjj04gn7nktd5	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EI-[phone]\nDevice: Lenovo ThinkPad (WINDOWS_PC)\nReported issue: Not powering on\nTechnician diagnosis: reported failure to power on\nRecommended repair: Repaired malfunctioned failed power components and\nParts involved: The Power components and power line repair\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-25 00:39:39.114
cmtbjdetx000yla04iur1lrpx	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EIS/2026/0045\nDevice: Dell Latitude 7200 2-in-1 (OTHER)\nReported issue: The Keyboard is not working.\nTechnician diagnosis: Keyboard issues.\nRecommended repair: Replace the plug and Play X2 Dell Keyboard\nParts involved: NA\nTechnician notes: n/a\nStage: the repair has not been carried out yet.\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-27 13:06:04.246
cmtbjeqsm0015la042ume6zdt	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EIS/2026/0049\nDevice: Lenovo Lenovo Thinkbook i5 E15 16GB RAM/477GB (WINDOWS_PC)\nReported issue: BROKEN NEXT TO THE SCREEN BUT ITS WORKING FINE\nTechnician diagnosis: Machine has a broken body around the hinge caused by hinge movement\nRecommended repair: Cosmetic build for the hinge grounding and also broken body on the keyboard Panel\nParts involved: NA\nTechnician notes: n/a\nStage: the repair has been carried out.\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-27 13:07:06.407
cmtfn49uv0000jy04gx3sd22y	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_BUSINESS_COPILOT	duuka-ai-2026-05-25-v2	gemini-1.5-flash	ffd		gemini	2026-08-30 10:02:01.063
cmtfn51zz0001jy04ogzfzfs9	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_BUSINESS_COPILOT	duuka-ai-2026-05-25-v2	gemini-1.5-flash	12 open repair job(s) are older than 7 days. These are likely client-experience and cash-conversion risks.	Relevant Duuka ProMax knowledge base articles:\n\n1. Roles and security rules [SECURITY]\nRoles control data access. ADMIN has full workspace access. OPS and FRONT_DESK manage intake and client communication. FINANCE handles billing and reports. Internal technicians update repair work. External technicians only see assigned job device details and safe diagnosis summaries, never client PII or pricing history.\n\n2. Jobs and repair workflow [JOBS]\nJobs track repairs from intake to completion. Create jobs from Jobs -> New Job, capture client and device details, then move through RECEIVED, DIAGNOSING, REFERRED, AWAITING_APPROVAL, IN_REPAIR, READY_FOR_PICKUP, COMPLETED, or CLOSED. External technicians must never see client identity or pricing history.\n\n3. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n4. Sales, POS, and CRM workflow [SALES]\nSales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.	gemini	2026-08-30 10:02:37.536
cmtgvldsb0000l6043yrqin9l	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_BUSINESS_COPILOT	duuka-ai-2026-05-25-v2	gemini-1.5-flash	Hey		gemini	2026-08-31 06:47:02.411
cmtjvf8p20000jr04ar4ktzc9	org_eis_01	cmns5jbas00002lfw97nnwshd	AI_BUSINESS_COPILOT	duuka-ai-2026-05-25-v2	claude-haiku-4-5	What should I focus on today?	Relevant Duuka ProMax knowledge base articles:\n\n1. AI Guide and AI Insights [AI]\nThe Duuka AI Guide helps staff learn how to use the system. AI Insights and Business Copilot help managers understand aggregate operational risks such as stuck repairs, low stock, overdue invoices, supplier payables, expenses, and target progress. AI should not receive client PII or private notes unless explicitly designed and approved.\n\n2. Sales, POS, and CRM workflow [SALES]\nSales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.\n\n3. Sales POS and CRM workflow [SALES]\nSales CRM tracks leads, campaigns, quotations, visits, and targets. POS handles walk-in sales and cashier shifts. Managers should review open leads, target progress, paid sales, receipts, and campaign follow-up activity.	anthropic	2026-09-02 09:05:34.406
cmtl1mqg60000jr04zi1g0lds	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EIS/2026/0043\nDevice: Lenovo V14 i3 16GB RAM/477GB Lenovo V14 i3 16GB RAM/477GB (WINDOWS_PC)\nReported issue: LAPTOP NOT POWERING AND NOT CHARGING\nTechnician diagnosis: Machine won’t power on\nRecommended repair: Lenovo thinkpad got short circuit on it's motherboard\nParts involved: NA\nTechnician notes: n/a\nStage: the repair has not been carried out yet.\n\nWrite the assessment report for this repair.	\N	anthropic	2026-09-03 04:47:07.878
cmsrjssey0000l1044enedssa	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EIS/2026/0042\nDevice: Epson Printer Epson (OTHER)\nReported issue: The printer prints blank not un till you've done nozzle [redacted]\nTechnician diagnosis: Paper Prints Blank unless nozzle Nozzle [redacted] or colour alignments\nRecommended repair: Printer Head sensor failure confirmed, failure to command papers to pass through service on the printer\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-13 13:22:38.17
cmsyoq1f70000l504njnho5a0	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EIS/2026/0042\nDevice: Epson Printer Epson (OTHER)\nReported issue: The printer prints blank not un till you've done nozzle [redacted]\nTechnician diagnosis: Paper Prints Blank unless nozzle Nozzle [redacted] or colour alignments\nRecommended repair: Printer Head sensor failure confirmed, failure to command papers to pass through service on the printer\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-18 13:14:51.188
cmsg8rwdv000kjz043v9akfam	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EI-[phone]\nDevice: THINKBOOK Unknown (WINDOWS_PC)\nReported issue: There was lemonade spillage in the computer\nTechnician diagnosis: Machine has a Spill,\nRecommended repair: [redacted] the Board to a non enhanced dry Tested all working as expected\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-05 15:28:32.947
cmsyp0ghp0001jx04wtfk06tm	org_eis_01	cmns5jbas00002lfw97nnwshd	ASSESSMENT	duuka-ai-2026-05-25-v2	claude-sonnet-5	Repair job number: EIS/2026/0042\nDevice: Epson Printer Epson (OTHER)\nReported issue: The printer prints blank not un till you've done nozzle [redacted]\nTechnician diagnosis: Paper Prints Blank unless nozzle Nozzle [redacted] or colour alignments\nRecommended repair: Printer Head sensor failure confirmed, failure to command papers to pass through service on the printer\nParts involved: NA\nTechnician notes: n/a\n\nWrite the assessment report for this repair.	\N	anthropic	2026-08-18 13:22:57.278
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AuditLog" (id, "jobId", "userId", action, detail, "orgId", "createdAt") FROM stdin;
\.


--
-- Data for Name: BankAccount; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BankAccount" (id, "orgId", name, "accountNumber", "bankName", currency, "openingBalance", "currentBalance", "isActive", "createdAt", "updatedAt", "ledgerCode") FROM stdin;
\.


--
-- Data for Name: BankTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BankTransaction" (id, "bankAccountId", "orgId", date, description, amount, currency, "exchangeRateToBase", type, reference, "reconciledAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: BillingEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BillingEvent" (id, "orgId", event, amount, currency, status, "flwTxId", "txRef", plan, "createdAt") FROM stdin;
\.


--
-- Data for Name: Branch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Branch" (id, "orgId", name, address, phone, "isDefault", "isActive", "createdAt", "updatedAt") FROM stdin;
branch_eis_main	org_eis_01	Eagle Info Solutions	Plot 177, Kampala	+256756406577	t	t	2026-05-25 11:10:00	2026-05-25 11:10:00
\.


--
-- Data for Name: Campaign; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Campaign" (id, "orgId", name, type, status, subject, body, "scheduledAt", "startedAt", "completedAt", "createdById", "createdAt", "updatedAt") FROM stdin;
cmpfe1edi0001ky04unkldr3l	org_eis_01	MacBook Pro 13-inch 2020 Deals	WHATSAPP	ACTIVE	\N	Upgrade to a [redacted], powerful MacBook Pro at a great price.\r\n\r\nAvailable until end of next week:\r\n\r\nMacBook Pro 13” 2020\r\nIntel i5 | 16GB | 256GB\r\nUGX 2.2M\r\n\r\nMacBook Pro 13” 2020\r\nIntel i5 | 16GB | 1TB\r\nUGX 2.6M\r\n\r\nMacBook Pro 13” 2020\r\nIntel i7 | 32GB | 1TB\r\nUGX 3.3M\r\n\r\nProfessionally checked and ready for work.\r\n\r\nEagle Info Solutions\r\nGenuine devices. Trusted support.\r\nCall/WhatsApp: [phone redacted]	\N	2026-05-21 11:10:05.026	2026-05-21 11:28:02.823	cmns5jbas00002lfw97nnwshd	2026-05-21 11:09:01.062	2026-05-21 11:28:12.106
\.


--
-- Data for Name: CampaignContact; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CampaignContact" (id, "campaignId", "orgId", "leadId", "clientId", status, "sentAt", "openedAt", "repliedAt", "createdAt") FROM stdin;
cmpfe1plf0001la05bbxs5mxm	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnsu3ifj0000lb0781yjo6cj	SENT	2026-05-21 11:14:15.829	\N	\N	2026-05-21 11:09:15.604
cmpfe1psu0003la05u96uwf4u	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnsugsv50000l804rlhd91sd	SENT	2026-05-21 11:14:55.527	\N	\N	2026-05-21 11:09:15.871
cmpfe1q010005la05jsmbvj2j	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnsumgzj0004if04haj2vbki	SENT	2026-05-21 19:13:20.031	\N	\N	2026-05-21 11:09:16.129
cmpfe1q770007la05ea0htlna	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmrkk87s20001k104tq42br03	SENT	2026-05-21 19:13:20.971	\N	\N	2026-05-21 11:09:16.388
cmpfe1qe70009la05j71wykfq	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnsuxyi90009if04lcmfmiv3	SENT	2026-05-21 11:15:10.783	\N	\N	2026-05-21 11:09:16.639
cmpfe1ql8000bla05z6pf88lv	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnt1ujwg0000jv04erji6d04	SENT	2026-05-21 19:13:21.852	\N	\N	2026-05-21 11:09:16.892
cmpfe1qsw000dla05vzz5m9q5	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmntvqwbw0000l704etryfmwr	SENT	2026-05-21 19:13:22.568	\N	\N	2026-05-21 11:09:17.169
cmpfe1r02000fla05zo62qkxb	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnvcj3a10000ld04pn9edyv1	SENT	2026-05-21 19:13:23.343	\N	\N	2026-05-21 11:09:17.426
cmpfe1r74000hla05uzxu5im9	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnvkb87j0000js04cyxzwml1	SENT	2026-05-21 19:13:23.997	\N	\N	2026-05-21 11:09:17.68
cmpfe1red000jla051wwbuwpd	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnwq8epr0000le044obmxf11	SENT	2026-05-21 11:15:41.869	\N	\N	2026-05-21 11:09:17.942
cmpfe1rlm000lla05smhef0s3	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnwq8pkk0005le04crjsvnv7	SENT	2026-05-21 19:13:24.873	\N	\N	2026-05-21 11:09:18.202
cmpfe1rst000nla05epr3zy0y	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnx5s4y50000l104l47jq56u	SENT	2026-05-21 19:13:25.543	\N	\N	2026-05-21 11:09:18.462
cmpfe1s0o000pla05p1fn5zwn	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmnyjdki50000l504iksqfuv1	SENT	2026-05-21 19:13:26.177	\N	\N	2026-05-21 11:09:18.745
cmpfe1sfy000tla057c9pgvup	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmo05hxzb0001jr04d0jgu1p0	SENT	2026-05-21 19:13:27.465	\N	\N	2026-05-21 11:09:19.294
cmpfe1sn2000vla05ntdy4507	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmo1rje3u0000l604zeoe85s2	SENT	2026-05-21 19:13:28.136	\N	\N	2026-05-21 11:09:19.55
cmpfe1su6000xla05pwvz9k25	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmo4wigwh000gjy04nxndyx1k	SENT	2026-05-21 19:13:29.035	\N	\N	2026-05-21 11:09:19.806
cmpfe1t19000zla05dvezxdfe	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmo4wu48c0006l104rou4hqx4	SENT	2026-05-21 19:13:29.61	\N	\N	2026-05-21 11:09:20.062
cmpfe1t8a0011la05fkh36wn4	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmod4xwpv0000js042lj8dr7g	SENT	2026-05-21 19:13:30.143	\N	\N	2026-05-21 11:09:20.315
cmpfe1tff0013la05qbiks8ut	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmog7m2fr0000l204msw7v1yc	SENT	2026-05-21 19:13:30.84	\N	\N	2026-05-21 11:09:20.571
cmpfe1tmp0015la05cfdvt2fz	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmogy43fr0000l8046jorrnst	SENT	2026-05-21 19:13:31.625	\N	\N	2026-05-21 11:09:20.833
cmpfe1ttu0017la0579k5mno8	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoh0naxp0004jx04ga22xyog	SENT	2026-05-21 19:13:32.299	\N	\N	2026-05-21 11:09:21.09
cmpfe1u0y0019la05pxxgypl9	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoh5hoq70000l404k2ftzok9	SENT	2026-05-21 19:13:33.046	\N	\N	2026-05-21 11:09:21.346
cmpfe1u92001bla05mn68f1sw	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoim4j9q0000l804pszxp1xn	SENT	2026-05-21 19:13:33.781	\N	\N	2026-05-21 11:09:21.639
cmpfe1ug5001dla05lum4yup1	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoim9zd70004l4047bi61t7n	SENT	2026-05-21 19:13:34.686	\N	\N	2026-05-21 11:09:21.893
cmpfe1un5001fla05zm8lt14g	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoimdnw80007l804qkekez32	SENT	2026-05-21 19:13:35.246	\N	\N	2026-05-21 11:09:22.146
cmpfe1uu6001hla05se82zk79	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmomscde10000kz04runc0pac	SENT	2026-05-21 19:13:36.201	\N	\N	2026-05-21 11:09:22.398
cmpfe1v17001jla05usk85v63	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmomzqhmw0000jr043m97ifu3	SENT	2026-05-21 19:13:36.856	\N	\N	2026-05-21 11:09:22.651
cmpfe1v8b001lla05jjzztbt5	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoq1uezz0006ic04zn4svd4n	SENT	2026-05-21 19:13:37.546	\N	\N	2026-05-21 11:09:22.907
cmpfe1vfe001nla05z0geol27	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmor28wrb0005ld047nu8xay5	SENT	2026-05-21 19:13:38.502	\N	\N	2026-05-21 11:09:23.163
cmpfe1vme001pla05xxagrpel	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmor9qqe70000l704sbyzxld9	SENT	2026-05-21 11:27:34.305	\N	\N	2026-05-21 11:09:23.414
cmpfe1vtl001rla05wo60qo3g	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmor9zwx30000l504pqrpadv4	SENT	2026-05-21 11:27:44.502	\N	\N	2026-05-21 11:09:23.673
cmpfe1w0o001tla057ublky3m	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmora5dqm000aky04aeen65aa	SENT	2026-05-21 19:13:38.986	\N	\N	2026-05-21 11:09:23.928
cmpfe1w7p001vla055bj3eu1h	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoraeqfv000ll5047eq88izd	SENT	2026-05-21 19:13:39.655	\N	\N	2026-05-21 11:09:24.181
cmpfe1wes001xla05hheq3xfo	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmotx2k6m0000js04npyykrqp	SENT	2026-05-21 19:13:40.433	\N	\N	2026-05-21 11:09:24.436
cmpfe1wlx001zla050ae5x7t2	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmotxn0ja000bjs04e3hyzccy	SENT	2026-05-21 19:13:41.183	\N	\N	2026-05-21 11:09:24.693
cmpfe1wt00021la05jr8gzu3s	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmovdymw50000l404ex76us03	SENT	2026-05-21 19:13:42.023	\N	\N	2026-05-21 11:09:24.949
cmpfe1x000023la05a3otheqo	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmovka56b0000l7047w2ftz2r	SENT	2026-05-21 11:14:03.886	\N	\N	2026-05-21 11:09:25.201
cmpfe1x730025la05c4zhetgx	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoy6yfmu0008l7045p4ipwvx	SENT	2026-05-21 19:13:42.733	\N	\N	2026-05-21 11:09:25.455
cmpfe1xf40027la056gasaoi3	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmoy742180006l104hs1r804y	SENT	2026-05-21 19:13:43.444	\N	\N	2026-05-21 11:09:25.744
cmpfe1xpi0029la057pzynap1	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmp0ze3b60000lb04a41a94y8	SENT	2026-05-21 19:13:44.085	\N	\N	2026-05-21 11:09:26.119
cmpfe1y02002bla05fb7wn656	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmp6mp6dw0000la04gj3wc96k	SENT	2026-08-29 13:48:55.814	\N	\N	2026-05-21 11:09:26.498
cmpfe1yl6002fla05f38oikn3	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmp6u8w610000ld04pf6k57q7	SENT	2026-05-21 19:13:46.249	\N	\N	2026-05-21 11:09:27.259
cmpfe1z2o002hla05k6365h99	cmpfe1edi0001ky04unkldr3l	org_eis_01	\N	cmp8fzwz70000jx0465cll0lh	SENT	2026-05-21 19:13:46.798	\N	\N	2026-05-21 11:09:27.888
\.


--
-- Data for Name: CashierShift; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CashierShift" (id, "orgId", "branchId", "posSessionId", "cashierId", status, "shiftPin", "openingCash", "closingCash", "openedAt", "closedAt", notes) FROM stdin;
cmq3h5t0d0000jv04ppc2feq1	org_eis_01	\N	\N	cmns5jbas00002lfw97nnwshd	OPEN	\N	0.00	\N	2026-06-07 07:42:53.726	\N	\N
cmrappjar0000jv0431yslh3g	org_eis_01	\N	\N	cmns5nlp700042lmerqro7219	OPEN	\N	0.00	\N	2026-07-07 13:56:16.756	\N	\N
\.


--
-- Data for Name: ChartOfAccount; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ChartOfAccount" (id, "orgId", code, name, type, "parentId", description, "isSystem", "isActive", "createdAt", "updatedAt") FROM stdin;
cmshf5edt0008l504pyvnm9qp	org_eis_01	1000	Cash & Bank	ASSET	\N	\N	t	t	2026-08-06 11:14:46.673	2026-08-06 11:14:46.673
cmshf5efq000al504meq15c9i	org_eis_01	2100	VAT Payable	LIABILITY	\N	\N	t	t	2026-08-06 11:14:46.742	2026-08-06 11:14:46.742
cmshf5ehm000cl504njyw6k6u	org_eis_01	3000	Owner's Equity	EQUITY	\N	\N	t	t	2026-08-06 11:14:46.81	2026-08-06 11:14:46.81
cmshf5ejf000el504inx6qykg	org_eis_01	4000	Sales Revenue	REVENUE	\N	\N	t	t	2026-08-06 11:14:46.875	2026-08-06 11:14:46.875
cmshf5el7000gl504lqtppi66	org_eis_01	5000	Cost of Sales	EXPENSE	\N	\N	t	t	2026-08-06 11:14:46.939	2026-08-06 11:14:46.939
cmshf5en0000il504cttdo136	org_eis_01	6000	Operating Expenses	EXPENSE	\N	\N	t	t	2026-08-06 11:14:47.004	2026-08-06 11:14:47.004
cmtfhafpf0005ic04p4vt37qa	org_eis_01	6100	Bank & Transfer Charges	EXPENSE	\N	\N	t	t	2026-08-30 07:18:50.884	2026-08-30 07:18:50.884
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Client" (id, "fullName", phone, email, organization, address, notes, "orgId", "createdAt", "updatedAt") FROM stdin;
cmogy43fr0000l8046jorrnst	Client F37163	+256742937383	client-f3716384@example.test	food [redacted]	\N	\N	org_eis_01	2026-04-27 08:39:03.016	2026-04-27 08:39:03.016
cmnsu3ifj0000lb0781yjo6cj	Client 138EF8	+256721776277	client-138ef881@example.test	\N	\N	\N	org_eis_01	2026-04-10 11:40:09.103	2026-07-15 08:24:06.578
cmnsugsv50000l804rlhd91sd	Client 705E72	+256712368344	\N	Street Club Entebbe	\N	\N	org_eis_01	2026-04-10 11:50:29.153	2026-04-10 11:50:29.153
cmnsumgzj0004if04haj2vbki	Client 41F014	+256781245325	\N	\N	\N	\N	org_eis_01	2026-04-10 11:54:53.695	2026-04-10 11:54:53.695
cmnsuxyi90009if04lcmfmiv3	Client 7E5B1C	+256705882893	\N	\N	\N	\N	org_eis_01	2026-04-10 12:03:49.617	2026-04-10 12:03:49.617
cmnt1ujwg0000jv04erji6d04	Client 92C4A6	+256732399075	\N	\N	\N	\N	org_eis_01	2026-04-10 15:17:08.033	2026-04-10 15:17:08.033
cmntvqwbw0000l704etryfmwr	Client 676F03	+256734675216	\N	Sufficiency of Scripture	\N	\N	org_eis_01	2026-04-11 05:14:05.997	2026-07-07 15:40:08.43
cmnvcj3a10000ld04pn9edyv1	Client F951FE	+256708190562	\N	\N	\N	\N	org_eis_01	2026-04-12 05:51:41.401	2026-04-12 05:51:41.401
cmnvkb87j0000js04cyxzwml1	Client A953D4	+256758022708	client-a953d4a2@example.test	\N	\N	\N	org_eis_01	2026-04-12 09:29:31.472	2026-04-12 09:29:31.472
cmnwq8epr0000le044obmxf11	Client A5161D	+256704769418	client-a5161d83@example.test	\N	\N	\N	org_eis_01	2026-04-13 05:03:03.808	2026-04-13 05:03:03.808
cmnwq8pkk0005le04crjsvnv7	Client 9DC4A2	+256728626256	client-9dc4a209@example.test	\N	\N	\N	org_eis_01	2026-04-13 05:03:17.877	2026-04-13 05:03:17.877
cmnx5s4y50000l104l47jq56u	Client F9CEA6	+256767227800	client-f9cea618@example.test	\N	\N	\N	org_eis_01	2026-04-13 12:18:18.509	2026-04-13 12:18:18.509
cmnyjdki50000l504iksqfuv1	Client AC1FD2	+256700379030	client-ac1fd2cf@example.test	\N	\N	\N	org_eis_01	2026-04-14 11:26:39.63	2026-05-10 09:35:22.715
cmo05hxzb0001jr04d0jgu1p0	Client BD6615	+256774094895	\N	\N	\N	\N	org_eis_01	2026-04-15 14:33:41.448	2026-04-28 21:16:10.834
cmo1rje3u0000l604zeoe85s2	Client 051705	+256743630124	\N	\N	\N	\N	org_eis_01	2026-04-16 17:38:26.73	2026-04-16 17:38:26.73
cmo4wigwh000gjy04nxndyx1k	Client 0BB82F	+256740620997	client-0bb82f0b@example.test	MUK	\N	\N	org_eis_01	2026-04-18 22:21:00.306	2026-04-18 22:21:00.306
cmo4wu48c0006l104rou4hqx4	Client 7D06CB	+256725684677	\N	\N	\N	\N	org_eis_01	2026-04-18 22:30:03.756	2026-04-18 22:30:03.756
cmod4xwpv0000js042lj8dr7g	Client 5808EF	+256729503146	\N	Lake Mburo Safaris	\N	\N	org_eis_01	2026-04-24 16:39:06.98	2026-04-28 14:58:38.454
cmog7m2fr0000l204msw7v1yc	Client 50A9E6	+256710484893	client-50a9e6b7@example.test	\N	\N	\N	org_eis_01	2026-04-26 20:17:11.895	2026-04-26 20:17:11.895
cmoh0naxp0004jx04ga22xyog	Client AF271E	+256785877964	\N	\N	\N	\N	org_eis_01	2026-04-27 09:49:58.429	2026-04-27 09:49:58.429
cmoh5hoq70000l404k2ftzok9	Client 0E221A	+256772966519	client-0e221a03@example.test	\N	\N	\N	org_eis_01	2026-04-27 12:05:34.447	2026-04-27 12:05:34.447
cmoim4j9q0000l804pszxp1xn	Client D5035B	+256733633868	\N	\N	\N	\N	org_eis_01	2026-04-28 12:39:00.495	2026-04-28 12:39:00.495
cmoim9zd70004l4047bi61t7n	Client A3A9FE	+256716404686	\N	\N	\N	\N	org_eis_01	2026-04-28 12:43:14.636	2026-04-28 12:43:14.636
cmoimdnw80007l804qkekez32	Client 17040C	+256711576222	\N	\N	\N	\N	org_eis_01	2026-04-28 12:46:06.392	2026-04-28 12:46:06.392
cmqryg5x70001l4040k7ldbxx	Client A5B80F	+256735189037	\N	\N	\N	\N	org_eis_01	2026-06-24 10:53:18.715	2026-06-24 10:53:18.715
cmqwjjlh10001jr043exlhwcq	Client 2A5832	+256791714670	\N	\N	\N	\N	org_eis_01	2026-06-27 15:54:55.477	2026-06-27 15:54:55.477
cmr52czjn0001js04b9mh6xgf	Client 1535BA	+256730481134	\N	\N	\N	\N	org_eis_01	2026-07-03 15:03:49.235	2026-07-03 15:03:49.235
cmomscde10000kz04runc0pac	Client F1CBC1	+256722938996	\N	\N	\N	\N	org_eis_01	2026-05-01 10:44:08.521	2026-05-01 10:44:08.521
cmomzqhmw0000jr043m97ifu3	Client E02FEE	+256701931350	\N	\N	\N	\N	org_eis_01	2026-05-01 14:11:04.52	2026-05-01 14:11:04.52
cmoq1uezz0006ic04zn4svd4n	Client 41FFDD	+256754921796	client-41ffdd3b@example.test	\N	\N	\N	org_eis_01	2026-05-03 17:33:25.487	2026-05-03 17:33:25.487
cmor28wrb0005ld047nu8xay5	Client 4D97C2	+256770264050	client-4d97c2ff@example.test	\N	\N	\N	org_eis_01	2026-05-04 10:32:27.864	2026-05-04 10:35:08.091
cmor9qqe70000l704sbyzxld9	Client 9F0626	+256713300719	\N	Nangs Gadgets	\N	\N	org_eis_01	2026-05-04 14:02:16.735	2026-05-04 14:02:16.735
cmor9zwx30000l504pqrpadv4	Client 5D56C3	+256717007691	\N	WETECH	\N	\N	org_eis_01	2026-05-04 14:09:25.095	2026-05-04 14:09:25.095
cmora5dqm000aky04aeen65aa	Client 71B8B4	+256739842797	\N	\N	\N	\N	org_eis_01	2026-05-04 14:13:40.174	2026-05-04 14:13:40.174
cmoraeqfv000ll5047eq88izd	Client 7837A0	+256737845664	\N	\N	\N	\N	org_eis_01	2026-05-04 14:20:56.539	2026-05-04 14:20:56.539
cmotx2k6m0000js04npyykrqp	Client C9D2D9	+256742929970	\N	\N	\N	\N	org_eis_01	2026-05-06 10:30:52.078	2026-05-07 04:33:55.736
cmotxn0ja000bjs04e3hyzccy	Client 033123	+256771710736	\N	\N	\N	\N	org_eis_01	2026-05-06 10:46:46.391	2026-05-06 10:46:46.391
cmovdymw50000l404ex76us03	Client 225FC9	+256786359552	\N	MKOPA	\N	\N	org_eis_01	2026-05-07 11:11:28.614	2026-05-07 11:11:28.614
cmovka56b0000l7047w2ftz2r	Client FF515C	+256751734123	\N	\N	\N	\N	org_eis_01	2026-05-07 14:08:23.219	2026-05-07 14:08:23.219
cmoy6yfmu0008l7045p4ipwvx	Client CA5EAA	+256763785418	\N	\N	\N	\N	org_eis_01	2026-05-09 10:18:40.423	2026-05-21 06:51:28.967
cmoy742180006l104hs1r804y	Client A90F85	+256719061267	\N	\N	\N	\N	org_eis_01	2026-05-09 10:23:02.732	2026-05-09 10:23:02.732
cmp0ze3b60000lb04a41a94y8	Client B88E2B	+256758565998	\N	Swangz Avenue	\N	\N	org_eis_01	2026-05-11 09:10:12.546	2026-05-11 09:10:12.546
cmp6mp6dw0000la04gj3wc96k	Client 61831F	+256791475447	\N	\N	\N	\N	org_eis_01	2026-05-15 08:01:31.796	2026-05-15 08:01:31.796
cmp8fzwz70000jx0465cll0lh	Client 256B8C	+256762595887	\N	\N	\N	\N	org_eis_01	2026-05-16 14:29:27.859	2026-05-16 14:29:27.859
cmpjp0o600000jv04sx1eolqt	Client E2E960	+256741141386	client-e2e960d5@example.test	\N	\N	\N	org_eis_01	2026-05-24 11:27:27.576	2026-05-24 11:27:27.576
cmpmccuiq0001l204sxqmwq91	Client 83DD91	+256778777588	\N	\N	\N	\N	org_eis_01	2026-05-26 07:56:19.203	2026-05-26 07:56:19.203
cmpmchxp80001l7041tt1kfz7	Client 0E1BE5	+256778196648	\N	\N	\N	\N	org_eis_01	2026-05-26 08:00:16.604	2026-05-26 08:00:16.604
cmpmcm50i0001kz04907ckjvr	Client 5C5B30	+256738279687	\N	\N	\N	\N	org_eis_01	2026-05-26 08:03:32.706	2026-05-26 08:03:32.706
cmpqrjnww0001i50519blu3y5	Client 5B00ED	+256789744140	\N	\N	\N	\N	org_eis_01	2026-05-29 10:12:36.176	2026-05-29 10:12:36.176
cmpseo7nt0001i604r48jburu	Client F3FFDA	+256782690556	\N	Monitor Publications Limited	\N	\N	org_eis_01	2026-05-30 13:47:45.737	2026-05-30 13:47:45.737
cmpwnhyod0001k0042acuaqwm	Client 9FEC49	+256792058967	\N	Ngabu Hotel	\N	\N	org_eis_01	2026-06-02 13:05:55.405	2026-06-02 13:05:55.405
cmq261jk60001jr04o4vgrdm5	Client E3ABED	+256784329288	\N	\N	\N	\N	org_eis_01	2026-06-06 09:43:52.902	2026-06-06 09:43:52.902
cmq2dj60k0009ii04v5c6kzb5	Client CCCDC0	+256726378312	client-cccdc0f3@example.test	\N	\N	\N	org_eis_01	2026-06-06 13:13:32.469	2026-06-06 13:13:32.469
cmq5btsu00001kz04gs7kwqll	Client 128551	+256715672615	\N	\N	\N	\N	org_eis_01	2026-06-08 14:49:07.897	2026-06-08 14:49:07.897
cmq5c79tf0001jv04jdwiyad3	Client F8A188	+256778990105	\N	MAKERERE UNIVERSITY	\N	\N	org_eis_01	2026-06-08 14:59:36.435	2026-06-08 14:59:36.435
cmq5d21bk0001jv04icd2mpz8	Client 60B9A0	+256730562852	\N	\N	\N	\N	org_eis_01	2026-06-08 15:23:31.76	2026-06-08 15:23:31.76
cmq6p2rvx0001ld040fcrj2m2	Client 51767C	+256798233467	\N	\N	\N	\N	org_eis_01	2026-06-09 13:47:47.757	2026-06-09 13:47:47.757
cmqc5f7lq0001k004sq6d7hn7	Client 487D38	+256702779062	\N	\N	\N	\N	org_eis_01	2026-06-13 09:24:12.735	2026-06-13 09:24:12.735
cmqcapsbp0001js045eyk2j30	Client 72E251	+256729300255	\N	\N	\N	\N	org_eis_01	2026-06-13 11:52:24.229	2026-06-13 11:52:24.229
cmqfb4wg50001ic04s0w5arse	Client D582E8	+256717729317	client-d582e85b@example.test	\N	\N	\N	org_eis_01	2026-06-15 14:27:27.941	2026-06-15 14:27:27.941
cmqgphlxa000nl504pp381otp	Client 16C99E	+256779548784	\N	\N	\N	\N	org_eis_01	2026-06-16 13:57:01.63	2026-06-16 13:57:01.63
cmqp0g9sn0001kz04gzwse2m9	Client 21BD27	+256713008973	\N	\N	\N	\N	org_eis_01	2026-06-22 09:26:04.439	2026-06-22 09:26:04.439
cmqp0qe4m0005jm046ysctsqn	Client 72ADCC	+256776751512	\N	\N	\N	\N	org_eis_01	2026-06-22 09:33:56.614	2026-06-22 09:33:56.614
cmqrviwz30001l804b3yf4pie	Client AEABA1	+256707329976	\N	\N	\N	\N	org_eis_01	2026-06-24 09:31:28.239	2026-06-24 09:31:28.239
cmr52yc96000hi904uz5gm4g4	Client 545442	+256786243344	client-5454421d@example.test	\N	\N	\N	org_eis_01	2026-07-03 15:20:25.482	2026-07-03 15:20:25.482
cmracztxm0001gy04a93n2rwc	Client 6952F6	+256743124530	\N	\N	\N	\N	org_eis_01	2026-07-07 08:00:22.09	2026-07-07 08:00:22.09
cmratam2q0005kw04n3de8w8a	Client F52768	+256770161505	\N	\N	\N	\N	org_eis_01	2026-07-07 15:36:38.978	2026-07-07 15:36:38.978
cmratd51p000fkw04ldudfz4b	Client 4988EF	+256777164490	\N	\N	\N	\N	org_eis_01	2026-07-07 15:38:36.877	2026-07-07 15:38:36.877
cmrd9etlt0001jl04hvxus1pr	Client F1B7DA	+256774420650	\N	\N	\N	\N	org_eis_01	2026-07-09 08:43:21.569	2026-07-09 08:43:21.569
cmrix4v5a0001l505phktzhum	Client BEC4F9	+256789559758	\N	\N	Plot 158, Kampala	\N	org_eis_01	2026-07-13 07:46:18.67	2026-07-13 07:46:18.67
cmrueqsnj0001jr041drjwi60	Client 625E76	+256774043532	\N	\N	\N	\N	org_eis_01	2026-07-21 08:44:43.28	2026-07-21 08:44:43.28
cmrx4tatr0001l604eup4vzz5	Client 3B7AA7	+256761312288	\N	\N	\N	\N	org_eis_01	2026-07-23 06:30:02.511	2026-07-23 06:30:02.511
cms65pr6x0009l40444rvna1f	Client 132708	+256773056110	client-13270817@example.test	\N	\N	\N	org_eis_01	2026-07-29 14:05:12.297	2026-07-29 14:05:12.297
cmshf19460003ib04aszaw9s1	Client 25C028	+256770403421	\N	\N	\N	\N	org_eis_01	2026-08-06 11:11:33.222	2026-08-06 11:11:33.222
cmshqrqca0001l504n83r3qtl	Client A5E0DB	+256795312360	client-a5e0db35@example.test	\N	\N	\N	org_eis_01	2026-08-06 16:40:04.379	2026-08-06 16:40:04.379
cmsj633hh0003l80460bn7a3a	Client FF52EA	+256766179979	\N	\N	\N	\N	org_eis_01	2026-08-07 16:36:35.045	2026-08-07 16:36:35.045
cmsssvisu0001l5049nqrxds2	Client 09FB6D	+256794803360	\N	\N	Plot 160, Kampala	\N	org_eis_01	2026-08-14 10:24:28.398	2026-08-14 10:24:28.398
cmt2l4l3j0001jx04pa3xz79t	Client 2A384B	+256744539771	\N	\N	\N	\N	org_eis_01	2026-08-21 06:45:16.111	2026-08-21 06:45:16.111
cmt2mornt0005la04h9yue6qa	Client 1C9EEC	+256786943060	\N	\N	\N	\N	org_eis_01	2026-08-21 07:28:57.353	2026-08-21 07:28:57.353
cmt7ar8z00001ju04gzhve8ht	Client 19B0AC	+256716915566	client-19b0acd5@example.test	\N	\N	\N	org_eis_01	2026-08-24 13:53:48.589	2026-08-24 13:53:48.589
cmt7eivmb0001jn04xn977rlu	Client 32524C	+256784797772	client-32524ce9@example.test	\N	\N	\N	org_eis_01	2026-08-24 15:39:16.499	2026-08-24 15:39:16.499
cmt8hxza70001jx0441s93o2k	Client 8F143F	+256734802367	client-8f143f89@example.test	Fourth Generation Capital Limited	Plot 367, Kampala	\N	org_eis_01	2026-08-25 10:02:46.111	2026-08-25 10:02:46.111
cmtb2zxbk0001l704tj29danq	Client 0BD594	+256704231558	client-0bd59416@example.test	MIIC HUB	\N	\N	org_eis_01	2026-08-27 05:27:41.168	2026-08-27 05:27:41.168
cmtocedhi0001i804mk2kes8f	Client 9502B8	+256778317367	\N	\N	\N	\N	org_eis_01	2026-09-05 12:11:52.134	2026-09-05 12:11:52.134
cmtrcvolx0001l104k9ptj7ov	Client F0D599	+256758734919	\N	Uganda Jubilee Network Limited	\N	\N	org_eis_01	2026-09-07 14:48:38.23	2026-09-07 14:48:38.23
cmtsg3fmy0001l70433j81y7i	Client A2969B	+256749845345	client-a2969b5e@example.test	\N	\N	\N	org_eis_01	2026-09-08 09:06:24.874	2026-09-08 09:06:24.874
cmtsily9z0001la04pamlsdg5	Client 1BCF1C	+256798750167	\N	House of KEA	\N	\N	org_eis_01	2026-09-08 10:16:48.071	2026-09-08 10:16:48.071
cmr65ydkf000hkz042hn1t0wn	Client FE0B42	+256790187450	\N	\N	\N	[2026-08-28] Phone cleared: the record held [phone redacted], which is Eagle Info's own WhatsApp business number, so every message to this customer was rejected by Meta. The correct number is not known and must be re-entered.\n[2026-08-28] Correct number supplied by the owner and set: +256 756 844 448.	org_eis_01	2026-07-04 09:32:12.208	2026-08-28 13:48:15.88
cmp6u8w610000ld04pf6k57q7	Client 15CA4C	+256717324662	\N	[redacted] Group	\N	\N	org_eis_01	2026-05-15 11:32:48.985	2026-05-15 11:32:48.985
cmpser8ek0001lb049dyg6ftu	Client 87356B	+256701376040	\N	[redacted]	\N	\N	org_eis_01	2026-05-30 13:50:06.668	2026-06-24 14:22:16.684
cmpseugyg0003js04rrryzg5d	Client 715B22	+256718827392	\N	[redacted] Africa Group	\N	\N	org_eis_01	2026-05-30 13:52:37.72	2026-05-30 13:52:37.72
cmratfqe3000zkw04iv172urq	Client 90A56C	+256702354205	client-90a56cb7@example.test	[redacted] IHK	Plot 205, Kampala	\N	org_eis_01	2026-07-07 15:40:37.851	2026-08-25 15:35:38.646
cmrkk87s20001k104tq42br03	Client 64AFCA	+256765119401	client-64afcace@example.test	[redacted]	\N	\N	org_eis_01	2026-07-14 11:20:32.355	2026-08-06 07:49:50.84
cmrlt6nom0001jr04pzai2wom	Client D53A07	+256778398032	client-d53a0719@example.test	[redacted] [redacted]	Plot 32, Kampala	\N	org_eis_01	2026-07-15 08:19:02.374	2026-08-03 11:39:25.324
cmsrk2mef0001l704l0tqylkn	Client 9C714A	+256765415759	client-9c714af1@example.test	[redacted] IMC	\N	\N	org_eis_01	2026-08-13 13:30:16.935	2026-09-07 14:49:58.006
\.


--
-- Data for Name: ClientMergeRecord; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ClientMergeRecord" (id, "orgId", "sourceClientId", "targetClientId", "mergedById", reason, "snapshotJson", "mergedAt") FROM stdin;
\.


--
-- Data for Name: ClientNote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ClientNote" (id, "clientId", "authorId", body, "createdAt") FROM stdin;
\.


--
-- Data for Name: CommunicationPolicy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CommunicationPolicy" (id, status, "dashboardEnabled", "whatsappEnabled", "emailEnabled", "templateKey", "nudge1Hours", "nudge2Hours", "orgId", "createdAt", "updatedAt") FROM stdin;
cmoj3egic0000l805zz6aw46m	RECEIVED	t	f	f	JOB_CREATED	\N	\N	org_eis_01	2026-04-28 20:42:36.948	2026-05-21 21:04:29.131
cmoj3epen0000kz04sbww17sf	DIAGNOSING	t	f	f	JOB_STATUS_UPDATE	\N	\N	org_eis_01	2026-04-28 20:42:48.479	2026-05-21 21:04:29.326
cmoj3f36x0001kz04onpt4x5r	AWAITING_APPROVAL	t	f	f	JOB_STATUS_UPDATE	\N	\N	org_eis_01	2026-04-28 20:43:06.345	2026-05-21 21:04:29.682
cmoj3ihe50000l4044h4nt2vs	CLOSED	t	f	f	JOB_STATUS_UPDATE	\N	\N	org_eis_01	2026-04-28 20:45:44.717	2026-05-21 21:04:30.403
cmoj3iigj0001l404vl7538ko	COMPLETED	t	f	f	JOB_COMPLETED	\N	\N	org_eis_01	2026-04-28 20:45:46.1	2026-05-21 21:04:30.225
cmoj3ikfb0003l4049qko57nb	READY_FOR_PICKUP	t	f	f	READY_FOR_PICKUP_NUDGE_1	24	72	org_eis_01	2026-04-28 20:45:48.648	2026-05-21 21:04:30.044
cmoj3ild40004l404hq3ft2fg	IN_REPAIR	t	f	f	JOB_STATUS_UPDATE	\N	\N	org_eis_01	2026-04-28 20:45:49.864	2026-05-21 21:04:29.859
cmoj3ip620005l404tke1e734	REFERRED	t	f	f	JOB_STATUS_UPDATE	\N	\N	org_eis_01	2026-04-28 20:45:54.794	2026-05-21 21:04:29.504
\.


--
-- Data for Name: CommunicationTemplate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CommunicationTemplate" (id, key, channel, label, subject, body, variables, "metaTemplateName", "metaLanguageCode", "isActive", "orgId", "createdAt", "updatedAt") FROM stdin;
cmoj2gjeh0000jl047royh6le	REPAIR_REQUEST_CONFIRMATION	WHATSAPP	Repair request confirmation	\N	Hello {customerName},\n\nThank you for submitting your repair request ({requestNumber}).\n\nWe have received your device and will contact you shortly to confirm the diagnosis and timeline.\n\nBest regards,\nEagle Info Solutions	["customerName","requestNumber"]	repair_request_confirmation_v2	en	t	org_eis_01	2026-04-28 20:16:14.394	2026-05-21 21:13:03.844
cmoj2gjhx0001jl048vna3t47	FRONT_DESK_APPROVED	WHATSAPP	Intake approved	\N	Hello {customerName},\n\nYour repair request ({requestNumber}) has been APPROVED.\n\nPlease bring your device to our shop at your convenience.\n\nBest regards,\nEagle Info Solutions	["customerName","requestNumber"]	front_desk_approved_v2	en	t	org_eis_01	2026-04-28 20:16:14.518	2026-05-21 21:13:04.016
cmoj2gjkl0002jl047nj1hb80	FRONT_DESK_REJECTED	WHATSAPP	Intake rejected	\N	Hello {customerName},\n\nUnfortunately, we are unable to process your repair request ({requestNumber}) at this time.\n\nPlease contact us for more information.\n\nBest regards,\nEagle Info Solutions	["customerName","requestNumber"]	front_desk_rejected_v2	en	t	org_eis_01	2026-04-28 20:16:14.614	2026-05-21 21:13:04.162
cmoj2gjnn0003jl04j1mk17c8	JOB_CREATED	WHATSAPP	Job created	\N	Hello {customerName},\n\nYour device has been registered as Job #{jobNumber}.\n\nWe will update you as the repair progresses.\n\nBest regards,\nEagle Info Solutions	["customerName","jobNumber"]	job_created_v2	en	t	org_eis_01	2026-04-28 20:16:14.724	2026-05-21 21:13:04.303
cmoj2gjq80004jl04o0dti12z	JOB_COMPLETED	WHATSAPP	Job completed	\N	Hello {customerName},\n\nGreat news! Your device (Job #{jobNumber}) is ready for pickup.\n\nPlease visit our shop to collect your device.\n\nBest regards,\nEagle Info Solutions	["customerName","jobNumber"]	job_completed_v2	en	t	org_eis_01	2026-04-28 20:16:14.817	2026-05-21 21:13:04.451
cmoj2gjt80005jl04z4ryaot6	JOB_STATUS_UPDATE	WHATSAPP	Generic job status update (WhatsApp)	\N	Hello {customerName},\n\nUpdate on Job #{jobNumber}:\nStatus: {newStatusLabel}\n\nBest regards,\nEagle Info Solutions	["customerName","jobNumber","newStatusLabel"]	job_status_update_v2	en	t	org_eis_01	2026-04-28 20:16:14.925	2026-05-21 21:13:04.602
cmoj2gjwt0006jl0446bpxl18	JOB_STATUS_UPDATE	EMAIL	Generic job status update (Email)	Update on Job #{jobNumber}	Hello {customerName},\n\nUpdate on Job #{jobNumber}:\nStatus: {newStatusLabel}\n\nBest regards,\nEagle Info Solutions	["customerName","jobNumber","newStatusLabel"]	job_status_update_v2	en	t	org_eis_01	2026-04-28 20:16:15.054	2026-05-21 21:13:04.602
cmoj2gjzs0007jl041ymqad1i	READY_FOR_PICKUP_NUDGE_1	WHATSAPP	Ready for pickup (nudge 1)	\N	Hello {customerName},\n\nReminder: Your device for Job #{jobNumber} is ready for pickup.\n\nPlease visit us to collect it.\n\nEagle Info Solutions	["customerName","jobNumber"]	ready_for_pickup_nudge_1_v2	en	t	org_eis_01	2026-04-28 20:16:15.16	2026-05-21 21:13:04.743
cmoj2gk330008jl042hb1xbr0	READY_FOR_PICKUP_NUDGE_1	EMAIL	Ready for pickup (nudge 1) (Email)	Pickup reminder: Job #{jobNumber}	Hello {customerName},\n\nReminder: Your device for Job #{jobNumber} is ready for pickup.\n\nPlease visit us to collect it.\n\nEagle Info Solutions	["customerName","jobNumber"]	ready_for_pickup_nudge_1_v2	en	t	org_eis_01	2026-04-28 20:16:15.28	2026-05-21 21:13:04.743
cmoj2gk6m0009jl04hh1vn1s0	READY_FOR_PICKUP_NUDGE_2	WHATSAPP	Ready for pickup (nudge 2)	\N	Hello {customerName},\n\nFinal reminder: Job #{jobNumber} is still ready for pickup.\n\nIf you need delivery, reply and we will advise.\n\nEagle Info Solutions	["customerName","jobNumber"]	ready_for_pickup_nudge_2_v2	en	t	org_eis_01	2026-04-28 20:16:15.406	2026-05-21 21:13:04.888
cmoj2gk9z000ajl04kaabeyim	READY_FOR_PICKUP_NUDGE_2	EMAIL	Ready for pickup (nudge 2) (Email)	Final pickup reminder: Job #{jobNumber}	Hello {customerName},\n\nFinal reminder: Job #{jobNumber} is still ready for pickup.\n\nIf you need delivery, reply and we will advise.\n\nEagle Info Solutions	["customerName","jobNumber"]	ready_for_pickup_nudge_2_v2	en	t	org_eis_01	2026-04-28 20:16:15.528	2026-05-21 21:13:04.888
\.


--
-- Data for Name: CommunicationTemplateVersion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CommunicationTemplateVersion" (id, "orgId", "templateId", version, status, subject, body, variables, "approvedAt", "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: Complaint; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Complaint" (id, "orgId", "complaintNumber", status, category, channel, "jobId", "saleId", "clientName", "clientPhone", "clientEmail", description, "expectedResolution", "assignedToId", "internalNotes", resolution, "acknowledgedAt", "investigatingAt", "resolvedAt", "closedAt", "satisfactionRating", "satisfactionComment", "ratedAt", "createdAt", "updatedAt", "clientId") FROM stdin;
\.


--
-- Data for Name: Conversation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Conversation" (id, "orgId", channel, "clientId", "jobId", "repairRequestId", "assignedToId", status, subject, "lastMessageAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ConversationMessage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ConversationMessage" (id, "orgId", "conversationId", direction, channel, sender, recipient, body, "outboundMessageId", "inboundMessageId", "providerMessageId", "sentAt", "receivedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: CreditNote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CreditNote" (id, "orgId", "saleId", "invoiceId", "creditNoteNumber", currency, "exchangeRateToBase", "totalAmount", "issuedAt", reason, "itemsReceivedBackAt", "itemsReceivedBackById", "itemsReceivedBackNote", "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: CreditNoteItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CreditNoteItem" (id, "creditNoteId", "partId", description, quantity, "unitPrice", "lineTotal", "saleUomFactor", "createdAt") FROM stdin;
\.


--
-- Data for Name: CustomerApproval; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerApproval" (id, "orgId", "jobId", "approvalType", status, amount, currency, "exchangeRateToBase", "requestedById", "respondedByName", "responseNote", "requestedAt", "respondedAt") FROM stdin;
\.


--
-- Data for Name: CustomerConsent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CustomerConsent" (id, "orgId", "clientId", "consentType", channel, granted, source, "capturedAt", "expiresAt", note) FROM stdin;
\.


--
-- Data for Name: DeliveryNote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryNote" (id, "orgId", "saleId", "invoiceId", "deliveryNoteNumber", "deliveredAt", "deliveryMethod", "deliveredByName", "receivedByName", "receivedBySignatureText", note, "createdById", "createdAt") FROM stdin;
cmt2ndv180002ie04ulqjj7ie	org_eis_01	\N	cmt2n0pks0001l304mx8llmen	EIS/DN/2026/0001	2026-08-21 07:48:28.123	\N	Staff CC92	Client CC92	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-21 07:48:28.123
cmtctu6ng0001jl04on236la3	org_eis_01	\N	cmtcsfsen0001jv04fz4aemy1	EIS/DN/2026/0002	2026-08-28 10:46:49.133	DELIVERY	Staff F4AB	Client F4AB	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-28 10:46:49.133
cmtr81abr0001jl04mhoi893b	org_eis_01	\N	cmtr7mkyo000jla04mmzlut58	EIS/DN/2026/0003	2026-09-07 12:33:01.575	\N	Staff 8AA2	Client 8AA2	\N	\N	cmns5jbas00002lfw97nnwshd	2026-09-07 12:33:01.575
\.


--
-- Data for Name: DeliveryNoteItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeliveryNoteItem" (id, "deliveryNoteId", "saleItemId", "partId", description, quantity) FROM stdin;
cmt2ndv180003ie0464v0zcs9	cmt2ndv180002ie04ulqjj7ie	\N	\N	Dell Tower Desktop – Professional Specifications Intel® Core™ i3 Processor 4GB RAM 128GB SSD + 500GB HDD 19-inch Monitor USB Keyboard & Mouse Windows Operating System	10
cmtctu6ng0002jl042kayh2iz	cmtctu6ng0001jl04on236la3	\N	\N	Tecno Spark 50 — 8GB RAM / 128GB ROM	2
cmtr81abr0002jl04wf1n8fc1	cmtr81abr0001jl04mhoi893b	\N	\N	Repair — Lenovo ThinkPad	1
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Department" (id, "orgId", name, code, "createdAt") FROM stdin;
\.


--
-- Data for Name: Device; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Device" (id, "clientId", "orgId", "deviceType", brand, model, "serialOrImei", accessories, "physicalNotes", "createdAt", "updatedAt") FROM stdin;
cmnvcj3d10002ld0471pjnhb4	cmnvcj3a10000ld04pn9edyv1	org_eis_01	WINDOWS_PC	Hp	HP	\N	\N	\N	2026-04-12 05:51:41.509	2026-04-12 05:51:41.509
cmnvcj3lu0008ld04vjcrhau6	cmnvcj3a10000ld04pn9edyv1	org_eis_01	WINDOWS_PC	Asus	Asus	\N	\N	\N	2026-04-12 05:51:41.827	2026-04-12 05:51:41.827
cmo0bqqzk0002kw04o95gv0zn	cmo05hxzb0001jr04d0jgu1p0	org_eis_01	PHONE_IPHONE	Apple	iPhone 12 Blue	\N	\N	\N	2026-04-15 17:28:29.984	2026-04-15 17:28:29.984
cmo4wih10000ijy04t8m0g65w	cmo4wigwh000gjy04nxndyx1k	org_eis_01	MAC	Apple	MacBook Air 13 Inch 2017	NA	Hard Shell Cash	Intermittent fuzzy screen	2026-04-18 22:21:00.468	2026-04-18 22:21:00.468
cmo4wu4di0008l1041l8xtdiu	cmo4wu48c0006l104rou4hqx4	org_eis_01	MAC	Apple	iMac 21.5 imcd	NA	\N	\N	2026-04-18 22:30:03.943	2026-04-18 22:30:03.943
cmod4xwz80002js04xqhn9ez6	cmod4xwpv0000js042lj8dr7g	org_eis_01	PHONE_IPHONE	Apple	iPhone 13 Pro max	\N	Case	Cracked back	2026-04-24 16:39:07.316	2026-04-24 16:39:07.316
cmogy43iu0002l8044lfqaxoz	cmogy43fr0000l8046jorrnst	org_eis_01	WINDOWS_PC	hp ProBook 440	hp probook 440 G1	\N	none	\N	2026-04-27 08:39:03.126	2026-04-27 08:39:03.126
cmoh0nb2n0006jx04nqsdt792	cmoh0naxp0004jx04ga22xyog	org_eis_01	MAC	MacBook	A1466	FVFW6SC1J1WK	none	not powering	2026-04-27 09:49:58.607	2026-04-27 09:49:58.607
cmoim4jdb0002l804dy4lco8y	cmoim4j9q0000l804pszxp1xn	org_eis_01	PHONE_IPHONE	Apple	iPhone 13Pro Max	\N	\N	\N	2026-04-28 12:39:00.624	2026-04-28 12:39:00.624
cmoim9zfl0006l404xvl44r1e	cmoim9zd70004l4047bi61t7n	org_eis_01	TABLET	Apple	iPad Air	\N	\N	\N	2026-04-28 12:43:14.721	2026-04-28 12:43:14.721
cmoimdnzh0009l80425ahyzyw	cmoimdnw80007l804qkekez32	org_eis_01	MAC	Apple	MacBook Pro 16 inch 2019	\N	\N	\N	2026-04-28 12:46:06.509	2026-04-28 12:46:06.509
cmoimdo9h000fl8045j6hy1na	cmoimdnw80007l804qkekez32	org_eis_01	MAC	Apple	MacBook Pro 13 inch 2017	\N	\N	\N	2026-04-28 12:46:06.87	2026-04-28 12:46:06.87
cmoir43uz0002jp04y3i5pwhe	cmod4xwpv0000js042lj8dr7g	org_eis_01	PHONE_IPHONE	Apple	iPhone 13 Pro max	\N	Case	\N	2026-04-28 14:58:38.603	2026-04-28 14:58:38.603
cmoj4lmiu0002jp04y2gnd9ac	cmo05hxzb0001jr04d0jgu1p0	org_eis_01	PHONE_IPHONE	Apple	iPhone 12	\N	\N	\N	2026-04-28 21:16:10.95	2026-04-28 21:16:10.95
cmomscdhj0002kz0459rqfv1f	cmomscde10000kz04runc0pac	org_eis_01	WINDOWS_PC	Dell	Dell old model	\N	\N	\N	2026-05-01 10:44:08.648	2026-05-01 10:44:08.648
cmomzqhqw0002jr047fqes7sc	cmomzqhmw0000jr043m97ifu3	org_eis_01	MAC	MacBook Pro	MacBook Pro 2017	\N	\N	Not powering	2026-05-01 14:11:04.664	2026-05-01 14:11:04.664
cmor2ccig0002l104x27jw6is	cmor28wrb0005ld047nu8xay5	org_eis_01	MAC	Apple	A1278	C1MNR9YWDTY3	\N	\N	2026-05-04 10:35:08.249	2026-05-04 10:35:08.249
cmor9qqh10002l704qx7sb5cm	cmor9qqe70000l704sbyzxld9	org_eis_01	MAC	Apple	MacBook Air M3	\N	Case	\N	2026-05-04 14:02:16.838	2026-05-04 14:02:16.838
cmor9zx030002l504bpd8e00z	cmor9zwx30000l504pqrpadv4	org_eis_01	MAC	Apple	MacBook Air 2019	\N	Case	\N	2026-05-04 14:09:25.204	2026-05-04 14:09:25.204
cmora5dt0000cky0417oysgnm	cmora5dqm000aky04aeen65aa	org_eis_01	MAC	Apple	MacBook Pro 13 2017	\N	\N	\N	2026-05-04 14:13:40.26	2026-05-04 14:13:40.26
cmoraeqj6000nl504ojgf8nt5	cmoraeqfv000ll5047eq88izd	org_eis_01	PHONE_IPHONE	Apple	iPhone 6s	\N	\N	\N	2026-05-04 14:20:56.659	2026-05-04 14:20:56.659
cmotxn0nz000djs0460c94zp7	cmotxn0ja000bjs04e3hyzccy	org_eis_01	WINDOWS_PC	Hp EliteBook 830 G6	hp EliteBook 830 G6	S/N5CG9497WQM	\N	Note powering	2026-05-06 10:46:46.56	2026-05-06 10:46:46.56
cmovdymzj0002l404qzgorl61	cmovdymw50000l404ex76us03	org_eis_01	MAC	Apple	MacBook Pro 16 Inch M1 Pro	\N	Charger and Magsafe 3 Cable	\N	2026-05-07 11:11:28.735	2026-05-07 11:11:28.735
cmovka59i0002l7043yto9xpu	cmovka56b0000l7047w2ftz2r	org_eis_01	MAC	M1 Pro 13inch	MacBook M1 pro 13inch	\N	\N	\N	2026-05-07 14:08:23.334	2026-05-07 14:08:23.334
cmoy6yfqu000al704o9yciwep	cmoy6yfmu0008l7045p4ipwvx	org_eis_01	MAC	MBP 15 inch	MBP 15 inch	\N	\N	\N	2026-05-09 10:18:40.566	2026-05-09 10:18:40.566
cmoy7424e0008l104te8lkahh	cmoy742180006l104hs1r804y	org_eis_01	MAC	MBP 2017 15inch	MBP 2017 15inch	\N	\N	\N	2026-05-09 10:23:02.847	2026-05-09 10:23:02.847
cmp0ze3ef0002lb04ujqmf16b	cmp0ze3b60000lb04a41a94y8	org_eis_01	WINDOWS_PC	HP	EB 830 G6	\N	\N	\N	2026-05-11 09:10:12.663	2026-05-11 09:10:12.663
cmp6mp6gx0002la04khps5d63	cmp6mp6dw0000la04gj3wc96k	org_eis_01	MAC	Macbook Air	MacBook Air 2015	\N	\N	\N	2026-05-15 08:01:31.905	2026-05-15 08:01:31.905
cmp6n0cn90002k004vvmoufmb	cmor9qqe70000l704sbyzxld9	org_eis_01	MAC	MacBook pro 13inch	MacBook pro 13inch 2018	\N	\N	\N	2026-05-15 08:10:13.126	2026-05-15 08:10:13.126
cmp6u8w8e0002ld04d381t6xh	cmp6u8w610000ld04pf6k57q7	org_eis_01	WINDOWS_PC	HP Victus	Gaming	\N	\N	\N	2026-05-15 11:32:49.071	2026-05-15 11:32:49.071
cmp8fzx2q0002jx04iqts4ivl	cmp8fzwz70000jx0465cll0lh	org_eis_01	MAC	MacBook pro 13inch 2017 NTB	A1708	\N	African Bag	Brocken screen	2026-05-16 14:29:27.986	2026-05-16 14:29:27.986
cmpf4u7jf0004jv049ivhhz09	cmoy6yfmu0008l7045p4ipwvx	org_eis_01	MAC	MBP 2015 15 inch	MBP 2015 15 inch	\N	\N	\N	2026-05-21 06:51:29.067	2026-05-21 06:51:29.067
cmpmccuom0003l204pkcgp77b	cmpmccuiq0001l204sxqmwq91	org_eis_01	PHONE_IPHONE	Apple	iPhone 12	NA	\N	\N	2026-05-26 07:56:19.415	2026-05-26 07:56:19.415
cmpmchxv30003l704vxu01zqe	cmpmchxp80001l7041tt1kfz7	org_eis_01	WINDOWS_PC	Lenovo	T14	NA	\N	\N	2026-05-26 08:00:16.816	2026-05-26 08:00:16.816
cmpmcm5410003kz04gzabxgds	cmpmcm50i0001kz04907ckjvr	org_eis_01	PHONE_ANDROID	Samsung	S21 Ultra	\N	\N	\N	2026-05-26 08:03:32.833	2026-05-26 08:03:32.833
cmpqrjo1g0003i505jzghlltg	cmpqrjnww0001i50519blu3y5	org_eis_01	MAC	iMac 27 inch 2015	iMac 27 inch 2015	\N	\N	line on the screen and no cover for RAM slots	2026-05-29 10:12:36.34	2026-05-29 10:12:36.34
cmpseo7r50003i6042co6b7yi	cmpseo7nt0001i604r48jburu	org_eis_01	PHONE_IPHONE	Apple	iPhone 13 Pro Max	\N	Case	Cracked screen	2026-05-30 13:47:45.857	2026-05-30 13:47:45.857
cmpser8j20003lb045lp6yp5j	cmpser8ek0001lb049dyg6ftu	org_eis_01	MAC	Apple	MacBook Air 13 2017	\N	Adapter - 45w magsafe 2	\N	2026-05-30 13:50:06.831	2026-05-30 13:50:06.831
cmpseuh1l0005js049iyy8b85	cmpseugyg0003js04rrryzg5d	org_eis_01	TABLET	Apple	iPad	\N	Black Case	\N	2026-05-30 13:52:37.834	2026-05-30 13:52:37.834
cmpwnhyrr0003k004i6vs9zxm	cmpwnhyod0001k0042acuaqwm	org_eis_01	MAC	Apple	MacBook Pro 13 inch 2020	\N	NA	Previously repaired after a liquid spill	2026-06-02 13:05:55.527	2026-06-02 13:05:55.527
cmq24vp5e0003lg04jokcc3l8	cmntvqwbw0000l704etryfmwr	org_eis_01	MAC	MacBook Pro 15inch	A1286	S/N C02FQ193DF8X	\N	Hard disk ?	2026-06-06 09:11:20.595	2026-06-06 09:11:20.595
cmq24vq6e0009lg04n0aiz32g	cmntvqwbw0000l704etryfmwr	org_eis_01	MAC	MacBook pro 15inch	A1286	S/N W89261HX648	\N	Not Powering	2026-06-06 09:11:21.927	2026-06-06 09:11:21.927
cmq261joh0003jr04ds83rwda	cmq261jk60001jr04o4vgrdm5	org_eis_01	MAC	MacMini M2	Macmini	\N	\N	No black Back cover	2026-06-06 09:43:53.057	2026-06-06 09:43:53.057
cmq5btsz80003kz04xj5r9zxi	cmq5btsu00001kz04gs7kwqll	org_eis_01	PHONE_IPHONE	Apple	iPhone 16 Pro max - Gold	\N	\N	\N	2026-06-08 14:49:08.084	2026-06-08 14:49:08.084
cmq5c79x70003jv04xaehgue4	cmq5c79tf0001jv04jdwiyad3	org_eis_01	WINDOWS_PC	Acer 14 Inch	Acer 14 Inch	\N	Bag and charger	\N	2026-06-08 14:59:36.571	2026-06-08 14:59:36.571
cmq5d21ka0003jv04odgsn9uu	cmq5d21bk0001jv04icd2mpz8	org_eis_01	PHONE_IPHONE	Apple	iPhone 13 Pro Max	\N	Case Black	\N	2026-06-08 15:23:32.075	2026-06-08 15:23:32.075
cmqc5f85y0003k004d38tb23y	cmqc5f7lq0001k004sq6d7hn7	org_eis_01	PHONE_IPHONE	iphone 12pro	MGLN3LL/A	F17fj1z90d80	cover	\N	2026-06-13 09:24:13.463	2026-06-13 09:24:13.463
cmqcapsh20003js04swonj7n3	cmqcapsbp0001js045eyk2j30	org_eis_01	MAC	MacBook pro 15inch 1017	A1707	S/N C02WT3YEHTD6	None	Not powering	2026-06-13 11:52:24.422	2026-06-13 11:52:24.422
cmqgphmbb000pl504xmltvs9t	cmqgphlxa000nl504pp381otp	org_eis_01	MAC	Apple	MacBook Air M1 A2337 Space Grey	C02DXFB1Q6L4	\N	\N	2026-06-16 13:57:02.135	2026-06-16 13:57:02.135
cmqwjjlo40003jr04va36pdik	cmqwjjlh10001jr043exlhwcq	org_eis_01	MAC	MBA 15 inch	M2	\N	\N	\N	2026-06-27 15:54:55.732	2026-06-27 15:54:55.732
cmr52czql0003js04qz236d4g	cmr52czjn0001js04b9mh6xgf	org_eis_01	MAC	Mac 2018 15 inch	Mac 2018 15 inch	\N	\N	\N	2026-07-03 15:03:49.485	2026-07-03 15:03:49.485
cmr52ycg7000ji904u0g8nxow	cmr52yc96000hi904uz5gm4g4	org_eis_01	PHONE_ANDROID	Google pixel	pixel	\N	\N	\N	2026-07-03 15:20:25.736	2026-07-03 15:20:25.736
cmratam820007kw04wrz26lr0	cmratam2q0005kw04n3de8w8a	org_eis_01	MAC	Apple	MBP 16 2019	\N	software	\N	2026-07-07 15:36:39.17	2026-07-07 15:36:39.17
cmratd5aj000hkw04n17hmzmg	cmratd51p000fkw04ldudfz4b	org_eis_01	MAC	Apple	MacBook Pro	\N	\N	\N	2026-07-07 15:38:37.196	2026-07-07 15:38:37.196
cmratf3tg000rkw0437ep04jd	cmntvqwbw0000l704etryfmwr	org_eis_01	WINDOWS_PC	Dell	Tower Desktop	\N	\N	\N	2026-07-07 15:40:08.597	2026-07-07 15:40:08.597
cmrltd6i40003ie04nlnk1s1b	cmnsu3ifj0000lb0781yjo6cj	org_eis_01	WINDOWS_PC	HP	840 G7	\N	\N	\N	2026-07-15 08:24:06.701	2026-07-15 08:24:06.701
cmrx4tayz0003l604ji42yy95	cmrx4tatr0001l604eup4vzz5	org_eis_01	MAC	MacBook pro	2007	\N	no Accessory	not powering	2026-07-23 06:30:02.7	2026-07-23 06:30:02.7
cmt2l4l610003jx04rxx69hsv	cmt2l4l3j0001jx04pa3xz79t	org_eis_01	MAC	Apple	A2338	\N	\N	Beer spill on the right side causing charging issues	2026-08-21 06:45:16.201	2026-08-21 06:45:16.201
cmt2morxu0007la0488yuz082	cmt2mornt0005la04h9yue6qa	org_eis_01	OTHER	macbook	macbook	\N	\N	\N	2026-08-21 07:28:57.714	2026-08-21 07:28:57.714
cmtocedjw0003i804ax0aewcy	cmtocedhi0001i804mk2kes8f	org_eis_01	MAC	Macbook	**	\N	\N	None responsive keyboard	2026-09-05 12:11:52.22	2026-09-05 12:11:52.22
cmotx2kci0002js04ynut8w53	cmotx2k6m0000js04npyykrqp	org_eis_01	MAC	MacBook pro 2018 15 inches	A1990	S/N C02x	\N	Keeps [redacted]	2026-05-06 10:30:52.291	2026-05-06 10:30:52.291
\.


--
-- Data for Name: DeviceSpecification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DeviceSpecification" (id, "orgId", "deviceId", key, value, source, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: DiagnosisReport; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DiagnosisReport" (id, "orgId", "jobId", "authorId", visibility, summary, findings, "recommendedWork", "riskNotes", "createdAt", "updatedAt") FROM stdin;
cmsg9xsl90011jr040hz4rlm1	org_eis_01	cms65nsn30003l404ivvbxkkv	cmns5jbas00002lfw97nnwshd	CLIENT	This report covers the diagnostic assessment of a Lenovo ThinkPad laptop submitted for repair job EI-2026-0034, reported as failing to power on. Assessment confirms the fault and identifies it as a logic board level issue that cannot be resolved through standard repair.	Diagnostic testing confirmed the unit fails to power on, and the fault has been traced to the logic board. The specific components required to repair the logic board are not available, preventing a component-level repair.	As the required logic board components cannot be sourced, repair is limited to replacement of the logic board as a whole unit.	No warranty repair can be completed until a replacement logic board is sourced and fitted; standard practice applies once repair proceeds, with the system tested after repair and any replacement parts covered by applicable supplier warranty.	2026-08-05 16:01:07.582	2026-08-05 16:02:18.846
cmtbjdiw3000zla04a9ty5m4e	org_eis_01	cmt2l8ddo0003if04ga8b6mik	cmns5jbas00002lfw97nnwshd	CLIENT	This Dell Latitude 7200 2-in-1 was brought in under job EIS/2026/0045 with a non-functioning keyboard, leaving the customer unable to type on the built-in keys.	Assessment confirmed a fault with the keyboard itself rather than a software or driver issue, consistent with the reported symptom of complete unresponsiveness.	Replace the existing keyboard with a plug-and-play Dell X2 keyboard unit.	The system will be fully tested after the replacement to confirm normal keyboard operation, and the new keyboard will carry applicable supplier warranty.	2026-08-27 13:06:09.508	2026-08-27 13:06:34.489
cmsg8k62y0001jz04c6jjgh7n	org_eis_01	cms7gixy90003jo04s9gd3rpq	cmns5jbas00002lfw97nnwshd	CLIENT	This Lenovo PC was reported with a charging fault and failed to power on. Assessment confirmed the unit could not power on despite functional power line components, and the issue has been resolved.	Diagnostic testing confirmed the power delivery components were functioning correctly, ruling out a hardware charging fault. The root cause was identified as corrupted BIOS firmware preventing the system from powering on.	Reprogram the BIOS to [redacted] correct firmware operation, after which the machine powers on as expected.	The system has been tested and confirmed to power on normally following the BIOS reprogramming. No replacement parts were used in this repair; standard service warranty applies to the work performed.	2026-08-05 15:22:32.266	2026-08-05 15:23:49.731
cmsg91sv4000xla04h2jrg3lj	org_eis_01	cms65p1wt000bjt04eds8aj7f	cmns5jbas00002lfw97nnwshd	CLIENT	This Dell Windows PC was reported as not charging, and diagnostic assessment established that the underlying issue is that the machine does not power on at all, rather than a charging fault.	Diagnostic testing identified a BIOS firmware issue as the root cause; the unit only displays an amber flashing light and does not proceed through the normal boot sequence.	The BIOS firmware requires reflashing to [redacted] normal boot and power-on operation.	The system was fully tested after the BIOS firmware repair and was confirmed normal power-on and charging function; standard supplier warranty applies to any replacement parts used.	2026-08-05 15:36:14.944	2026-08-05 15:37:38.012
cmsg9avre0004la042g9f6p2n	org_eis_01	cms65ob8f0003jt049xb0gvtv	cmns5jbas00002lfw97nnwshd	CLIENT	This Lenovo Windows PC laptop was submitted with reported broken hinges. Assessment confirms the fault and identifies additional missing screen bezel.	Diagnostic inspection confirmed broken hinges along with missing  screen bezel, consistent with physical stress at the hinge mounting points.	Replace the screen bezel to [redacted] structural integrity and normal opening/closing operation of the laptop.	The system was tested after repair to confirm normal operation, and any replacement parts carry applicable supplier warranty.	2026-08-05 15:43:18.602	2026-08-05 15:45:09.542
cmtbjeuzc0016la04toeuivyg	org_eis_01	cmt8tu2ib0003ky0481qbonqu	cmns5jbas00002lfw97nnwshd	CLIENT	This Lenovo ThinkBook 15 (i5, 16GB RAM/477GB) was brought in with cracking to the casing near the screen hinge, though the laptop remained fully functional. The unit has now been repaired and returned.	Inspection confirmed the damage was cosmetic rather than electrical, caused by repeated hinge movement stressing the casing until it cracked around the hinge area and on the keyboard panel. No impact on internal components or day-to-day operation was found.	Carried out a cosmetic rebuild of the hinge area and keyboard panel to [redacted] structural integrity around the hinge and stop further cracking under normal use.	The system was fully tested after the repair and confirmed to be operating normally. As no replacement parts were fitted, standard workmanship terms apply to the cosmetic build carried out.	2026-08-27 13:07:11.833	2026-08-27 13:07:54.255
cmtl1mvpf0001jr04fxsy3k64	org_eis_01	cmsrk2mox0003l70498wl0fy3	cmns5jbas00002lfw97nnwshd	CLIENT	This Lenovo V14 (i3, 16GB RAM, 477GB storage) was brought in under job EIS/2026/0043 with a report that it would not power on or charge. Our assessment confirms the machine is dead and requires board-level repair before it can be returned to service.	Testing established that the unit fails to respond to the power button or the charger, which points to a short circuit on the motherboard rather than a battery or charger fault. This short is preventing the system from drawing or regulating power at all, which is why no charging activity or boot attempt is seen.	We recommend replacing the board  as  repairing the short circuit on the motherboard has not [redacted] normal power delivery and charging function.	New board replacement will revive normal machine operation  once fixed and tested. The laptop will be fully tested after repair to confirm normal power-on, charging, and operation, and any replacement parts used will carry the applicable supplier warranty.	2026-09-03 04:47:14.692	2026-09-03 04:53:50.36
cmsh7q0cv000tl804xrn9j20q	org_eis_01	cmsh7cf7x0003le04n0oj6n6l	cmns5jbas00002lfw97nnwshd	CLIENT	The HP 450 G8 was reported as running slowly with a faulty touchpad and keyboard issues. Assessment confirms these faults and finds the unit requires multiple hardware replacements to [redacted] normal operation.	Diagnostic testing confirmed noticeable delays in system response, unresponsive keyboard keys, and a dragging, unresponsive touchpad, indicating failing input hardware alongside general performance degradation.	Replace the affected keyboard and touchpad assemblies and address the performance issue to [redacted] the machine to normal working condition.	The system will be fully tested after repair to confirm normal operation, and any replacement parts fitted will carry the applicable supplier warranty. Specific replacement parts have not yet been finalised, so final scope may be adjusted once parts are confirmed.	2026-08-06 07:46:51.343	2026-08-06 07:47:18.648
cmsyp0kld0002jx042mzl1vkg	org_eis_01	cmsrji9xl0003l80458lzg6s5	cmns5jbas00002lfw97nnwshd	CLIENT	This report covers the assessment of an Epson printer (job EIS/2026/0042) reported to print blank pages unless a nozzle [redacted] cycle is run first. Diagnostic assessment confirms a hardware fault requiring repair.	Testing confirmed the printer only produces correct output after manual nozzle [redacted] or colour alignment, indicating the printhead is not being properly commanded during normal print cycles. The root cause has been identified as failure of the printhead sensor, which prevents correct control of paper feed and print head operation.	Replace the faulty printer head to [redacted] correct paper feed operation and normal print output. Issue of faint print-ing persisted and we also realised a Maintainace box error. We replaced the maintain ace box too to [redacted] full functionality	No replacement parts have yet been specified or costed for this repair. The system will be fully tested after the sensor replacement, and any replacement parts fitted will carry the applicable supplier warranty.	2026-08-18 13:23:02.594	2026-08-18 13:24:40.206
cmsg8s0kz000ljz0413c9eyx6	org_eis_01	cms65q5hk000jl404zid2jq7u	cmns5jbas00002lfw97nnwshd	CLIENT	This Thinkbook Windows PC was submitted following a lemonade spillage into the chassis. Assessment confirms liquid contamination affecting the motherboard, with no permanent damage identified after [redacted].	Diagnostic inspection confirmed liquid ingress from the spillage had reached the mainboard. No component failure or corrosion damage was found once the residue was removed.	[redacted] the board thoroughly to remove residue and dry the unit fully, then function-test all systems to confirm normal operation.	The system has been tested and confirmed fully functional following [redacted]. As no replacement parts were required, no additional parts warranty applies; residual risk of latent corrosion from sugar residue cannot be fully excluded and should be monitored.	2026-08-05 15:28:38.387	2026-08-05 15:30:39.074
\.


--
-- Data for Name: DocumentBrandingSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DocumentBrandingSettings" (id, "orgId", "companyName", "companyTagline", "companyAddressLine1", "companyAddressLine2", "companyContacts", "companyEmail", "companyWebsite", "companyTaxId", "companyLogoUrl", "companyLogoKey", "documentTitle", "quotePrefix", "quoteFormat", "quoteValidityDays", "sequencePadLength", "vatDefaultApplicable", "vatRatePercent", "vatInclusive", "vatLabel", "termsText", "footerText", "paymentInstructions", "paymentAccounts", "signatureCompanyLabel", "signatureClientLabel", "primaryColor", "secondaryColor", "accentColor", "backgroundColor", "surfaceColor", "borderColor", "invoiceTemplateKey", "quotationTemplateKey", "jobCardTemplateKey", "receiptTemplateKey", "updatedAt") FROM stdin;
org_eis_01	org_eis_01	Eagle Info Solutions	SMC LIMITED	Nalubega Complex, 1st Floor	Shop L28, Bombo Road Opposite Watoto Church	+256700000000	accounts@example.test	www.eagleinfosolutions.com	\N	\N	\N	Job Card	EIS	{PREFIX} {M}/{YYYY}/{SEQ}	30	4	f	18.000000	f	VAT	Quotation valid for 30 days from date issued. Repair work begins only after approval is recorded. Parts availability may affect final timeline. Hidden pre-existing faults may affect final outcome. Uncollected devices may attract storage fees after notice.	Powered by Duuka Pro Max — Eagle Info's repair & business management platform. care.eagleinfosolutions.com	Pay on collection.	Example Bank — 0000000000	Signed by: Eagle Info Solutions	Signed by: Client	#000000	#d4af37	#d4af37	#ffffff	#f5f5f5	#e5e5e5	invoice_classic	quote_classic	job_card_classic	receipt_classic	2026-06-06 20:29:19
\.


--
-- Data for Name: DocumentSequence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DocumentSequence" (id, "orgId", type, year, value, "updatedAt", month) FROM stdin;
cmshf19a70004ib040h6zi45y	org_eis_01	INV	2026	56	2026-09-08 10:17:30.05	0
cmshf5e1n0004l504k0ll87hr	org_eis_01	RCT	2026	49	2026-09-08 10:17:39.962	0
cmshf5esl000jl5045sh6tvpj	org_eis_01	JE	2026	58	2026-09-08 10:17:41.45	0
cmt0b2wyr0000l7041dy0cicu	org_eis_01	QT	2026	14	2026-09-03 04:56:29.106	0
cmt2nduw00000ie0467d0o47v	org_eis_01	DN	2026	3	2026-09-07 12:33:01.441	0
\.


--
-- Data for Name: DocumentTaxLine; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."DocumentTaxLine" (id, "orgId", "documentType", "documentId", "taxLabel", "taxRate", "taxableAmount", "taxAmount", "createdAt") FROM stdin;
\.


--
-- Data for Name: Expense; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Expense" (id, "orgId", "expenseNumber", category, description, amount, currency, "exchangeRateToBase", "paidAt", method, "supplierId", "branchId", reference, notes, "createdById", "createdAt", "dueAt", "paidAmount") FROM stdin;
cmq12sekb0001js04vfkdqw15	org_eis_01	EXP-2026-0002	RENT	Shop Rent	935000.00	UGX	\N	2026-06-05 00:00:00	BANK_TRANSFER	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:25:01.499	\N	935000.00
cmq12tmlh0001l204m1t71678	org_eis_01	EXP-2026-0003	SALARIES	Jeilo's salary	500000.00	UGX	\N	2026-06-04 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:25:58.566	\N	500000.00
cmq12ylcq0007k104hd29ileo	org_eis_01	EXP-2026-0006	OTHER	Delivery fees	40000.00	UGX	\N	2026-06-05 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:29:50.234	\N	40000.00
cmq12zy060007l204oz50xdyy	org_eis_01	EXP-2026-0007	OTHER	Director's Lunch and fruits	13000.00	UGX	\N	2026-06-05 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:30:53.287	\N	13000.00
cmq130swa000al204mybh2vqb	org_eis_01	EXP-2026-0008	MARKETING	Milo Media	60000.00	UGX	\N	2026-06-01 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:31:33.323	\N	60000.00
cmq132wq00004l804l83lbt78	org_eis_01	EXP-2026-0010	MAINTENANCE	Generator Fuel	20000.00	UGX	\N	2026-06-01 00:00:00	MOBILE_MONEY	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:33:11.592	\N	20000.00
cmq134qag0007l80423488tw2	org_eis_01	EXP-2026-0011	MAINTENANCE	Generator maintenance	50000.00	UGX	\N	2026-06-05 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:34:36.568	\N	50000.00
cmq6oowno0001jy04an51mqi8	org_eis_01	EXP-2026-0013	SUPPLIES	Dell Charge-Zawedi	50000.00	UGX	\N	2026-06-09 00:00:00	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-09 13:37:00.757	\N	50000.00
cmq6pb48s0006ld04c9k49rtl	org_eis_01	EXP-2026-0014	OTHER	Taxes & Licenses	263000.00	UGX	\N	2026-06-09 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-09 13:54:17.02	\N	263000.00
cmq12qyxy0001k1048wqdz798	org_eis_01	EXP-2026-0001	SALARIES	[redacted]'s Salary	200000.00	UGX	\N	2026-06-05 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:23:54.598	\N	200000.00
cmq12vq7n0004l2049to85iye	org_eis_01	EXP-2026-0004	OTHER	[redacted]'s Allowance	50000.00	UGX	\N	2026-06-04 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:27:36.563	\N	50000.00
cmq12x0ux0004k104ketbrzh6	org_eis_01	EXP-2026-0005	OTHER	[redacted]'s Allowance	20000.00	UGX	\N	2026-06-04 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:28:37.018	\N	20000.00
cmq131wc90001l804bnp49tq9	org_eis_01	EXP-2026-0009	MARKETING	[redacted] facilitation	20000.00	UGX	\N	2026-06-02 00:00:00	MOBILE_MONEY	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:32:24.441	\N	20000.00
cmq6ogp850001jl04lncov6wx	org_eis_01	EXP-2026-0012	MAINTENANCE	Garbage & [redacted]	25000.00	UGX	\N	2026-06-09 00:00:00	CASH	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-09 13:30:37.877	\N	25000.00
\.


--
-- Data for Name: ExpensePayment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ExpensePayment" (id, "orgId", "expenseId", currency, amount, method, reference, "paidAt", note, "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: FieldVisit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FieldVisit" (id, "orgId", "branchId", "jobId", "assignedToId", "scheduledById", type, status, "scheduledAt", "startedAt", "arrivedAt", "completedAt", address, "gpsLat", "gpsLng", "contactName", "contactPhone", notes, "outcomeNotes", "signoffName", "signoffAt", "createdAt", "updatedAt") FROM stdin;
cmppxf3hz0001l804giq4i65g	org_eis_01	\N	cmpmccutn0005l2048m8iktwp	cmns5vd6400062lsig31tm6wk	cmns5jbas00002lfw97nnwshd	ASSESSMENT	COMPLETED	2026-05-28 20:08:00	2026-05-28 20:10:12.924	\N	2026-05-28 20:11:16.428	Plot 211, Kampala	\N	\N	Contact E1A6	+256705187411	Client needs software upgrades	Updates done and machine now works great	Signoff E1A6	2026-05-28 20:11:16.428	2026-05-28 20:09:14.615	2026-05-28 20:11:16.429
\.


--
-- Data for Name: FileAsset; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FileAsset" (id, "orgId", "ownerType", "ownerId", url, "storageKey", "fileName", "mimeType", "sizeBytes", label, visibility, "uploadedById", "deletedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: FxReferenceRate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."FxReferenceRate" (id, base, quote, rate, source, "fetchedAt") FROM stdin;
\.


--
-- Data for Name: GoodsReceived; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."GoodsReceived" (id, "orgId", "grnNumber", status, "supplierId", "poId", "locationId", "receivedAt", note, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: GoodsReceivedItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."GoodsReceivedItem" (id, "grnId", "poItemId", "partId", description, quantity, "unitCost", "createdAt") FROM stdin;
\.


--
-- Data for Name: InboundMessage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InboundMessage" (id, wamid, "from", body, "mediaType", "mediaId", "mediaCaption", "timestamp", "clientId", "jobId", "orgId", "isRead", "readAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: InventoryCategory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InventoryCategory" (id, "orgId", name, "parentId", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Invoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Invoice" (id, "orgId", "jobId", "clientId", "invoiceType", subject, "dueDate", "invoiceNumber", currency, "exchangeRateToBase", status, "issuedAt", "totalAmount", "paidAmount", "paidAt", notes, "createdAt", "updatedAt") FROM stdin;
cmprdk67l0001kv04p0cfi95l	org_eis_01	cmoy7429x000al1042z0dkcoy	cmoy742180006l104hs1r804y	REPAIR	\N	\N	INV-EIS-5/2026/0016	UGX	\N	PAID	2026-05-29 20:28:51.323	380000.00	380000.00	2026-06-01 13:15:15.179	\N	2026-05-29 20:28:51.441	2026-06-01 13:15:15.181
cmprduvp10001jo04c1sqhwt7	org_eis_01	cmp0ze3it0004lb043j37ojgy	cmp0ze3b60000lb04a41a94y8	REPAIR	\N	\N	INV-EIS-5/2026/0017	UGX	\N	PAID	2026-05-29 20:37:10.852	120000.00	120000.00	2026-06-01 13:14:40.762	\N	2026-05-29 20:37:11.029	2026-06-01 13:14:40.763
cmpv8hchs0007jm04yl743320	org_eis_01	cmpseo7uz0005i604wa19357r	cmpseo7nt0001i604r48jburu	REPAIR	\N	\N	INV-EIS-6/2026/0005	UGX	\N	PAID	2026-06-01 13:17:46.154	690000.00	690000.00	2026-06-01 13:17:46.504	\N	2026-06-01 13:17:46.24	2026-06-01 13:17:46.505
cmpv8i9290003jp04u0i3x66q	org_eis_01	cmora5dxz000eky04yfangbym	cmora5dqm000aky04aeen65aa	REPAIR	\N	\N	INV-EIS-6/2026/0009	UGX	\N	PAID	2026-06-01 13:18:27.66	550000.00	550000.00	2026-08-06 20:22:10.7	\N	2026-06-01 13:18:28.449	2026-08-06 20:22:10.701
cmpwt2no10001le04jw30yjie	org_eis_01	cmoim4jhp0004l804jd1vspox	cmoim4j9q0000l804pszxp1xn	REPAIR	\N	\N	INV-EIS-6/2026/0022	UGX	\N	PAID	2026-06-02 15:41:58.869	220000.00	220000.00	2026-06-03 09:42:04.801	\N	2026-06-02 15:41:58.994	2026-06-03 09:42:04.802
cmpxmi6m30001k004vq910r64	org_eis_01	cmp6u8wcd0004ld04d3ltje5p	cmp6u8w610000ld04pf6k57q7	REPAIR	\N	\N	INV-EIS-6/2026/0020	UGX	\N	PAID	2026-06-03 05:25:52.172	300000.00	300000.00	2026-06-03 05:25:52.575	\N	2026-06-03 05:25:52.252	2026-06-03 05:25:52.576
cmpxmkj5b0001le049adwslpo	org_eis_01	cmp8fzx6w0004jx04c6684rto	cmp8fzwz70000jx0465cll0lh	REPAIR	\N	\N	INV-EIS-6/2026/0021	UGX	\N	PAID	2026-06-03 05:27:41.727	1100000.00	1100000.00	2026-06-03 05:27:42.137	\N	2026-06-03 05:27:41.808	2026-06-03 05:27:42.138
cmpxmlgxk0001ji04doqjcaly	org_eis_01	cmpmchxzb0005l704e2xo3hzh	cmpmchxp80001l7041tt1kfz7	REPAIR	\N	\N	INV-EIS-6/2026/0002	UGX	\N	PAID	2026-06-03 05:28:25.526	270000.00	270000.00	2026-06-03 05:28:25.848	\N	2026-06-03 05:28:25.593	2026-06-03 05:28:25.849
cmpxmofd40007ji04r92rtv0l	org_eis_01	cmp6mp6ku0004la044ejas43h	cmp6mp6dw0000la04gj3wc96k	REPAIR	\N	\N	INV-EIS-6/2026/0018	UGX	\N	PAID	2026-06-03 05:30:43.45	150000.00	150000.00	2026-06-03 05:30:43.794	\N	2026-06-03 05:30:43.528	2026-06-03 05:30:43.795
cmpxmpb6d000bk004jmbltswb	org_eis_01	cmor9qqkw0004l704c3cbj82j	cmor9qqe70000l704sbyzxld9	REPAIR	\N	\N	INV-EIS-6/2026/0007	UGX	\N	PAID	2026-06-03 05:31:24.682	80000.00	80000.00	2026-06-03 05:31:25.816	\N	2026-06-03 05:31:24.757	2026-06-03 05:31:25.817
cmpxmsnlg000fji04w7d0wpgh	org_eis_01	cmpser8nn0005lb041dkwf11i	cmpser8ek0001lb049dyg6ftu	REPAIR	\N	\N	INV-EIS-6/2026/0006	UGX	\N	ISSUED	2026-06-24 14:23:06.63	250000.00	250000.00	2026-06-03 05:34:01.162	\N	2026-06-03 05:34:00.82	2026-06-24 14:23:06.788
cmpxmtn8f0003l104oibhnk9w	org_eis_01	cmpjp0oae0002jv0407uuhi7e	cmpjp0o600000jv04sx1eolqt	REPAIR	\N	\N	INV-EIS-6/2026/0023	UGX	\N	PAID	2026-06-03 05:34:46.939	170000.00	170000.00	2026-06-03 05:34:47.31	\N	2026-06-03 05:34:47.007	2026-06-03 05:34:47.311
cmpxmvolx0009l104v1xykp5v	org_eis_01	cmovka5eh0004l704buwqb26w	cmovka56b0000l7047w2ftz2r	REPAIR	\N	\N	INV-EIS-6/2026/0014	UGX	\N	PAID	2026-06-03 05:36:22.027	70000.00	70000.00	2026-06-03 05:36:22.372	\N	2026-06-03 05:36:22.101	2026-06-03 05:36:22.373
cmpxmwhq2000fl104lxn26axb	org_eis_01	cmotx2kh10004js04gyz356jl	cmotx2k6m0000js04npyykrqp	REPAIR	\N	\N	INV-EIS-6/2026/0011	UGX	\N	PAID	2026-06-03 05:36:59.768	380000.00	380000.00	2026-06-03 05:37:00.093	\N	2026-06-03 05:36:59.835	2026-06-03 05:37:00.094
cmpxmxery000pji04uiif1hrb	org_eis_01	cmoraeqna000pl504vmbmos7u	cmoraeqfv000ll5047eq88izd	REPAIR	\N	\N	INV-EIS-6/2026/0010	UGX	\N	PAID	2026-06-03 05:37:42.605	90000.00	90000.00	2026-06-03 10:14:38.507	\N	2026-06-03 05:37:42.67	2026-06-03 10:14:38.508
cmpxmyimt0009le043dh1xuo9	org_eis_01	cmor9zx400004l504vs4oykws	cmor9zwx30000l504pqrpadv4	REPAIR	\N	\N	INV-EIS-6/2026/0008	UGX	\N	PAID	2026-06-03 05:38:34.246	50000.00	50000.00	2026-06-03 05:38:34.61	\N	2026-06-03 05:38:34.325	2026-06-03 05:38:34.611
cmpxmzxa1000vji04a1yeh2yo	org_eis_01	cmo0bqr4w0004kw0415tbo2zi	cmo05hxzb0001jr04d0jgu1p0	REPAIR	\N	\N	INV-EIS-6/2026/0015	UGX	\N	PAID	2026-06-03 05:39:39.894	350000.00	350000.00	2026-06-03 05:39:40.286	\N	2026-06-03 05:39:39.961	2026-06-03 05:39:40.287
cmpxn2c72000jk004i55yvplj	org_eis_01	cmnsu3ijh0002lb078t7sn6xy	cmnsu3ifj0000lb0781yjo6cj	REPAIR	\N	\N	INV-EIS-6/2026/0001	UGX	\N	PAID	2026-06-03 05:41:32.337	150000.00	150000.00	2026-06-03 05:41:32.858	\N	2026-06-03 05:41:32.606	2026-06-03 05:41:32.859
cmpxnes74000ll104wwh2jv3p	org_eis_01	cmnsutfxs0002ju042ry8cthz	cmrkk87s20001k104tq42br03	REPAIR	\N	\N	INV-EIS-6/2026/0004	UGX	\N	PAID	2026-06-03 05:51:13.148	330000.00	330000.00	2026-06-03 05:51:13.484	\N	2026-06-03 05:51:13.216	2026-06-03 05:51:13.485
cmpxvmmrf0001jm04udpohd0y	org_eis_01	cmoy6yfwq000cl704o8k5n1dx	cmoy6yfmu0008l7045p4ipwvx	REPAIR	\N	\N	INV-EIS-5/2026/0015	UGX	\N	PAID	2026-05-15 04:56:20.362	120000.00	120000.00	2026-06-03 09:41:16.633	\N	2026-06-03 09:41:16.348	2026-06-03 09:41:16.634
cmpxvosdj0007jp049xtqaoy8	org_eis_01	cmnwq8pos0007le04dhyv4ff9	cmnwq8pkk0005le04crjsvnv7	REPAIR	\N	\N	INV-EIS-6/2026/0012	UGX	\N	PAID	2026-06-03 09:42:56.866	120000.00	120000.00	2026-06-03 09:42:57.205	\N	2026-06-03 09:42:56.935	2026-06-03 09:42:57.206
cmq12ca40000die04wolbcvlx	org_eis_01	cmnt1uk140002jv04xxado5td	cmnt1ujwg0000jv04erji6d04	REPAIR	\N	\N	INV-2026-0001	UGX	\N	PAID	2026-06-05 15:12:28.859	480000.00	480000.00	2026-06-05 15:12:29.592	\N	2026-06-05 15:12:29.232	2026-06-05 15:12:29.593
cmq12drs60009ii04qs907dly	org_eis_01	cmogy43mv0004l8046wgcw76x	cmogy43fr0000l8046jorrnst	REPAIR	\N	\N	INV-EIS-6/2026/0019	UGX	\N	PAID	2026-06-05 15:13:38.597	180000.00	180000.00	2026-06-05 15:13:39.156	\N	2026-06-05 15:13:38.791	2026-06-05 15:13:39.157
cmq144lud0001le042hhnrekf	org_eis_01	cmpf4u7nv0006jv047j884ahd	cmoy6yfmu0008l7045p4ipwvx	REPAIR	\N	\N	INV-2026-0002	UGX	\N	PAID	2026-06-05 16:02:30.038	400000.00	400000.00	2026-06-05 16:02:30.797	\N	2026-06-05 16:02:30.422	2026-06-05 16:02:30.798
cmq14645s0001ld04o4nl31gb	org_eis_01	cmoimdodv000hl804mmrudzh3	cmoimdnw80007l804qkekez32	REPAIR	\N	\N	INV-EIS-6/2026/0025	UGX	\N	PAID	2026-06-05 16:03:40.485	330000.00	330000.00	2026-06-05 16:03:41.269	\N	2026-06-05 16:03:40.816	2026-06-05 16:03:41.27
cmq1474w50007ld04r2scdhvj	org_eis_01	cmoimdo3s000bl8047uxb8h4b	cmoimdnw80007l804qkekez32	REPAIR	\N	\N	INV-EIS-6/2026/0024	UGX	\N	PAID	2026-06-05 16:04:28.154	480000.00	480000.00	2026-06-05 16:04:28.901	\N	2026-06-05 16:04:28.421	2026-06-05 16:04:28.902
cmq147uog0001l804qht3pf9n	org_eis_01	cmp6n0cry0004k004qe495s2j	cmor9qqe70000l704sbyzxld9	REPAIR	\N	\N	INV-2026-0003	UGX	\N	PAID	2026-06-05 16:05:01.427	150000.00	150000.00	2026-06-05 16:05:02.243	\N	2026-06-05 16:05:01.841	2026-06-05 16:05:02.244
cmq148s5g0007l80410ux22mw	org_eis_01	cmoh5houk0002l4042cpk8nlw	cmoh5hoq70000l404k2ftzok9	REPAIR	\N	\N	INV-2026-0004	UGX	\N	PAID	2026-06-05 16:05:44.858	650000.00	650000.00	2026-06-05 16:05:45.66	\N	2026-06-05 16:05:45.22	2026-06-05 16:05:45.661
cmq14bb6d0009le04gpjaxwnn	org_eis_01	cmoh0nb6p0008jx04u31h3b74	cmoh0naxp0004jx04ga22xyog	REPAIR	\N	\N	INV-2026-0005	UGX	\N	PAID	2026-06-05 16:07:42.837	200000.00	200000.00	2026-06-05 16:07:43.612	\N	2026-06-05 16:07:43.189	2026-06-05 16:07:43.613
cmq14c725000hl804469o2zyl	org_eis_01	cmnsugszq0002l804mfj2hkph	cmnsugsv50000l804rlhd91sd	REPAIR	\N	\N	INV-2026-0006	UGX	\N	PAID	2026-06-05 16:08:24.054	860000.00	860000.00	2026-06-05 16:08:24.881	\N	2026-06-05 16:08:24.509	2026-06-05 16:08:24.882
cmq14cxru0005jv04qfbs3cgb	org_eis_01	cmnsuxym1000bif04edf7ar89	cmnsuxyi90009if04lcmfmiv3	REPAIR	\N	\N	INV-2026-0007	UGX	\N	PAID	2026-06-05 16:08:58.824	180000.00	180000.00	2026-06-05 16:08:59.469	\N	2026-06-05 16:08:59.13	2026-06-05 16:08:59.47
cmq14dm8z000bjv04vqccjgvr	org_eis_01	cmo4wih6f000kjy04jm8wv5k1	cmo4wigwh000gjy04nxndyx1k	REPAIR	\N	\N	INV-EIS-6/2026/0017	UGX	\N	PAID	2026-06-05 16:09:30.643	400000.00	400000.00	2026-06-05 16:09:31.234	\N	2026-06-05 16:09:30.851	2026-06-05 16:09:31.235
cmq14e83l0001jr04ljvky9mr	org_eis_01	cmnvkb8cr0002js04uodxmzrb	cmnvkb87j0000js04cyxzwml1	REPAIR	\N	\N	INV-2026-0008	UGX	\N	PAID	2026-06-05 16:09:58.83	50000.00	50000.00	2026-06-05 16:09:59.805	\N	2026-06-05 16:09:59.169	2026-06-05 16:09:59.806
cmq2e0l6q0007l404ysgig4xl	org_eis_01	cmpseuh690007js047n6cmfhv	cmpseugyg0003js04rrryzg5d	REPAIR	\N	\N	INV-2026-0009	UGX	\N	PAID	2026-06-06 13:27:04.904	220000.00	220000.00	2026-06-06 13:27:05.66	\N	2026-06-06 13:27:05.282	2026-06-06 13:27:05.661
cmq5canbu000fjv04tpp68ob5	org_eis_01	cmq5c7a1z0005jv043p2d1ug3	cmq5c79tf0001jv04jdwiyad3	REPAIR	\N	\N	INV-2026-0010	UGX	\N	PAID	2026-06-08 15:02:13.392	430000.00	430000.00	2026-06-08 15:02:14.329	\N	2026-06-08 15:02:13.915	2026-06-08 15:02:14.33
cmq6hhcrr0001ld04u8b5q65j	org_eis_01	cmq5d21rn0005jv04z33izd5j	cmq5d21bk0001jv04icd2mpz8	REPAIR	\N	\N	INV-2026-0011	UGX	\N	PAID	2026-06-09 10:15:10.55	450000.00	450000.00	2026-06-09 10:15:11.482	\N	2026-06-09 10:15:11.08	2026-06-09 10:15:11.483
cmq6p4qoq0003ld04nfoenrev	org_eis_01	\N	cmq6p2rvx0001ld040fcrj2m2	MERCHANDISE	Dell Latitude 3120 Touch 8GB/256GB	\N	INV-2026-0012	UGX	\N	PAID	2026-06-09 13:49:19.514	600000.00	600000.00	2026-06-09 13:50:12.173	\N	2026-06-09 13:49:19.514	2026-06-09 13:50:14.639
cmqb239al0001k404gr27iba5	org_eis_01	cmpwnhywb0005k004pxjcl0j7	cmpwnhyod0001k0042acuaqwm	REPAIR	\N	\N	INV-2026-0013	UGX	\N	PAID	2026-06-12 15:03:09.511	450000.00	450000.00	2026-06-12 15:03:11.167	\N	2026-06-12 15:03:10.029	2026-06-12 15:03:11.169
cmqcgueh50007jy0462130qci	org_eis_01	cmqc5f9300005k0045qgt5u1b	cmqc5f7lq0001k004sq6d7hn7	REPAIR	\N	\N	INV-EIS-6/2026/0016	UGX	\N	PAID	2026-06-13 14:43:56.925	150000.00	150000.00	2026-06-13 14:43:57.588	\N	2026-06-13 14:43:57.257	2026-06-13 14:43:57.589
cmqhxaqy20001l404gtr7l21o	org_eis_01	cmqgphmls000rl504yd7f9nn9	cmqgphlxa000nl504pp381otp	REPAIR	\N	\N	INV-2026-0014	UGX	\N	PAID	2026-06-17 10:23:24.032	1200000.00	1200000.00	2026-06-17 10:23:25.078	\N	2026-06-17 10:23:24.65	2026-06-17 10:23:25.079
cmqryg62w0003l404fuu1aa7i	org_eis_01	\N	cmqryg5x70001l4040k7ldbxx	SERVICE	MacBook Pro 2012 RAM	2026-07-24 00:00:00	INV-2026-0015	UGX	\N	PAID	2026-06-24 10:53:18.92	370000.00	370000.00	2026-08-18 18:47:12.897	\N	2026-06-24 10:53:18.92	2026-08-18 18:47:12.898
cmqryiwbc0001kv04o2wp30vu	org_eis_01	cmq24vpai0005lg04vfuem40i	cmntvqwbw0000l704etryfmwr	REPAIR	\N	\N	INV-2026-0016	UGX	\N	PAID	2026-06-24 10:55:35.73	180000.00	180000.00	2026-07-08 08:20:10.767	\N	2026-06-24 10:55:26.232	2026-07-08 08:20:10.768
cmqtkv07r0001kw041kas0kun	org_eis_01	cmnvcj3hg0004ld04mrxtfeui	cmnvcj3a10000ld04pn9edyv1	REPAIR	\N	\N	INV-2026-0017	UGX	\N	PAID	2026-06-25 14:08:40.318	320000.00	320000.00	2026-06-25 14:53:51.595	\N	2026-06-25 14:08:28.887	2026-06-25 14:53:51.596
cmqtmjj780007jm04fy3t4mi7	org_eis_01	cmnvcj3pv000ald04e0g3ktgd	cmnvcj3a10000ld04pn9edyv1	REPAIR	\N	\N	INV-2026-0018	UGX	\N	PAID	2026-06-25 14:55:32.448	360000.00	360000.00	2026-06-25 14:55:33.279	\N	2026-06-25 14:55:32.853	2026-06-25 14:55:33.28
cmqwjm9dg0001lb04xo8nrpza	org_eis_01	cmqwjjlwn0005jr04pv5rujps	cmqwjjlh10001jr043exlhwcq	REPAIR	\N	\N	INV-2026-0019	UGX	\N	PAID	2026-06-27 15:56:59.202	50000.00	50000.00	2026-06-27 15:57:00.191	\N	2026-06-27 15:56:59.764	2026-06-27 15:57:00.192
cmr52gnda000ijs049odg5w7z	org_eis_01	cmr52d02z0005js04wcjlahff	cmr52czjn0001js04b9mh6xgf	REPAIR	\N	\N	INV-EIS-7/2026/0021	UGX	\N	PAID	2026-07-03 15:06:39.725	200000.00	200000.00	2026-07-03 15:06:40.577	\N	2026-07-03 15:06:40.078	2026-07-03 15:06:40.578
cmr535lpd0003ih04kz2lct3a	org_eis_01	cmr52ycs5000li904qhkdtema	cmr52yc96000hi904uz5gm4g4	REPAIR	\N	\N	INV-EIS-7/2026/0022	UGX	\N	PAID	2026-07-03 15:26:03.506	420000.00	420000.00	2026-07-03 15:26:05.712	\N	2026-07-03 15:26:04.321	2026-07-03 15:26:05.713
cmr65ydrn000jkz040d99njpz	org_eis_01	\N	cmr65ydkf000hkz042hn1t0wn	MERCHANDISE	Laptop Sleeve	2026-07-04 00:00:00	INV-2026-0020	UGX	\N	ISSUED	2026-07-04 09:32:12.467	210000.00	0.00	\N	\N	2026-07-04 09:32:12.467	2026-07-04 09:32:12.467
cmrbt14l2000hl404y8d26a3t	org_eis_01	cmqfb4wou0003ic046xu0e4o7	cmqfb4wg50001ic04s0w5arse	REPAIR	\N	\N	INV-EIS-7/2026/0018	UGX	\N	PAID	2026-07-08 08:17:02.075	550000.00	550000.00	2026-07-08 08:17:03.122	\N	2026-07-08 08:17:02.582	2026-07-08 08:17:03.123
cmrbt3aoo000jkw04pf28uea3	org_eis_01	cmqcapslm0005js041y36nzdn	cmqcapsbp0001js045eyk2j30	REPAIR	\N	\N	INV-EIS-7/2026/0017	UGX	\N	PAID	2026-07-08 08:18:43.412	350000.00	350000.00	2026-07-08 08:18:44.37	\N	2026-07-08 08:18:43.8	2026-07-08 08:18:44.371
cmrbt4k230007jr04zqjn9vnu	org_eis_01	cmq24vqax000blg04ft4xe80x	cmntvqwbw0000l704etryfmwr	REPAIR	\N	\N	INV-EIS-7/2026/0010	UGX	\N	PAID	2026-07-08 08:19:42.218	180000.00	180000.00	2026-07-08 08:19:43.042	\N	2026-07-08 08:19:42.604	2026-07-08 08:19:43.043
cmrbtboah000hjr04ttz4qxcc	org_eis_01	cmntvqwht0002l70454i9i627	cmntvqwbw0000l704etryfmwr	REPAIR	\N	\N	INV-EIS-5/2026/0007	UGX	\N	PAID	2026-05-05 14:45:37.356	220000.00	220000.00	2026-07-08 08:25:15.024	\N	2026-07-08 08:25:14.681	2026-07-08 08:25:15.025
cmrbyqkb70003kw04u80zz0a5	org_eis_01	cmratd5np000jkw04kw743av7	cmratd51p000fkw04ldudfz4b	REPAIR	\N	\N	INV-EIS-7/2026/0024	UGX	\N	PAID	2026-07-08 10:56:47.004	450000.00	450000.00	2026-07-08 10:56:47.939	\N	2026-07-08 10:56:47.443	2026-07-08 10:56:47.94
cmrbz0m650001i804rlsimehk	org_eis_01	cmratamg50009kw04p6s0207m	cmratam2q0005kw04n3de8w8a	REPAIR	\N	\N	INV-EIS-7/2026/0023	UGX	\N	PAID	2026-07-08 11:04:35.95	50000.00	50000.00	2026-07-08 11:04:37.069	\N	2026-07-08 11:04:36.413	2026-07-08 11:04:37.07
cmrd9etsi0003jl04e9bshiaa	org_eis_01	\N	cmrd9etlt0001jl04hvxus1pr	SERVICE	hp 840 G6 BIOS repair	\N	INV-2026-0021	UGX	\N	ISSUED	2026-07-09 08:43:21.811	250000.00	0.00	\N	\N	2026-07-09 08:43:21.811	2026-07-09 08:43:21.811
cmrd9glwq0001ie048lr3czn2	org_eis_01	\N	cmrd9etlt0001jl04hvxus1pr	SERVICE	0078 - 85W T charger	2026-07-09 00:00:00	INV-2026-0022	UGX	\N	PAID	2026-07-09 08:44:44.906	200000.00	200000.00	2026-08-18 18:45:39.266	\N	2026-07-09 08:44:44.906	2026-08-18 18:45:39.267
cmriyr7g5000sl804dvwrlojv	org_eis_01	cmratfqqd0011kw04x57howiv	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-7/2026/0026	UGX	\N	ISSUED	2026-07-13 08:39:24.674	212400.00	0.00	\N	\N	2026-07-13 08:31:40.662	2026-07-13 08:39:24.825
cmrm1yj5u0003l104ub0rrdvu	org_eis_01	cmrltd6mz0005ie041u4tq8zt	cmnsu3ifj0000lb0781yjo6cj	REPAIR	\N	\N	INV-EIS-7/2026/0031	UGX	\N	PAID	2026-07-15 12:24:39.438	280000.00	280000.00	2026-07-15 12:24:40.224	\N	2026-07-15 12:24:39.81	2026-07-15 12:24:40.225
cmrm5oanr0001jo04h11v9bng	org_eis_01	cmriyhtv4000bl804u73oft3m	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-7/2026/0028	UGX	\N	ISSUED	2026-07-15 14:08:40.54	485000.00	0.00	\N	\N	2026-07-15 14:08:40.695	2026-07-15 14:08:40.695
cms7hzehm0001lc04dpoamos1	org_eis_01	cmrx4tb6t0005l604othosvz5	cmrx4tatr0001l604eup4vzz5	REPAIR	\N	\N	INV-EIS-7/2026/0032	UGX	\N	ISSUED	2026-08-12 13:44:52.679	200000.00	200000.00	2026-08-12 13:44:06.581	\N	2026-07-30 12:36:23.963	2026-08-12 13:44:52.813
cms7iqo2c000old040odspnx7	org_eis_01	cms65prca000bl404daeh0idg	cms65pr6x0009l40444rvna1f	REPAIR	\N	\N	INV-EIS-7/2026/0037	UGX	\N	PAID	2026-07-30 12:57:35.762	100000.00	100000.00	2026-08-02 22:14:54.354	\N	2026-07-30 12:57:36.085	2026-08-02 22:14:54.355
cmsbmp6g00003jm04qnsh3z3y	org_eis_01	cmratf42y000tkw04ohmxbx8t	cmntvqwbw0000l704etryfmwr	REPAIR	\N	\N	INV-EIS-8/2026/0025	UGX	\N	PAID	2026-08-02 09:59:29.603	180000.00	180000.00	2026-09-07 12:16:57.79	\N	2026-08-02 09:59:29.76	2026-09-07 12:16:57.791
cmsf5n4k10003la04hp0gkobb	org_eis_01	cmriyhnq50003l804ft3d3jgk	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-8/2026/0027	UGX	\N	ISSUED	2026-08-04 21:13:05.061	250000.00	0.00	\N	\N	2026-08-04 21:13:05.233	2026-08-04 21:13:05.233
cmsg8ikiq000bla04kwpbvb24	org_eis_01	cms7gixy90003jo04s9gd3rpq	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-8/2026/0039	UGX	\N	ISSUED	2026-08-05 15:21:17.52	180000.00	0.00	\N	\N	2026-08-05 15:21:17.666	2026-08-05 15:21:17.666
cmsg8plg2000ajz04u352wnlr	org_eis_01	cms65q5hk000jl404zid2jq7u	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-8/2026/0038	UGX	\N	ISSUED	2026-08-05 15:26:45.273	100000.00	0.00	\N	\N	2026-08-05 15:26:45.458	2026-08-05 15:26:45.458
cmsg90pke000nla04a9hpr7u1	org_eis_01	cms65p1wt000bjt04eds8aj7f	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-8/2026/0036	UGX	\N	ISSUED	2026-08-05 15:35:23.875	180000.00	0.00	\N	\N	2026-08-05 15:35:24.014	2026-08-05 15:35:24.014
cmsg98gif000did044s78ncmh	org_eis_01	cms65ob8f0003jt049xb0gvtv	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EIS-8/2026/0035	UGX	\N	ISSUED	2026-08-05 15:41:25.358	180000.00	0.00	\N	\N	2026-08-05 15:41:25.528	2026-08-05 15:41:25.528
cmsh7ok7v0005l404ivxv06hs	org_eis_01	cmsh7cf7x0003le04n0oj6n6l	cmrkk87s20001k104tq42br03	REPAIR	\N	\N	INV-EIS-8/2026/0040	UGX	\N	PAID	2026-08-06 07:45:43.614	719800.00	719800.00	2026-08-21 07:22:19.863	\N	2026-08-06 07:45:43.772	2026-08-21 07:22:19.863
cmshf19fl0006ib04pfn41ou5	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0023	UGX	\N	VOID	2026-08-06 11:11:33.633	490000.00	0.00	\N	\N	2026-08-06 11:11:33.633	2026-08-07 16:57:35.603
cmshf1a75000fib047kl8fo78	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0024	UGX	\N	VOID	2026-08-06 11:11:34.625	490000.00	0.00	\N	\N	2026-08-06 11:11:34.625	2026-08-07 16:57:37.454
cmshf1bol000oib04cjrsb73l	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0025	UGX	\N	VOID	2026-08-06 11:11:36.55	490000.00	0.00	\N	\N	2026-08-06 11:11:36.55	2026-08-07 16:57:38.344
cmshf1cfd000xib04sfui952b	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0026	UGX	\N	VOID	2026-08-06 11:11:37.513	490000.00	0.00	\N	\N	2026-08-06 11:11:37.513	2026-08-07 16:57:39.302
cmshf1d840016ib04lnfb9pql	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0027	UGX	\N	VOID	2026-08-06 11:11:38.548	490000.00	0.00	\N	\N	2026-08-06 11:11:38.548	2026-08-07 16:57:40.159
cmshf1dye001fib04x7k3ekqy	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0028	UGX	\N	VOID	2026-08-06 11:11:39.494	490000.00	0.00	\N	\N	2026-08-06 11:11:39.494	2026-08-07 16:57:40.899
cmshf1em5001oib04q3t75fcl	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0029	UGX	\N	VOID	2026-08-06 11:11:40.349	490000.00	0.00	\N	\N	2026-08-06 11:11:40.349	2026-08-07 16:57:41.624
cmshf1fbt001xib042x76bhl6	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0030	UGX	\N	VOID	2026-08-06 11:11:41.273	490000.00	0.00	\N	\N	2026-08-06 11:11:41.273	2026-08-07 16:57:43.337
cmshf1gng0026ib04039jvbok	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0031	UGX	\N	VOID	2026-08-06 11:11:42.988	490000.00	0.00	\N	\N	2026-08-06 11:11:42.988	2026-08-07 16:57:44.169
cmshf1w7y0003l4045ndew5r0	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0032	UGX	\N	VOID	2026-08-06 11:12:03.166	490000.00	0.00	\N	\N	2026-08-06 11:12:03.166	2026-08-07 16:57:44.912
cmshf1xad000cl4047oxti93v	org_eis_01	\N	cmshf19460003ib04aszaw9s1	SERVICE	0067 · Leather Bag	2026-08-06 00:00:00	EIS/INV/2026/0033	UGX	\N	ISSUED	2026-08-06 11:12:04.549	490000.00	300000.00	\N	\N	2026-08-06 11:12:04.549	2026-08-06 11:14:47.764
cmsj633r20005l804jdbs0n41	org_eis_01	\N	cmsj633hh0003l80460bn7a3a	MERCHANDISE	iPhone 17 Pro Max 256GB Silver	\N	EIS/INV/2026/0034	UGX	\N	PAID	2026-08-07 00:00:00	1588.00	1588.00	2026-08-07 16:40:41.529	\N	2026-08-07 16:36:35.39	2026-08-07 16:40:41.53
cmsj665gc0001l50476spppzb	org_eis_01	\N	cmsj633hh0003l80460bn7a3a	SERVICE	iPhone 17 Pro max 256 GB Silver	\N	EIS/INV/2026/0035	UGX	\N	VOID	2026-08-07 00:00:00	1874.00	0.00	\N	\N	2026-08-07 16:38:57.565	2026-08-07 16:41:20.232
cmsj66v6h0009l804vxdxo6o8	org_eis_01	\N	cmsj633hh0003l80460bn7a3a	MERCHANDISE	iPhone 17 Pro max 256 GB Silver	\N	EIS/INV/2026/0036	UGX	\N	PAID	2026-08-07 00:00:00	1874.00	1874.00	2026-08-18 18:47:42.426	\N	2026-08-07 16:39:30.906	2026-08-18 18:47:42.426
cmsn90okd0003lg04jwhk7us3	org_eis_01	cmshqrqp50003l504k4j3l3lr	cmshqrqca0001l504n83r3qtl	REPAIR	\N	\N	EIS/INV/2026/0041	UGX	\N	PAID	2026-08-10 13:09:45.805	440000.00	440000.00	2026-08-12 13:46:26.653	\N	2026-08-10 13:09:45.95	2026-08-12 13:46:26.654
cmsqjoxz90003la043x5bwis6	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	INV-EI-2026-0030	UGX	\N	ISSUED	2026-08-12 20:31:52.454	720000.00	0.00	\N	\N	2026-08-12 20:31:52.581	2026-08-12 20:31:52.581
cmsrjz7hw000dky04y1mcmkld	org_eis_01	cmsrji9xl0003l80458lzg6s5	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	EIS/INV/2026/0042	UGX	\N	ISSUED	2026-08-13 13:27:49.909	395000.00	0.00	\N	\N	2026-08-13 13:27:37.652	2026-08-25 00:19:03.628
cmsz0f33j000alc04eb9nmlka	org_eis_01	\N	cmratd51p000fkw04ldudfz4b	MERCHANDISE	USB-C Mac cables	2026-08-31 00:00:00	EIS/INV/2026/0037	UGX	\N	ISSUED	2026-08-17 00:00:00	60000.00	0.00	\N	\N	2026-08-18 18:42:15.535	2026-08-18 18:42:15.535
cmt2mim8u0001la04vd7c9vor	org_eis_01	\N	cmqp0qe4m0005jm046ysctsqn	SERVICE	Invoice from quotation QT-2026-0003	2026-08-11 00:00:00	EIS/INV/2026/0038	UGX	\N	VOID	2026-07-10 00:00:00	13300000.00	0.00	\N	Converted from quotation QT-2026-0003	2026-08-21 07:24:10.399	2026-08-28 12:03:06.378
cmt2n0pks0001l304mx8llmen	org_eis_01	\N	cmqp0g9sn0001kz04gzwse2m9	SERVICE	Invoice from quotation QT-2026-0002	2026-08-09 00:00:00	EIS/INV/2026/0039	UGX	\N	PAID	2026-07-10 00:00:00	24000000.00	24000000.00	2026-08-21 07:42:59.561	Converted from quotation QT-2026-0002	2026-08-21 07:38:14.524	2026-08-21 07:42:59.562
cmt6zope10001jt04cy5ca1wf	org_eis_01	\N	cmracztxm0001gy04a93n2rwc	SERVICE	Macbook Laptop repair	\N	EIS/INV/2026/0040	UGX	\N	ISSUED	2026-08-24 00:00:00	650000.00	0.00	\N	\N	2026-08-24 08:43:54.122	2026-08-30 07:57:50.503
cmt8u3t8j000zjr040km4mcql	org_eis_01	cmt7eivuy0003jn04a53ddidd	cmt7eivmb0001jn04xn977rlu	REPAIR	\N	\N	EIS/INV/2026/0048	UGX	\N	PAID	2026-08-25 15:43:13.469	40000.00	40000.00	2026-08-25 15:43:41.399	\N	2026-08-25 15:43:13.603	2026-08-25 15:43:41.4
cmt8u91ft0014jl04jnulauut	org_eis_01	cmt7ar99w0003ju04c9er75u9	cmt7ar8z00001ju04gzhve8ht	REPAIR	\N	\N	EIS/INV/2026/0043	UGX	\N	ISSUED	2026-08-25 15:47:38.597	150000.00	100000.00	\N	\N	2026-08-25 15:47:17.513	2026-08-25 15:47:38.73
cmt8ujde80016ky043ck12zdi	org_eis_01	cmt2mou050009la04jt0ezoar	cmt2mornt0005la04h9yue6qa	REPAIR	\N	\N	EIS/INV/2026/0046	UGX	\N	PAID	2026-08-25 15:55:19.434	450000.00	450000.00	2026-08-30 07:58:41.38	\N	2026-08-25 15:55:19.568	2026-08-30 07:58:41.381
cmt8ur5c70021jr04ev3ltmyp	org_eis_01	cmt2l4lgs0005jx04yvb82oo8	cmt2l4l3j0001jx04pa3xz79t	REPAIR	\N	\N	EIS/INV/2026/0044	UGX	\N	PAID	2026-08-25 16:01:22.231	300000.00	300000.00	2026-08-25 16:01:58.21	\N	2026-08-25 16:01:22.376	2026-08-25 16:01:58.211
cmtbj5vh00005jq04ww5pa9tr	org_eis_01	cmt8tu2ib0003ky0481qbonqu	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	EIS/INV/2026/0045	UGX	\N	ISSUED	2026-08-27 13:00:25.674	120000.00	0.00	\N	\N	2026-08-27 13:00:12.564	2026-08-27 13:00:25.988
cmtbjj1v8000kjn044f8e6ke8	org_eis_01	cmrkk87x70003k1047soc8sxe	cmrkk87s20001k104tq42br03	REPAIR	\N	\N	EIS/INV/2026/0047	UGX	\N	PAID	2026-08-27 13:10:25.552	610000.00	610000.00	2026-08-27 13:10:30.207	\N	2026-08-27 13:10:27.38	2026-08-27 13:10:30.208
cmtcsfsen0001jv04fz4aemy1	org_eis_01	\N	cmt8hxza70001jx0441s93o2k	SERVICE	Invoice from quotation EIS/QT/2026/0009	\N	EIS/INV/2026/0049	UGX	\N	PAID	2026-08-28 00:00:00	1220000.00	1220000.00	2026-08-28 17:57:25.468	Converted from quotation EIS/QT/2026/0009	2026-08-28 10:07:37.872	2026-08-28 17:57:25.469
cmtcws0ki0005jr04ozickr78	org_eis_01	cmo4wu4i6000al1042i4g5car	cmo4wu48c0006l104rou4hqx4	REPAIR	\N	\N	EIS/INV/2026/0050	UGX	\N	PAID	2026-08-28 12:09:20.935	400000.00	400000.00	2026-08-28 12:09:38.539	\N	2026-08-28 12:09:06.786	2026-08-28 12:09:38.54
cmtd3uvra0003jr048qiz8y98	org_eis_01	cmor290bl000cld04m1gr8l7e	cmor28wrb0005ld047nu8xay5	REPAIR	\N	\N	EIS/INV/2026/0051	UGX	\N	ISSUED	2026-08-28 15:27:15.11	350000.00	250000.00	\N	\N	2026-08-28 15:27:17.83	2026-08-28 15:27:19.852
cmtd46py70003ju04hdcssbcn	org_eis_01	cmor2ccmo0004l104cog4ekdv	cmor28wrb0005ld047nu8xay5	REPAIR	\N	\N	EIS/INV/2026/0052	UGX	\N	ISSUED	2026-08-28 15:36:27.508	250000.00	50000.00	\N	\N	2026-08-28 15:36:30.176	2026-08-28 15:36:32.158
cmtfisrah000fl204o6fem91v	org_eis_01	\N	cmt2mornt0005la04h9yue6qa	MERCHANDISE	Leather Bag	\N	EIS/INV/2026/0053	UGX	\N	PAID	2026-08-30 00:00:00	100000.00	100000.00	2026-08-30 08:02:22.153	\N	2026-08-30 08:01:05.321	2026-08-30 08:02:22.153
cmtfiwbb9000ol204gldyd1xm	org_eis_01	\N	cmog7m2fr0000l204msw7v1yc	MERCHANDISE	USB-c to lightening cable	\N	EIS/INV/2026/0054	UGX	\N	PAID	2026-08-30 00:00:00	40000.00	40000.00	2026-08-30 08:04:00.689	\N	2026-08-30 08:03:51.238	2026-08-30 08:04:00.69
cmtr7mkyo000jla04mmzlut58	org_eis_01	cmrysqgod0003l204x47oh6gn	cmratfqe3000zkw04iv172urq	REPAIR	\N	\N	EIS/INV/2026/0055	UGX	\N	PAID	2026-09-07 12:21:35.124	120000.00	120000.00	2026-09-07 12:21:37.315	\N	2026-09-07 12:21:35.52	2026-09-07 12:21:37.316
cmtsimutg0001jy04p3rg7061	org_eis_01	\N	cmtsily9z0001la04pamlsdg5	MERCHANDISE	MacBook Pro 13ich M2 2022 24/1TB 8core open box	\N	EIS/INV/2026/0056	UGX	\N	PAID	2026-09-08 00:00:00	3800000.00	3800000.00	2026-09-08 10:17:41.974	\N	2026-09-08 10:17:30.244	2026-09-08 10:17:41.975
\.


--
-- Data for Name: InvoiceAttachment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InvoiceAttachment" (id, "orgId", "invoiceId", "fileName", "filePath", "fileSize", "mimeType", "uploadedById", "uploadedAt") FROM stdin;
\.


--
-- Data for Name: InvoiceLine; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."InvoiceLine" (id, "orgId", "invoiceId", "sourceType", "sourceId", description, quantity, "unitPrice", "discountAmount", "taxAmount", "lineTotal", "saleUomFactor", "costAtSale", "createdAt") FROM stdin;
cmqryg62w0004l404n3gvy5l6	org_eis_01	cmqryg62w0003l404fuu1aa7i	Custom	\N	MacBook Pro 2012 RAM	1.000	120000.00	0.00	0.00	120000.00	\N	\N	2026-06-24 10:53:18.92
cmqryg62w0005l404lraqkh8i	org_eis_01	cmqryg62w0003l404fuu1aa7i	Custom	\N	MacBook Pro 2012 Keyboard	1.000	200000.00	0.00	0.00	200000.00	\N	\N	2026-06-24 10:53:18.92
cmqryg62w0006l404a23794qi	org_eis_01	cmqryg62w0003l404fuu1aa7i	Custom	\N	Hard Drive	1.000	50000.00	0.00	0.00	50000.00	\N	\N	2026-06-24 10:53:18.92
cmr65ydrn000kkz04zw7iu9l5	org_eis_01	cmr65ydrn000jkz040d99njpz	Part	cmr62bc5f0001l504pswy2ydi	0045 - Sleeve bags	3.000	70000.00	0.00	0.00	210000.00	\N	\N	2026-07-04 09:32:12.467
cmrd9etsi0004jl04j0hs1mz7	org_eis_01	cmrd9etsi0003jl04e9bshiaa	Custom	\N	hp 840 G6 BIOS repair	1.000	250000.00	0.00	0.00	250000.00	\N	\N	2026-07-09 08:43:21.811
cmrd9glwq0002ie044g4lr7ls	org_eis_01	cmrd9glwq0001ie048lr3czn2	Part	cmr64859v0007la04bosay1x5	0078 - 85W T charger	1.000	200000.00	0.00	0.00	200000.00	\N	\N	2026-07-09 08:44:44.906
cmshf19fl0007ib040shj3f5q	org_eis_01	cmshf19fl0006ib04pfn41ou5	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:33.633
cmshf19fl0008ib04gw1859rp	org_eis_01	cmshf19fl0006ib04pfn41ou5	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:33.633
cmshf1a75000gib04z3yo1nq5	org_eis_01	cmshf1a75000fib047kl8fo78	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:34.625
cmshf1a75000hib04yj5tgwtj	org_eis_01	cmshf1a75000fib047kl8fo78	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:34.625
cmshf1bol000pib04tbggpg8a	org_eis_01	cmshf1bol000oib04cjrsb73l	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:36.55
cmshf1bol000qib04zsoslo0d	org_eis_01	cmshf1bol000oib04cjrsb73l	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:36.55
cmshf1cfd000yib04o1cxzqwm	org_eis_01	cmshf1cfd000xib04sfui952b	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:37.513
cmshf1cfd000zib04jaod86hw	org_eis_01	cmshf1cfd000xib04sfui952b	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:37.513
cmshf1d840017ib04yklpqata	org_eis_01	cmshf1d840016ib04lnfb9pql	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:38.548
cmshf1d840018ib040r9uzu0h	org_eis_01	cmshf1d840016ib04lnfb9pql	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:38.548
cmshf1dye001gib04p60djyf5	org_eis_01	cmshf1dye001fib04x7k3ekqy	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:39.494
cmshf1dye001hib04q40pfgn6	org_eis_01	cmshf1dye001fib04x7k3ekqy	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:39.494
cmshf1em5001pib04oeha210p	org_eis_01	cmshf1em5001oib04q3t75fcl	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:40.349
cmshf1em5001qib04b34owg1t	org_eis_01	cmshf1em5001oib04q3t75fcl	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:40.349
cmshf1fbt001yib04ec73plep	org_eis_01	cmshf1fbt001xib042x76bhl6	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:41.273
cmshf1fbt001zib04zotmoq4v	org_eis_01	cmshf1fbt001xib042x76bhl6	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:41.273
cmshf1gng0027ib04am0e1j7j	org_eis_01	cmshf1gng0026ib04039jvbok	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:11:42.988
cmshf1gng0028ib04xmu0oe1k	org_eis_01	cmshf1gng0026ib04039jvbok	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:11:42.988
cmshf1w7y0004l404wrh4otbz	org_eis_01	cmshf1w7y0003l4045ndew5r0	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:12:03.166
cmshf1w7y0005l404xe3n3em3	org_eis_01	cmshf1w7y0003l4045ndew5r0	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:12:03.166
cmshf1xad000dl404nw4odlb1	org_eis_01	cmshf1xad000cl4047oxti93v	Part	cmr62mblu0003l504sl42tesg	0067 · Leather Bag	3.000	80000.00	0.00	0.00	240000.00	\N	\N	2026-08-06 11:12:04.549
cmshf1xad000el404epa5bd1e	org_eis_01	cmshf1xad000cl4047oxti93v	Part	cmr62irx90003kz04fydvkqd6	0046 · Bags with leather handles	5.000	50000.00	0.00	0.00	250000.00	\N	\N	2026-08-06 11:12:04.549
cmsj665gc0002l504gabti5k7	org_eis_01	cmsj665gc0001l50476spppzb	Custom	\N	iPhone 17 Pro max 256 GB Silver	1.000	1588.00	0.00	286.00	1588.00	\N	\N	2026-08-07 16:38:57.565
cmsj66v6h000al804l0t90cf3	org_eis_01	cmsj66v6h0009l804vxdxo6o8	Custom	\N	iPhone 17 Pro max 256 GB Silver	1.000	1588.00	0.00	286.00	1588.00	\N	\N	2026-08-07 16:39:30.906
cmsj68dd8000cl804u9l2d4c1	org_eis_01	cmsj633r20005l804jdbs0n41	Custom	\N	iPhone 17 Pro Max 256GB Silver	1.000	1588.00	0.00	0.00	1588.00	\N	\N	2026-08-07 16:40:41.132
cmsz0f33j000blc04otytrve8	org_eis_01	cmsz0f33j000alc04eb9nmlka	Custom	\N	USB-C Mac cables	1.000	60000.00	0.00	0.00	60000.00	\N	\N	2026-08-18 18:42:15.535
cmt2mjdel000jjv04cg93u46k	org_eis_01	cmt2mim8u0001la04vd7c9vor	Custom	\N	Dell Tower Desktop – Professional Specifications Intel® Core™ i3 Processor 4GB RAM 128GB SSD + 500GB HDD 19-inch Monitor USB Keyboard & Mouse Windows Operating System	10.000	1300000.00	0.00	0.00	13000000.00	\N	\N	2026-08-21 07:24:45.598
cmt2mjdel000kjv04ip9v8131	org_eis_01	cmt2mim8u0001la04vd7c9vor	Custom	\N	Transport	1.000	300000.00	0.00	0.00	300000.00	\N	\N	2026-08-21 07:24:45.598
cmt2n1lpk0002k004vb2grvmt	org_eis_01	cmt2n0pks0001l304mx8llmen	Custom	\N	Dell Tower Desktop – Professional Specifications Intel® Core™ i3 Processor 4GB RAM 128GB SSD + 500GB HDD 19-inch Monitor USB Keyboard & Mouse Windows Operating System	10.000	2400000.00	0.00	0.00	24000000.00	\N	\N	2026-08-21 07:38:56.168
cmt6zope20002jt04l57nctgk	org_eis_01	cmt6zope10001jt04cy5ca1wf	Custom	\N	Macbook Laptop repair	1.000	650000.00	0.00	0.00	650000.00	\N	\N	2026-08-24 08:43:54.122
cmt7wm34300002l8wmv0fz0tg	org_eis_01	cmrbtboah000hjr04ttz4qxcc	Custom	\N	Repair — Dell Latitude	1.000	220000.00	0.00	0.00	220000.00	\N	\N	2026-08-25 00:05:39.268
cmt7wm4m900012l8wt7k18eye	org_eis_01	cmpxvmmrf0001jm04udpohd0y	Custom	\N	Software service — OS install	1.000	120000.00	0.00	0.00	120000.00	\N	\N	2026-08-25 00:05:41.217
cmt7wm63e00022l8wcop45aqt	org_eis_01	cmprdk67l0001kv04p0cfi95l	Custom	\N	Repair — MBP 2017 15inch MBP 2017 15inch	1.000	380000.00	0.00	0.00	380000.00	\N	\N	2026-08-25 00:05:43.13
cmt7wm9th00042l8w18ljdx8u	org_eis_01	cmpv8hchs0007jm04yl743320	Custom	\N	Repair — Apple iPhone 13 Pro Max	1.000	690000.00	0.00	0.00	690000.00	\N	\N	2026-08-25 00:05:47.957
cmt7wmb9g00052l8w48wu6zi6	org_eis_01	cmpv8i9290003jp04u0i3x66q	Custom	\N	Repair — Apple MacBook Pro 13 2017	1.000	550000.00	0.00	0.00	550000.00	\N	\N	2026-08-25 00:05:49.829
cmt7wmd8500062l8w0mklx95i	org_eis_01	cmpwt2no10001le04jw30yjie	Custom	\N	Repair — Apple iPhone 13Pro Max	1.000	220000.00	0.00	0.00	220000.00	\N	\N	2026-08-25 00:05:52.374
cmt7wmeo600072l8wsvveoo2w	org_eis_01	cmpxmi6m30001k004vq910r64	Custom	\N	Repair — HP Victus Gaming	1.000	300000.00	0.00	0.00	300000.00	\N	\N	2026-08-25 00:05:54.247
cmt7wmgmq00082l8wzr5porfe	org_eis_01	cmpxmkj5b0001le049adwslpo	Custom	\N	Repair — MacBook pro 13inch 2017 NTB A1708	1.000	1100000.00	0.00	0.00	1100000.00	\N	\N	2026-08-25 00:05:56.787
cmt7wmi2y00092l8wi7tfsunr	org_eis_01	cmpxmlgxk0001ji04doqjcaly	Custom	\N	Repair — Lenovo T14	1.000	270000.00	0.00	0.00	270000.00	\N	\N	2026-08-25 00:05:58.666
cmt7wmjiv000a2l8won5uloky	org_eis_01	cmpxmofd40007ji04r92rtv0l	Custom	\N	Software service — OS install	1.000	150000.00	0.00	0.00	150000.00	\N	\N	2026-08-25 00:06:00.536
cmt7wmlg4000b2l8wmi9tsnhc	org_eis_01	cmpxmpb6d000bk004jmbltswb	Custom	\N	Software service — Third-party apps	1.000	80000.00	0.00	0.00	80000.00	\N	\N	2026-08-25 00:06:03.029
cmt7wmmxp000c2l8wf0rxmp8f	org_eis_01	cmpxmtn8f0003l104oibhnk9w	Custom	\N	Repair — Dell Dell xps	1.000	170000.00	0.00	0.00	170000.00	\N	\N	2026-08-25 00:06:04.957
cmt7wmodp000d2l8wjwj3j2ou	org_eis_01	cmpxmvolx0009l104v1xykp5v	Custom	\N	Repair — M1 Pro 13inch MacBook M1 pro 13inch	1.000	70000.00	0.00	0.00	70000.00	\N	\N	2026-08-25 00:06:06.83
cmt7wmqkp000e2l8wxf7a6vmv	org_eis_01	cmpxmwhq2000fl104lxn26axb	Custom	\N	Repair — MacBook pro 2018 15 inches A1990	1.000	380000.00	0.00	0.00	380000.00	\N	\N	2026-08-25 00:06:09.674
cmt7wms0p000f2l8wxq1qm7ce	org_eis_01	cmpxmxery000pji04uiif1hrb	Custom	\N	Repair — Apple iPhone 6s	1.000	90000.00	0.00	0.00	90000.00	\N	\N	2026-08-25 00:06:11.546
cmt7wmvnt000h2l8wl0s4z5gy	org_eis_01	cmpxmzxa1000vji04a1yeh2yo	Custom	\N	Repair — Apple iPhone 12 Blue	1.000	350000.00	0.00	0.00	350000.00	\N	\N	2026-08-25 00:06:16.265
cmt7wmz7y000j2l8wjrohwosy	org_eis_01	cmpxnes74000ll104wwh2jv3p	Custom	\N	Repair — Apple MacBook Pro 13 inch 2017 Silver	1.000	330000.00	0.00	0.00	330000.00	\N	\N	2026-08-25 00:06:20.879
cmt7wn0oo000k2l8wb8ah934z	org_eis_01	cmpxvosdj0007jp049xtqaoy8	Custom	\N	Repair — Apple 2010	1.000	120000.00	0.00	0.00	120000.00	\N	\N	2026-08-25 00:06:22.776
cmt7wn24w000l2l8w599usxpp	org_eis_01	cmq12ca40000die04wolbcvlx	Custom	\N	Repair — Hp EliteBook 840 G5	1.000	480000.00	0.00	0.00	480000.00	\N	\N	2026-08-25 00:06:24.656
cmt7wn4bx000m2l8wood3q4xt	org_eis_01	cmq12drs60009ii04qs907dly	Custom	\N	Repair — hp ProBook 440 hp probook 440 G1	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:06:27.501
cmt7wn5ru000n2l8wayw6h9h4	org_eis_01	cmq144lud0001le042hhnrekf	Custom	\N	Repair — MBP 2015 15 inch MBP 2015 15 inch	1.000	400000.00	0.00	0.00	400000.00	\N	\N	2026-08-25 00:06:29.371
cmt7wn77y000o2l8wojypk4tr	org_eis_01	cmq14645s0001ld04o4nl31gb	Custom	\N	Repair — Apple MacBook Pro 13 inch 2017	1.000	330000.00	0.00	0.00	330000.00	\N	\N	2026-08-25 00:06:31.247
cmt7wn9f4000p2l8wveae0owy	org_eis_01	cmq1474w50007ld04r2scdhvj	Custom	\N	Repair — Apple MacBook Pro 16 inch 2019	1.000	480000.00	0.00	0.00	480000.00	\N	\N	2026-08-25 00:06:34.097
cmt7wnauy000q2l8w79ezn2nw	org_eis_01	cmq147uog0001l804qht3pf9n	Custom	\N	Software service — OS install	1.000	150000.00	0.00	0.00	150000.00	\N	\N	2026-08-25 00:06:35.963
cmt7wnd24000r2l8w0gtf3akt	org_eis_01	cmq148s5g0007l80410ux22mw	Custom	\N	Repair — Apple MacBook Pro 2017	1.000	650000.00	0.00	0.00	650000.00	\N	\N	2026-08-25 00:06:38.812
cmt7wnei3000s2l8wmn64mf40	org_eis_01	cmq14bb6d0009le04gpjaxwnn	Custom	\N	Repair — MacBook A1466	1.000	200000.00	0.00	0.00	200000.00	\N	\N	2026-08-25 00:06:40.684
cmt7wnfxz000t2l8wwxb12iqy	org_eis_01	cmq14c725000hl804469o2zyl	Custom	\N	Repair — Apple MacBook Pro	1.000	860000.00	0.00	0.00	860000.00	\N	\N	2026-08-25 00:06:42.552
cmt7wni5x000u2l8wgkwoqn7a	org_eis_01	cmq14cxru0005jv04qfbs3cgb	Custom	\N	Repair — Hp ProBook 14 inch	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:06:45.43
cmt7wnjlh000v2l8w4qlgsvhr	org_eis_01	cmq14dm8z000bjv04vqccjgvr	Custom	\N	Repair — Apple MacBook Air 13 Inch 2017	1.000	400000.00	0.00	0.00	400000.00	\N	\N	2026-08-25 00:06:47.285
cmt7wnl23000w2l8wd173wxqu	org_eis_01	cmq14e83l0001jr04ljvky9mr	Custom	\N	Repair — Dell Dell Latitude E7270 “ intel core i5	1.000	50000.00	0.00	0.00	50000.00	\N	\N	2026-08-25 00:06:49.179
cmt7wnn63000x2l8wyxwavvcr	org_eis_01	cmq2e0l6q0007l404ysgig4xl	Custom	\N	Repair — Apple iPad	1.000	220000.00	0.00	0.00	220000.00	\N	\N	2026-08-25 00:06:51.916
cmt7wnom6000y2l8wjmb7r446	org_eis_01	cmq5canbu000fjv04tpp68ob5	Custom	\N	Repair — Acer 14 Inch Acer 14 Inch	1.000	430000.00	0.00	0.00	430000.00	\N	\N	2026-08-25 00:06:53.79
cmt7wnqt6000z2l8wyxaxatx6	org_eis_01	cmq6hhcrr0001ld04u8b5q65j	Custom	\N	Repair — Apple iPhone 13 Pro Max	1.000	450000.00	0.00	0.00	450000.00	\N	\N	2026-08-25 00:06:56.634
cmt7wns9e00102l8wq7rd1ei9	org_eis_01	cmqb239al0001k404gr27iba5	Custom	\N	Repair — Apple MacBook Pro 13 inch 2020	1.000	450000.00	0.00	0.00	450000.00	\N	\N	2026-08-25 00:06:58.514
cmt7wntp700112l8wauai8eib	org_eis_01	cmqcgueh50007jy0462130qci	Custom	\N	Repair — iphone 12pro MGLN3LL/A	1.000	150000.00	0.00	0.00	150000.00	\N	\N	2026-08-25 00:07:00.379
cmt7wnvwf00122l8wzzrhkke4	org_eis_01	cmqhxaqy20001l404gtr7l21o	Custom	\N	Repair — Apple MacBook Air M1 A2337 Space Grey	1.000	1200000.00	0.00	0.00	1200000.00	\N	\N	2026-08-25 00:07:03.231
cmt7wnxca00132l8wc8o0sech	org_eis_01	cmqryiwbc0001kv04o2wp30vu	Custom	\N	Repair — MacBook Pro 15inch A1286	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:07:05.098
cmt7wnyta00142l8w1n4bok8y	org_eis_01	cmpxmsnlg000fji04w7d0wpgh	Custom	\N	Repair — Apple MacBook Air 13 2017	1.000	250000.00	0.00	0.00	250000.00	\N	\N	2026-08-25 00:07:07.006
cmt7wo0xd00152l8w3j49li3v	org_eis_01	cmqtkv07r0001kw041kas0kun	Custom	\N	Repair — Hp HP	1.000	320000.00	0.00	0.00	320000.00	\N	\N	2026-08-25 00:07:09.746
cmt7wo2df00162l8w4brsb7ls	org_eis_01	cmqtmjj780007jm04fy3t4mi7	Custom	\N	Repair — Asus Asus	1.000	360000.00	0.00	0.00	360000.00	\N	\N	2026-08-25 00:07:11.62
cmt7wo4ka00172l8w94imf7ww	org_eis_01	cmqwjm9dg0001lb04xo8nrpza	Custom	\N	Software service — OS install	1.000	50000.00	0.00	0.00	50000.00	\N	\N	2026-08-25 00:07:14.459
cmt7wo60e00182l8wi8wa8uso	org_eis_01	cmr52gnda000ijs049odg5w7z	Custom	\N	Software service — OS install	1.000	200000.00	0.00	0.00	200000.00	\N	\N	2026-08-25 00:07:16.334
cmt7wo7ga00192l8wuqeud4ej	org_eis_01	cmr535lpd0003ih04kz2lct3a	Custom	\N	Repair — Google pixel pixel	1.000	420000.00	0.00	0.00	420000.00	\N	\N	2026-08-25 00:07:18.203
cmt7wo9o7001a2l8wh7u11v87	org_eis_01	cmrbt14l2000hl404y8d26a3t	Custom	\N	Repair — iPhone iPhone 14 Pro Max	1.000	550000.00	0.00	0.00	550000.00	\N	\N	2026-08-25 00:07:21.08
cmt7wob3l001b2l8woxsg3t72	org_eis_01	cmrbt3aoo000jkw04pf28uea3	Custom	\N	Repair — MacBook pro 15inch 1017 A1707	1.000	350000.00	0.00	0.00	350000.00	\N	\N	2026-08-25 00:07:22.93
cmt7wocjv001c2l8wgdhs291r	org_eis_01	cmrbt4k230007jr04zqjn9vnu	Custom	\N	Repair — MacBook pro 15inch A1286	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:07:24.811
cmt7woeqt001d2l8wb490094k	org_eis_01	cmrbyqkb70003kw04u80zz0a5	Custom	\N	Repair — Apple MacBook Pro	1.000	450000.00	0.00	0.00	450000.00	\N	\N	2026-08-25 00:07:27.654
cmt7wog76001e2l8wued924ay	org_eis_01	cmrbz0m650001i804rlsimehk	Custom	\N	Software service — Third-party apps	1.000	50000.00	0.00	0.00	50000.00	\N	\N	2026-08-25 00:07:29.539
cmt7woibu001f2l8wsqcuw8ay	org_eis_01	cmriyr7g5000sl804dvwrlojv	Custom	\N	Repair — Lenovo ThinkPad T14 Unknown	1.000	212400.00	0.00	0.00	212400.00	\N	\N	2026-08-25 00:07:32.299
cmt7wojrr001g2l8w6my8us3r	org_eis_01	cmrm1yj5u0003l104ub0rrdvu	Custom	\N	Repair — HP 840 G7	1.000	280000.00	0.00	0.00	280000.00	\N	\N	2026-08-25 00:07:34.168
cmt7wol7k001h2l8wrhfqyvuy	org_eis_01	cmrm5oanr0001jo04h11v9bng	Custom	\N	Repair — Lenovo thinkbook 14	1.000	485000.00	0.00	0.00	485000.00	\N	\N	2026-08-25 00:07:36.032
cmt7wonfi001i2l8wdllme70a	org_eis_01	cms7iqo2c000old040odspnx7	Custom	\N	Repair — Apple Macbook	1.000	100000.00	0.00	0.00	100000.00	\N	\N	2026-08-25 00:07:38.911
cmt7woqbi001k2l8we57he0lu	org_eis_01	cmsf5n4k10003la04hp0gkobb	Custom	\N	Repair — LENOVO THINKPAD THINKPAD	1.000	250000.00	0.00	0.00	250000.00	\N	\N	2026-08-25 00:07:42.654
cmt7woshr001l2l8wxdaogpeh	org_eis_01	cmsg8ikiq000bla04kwpbvb24	Custom	\N	Repair — LENOVO Unknown	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:07:45.471
cmt7wotyb001m2l8woi5bszov	org_eis_01	cmsg8plg2000ajz04u352wnlr	Custom	\N	Repair — THINKBOOK Unknown	1.000	100000.00	0.00	0.00	100000.00	\N	\N	2026-08-25 00:07:47.363
cmt7wow5b001n2l8wj7nr42wl	org_eis_01	cmsg90pke000nla04a9hpr7u1	Custom	\N	Repair — DELL INC DELL	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:07:50.207
cmt7woxp1001o2l8wv9gwqk3z	org_eis_01	cmsg98gif000did044s78ncmh	Custom	\N	Repair — lenovo Unknown	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-08-25 00:07:52.213
cmt7woz4x001p2l8wy88k10a4	org_eis_01	cmsh7ok7v0005l404ivxv06hs	Custom	\N	Repair — Hp Hp 450 G8	1.000	719800.00	0.00	0.00	719800.00	\N	\N	2026-08-25 00:07:54.081
cmt7wp18e001q2l8wcl75s1wc	org_eis_01	cmsn90okd0003lg04jwhk7us3	Custom	\N	Repair — hp hp15-bs1np	1.000	440000.00	0.00	0.00	440000.00	\N	\N	2026-08-25 00:07:56.798
cmt7wp2q3001r2l8wgsfzhuzb	org_eis_01	cms7hzehm0001lc04dpoamos1	Custom	\N	Repair — MacBook pro 2007	1.000	200000.00	0.00	0.00	200000.00	\N	\N	2026-08-25 00:07:58.732
cmt7wp460001s2l8wjr1en7vd	org_eis_01	cmsqjoxz90003la043x5bwis6	Custom	\N	Repair — Dell Optiplex 5090	1.000	720000.00	0.00	0.00	720000.00	\N	\N	2026-08-25 00:08:00.6
cmt7x3arq00002l34prauxnbs	org_eis_01	cmsrjz7hw000dky04y1mcmkld	Custom	\N	Repair — Epson Printer Epson	1.000	395000.00	0.00	0.00	395000.00	\N	\N	2026-08-25 00:19:02.342
cmt8u4dgf000ljl04ywosugmk	org_eis_01	cmt8u3t8j000zjr040km4mcql	Custom	\N	Repair — Apple Unknown	1.000	40000.00	0.00	0.00	40000.00	\N	\N	2026-08-25 15:43:39.808
cmt8u9i2c001njr0431p7dl1u	org_eis_01	cmt8u91ft0014jl04jnulauut	Custom	\N	Repair — Apple imac	1.000	150000.00	0.00	0.00	150000.00	\N	\N	2026-08-25 15:47:39.06
cmt8ujdnc0017ky047iyj1de8	org_eis_01	cmt8ujde80016ky043ck12zdi	Custom	\N	Repair — Apple MacBook Pro 13 Inch 2020	1.000	450000.00	0.00	0.00	450000.00	\N	\N	2026-08-25 15:55:19.897
cmt8urvpf002ujl042hbq8h6w	org_eis_01	cmt8ur5c70021jr04ev3ltmyp	Custom	\N	Repair — Apple A2338	1.000	300000.00	0.00	0.00	300000.00	\N	\N	2026-08-25 16:01:56.547
cmtbj6630000hjq04ctg3ao74	org_eis_01	cmtbj5vh00005jq04ww5pa9tr	Custom	\N	Repair — Lenovo Lenovo Thinkbook i5 E15 16GB RAM/477GB	1.000	120000.00	0.00	0.00	120000.00	\N	\N	2026-08-27 13:00:26.316
cmtbjj230000ljn04szqzl7oz	org_eis_01	cmtbjj1v8000kjn044f8e6ke8	Custom	\N	Repair — HP HP	1.000	610000.00	0.00	0.00	610000.00	\N	\N	2026-08-27 13:10:27.66
cmtcwsnvn000kjr04ljc0jjmc	org_eis_01	cmtcws0ki0005jr04ozickr78	Custom	\N	Repair — Apple iMac 21.5 imcd	1.000	400000.00	0.00	0.00	400000.00	\N	\N	2026-08-28 12:09:36.996
cmtd3uw0i0004jr04197hr44l	org_eis_01	cmtd3uvra0003jr048qiz8y98	Custom	\N	Repair — Apple A1398	1.000	350000.00	0.00	0.00	350000.00	\N	\N	2026-08-28 15:27:18.162
cmtd46q6u0004ju0430xm837r	org_eis_01	cmtd46py70003ju04hdcssbcn	Custom	\N	Repair — Apple A1278	1.000	250000.00	0.00	0.00	250000.00	\N	\N	2026-08-28 15:36:30.486
cmtd96wdt0000kt04pza61j3s	org_eis_01	cmtcsfsen0001jv04fz4aemy1	Custom	\N	Tecno Spark 50 — 8GB RAM / 128GB ROM	2.000	610000.00	0.00	0.00	1220000.00	\N	\N	2026-08-28 17:56:36.594
cmtfiu2tp0006la04haw6r2rb	org_eis_01	cmtfisrah000fl204o6fem91v	Custom	\N	Leather Bag	1.000	100000.00	0.00	0.00	100000.00	\N	\N	2026-08-30 08:02:06.925
cmtfiwbb9000pl2046jcwpa3t	org_eis_01	cmtfiwbb9000ol204gldyd1xm	Part	cmr63edb30009jm04aq3mg72n	USB-c to lightening cable	2.000	20000.00	0.00	0.00	40000.00	1.000000	3000.00	2026-08-30 08:03:51.238
cmtr7gknz0000l504csmv405q	org_eis_01	cmsbmp6g00003jm04qnsh3z3y	Custom	\N	Repair — Dell Tower Desktop	1.000	180000.00	0.00	0.00	180000.00	\N	\N	2026-09-07 12:16:55.199
cmtr7ml5r000kla04ttzqc17o	org_eis_01	cmtr7mkyo000jla04mmzlut58	Custom	\N	Repair — Lenovo ThinkPad	1.000	120000.00	0.00	0.00	120000.00	\N	\N	2026-09-07 12:21:35.775
cmtsimutg0002jy04ryekf7hx	org_eis_01	cmtsimutg0001jy04p3rg7061	Part	cmq10uuxr000fjm04sbvlzutp	MacBook Pro 13ich M2 2022 24/1TB 8core open box	1.000	3800000.00	0.00	0.00	3800000.00	1.000000	2800000.00	2026-09-08 10:17:30.244
cmt7wm89g00032l8w53d81h4z	org_eis_01	cmprduvp10001jo04c1sqhwt7	Custom	\N	Software service — HP Elite [redacted] 830 G6	1.000	120000.00	0.00	0.00	120000.00	\N	\N	2026-08-25 00:05:45.941
cmt7wmtgp000g2l8w1l39bd2i	org_eis_01	cmpxmyimt0009le043dh1xuo9	Custom	\N	Software service — OS install, Data backup & [redacted], Account setup	1.000	50000.00	0.00	0.00	50000.00	\N	\N	2026-08-25 00:06:13.417
cmt7wmx41000i2l8w4f3pcz28	org_eis_01	cmpxn2c72000jk004i55yvplj	Custom	\N	Repair — HP Hp Elite [redacted] 830 G8	1.000	150000.00	0.00	0.00	150000.00	\N	\N	2026-08-25 00:06:18.145
\.


--
-- Data for Name: Job; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Job" (id, "jobNumber", status, "repairPath", "orgId", "branchId", "clientId", "deviceId", "createdById", "assignedToId", "deviceType", brand, model, "serialOrImei", accessories, "physicalNotes", "serviceType", "softwareOsInstall", "softwareDriversUpdates", "softwareDataBackupRestore", "softwareAccountSetup", "softwarePerformanceTune", "softwareThirdPartyApps", "softwareRequestedNotes", "softwareLicenseAttested", "softwareInstallerSource", "softwareInstallerSourceNote", "issueDescription", "workflowReason", "statusNote", "diagnosisNotes", "externalDiagnosis", "recommendedRepair", "recommendationOption", "communicationStatus", "clientConversationNote", "lastClientContactAt", "partsNeeded", "costEstimate", "finalCost", "vatApplicable", "externalTechFee", "externalPaid", "externalPaidAt", "externalPaidById", "externalPaymentRef", "clientPaid", "clientPaidAt", "clientPaidById", "clientPaymentRef", "invoiceNumber", "invoiceIssuedAt", "clientApproved", "approvalDate", "quotedAt", "quotationNumber", "repairTimeline", "timelineMinMinutes", "timelineMaxMinutes", "timelineConfidence", "timelineNote", "technicianNotes", "workDone", "partsReplaced", "receivedAt", "completedAt", "warrantyMonths", "warrantyExpiresAt", "deliveredAt", "deliveryMethod", "deliveredTo", "closedAt", "updatedAt") FROM stdin;
cmnsutfxs0002ju042ry8cthz	EIS-4/2026/0004	COMPLETED	IN_HOUSE	org_eis_01	\N	cmrkk87s20001k104tq42br03	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Pro 13 inch 2017 Silver	\N	Red/Black Hard Case	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine was slow and also Keyboard Not working	NONE	\N	Failed KeyBoard and also Slow Machine	\N	\N	PROCEED_REPAIR	NONE	Client Approved Replacement of the KeyBoard	2026-04-10 15:41:52.31	KeyBoard	230000.00	330000.00	f	\N	f	\N	\N	\N	t	2026-06-03 05:51:13.554	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0004	2026-06-03 05:51:13.148	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replace Keyboard Disable Slow Typing in Accessibility	Keyboard	2026-04-10 15:00:00	2026-04-10 15:43:17.975	\N	\N	\N	\N	\N	\N	2026-08-06 07:32:38.531
cmnt1uk140002jv04xxado5td	EIS-4/2026/0006	COMPLETED	EXTERNAL	org_eis_01	\N	cmnt1ujwg0000jv04erji6d04	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Hp	EliteBook 840 G5	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Spill on the Machine causing MotherBoard Failure	PARTS_PENDING	Time to find the Spare Part Possible SparePart availability Expected by Monday	\N	Water spill affected the Power system on the board	\N	PROCEED_REPAIR	NONE	Client Confirmed Board Replacement	2026-04-10 16:04:09.475	Motherboard replacement	400000.00	480000.00	f	0.00	t	2026-06-05 15:12:45.435	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-05 15:12:29.66	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 15:12:28.859	t	2026-04-10 16:05:55.112	\N	\N	\N	\N	\N	\N	\N	\N	Waiting to find a new Board	MotherBoard	2026-04-10 18:16:00	2026-05-21 06:53:31.759	\N	\N	\N	DELIVERY	Eddie	\N	2026-06-05 15:12:45.436
cmntvqwht0002l70454i9i627	EIS-4/2026/0007	COMPLETED	EXTERNAL	org_eis_01	\N	cmntvqwbw0000l704etryfmwr	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Dell	Latitude	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine doesn’t power on and has cracked body along the keyboard and hinges	PARTS_PENDING	Talked to Dan about possibility of building base than purchase entirely	\N	No power and Physical break of the lower base	\N	PROCEED_REPAIR	NONE	\N	2026-04-11 05:14:27.045	Power ICs	100000.00	220000.00	f	100000.00	t	2026-05-24 11:30:49.333	cmns5jbas00002lfw97nnwshd	\N	t	2026-07-08 08:25:15.094	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0007	2026-05-05 14:45:37.356	\N	\N	2026-06-10 12:55:33.676	EIS-4/QT/2026/0007	\N	\N	\N	\N	\N	\N	Power Repairs Done with replacement of Power system & Body repair fix works	Power Ics	2026-04-11 05:14:06.208	2026-05-06 15:08:15.642	\N	\N	\N	DELIVERY	Dan delivered to Luwero	\N	2026-07-08 08:25:15.095
cmnvcj3hg0004ld04mrxtfeui	EIS-4/2026/0008	COMPLETED	EXTERNAL	org_eis_01	\N	cmnvcj3a10000ld04pn9edyv1	cmnvcj3d10002ld0471pjnhb4	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Hp	HP	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	HP Service Charges Choose SSD Replacement Options: • 256GB – UGX 180,000* • 512GB – UGX 280,000* • General Servicing – UGX 50,000	NONE	\N	\N	\N	\N	PROCEED_REPAIR	NONE	Client needs a Quotation	2026-04-12 05:54:25.085	\N	200000.00	320000.00	f	0.00	f	\N	\N	\N	t	2026-06-25 14:53:51.694	cmns5nlp700042lmerqro7219	\N	INV-2026-0017	2026-06-25 14:08:40.318	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-12 08:51:00	2026-06-25 14:54:31.242	\N	\N	\N	\N	\N	\N	2026-06-25 14:54:31.243
cmnvcj3pv000ald04e0g3ktgd	EIS-4/2026/0009	COMPLETED	EXTERNAL	org_eis_01	\N	cmnvcj3a10000ld04pn9edyv1	cmnvcj3lu0008ld04vjcrhau6	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Asus	Asus	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	ASUS Service Charges • BIOS Replacement – UGX 70,000 • Screen Line Repair – UGX 180,000 • General Servicing – UGX 30,000 • Bezel Replacement – UGX 80,000	NONE	\N	\N	\N	\N	PROCEED_REPAIR	NONE	Client needs a Quotation	2026-04-12 05:54:48.114	\N	0.00	360000.00	f	0.00	f	\N	\N	\N	t	2026-06-25 14:55:33.353	cmns5nlp700042lmerqro7219	\N	\N	2026-06-25 14:55:32.448	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-12 08:51:00	2026-06-25 14:55:48.131	\N	\N	\N	\N	\N	\N	2026-06-25 14:55:48.133
cmnvkb8cr0002js04uodxmzrb	EIS-4/2026/0010	COMPLETED	IN_HOUSE	org_eis_01	\N	cmnvkb87j0000js04cyxzwml1	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	WINDOWS_PC	Dell	Dell Latitude E7270 “ intel core i5	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	My PC failed to turn back on after I had not used it for a while, so I really can’t point out a particular issue	NONE	\N	Machine had a Power Dead Lock Needed a reset to proceed	\N	\N	PROCEED_REPAIR	NONE	\N	2026-04-14 12:10:11.296	NA	0.00	50000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:10:00.662	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:09:58.83	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Reset performed and Servicing too	NA	2026-04-12 09:29:31.659	2026-04-18 22:08:11.281	\N	\N	\N	DELIVERY	Damba	\N	2026-06-05 16:10:00.663
cmnwq8etq0002le040f85l0el	EIS-4/2026/0011	IN_REPAIR	IN_HOUSE	org_eis_01	\N	cmnwq8epr0000le044obmxf11	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Air 11 inch - 2010	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The keyboard isn't working after liquid accident.	PARTS_PENDING	The fibre for the old MacBook Air still an issue to find - This will confirm if the issue is with the fibre or the keyboard as well	Machine Powers on but there is a rave of the fan and Keyboard doesnt function	\N	\N	PROCEED_REPAIR	NONE	Client need to know cost of repair	2026-04-15 17:37:42.163	I/O fibre needs to be replaced Need to confirm the keyboard functioning	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-13 05:03:03.95	\N	\N	\N	\N	\N	\N	\N	2026-04-25 18:36:43.21
cmnx5s5230002l1043j1ijvi7	EIS-4/2026/0013	READY_FOR_PICKUP	EXTERNAL	org_eis_01	\N	cmnx5s4y50000l104l47jq56u	\N	cmns5jbas00002lfw97nnwshd	cmns5vd6400062lsig31tm6wk	MAC	Apple	MacBook Pro 13 inch - 2012	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Laptop does not power on There were issues with the sound prior to this I have included the power cable	NONE	\N	Machine has a failed SMC thats the cause of no power	\N	\N	\N	NONE	\N	\N	\N	150000.00	330000.00	f	0.00	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	replacement of part	SMC replacement	2026-04-13 12:18:18.652	\N	\N	\N	\N	\N	\N	\N	2026-05-06 10:40:13.456
cmo0bqr4w0004kw0415tbo2zi	EIS-4/2026/0015	COMPLETED	EXTERNAL	org_eis_01	\N	cmo05hxzb0001jr04d0jgu1p0	cmo0bqqzk0002kw04o95gv0zn	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 12 Blue	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPhone Fell down and network failed	PARTS_PENDING	The Phone has both MAC address and BaseBAnd issues, We have retaken back for nothing repair and expecting for a repair completed report	\N	Identified a BaseBand issue	\N	PROCEED_REPAIR	NONE	Client requests to fix the issue never to return	2026-04-15 17:29:22.68	\N	250000.00	350000.00	f	0.00	t	2026-04-24 16:18:07.183	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 05:39:40.353	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0015	2026-06-03 05:39:39.894	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Fixed BaseBAnd and also IMEI Issues	Lower Board Replacement	2026-04-13 16:23:00	2026-04-24 16:18:29.141	\N	\N	\N	COURIER	Link Bus	\N	2026-06-03 05:39:40.354
cmo1rje8j0002l604c33r6eaa	EIS-4/2026/0016	COMPLETED	EXTERNAL	org_eis_01	\N	cmo1rje3u0000l604zeoe85s2	\N	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	A1688	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Charging Failure,\\Malfunction its not charging so am not sure if some exchanged my battery, charging cable rejection. no response after charger connection .	NONE	\N	\N	Phone has an issue with charging system will need to be replaced	\N	PROCEED_REPAIR	NONE	\N	2026-04-16 17:38:56.044	Charging system Replacement	0.00	0.00	f	0.00	t	2026-05-01 08:16:58.617	cmns5jbas00002lfw97nnwshd	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-16 17:38:26.9	2026-04-30 16:35:56.702	\N	\N	\N	\N	\N	\N	2026-05-01 08:16:58.619
cmo4wih6f000kjy04jm8wv5k1	EIS-4/2026/0017	COMPLETED	IN_HOUSE	org_eis_01	\N	cmo4wigwh000gjy04nxndyx1k	cmo4wih10000ijy04t8m0g65w	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Air 13 Inch 2017	NA	Hard Shell Cash	Intermittent fuzzy screen	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Intermittent fuzzy screen Possibly it was pressed by the charger in transit	NONE	\N	The screen goes fuzzy and will also get black at a point while the caps lock stays on	\N	\N	PROCEED_REPAIR	NONE	\N	2026-04-18 22:21:12.199	Screen is faulty	0.00	400000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:09:31.313	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0017	2026-06-05 16:09:30.643	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replaced a screen and the machines works great	SCreen replacement	2026-04-17 18:20:00	2026-04-18 22:23:19.943	\N	\N	\N	PICKUP	Client waited	\N	2026-06-05 16:09:31.314
cmo4wu4i6000al1042i4g5car	EIS-4/2026/0018	COMPLETED	IN_HOUSE	org_eis_01	\N	cmo4wu48c0006l104rou4hqx4	cmo4wu4di0008l1041l8xtdiu	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	iMac 21.5 imcd	NA	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine slow and needs serving	NONE	\N	Machine slow and needs to update SSD Fiber to close it	\N	\N	PROCEED_REPAIR	NONE	Client needs machine worked on they need it for music	2026-04-18 22:30:38.287	SSD Drive option is to confirm the storage options	240000.00	400000.00	f	\N	f	\N	\N	\N	t	2026-08-28 12:09:38.539	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0050	2026-08-28 12:09:20.935	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-16 16:29:00	2026-08-28 12:09:05.523	\N	\N	\N	\N	\N	\N	2026-08-28 12:09:38.674
cmoh0nb6p0008jx04u31h3b74	EIS-4/2026/0020	COMPLETED	EXTERNAL	org_eis_01	\N	cmoh0naxp0004jx04ga22xyog	cmoh0nb2n0006jx04nqsdt792	cmns5nlp700042lmerqro7219	cmns5vd6400062lsig31tm6wk	MAC	MacBook	A1466	FVFW6SC1J1WK	none	not powering	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	not powering	NONE	\N	\N	\N	\N	PROCEED_REPAIR	NONE	\N	2026-04-27 11:09:01.722	\N	100000.00	200000.00	f	0.00	t	2026-06-05 16:07:56.222	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-05 16:07:43.681	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:07:42.837	\N	\N	2026-04-27 11:09:02.122	EIS-4/QT/2026/0020	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-27 12:49:00	2026-04-27 15:05:05.722	\N	\N	\N	\N	\N	\N	2026-06-05 16:07:56.223
cmoim9zkd0008l4044tzn6txe	EIS-4/2026/0023	READY_FOR_PICKUP	EXTERNAL	org_eis_01	\N	cmoim9zd70004l4047bi61t7n	cmoim9zfl0006l404xvl44r1e	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	TABLET	Apple	iPad Air	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Broken Screen	NONE	\N	Physically Broken iPad screen	\N	\N	\N	NONE	\N	\N	Screen	300000.00	420000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	\N	2026-07-30 13:04:24.839	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	iPad screen replaced	Screen	2026-04-28 15:43:00	\N	\N	\N	\N	\N	\N	\N	2026-07-30 13:04:24.843
cmoimdo3s000bl8047uxb8h4b	EIS-4/2026/0024	COMPLETED	IN_HOUSE	org_eis_01	\N	cmoimdnw80007l804qkekez32	cmoimdnzh0009l80425ahyzyw	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Pro 16 inch 2019	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Battery Replacement	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	0.00	480000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:04:28.988	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0024	2026-06-05 16:04:28.154	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Battery Replacement	Battery	2026-04-22 15:45:00	2026-04-28 12:56:42.917	\N	\N	\N	PICKUP	Lambat	\N	2026-06-05 16:04:28.989
cmoimdodv000hl804mmrudzh3	EIS-4/2026/0025	COMPLETED	IN_HOUSE	org_eis_01	\N	cmoimdnw80007l804qkekez32	cmoimdo9h000fl8045j6hy1na	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Pro 13 inch 2017	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Battery Replacement	NONE	\N	Battery worn out	\N	\N	\N	NONE	\N	\N	Battery replacement	260000.00	330000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:03:41.348	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0025	2026-06-05 16:03:40.485	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replaced battery	Battery	2026-04-22 15:45:00	2026-04-28 12:50:05.818	\N	\N	\N	PICKUP	Lambert	\N	2026-06-05 16:03:41.349
cmoj4lmne0004jp049ib3m9gz	EIS-4/2026/0027	COMPLETED	EXTERNAL	org_eis_01	\N	cmo05hxzb0001jr04d0jgu1p0	cmoj4lmiu0002jp04y2gnd9ac	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 12	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	RETURN / WARRANTY for Job EIS-4/2026/0015	NONE	\N	\N	Hardware diagnosis to fix power off and Face ID	\N	\N	NONE	\N	\N	NA	0.00	0.00	f	0.00	t	2026-05-03 17:05:35.071	cmns5jbas00002lfw97nnwshd	\N	f	\N	\N	\N	INV-EIS-5/2026/0027	2026-05-04 12:03:46.05	\N	\N	2026-05-04 12:02:57.967	EIS-4/QT/2026/0027	\N	\N	\N	\N	\N	\N	Performed repaired	NA	2026-04-28 11:15:00	2026-05-03 17:05:44.345	\N	\N	\N	DELIVERY	Link	\N	2026-05-04 12:03:46.053
cmomscdqd0004kz042bi93efc	EIS-5/2026/0001	DELIVERED	EXTERNAL	org_eis_01	\N	cmomscde10000kz04runc0pac	cmomscdhj0002kz0459rqfv1f	cmns5nlp700042lmerqro7219	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Dell	Dell old model	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not Powering	NONE	\N	needs to re write Bios	Machine has a failed Motherboard Motherboard can't be repaired	\N	\N	NONE	\N	\N	Motherboard Replacement	200000.00	350000.00	f	0.00	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Need New Motherboard replacement	\N	2026-05-01 13:43:00	\N	\N	\N	\N	\N	\N	\N	2026-06-25 14:49:12.423
cmomzqhx70004jr04hzym5cgy	EIS-5/2026/0002	COMPLETED	EXTERNAL	org_eis_01	\N	cmomzqhmw0000jr043m97ifu3	cmomzqhqw0002jr047fqes7sc	cmns5nlp700042lmerqro7219	cmns5vd6400062lsig31tm6wk	MAC	MacBook Pro	MacBook Pro 2017	\N	\N	Not powering	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not Powering	NONE	\N	Power issue	\N	\N	\N	NONE	\N	\N	Power on motherboard needs to be fixed	200000.00	300000.00	f	200000.00	t	2026-05-05 15:21:51.165	cmns5jbas00002lfw97nnwshd	\N	t	2026-05-06 15:34:34.598	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0002	2026-05-05 14:59:48.876	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-25 17:10:00	2026-05-05 15:01:11.243	\N	\N	\N	DELIVERY	Machine maintained at EIS for Swap	\N	2026-05-06 15:34:34.599
cmor28wvg0007ld040vdce04z	EIS-5/2026/0004	IN_REPAIR	IN_HOUSE	org_eis_01	\N	cmor28wrb0005ld047nu8xay5	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	A1398	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	No Power, abrupt power off	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-04 10:32:28.012	\N	\N	\N	\N	\N	\N	\N	2026-08-28 12:10:37.953
cmor290bl000cld04m1gr8l7e	EIS-5/2026/0005	READY_FOR_PICKUP	IN_HOUSE	org_eis_01	\N	cmor28wrb0005ld047nu8xay5	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	A1398	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	machine Doesnt power on, Came Open with no screws	NONE	\N	Continued no power, despite resets and service	\N	\N	PROCEED_REPAIR	NONE	Client Positive to repair, we await his financial confirmation	2026-05-09 10:23:05.716	Battery 290,000 Servicing & Labour - 80,000	270000.00	350000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	EIS/INV/2026/0051	2026-08-28 15:27:15.11	\N	\N	2026-05-09 10:09:02.363	EIS-5/QT/2026/0005	\N	\N	\N	\N	\N	\N	Complete Servicing performed and machine started powering However battery not functional	NA	2026-05-04 10:32:32.481	\N	\N	\N	\N	\N	\N	\N	2026-08-28 15:29:29.364
cmor2ccmo0004l104cog4ekdv	EIS-5/2026/0006	IN_REPAIR	IN_HOUSE	org_eis_01	\N	cmor28wrb0005ld047nu8xay5	cmor2ccig0002l104x27jw6is	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	A1278	C1MNR9YWDTY3	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine is reported to have a black screen thats probable an issue with the GPU	NONE	\N	Machine starts in verbose mode causing the terminal like code Machine has multiple failed Parts including; Hard Drive Fibre, Ram, and Keyboard	\N	\N	\N	NONE	\N	\N	Hard Drive Fiber -120,000 Ram 4gb- 80,000 Keyboard - 220,000 Servicing & Labour - 80,000	0.00	250000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	EIS/INV/2026/0052	2026-08-28 15:36:27.508	\N	\N	2026-05-09 08:40:33.978	EIS-5/QT/2026/0006	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-04 10:35:08.181	\N	\N	\N	\N	\N	\N	\N	2026-08-28 15:36:32.31
cmotxn0s2000fjs04uihnur8z	EIS-5/2026/0012	CLOSED	EXTERNAL	org_eis_01	\N	cmotxn0ja000bjs04e3hyzccy	cmotxn0nz000djs0460c94zp7	cmns5nlp700042lmerqro7219	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Hp EliteBook 830 G6	hp EliteBook 830 G6	S/N5CG9497WQM	\N	Note powering	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	not powering	UNREPAIRABLE	\N	Needs Motherboard replacement	\N	\N	RETURN_UNREPAIRED	NONE	\N	2026-08-02 09:49:41.283	\N	400000.00	0.00	f	0.00	f	\N	\N	\N	t	2026-08-02 09:51:03.499	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0012	2026-05-06 11:59:55.869	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	motherboard replaced	motherboard	2026-04-04 13:46:00	\N	\N	\N	\N	\N	\N	2026-08-02 09:51:03.499	2026-08-02 09:51:03.5
cmovdyn420004l404lakagr6s	EIS-5/2026/0013	CLOSED	EXTERNAL	org_eis_01	\N	cmovdymw50000l404ex76us03	cmovdymzj0002l404qzgorl61	cmns5jbas00002lfw97nnwshd	cmns5vd6400062lsig31tm6wk	MAC	Apple	MacBook Pro 16 Inch M1 Pro	\N	Charger and Magsafe 3 Cable	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine doesn't Power on, remains on a black Screen Starts in DFU	UNREPAIRABLE	\N	Failure to boot, Its either within the Firmware, SSD./Nand or LogicBoard Hardware Domain	\N	\N	RETURN_UNREPAIRED	NONE	\N	2026-07-08 08:22:11.818	NA	\N	0.00	t	\N	f	\N	\N	\N	t	2026-07-08 08:23:33.479	cmns5jbas00002lfw97nnwshd	\N	\N	\N	\N	\N	2026-06-08 07:19:11.907	EIS-5/QT/2026/0013	\N	\N	\N	\N	\N	\N	Reset SMC, Reset NVRAM, Reseting FIrmware	NA	2026-05-07 12:11:00	\N	\N	\N	\N	\N	\N	2026-07-08 08:23:33.479	2026-07-08 08:23:33.48
cmovka5eh0004l704buwqb26w	EIS-5/2026/0014	COMPLETED	IN_HOUSE	org_eis_01	\N	cmovka56b0000l7047w2ftz2r	cmovka59i0002l7043yto9xpu	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	M1 Pro 13inch	MacBook M1 pro 13inch	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Displaying from the inside	NONE	\N	Displaying From the inside	\N	\N	\N	NONE	\N	\N	Screen Replacement needed	0.00	70000.00	f	\N	f	\N	\N	\N	t	2026-06-03 05:36:22.439	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0014	2026-06-03 05:36:22.027	t	2026-05-07 14:13:34.884	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-07 17:06:00	2026-05-07 14:13:51.312	\N	\N	\N	\N	\N	\N	2026-06-03 05:36:22.44
cmoy6yfwq000cl704o8k5n1dx	EIS-5/2026/0015	COMPLETED	IN_HOUSE	org_eis_01	\N	cmoy6yfmu0008l7045p4ipwvx	cmoy6yfqu000al704o9yciwep	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	MBP 15 inch	2012	\N	\N	\N	SOFTWARE	t	f	f	f	f	f	\N	t	COMPANY_LICENSE	\N	software update	NONE	\N	Installed OS on SSD - But HDD also shows signs of being faulty you need to backup	\N	\N	\N	NONE	\N	\N	\N	0.00	120000.00	f	\N	f	\N	\N	\N	t	2026-06-03 09:41:16.705	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0015	2026-05-15 04:56:20.362	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Software install	NA	2026-05-05 13:17:00	2026-05-15 04:55:53.704	\N	\N	\N	\N	\N	\N	2026-06-03 09:41:16.706
cmoy7429x000al1042z0dkcoy	EIS-5/2026/0016	COMPLETED	\N	org_eis_01	\N	cmoy742180006l104hs1r804y	cmoy7424e0008l104te8lkahh	cmns5nlp700042lmerqro7219	\N	MAC	MBP 2017 15inch	MBP 2017 15inch	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	No power	NONE	\N	POwer on USB-C Pads	\N	\N	\N	NONE	\N	\N	USB_C Power Pads	150000.00	380000.00	f	\N	f	\N	\N	\N	t	2026-06-01 13:15:15.25	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0016	2026-05-29 20:28:51.323	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replaced Power Pads USB -C	Replaced Power Pads USB -C	2026-05-08 13:22:00	2026-05-14 13:12:42.83	\N	\N	\N	\N	\N	\N	2026-06-01 13:15:37.562
cmq2dj66v000bii049kc7ehpq	EI-2026-0012	CLOSED	\N	org_eis_01	\N	cmq2dj60k0009ii04v5c6kzb5	\N	cmns5jbas00002lfw97nnwshd	\N	WINDOWS_PC	Lenovo ThinkPad	ThinkPad	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Power issue pc doesn’t start	UNREPAIRABLE	\N	\N	\N	\N	RETURN_UNREPAIRED	NONE	\N	2026-07-04 09:22:16.187	\N	\N	0.00	t	\N	f	\N	\N	\N	t	2026-07-04 09:22:55.864	cmns5nlp700042lmerqro7219	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-06-06 13:13:32.695	\N	\N	\N	\N	\N	\N	2026-07-04 09:22:55.864	2026-07-04 09:22:55.865
cmp6mp6ku0004la044ejas43h	EIS-5/2026/0018	COMPLETED	IN_HOUSE	org_eis_01	\N	cmp6mp6dw0000la04gj3wc96k	cmp6mp6gx0002la04khps5d63	cmns5nlp700042lmerqro7219	\N	MAC	Macbook Air	MacBook Air 2015	\N	\N	\N	SOFTWARE	t	f	f	f	f	f	\N	t	COMPANY_LICENSE	\N	Microsoft not working	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	0.00	150000.00	f	\N	f	\N	\N	\N	t	2026-06-03 05:30:43.864	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0018	2026-06-03 05:30:43.45	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-14 11:00:00	2026-05-15 08:04:21.56	\N	\N	\N	\N	\N	\N	2026-06-03 05:30:43.865
cmp6n0cry0004k004qe495s2j	EIS-5/2026/0019	COMPLETED	IN_HOUSE	org_eis_01	\N	cmor9qqe70000l704sbyzxld9	cmp6n0cn90002k004vvmoufmb	cmns5nlp700042lmerqro7219	\N	MAC	MacBook pro 13inch	MacBook pro 13inch 2018	\N	\N	\N	SOFTWARE	t	f	f	f	f	f	windows installation on mac	t	COMPANY_LICENSE	\N	he needs windows installed on mac	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	0.00	150000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:05:02.319	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:05:01.427	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-14 11:09:00	2026-05-15 08:11:32.985	\N	\N	\N	\N	\N	\N	2026-06-05 16:05:02.32
cmp6u8wcd0004ld04d3ltje5p	EIS-5/2026/0020	COMPLETED	EXTERNAL	org_eis_01	\N	cmp6u8w610000ld04pf6k57q7	cmp6u8w8e0002ld04d381t6xh	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	HP Victus	Gaming	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	No Power on battery and on Charger	NONE	\N	HP Victus, DC Charging Port Power Failure The machine won’t charge due to damaged charging port for power input circuit	\N	\N	\N	NONE	\N	\N	Power Repair	150000.00	300000.00	f	0.00	t	2026-06-01 13:17:13.897	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 05:25:52.647	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0020	2026-06-03 05:25:52.172	\N	\N	2026-05-15 11:38:49.655	EIS-5/QT/2026/0020	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-14 14:32:00	2026-05-29 05:34:46.602	\N	\N	\N	\N	\N	\N	2026-06-03 05:25:52.648
cmp8fzx6w0004jx04c6684rto	EIS-5/2026/0021	COMPLETED	IN_HOUSE	org_eis_01	\N	cmp8fzwz70000jx0465cll0lh	cmp8fzx2q0002jx04iqts4ivl	cmns5nlp700042lmerqro7219	cmns5nkty00012lme8d0os7dx	MAC	MacBook pro 13inch 2017 NTB	A1708	\N	African Bag	Brocken screen	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Brocken screen	NONE	\N	Broken Screen	\N	\N	\N	NONE	\N	\N	\N	1150000.00	1100000.00	f	\N	f	\N	\N	\N	t	2026-06-03 05:27:42.209	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0021	2026-06-03 05:27:41.727	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	replace Physically broken Screen	Clamshell Display	2026-05-16 17:29:00	2026-05-22 10:03:48.276	\N	\N	\N	DELIVERY	Muhammed	\N	2026-06-03 05:27:42.21
cmpf4u7nv0006jv047j884ahd	EIS-5/2026/0022	COMPLETED	\N	org_eis_01	\N	cmoy6yfmu0008l7045p4ipwvx	cmpf4u7jf0004jv049ivhhz09	cmns5nlp700042lmerqro7219	\N	MAC	MBP 2015 15 inch	MBP 2015 15 inch	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Needs a battery replacement	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	290000.00	400000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:02:30.866	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:02:30.038	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-20 09:51:00	2026-05-21 06:52:56.066	\N	\N	\N	\N	\N	\N	2026-06-05 16:02:30.867
cmpjp0oae0002jv0407uuhi7e	EIS-5/2026/0023	COMPLETED	EXTERNAL	org_eis_01	\N	cmpjp0o600000jv04sx1eolqt	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Dell	Dell xps	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	It sat in water after heavy downpour	NONE	\N	Water Damage Machine	\N	\N	\N	NONE	\N	\N	\N	25000.00	170000.00	f	0.00	t	2026-06-01 13:16:23.916	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 05:34:47.377	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0023	2026-06-03 05:34:46.939	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-24 11:27:27.734	2026-05-27 07:25:14.426	\N	\N	\N	PICKUP	Ann M	\N	2026-06-03 05:34:47.378
cmpmchxzb0005l704e2xo3hzh	EI-2026-0002	COMPLETED	EXTERNAL	org_eis_01	\N	cmpmchxp80001l7041tt1kfz7	cmpmchxv30003l704vxu01zqe	cmns5jbas00002lfw97nnwshd	cmpmcqrro0001l2042cc4lw6c	WINDOWS_PC	Lenovo	T14	NA	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Broken Screen Broken	NONE	\N	Screen flashing on display	\N	\N	\N	NONE	\N	\N	NA	200000.00	270000.00	f	200000.00	t	2026-06-03 10:31:14.565	cmns5jbas00002lfw97nnwshd	MM	t	2026-06-03 05:28:25.911	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0002	2026-06-03 05:28:25.526	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replacement of Screen	Screen	2026-05-25 11:00:00	2026-05-26 08:10:34.784	\N	\N	\N	\N	\N	\N	2026-06-03 10:31:14.566
cmpqrjo7j0005i505wkgnjl3a	EI-2026-0004	IN_REPAIR	\N	org_eis_01	\N	cmpqrjnww0001i50519blu3y5	cmpqrjo1g0003i505jzghlltg	cmns5nlp700042lmerqro7219	\N	MAC	iMac 27 inch 2015	iMac 27 inch 2015	\N	\N	line on the screen and no cover for RAM slots	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not powering on	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-29 13:12:00	\N	\N	\N	\N	\N	\N	\N	2026-06-02 09:36:34.254
cmpseo7uz0005i604wa19357r	EI-2026-0005	COMPLETED	EXTERNAL	org_eis_01	\N	cmpseo7nt0001i604r48jburu	cmpseo7r50003i6042co6b7yi	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 13 Pro Max	\N	Case	Cracked screen	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPhone has broken screen and also has an audio/Mic issue	NONE	\N	iPhone screen broken	\N	\N	\N	NONE	\N	\N	Need New Screen	450000.00	690000.00	f	\N	t	2026-06-01 13:16:34.868	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-01 13:17:46.565	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0005	2026-06-01 13:17:46.154	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Screen replaced, But audio also has an issue	Replaced charging system fibre that comes multiple purpose with charging, audio and vibrator	2026-05-29 12:47:00	2026-05-30 13:57:00.644	\N	\N	\N	\N	\N	\N	2026-06-01 13:17:46.566
cmpser8nn0005lb041dkwf11i	EI-2026-0006	COMPLETED	EXTERNAL	org_eis_01	\N	cmpser8ek0001lb049dyg6ftu	cmpser8j20003lb045lp6yp5j	cmns5jbas00002lfw97nnwshd	cmns5vd6400062lsig31tm6wk	MAC	Apple	MacBook Air 13 2017	\N	Adapter - 45w magsafe 2	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine wont power on - Opened, reset, only fan runs and stops just immediately	NONE	\N	Machine had a Bios issue	Machine has a bios issue	\N	PROCEED_REPAIR	NONE	\N	2026-06-03 07:56:36.714	\N	100000.00	250000.00	f	\N	t	2026-06-03 10:30:22.684	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 05:34:01.235	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0006	2026-06-24 14:23:06.63	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-05-28 14:49:00	2026-06-03 07:54:21.452	\N	\N	\N	COURIER	Sent Via Link Bus to kasese	\N	2026-06-24 14:23:06.882
cmpseuh690007js047n6cmfhv	EI-2026-0007	COMPLETED	EXTERNAL	org_eis_01	\N	cmpseugyg0003js04rrryzg5d	cmpseuh1l0005js049iyy8b85	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	TABLET	Apple	iPad	\N	Black Case	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPad has a front Camera Issue, Need to diagnose and fix	NONE	\N	\N	iPad with camera issue confirmed - need for replacement	\N	\N	NONE	\N	\N	Front camera	130000.00	220000.00	f	\N	t	2026-06-06 13:30:35.029	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-06 13:27:05.746	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-06 13:27:04.904	\N	\N	2026-06-02 10:27:07.299	QT-EI-2026-0007	\N	\N	\N	\N	\N	\N	Replaced front camera	Front camera	2026-05-29 12:52:00	2026-06-06 13:30:17.06	\N	\N	\N	COURIER	Client sent Bike guy	\N	2026-06-06 13:30:35.03
cmpwnhywb0005k004pxjcl0j7	EI-2026-0008	COMPLETED	\N	org_eis_01	\N	cmpwnhyod0001k0042acuaqwm	cmpwnhyrr0003k004i6vs9zxm	cmns5jbas00002lfw97nnwshd	\N	MAC	Apple	MacBook Pro 13 inch 2020	\N	NA	Previously repaired after a liquid spill	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Liquid spill - Presious repairs done without success	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	200000.00	450000.00	f	\N	f	\N	\N	\N	t	2026-06-12 15:03:11.27	cmns5nlp700042lmerqro7219	\N	\N	2026-06-12 15:03:09.511	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-06-02 13:05:55.526	2026-06-11 14:24:13.241	\N	\N	\N	\N	\N	\N	2026-06-12 15:03:11.272
cmq24vpai0005lg04vfuem40i	EI-2026-0009	COMPLETED	IN_HOUSE	org_eis_01	\N	cmntvqwbw0000l704etryfmwr	cmq24vp5e0003lg04jokcc3l8	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	MacBook Pro 15inch	A1286	S/N C02FQ193DF8X	\N	Hard disk ?	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Bringing Hard Disk ?	NONE	\N	GPU Failure confirmed	\N	\N	\N	NONE	\N	\N	GPU Failure confirmed	0.00	180000.00	f	\N	f	\N	\N	\N	t	2026-07-08 08:20:10.868	cmns5jbas00002lfw97nnwshd	\N	INV-2026-0016	2026-06-24 10:55:35.73	\N	\N	2026-06-10 12:55:46.713	QT-EI-2026-0009	\N	\N	\N	\N	\N	\N	GPU Failure confirmed	GPU Failure confirmed	2026-06-06 12:11:00	2026-06-16 13:25:35.655	\N	\N	\N	\N	\N	\N	2026-07-08 08:20:10.869
cmq24vqax000blg04ft4xe80x	EI-2026-0010	COMPLETED	IN_HOUSE	org_eis_01	\N	cmntvqwbw0000l704etryfmwr	cmq24vq6e0009lg04n0aiz32g	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	MacBook pro 15inch	A1286	S/N W89261HX648	\N	Not Powering	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not Powering	NONE	\N	GPU Failure confirmed	\N	\N	\N	NONE	\N	\N	GPU Failure confirmed	0.00	180000.00	f	\N	f	\N	\N	\N	t	2026-07-08 08:19:43.116	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-7/2026/0010	2026-07-08 08:19:42.218	\N	\N	2026-06-10 12:55:41.722	QT-EI-2026-0010	\N	\N	\N	\N	\N	\N	GPU Failure confirmed	GPU Failure confirmed	2026-06-06 12:11:00	2026-06-16 13:24:18.494	\N	\N	\N	\N	\N	\N	2026-07-08 08:19:43.117
cmq261jwd0005jr04jq5wzgfl	EI-2026-0011	IN_REPAIR	IN_HOUSE	org_eis_01	\N	cmq261jk60001jr04o4vgrdm5	cmq261joh0003jr04ds83rwda	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	MacMini M2	Macmini	\N	\N	No black Back cover	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not powering	NONE	\N	Needs Power Supply Replacement	\N	\N	\N	NONE	\N	\N	Power Supply 185W	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Order for Spare Part	185W Mac mini Pro Power Supply	2026-06-04 12:43:00	\N	\N	\N	\N	\N	\N	\N	2026-08-01 20:30:24.009
cmq5c7a1z0005jv043p2d1ug3	EI-2026-0014	COMPLETED	EXTERNAL	org_eis_01	\N	cmq5c79tf0001jv04jdwiyad3	cmq5c79x70003jv04xaehgue4	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Acer 14 Inch	Acer 14 Inch	\N	Bag and charger	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine was Slow, Cracked body and Screen broken	NONE	\N	Machine for Body rebuild, Screen Replacement and SSD Installation + Software installation	\N	\N	\N	NONE	\N	\N	Screen and SSD 256GB	280000.00	430000.00	f	\N	t	2026-06-08 15:02:25.25	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-08 15:02:14.398	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-08 15:02:13.392	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Rebuilt Body, Screen replaced, and installed SSD, Plus Reinstalled Software	Screen, SSD	2026-05-19 17:58:00	2026-06-08 15:03:14.257	\N	\N	\N	\N	\N	\N	2026-06-08 15:03:14.259
cmq5d21rn0005jv04z33izd5j	EI-2026-0015	COMPLETED	EXTERNAL	org_eis_01	\N	cmq5d21bk0001jv04icd2mpz8	cmq5d21ka0003jv04odgsn9uu	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 13 Pro Max	\N	Case Black	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Screen Displaying white	NONE	\N	Fix the screen Bug	\N	\N	\N	NONE	\N	\N	Repair Screen	180000.00	450000.00	f	\N	t	2026-06-09 11:28:02.92	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-09 10:15:11.573	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-09 10:15:10.55	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Screen Bug Fix	Screen fix	2026-06-08 15:23:32.073	2026-06-08 15:31:57.357	\N	\N	\N	\N	\N	\N	2026-06-09 11:28:02.921
cmqc5f9300005k0045qgt5u1b	EI-2026-0016	COMPLETED	\N	org_eis_01	\N	cmqc5f7lq0001k004sq6d7hn7	cmqc5f85y0003k004d38tb23y	cmns5nlp700042lmerqro7219	\N	PHONE_IPHONE	iphone 12pro	MGLN3LL/A	F17fj1z90d80	cover	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	problem with speakers	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	80000.00	150000.00	f	\N	f	\N	\N	\N	t	2026-06-13 14:43:57.65	cmns5nlp700042lmerqro7219	\N	INV-EIS-6/2026/0016	2026-06-13 14:43:56.925	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replacing Speakers and face id	Speakers	2026-06-13 12:23:00	2026-06-13 14:44:07.115	\N	\N	\N	\N	\N	\N	2026-06-13 14:44:07.117
cmqcapslm0005js041y36nzdn	EI-2026-0017	COMPLETED	EXTERNAL	org_eis_01	\N	cmqcapsbp0001js045eyk2j30	cmqcapsh20003js04swonj7n3	cmns5nlp700042lmerqro7219	cmns5vd6400062lsig31tm6wk	MAC	MacBook pro 15inch 1017	A1707	S/N C02WT3YEHTD6	None	Not powering	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not powering	NONE	\N	Machine has a Power issue - Multicomponent failure	\N	\N	\N	NONE	\N	\N	Power track failure	200000.00	350000.00	f	\N	f	\N	\N	\N	t	2026-07-08 08:18:44.455	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-7/2026/0017	2026-07-08 08:18:43.412	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replace PDU, PCH chips	Replace PDU, PCH chips	2026-06-13 14:52:00	2026-06-16 13:22:27.436	\N	\N	\N	\N	\N	\N	2026-07-08 08:18:44.456
cmqfb4wou0003ic046xu0e4o7	EI-2026-0018	COMPLETED	EXTERNAL	org_eis_01	\N	cmqfb4wg50001ic04s0w5arse	\N	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	iPhone	iPhone 14 Pro Max	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The screen is damaged and it can't show anything. The behind glass also has issues	NONE	\N	iPhone with Back and front screens broken	\N	\N	\N	NONE	\N	\N	Replacements of screens	450000.00	550000.00	f	\N	f	\N	\N	\N	t	2026-07-08 08:17:03.204	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-7/2026/0018	2026-07-08 08:17:02.075	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-06-15 14:27:28.254	2026-06-16 13:15:13.375	\N	\N	\N	\N	\N	\N	2026-07-08 08:17:03.205
cmqgphmls000rl504yd7f9nn9	EI-2026-0019	COMPLETED	IN_HOUSE	org_eis_01	\N	cmqgphlxa000nl504pp381otp	cmqgphmbb000pl504xmltvs9t	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Air M1 A2337 Space Grey	C02DXFB1Q6L4	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	BROKEN DISPLAY 16	NONE	\N	Clamshell Display	\N	\N	\N	NONE	\N	\N	Display	950000.00	1200000.00	f	\N	f	\N	\N	\N	t	2026-06-17 10:23:25.147	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-17 10:23:24.032	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replace Display	Display	2026-06-16 13:57:01.978	2026-06-17 10:23:07.099	\N	\N	\N	\N	\N	\N	2026-06-17 10:23:25.148
cmqwjjlwn0005jr04pv5rujps	EI-2026-0020	COMPLETED	IN_HOUSE	org_eis_01	\N	cmqwjjlh10001jr043exlhwcq	cmqwjjlo40003jr04va36pdik	cmns5nlp700042lmerqro7219	\N	MAC	MBA 15 inch	M2	\N	\N	\N	SOFTWARE	t	f	f	f	f	f	\N	t	\N	\N	Microsoft office	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	0.00	50000.00	f	\N	f	\N	\N	\N	t	2026-06-27 15:57:00.271	cmns5nlp700042lmerqro7219	\N	\N	2026-06-27 15:56:59.202	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-06-27 18:54:00	2026-06-27 15:59:12.266	\N	\N	\N	\N	\N	\N	2026-06-27 15:59:12.267
cmr52d02z0005js04wcjlahff	EI-2026-0021	COMPLETED	IN_HOUSE	org_eis_01	\N	cmr52czjn0001js04b9mh6xgf	cmr52czql0003js04qz236d4g	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	Mac 2018 15 inch	Mac 2018 15 inch	\N	\N	\N	SOFTWARE	t	f	f	f	f	f	\N	t	\N	\N	OS installation	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	0.00	200000.00	f	\N	f	\N	\N	\N	t	2026-07-03 15:06:40.651	cmns5nlp700042lmerqro7219	\N	INV-EIS-7/2026/0021	2026-07-03 15:06:39.725	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-03 18:03:00	2026-07-03 15:06:50.029	3	2026-10-03 15:06:50.029	\N	\N	\N	\N	2026-08-05 18:20:48.411
cmr52ycs5000li904qhkdtema	EI-2026-0022	COMPLETED	\N	org_eis_01	\N	cmr52yc96000hi904uz5gm4g4	cmr52ycg7000ji904u0g8nxow	cmns5nlp700042lmerqro7219	\N	PHONE_ANDROID	Google pixel	pixel	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Screen replacement	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	300000.00	420000.00	f	\N	f	\N	\N	\N	t	2026-07-03 15:26:06.574	cmns5nlp700042lmerqro7219	\N	INV-EIS-7/2026/0022	2026-07-03 15:26:03.506	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-01 18:20:00	2026-07-03 15:26:31.046	\N	\N	\N	\N	\N	\N	2026-07-03 15:26:31.047
cmratamg50009kw04p6s0207m	EI-2026-0023	COMPLETED	IN_HOUSE	org_eis_01	\N	cmratam2q0005kw04n3de8w8a	cmratam820007kw04wrz26lr0	cmns5nlp700042lmerqro7219	\N	MAC	Apple	MBP 16 2019	\N	software	\N	SOFTWARE	f	f	f	f	f	t	\N	t	OPEN_SOURCE	\N	software	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	0.00	50000.00	f	\N	f	\N	\N	\N	t	2026-07-08 11:04:37.16	cmns5nlp700042lmerqro7219	\N	INV-EIS-7/2026/0023	2026-07-08 11:04:35.95	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-07 12:36:00	2026-07-08 11:00:51.567	\N	\N	\N	\N	\N	\N	2026-07-08 11:04:37.161
cmratd5np000jkw04kw743av7	EI-2026-0024	COMPLETED	\N	org_eis_01	\N	cmratd51p000fkw04ldudfz4b	cmratd5aj000hkw04n17hmzmg	cmns5nlp700042lmerqro7219	\N	MAC	Apple	MacBook Pro	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Failed KeyBoard & TrackPad	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	180000.00	450000.00	f	\N	f	\N	\N	\N	t	2026-07-08 10:56:48.016	cmns5nlp700042lmerqro7219	\N	INV-EIS-7/2026/0024	2026-07-08 10:56:47.004	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-04 18:38:00	2026-07-08 10:57:03.163	\N	\N	\N	\N	\N	\N	2026-07-08 10:57:03.164
cmratf42y000tkw04ohmxbx8t	EI-2026-0025	COMPLETED	EXTERNAL	org_eis_01	\N	cmntvqwbw0000l704etryfmwr	cmratf3tg000rkw0437ep04jd	cmns5nlp700042lmerqro7219	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Dell	Tower Desktop	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine won't power on	PARTS_PENDING	\N	Not starting	\N	\N	PROCEED_REPAIR	APPROVED	\N	2026-09-07 12:18:26.744	NA	100000.00	180000.00	f	\N	t	2026-09-07 12:17:41.175	cmns5jbas00002lfw97nnwshd	\N	t	2026-09-07 12:16:57.79	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-8/2026/0025	2026-08-02 09:59:29.603	\N	\N	2026-08-02 09:58:00.615	QT-EI-2026-0025	30	\N	\N	\N	\N	\N	Issue withe eNe Chip	Rebound the chip - Firmware Upgrade	2026-06-18 18:39:00	2026-07-08 08:16:04.578	\N	\N	\N	\N	\N	\N	2026-09-07 12:18:26.746
cmratfqqd0011kw04x57howiv	EI-2026-0026	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5nlp700042lmerqro7219	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Lenovo ThinkPad T14	Unknown	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The Laptop is not charging.	NONE	\N	Check for issues of not charging	Machine has an issue with the Power Port and the Power system failure	\N	\N	NONE	\N	\N	NA	100000.00	212400.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-7/2026/0026	2026-07-13 08:39:24.674	\N	\N	2026-07-13 08:35:07.189	QT-EI-2026-0026	\N	\N	\N	\N	\N	\N	Repaired the Power shorting in the power system from the Power charging port to the battery	Power Component ICs	2026-07-07 15:40:38.293	2026-07-13 08:30:08.612	\N	\N	\N	\N	\N	\N	2026-07-13 08:39:24.905
cmriyhnq50003l804ft3d3jgk	EI-2026-0027	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	LENOVO THINKPAD	THINKPAD	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	IT IS NOT POWERING ON	NONE	\N	On connecting Power, it reverses current.	Power on the machine reverses current	\N	PROCEED_REPAIR	NONE	\N	2026-08-04 21:12:10.923	Power System ICS	120000.00	250000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-8/2026/0027	2026-08-04 21:13:05.061	\N	\N	2026-07-13 17:03:54.214	QT-EI-2026-0027	\N	\N	\N	\N	\N	\N	Fix defect power system	\N	2026-07-13 08:24:15.197	2026-08-04 21:13:02.562	\N	\N	\N	\N	\N	\N	2026-08-04 21:13:05.432
cmriyhtv4000bl804u73oft3m	EI-2026-0028	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Lenovo	thinkbook 14	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Broken hinges	NONE	\N	Defect Screen, Broken Hinges	Defective Screen and Hinges - Screen Paint sport increases as you tend to tilt the screen or reveal inner screen for access to hinges	\N	\N	NONE	\N	\N	Replace Screen and Hinges	300000.00	485000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-7/2026/0028	2026-07-15 14:08:40.54	\N	\N	2026-07-13 17:03:31.176	QT-EI-2026-0028	\N	\N	\N	\N	\N	\N	Replace Hinges and Screen	\N	2026-07-13 08:24:23.152	2026-07-15 12:26:32.156	\N	\N	\N	\N	\N	\N	2026-08-03 11:35:57.18
cmrkk87x70003k1047soc8sxe	EI-2026-0029	COMPLETED	EXTERNAL	org_eis_01	\N	cmrkk87s20001k104tq42br03	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	HP	HP	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	- Keyboard - the ctrl button is spoilt - Mouse pad - it's faulty, you can't right click - Slow performance because of space, perhaps the RAM issues - Sometimes it freezes when working on heavy documents - I suggest you recommend a new machine with better performance because i receive heavy files from different sources - the machine can be allocated for other tasks that are less heavy.	NONE	\N	Failed touch Pad and Broken Keyboard Lock	Failed touch Pad and Broken Keyboard Lock	\N	PROCEED_REPAIR	NONE	NA	2026-08-27 13:09:35.762	Replace Key lock	230000.00	610000.00	f	\N	t	2026-08-27 13:11:01.429	cmns5jbas00002lfw97nnwshd	\N	t	2026-08-27 13:10:30.207	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0047	2026-08-27 13:10:25.552	\N	\N	\N	\N	6	\N	\N	\N	\N	\N	Fixed the reported issues	NA	2026-07-14 11:20:32.539	2026-07-24 12:10:55.408	\N	\N	\N	\N	\N	\N	2026-08-27 13:11:01.43
cmrlt6nyo0003jr04ftpsm3rh	EI-2026-0030	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Dell	Optiplex 5090	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	It keeps on going on and off	NONE	\N	Powers on and Off	Powers on and off	\N	REPLACE_DEVICE	NONE	\N	2026-08-05 16:07:21.802	a processor related hardware failure affecting system stability and normal boot operation	400000.00	720000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EI-2026-0030	2026-08-12 20:31:52.454	\N	\N	2026-07-31 08:41:01.655	QT-EI-2026-0030	\N	\N	\N	\N	\N	\N	repeated power cycling and failure to complete normal startup processes.	faulty processor	2026-07-15 08:19:02.737	2026-08-12 20:31:51.612	\N	\N	\N	PICKUP	\N	\N	2026-08-12 20:31:52.652
cmrltd6mz0005ie041u4tq8zt	EI-2026-0031	COMPLETED	EXTERNAL	org_eis_01	\N	cmnsu3ifj0000lb0781yjo6cj	cmrltd6i40003ie04nlnk1s1b	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	HP	840 G7	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine not consistent on SSD	NONE	\N	Internal Drive failure	\N	\N	\N	NONE	\N	\N	SSD Replacement	100000.00	280000.00	f	\N	f	\N	\N	\N	t	2026-07-15 12:24:40.297	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-7/2026/0031	2026-07-15 12:24:39.438	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-13 11:23:00	2026-07-15 12:25:20.537	3	2026-10-15 12:25:20.537	\N	\N	\N	\N	2026-08-05 16:31:40.051
cmrx4tb6t0005l604othosvz5	EI-2026-0032	COMPLETED	IN_HOUSE	org_eis_01	\N	cmrx4tatr0001l604eup4vzz5	cmrx4tayz0003l604ji42yy95	cmns5nlp700042lmerqro7219	cmns5nnzs000f2lmeblzgrvrh	MAC	MacBook pro	2007	\N	no Accessory	not powering	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	not powering	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	70000.00	200000.00	f	\N	f	\N	\N	\N	t	2026-08-12 13:44:06.581	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-7/2026/0032	2026-08-12 13:44:52.679	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-07-23 09:29:00	2026-08-12 13:44:51.741	\N	\N	\N	PICKUP	\N	\N	2026-08-12 13:44:52.879
cmrysqgod0003l204x47oh6gn	EI-2026-0033	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Lenovo	ThinkPad	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Not powering on	PARTS_PENDING	\N	reported failure to power on	a reported failure to power on	\N	PROCEED_REPAIR	NONE	\N	2026-08-25 01:08:30.729	The Power components and power line repair	30000.00	120000.00	f	\N	t	2026-09-07 12:22:11.058	cmns5jbas00002lfw97nnwshd	\N	t	2026-09-07 12:21:37.315	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0055	2026-09-07 12:21:35.124	\N	\N	\N	\N	5	\N	\N	\N	\N	\N	Repaired malfunctioned failed power components and	Multi componente repair	2026-07-24 10:27:27.085	2026-07-24 12:10:02.029	3	2026-10-24 12:10:02.029	\N	\N	\N	\N	2026-09-07 12:22:11.059
cms65nsn30003l404ivvbxkkv	EI-2026-0034	IN_REPAIR	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	LENOVO THINKPAD	ThinkPad	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Laptop wasn't powering	NONE	\N	Machine failed to power on	Machine wont power on	\N	PROCEED_REPAIR	NONE	\N	2026-08-05 15:59:22.691	We cant find board repair components,	750000.00	1100000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	\N	\N	\N	\N	\N	Cant find LogicBoard components	Replacement of faulty logic board - New Board Spec , Intel Core i7	2026-07-29 14:03:40.863	\N	3	2026-11-05 16:00:51.847	\N	\N	\N	\N	2026-08-26 03:19:31.427
cms65ob8f0003jt049xb0gvtv	EI-2026-0035	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	lenovo	Unknown	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Broken Hinges	NONE	\N	Broken Hinges and Screen Bazel	Broken Hinges and Screen bezel	\N	PROCEED_REPAIR	NONE	\N	2026-08-05 15:38:54.053	NA	70000.00	180000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-8/2026/0035	2026-08-05 15:41:25.358	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replace Bezel	NA	2026-07-29 14:04:04.96	2026-08-05 15:41:23.932	3	2026-11-05 15:41:23.932	\N	\N	\N	\N	2026-08-05 15:43:02.525
cms65p1wt000bjt04eds8aj7f	EI-2026-0036	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	DELL INC	DELL	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	LAPTOP NOT CHARGING	NONE	\N	Machine wont power on	The Machine flashes an amber light on connect charger or powering on	\N	PROCEED_REPAIR	NONE	\N	2026-08-05 15:34:00.32	Only flashes an amber light	80000.00	180000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-8/2026/0036	2026-08-05 15:35:23.875	\N	\N	2026-07-31 08:27:19.24	QT-EI-2026-0036	\N	\N	\N	\N	\N	\N	Found a Bios Firmware Issue	NA	2026-07-29 14:04:39.533	2026-08-05 15:35:22.488	3	2026-11-05 15:35:22.488	\N	\N	\N	\N	2026-08-05 15:35:58.65
cms7gixy90003jo04s9gd3rpq	EI-2026-0039	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	LENOVO	Unknown	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Computer has issue with charging System	NONE	\N	Machine doesn't Power on Power line components check OK	Machine not powering on Checked Power components Tested OK	\N	PROCEED_REPAIR	NONE	\N	2026-08-05 15:20:23.903	NA	80000.00	180000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-8/2026/0039	2026-08-05 15:21:17.52	\N	\N	2026-07-31 08:26:54.981	QT-EI-2026-0039	\N	\N	\N	\N	\N	\N	Reprogrammed the Bios, machine powers as expected	NA	2026-07-30 11:55:36.418	2026-08-05 15:21:16.143	3	2026-11-05 15:21:16.143	\N	\N	\N	\N	2026-08-05 15:22:42.364
cmsh7cf7x0003le04n0oj6n6l	EAGLE-INFO-SOLUTIONS-EI-2026-0040	COMPLETED	EXTERNAL	org_eis_01	\N	cmrkk87s20001k104tq42br03	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Hp	Hp 450 G8	MAAD - 024/2021	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine is slow, faulty touchPad and with Keyboard issues	NONE	\N	\N	Machine visibly seen to delay action of operations Keyboard keys off and also the touch pad drags	\N	PROCEED_REPAIR	NONE	\N	2026-08-06 07:41:36.863	NA	250000.00	719800.00	f	\N	f	\N	\N	\N	t	2026-08-21 07:22:19.863	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-8/2026/0040	2026-08-06 07:45:43.614	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	The Machine needs multi-part replacement	Keyboard, Trackpad and Ram 8GB DDR4 upgrade	2026-08-06 07:36:17.421	2026-08-06 07:45:41.201	3	2026-11-06 07:45:41.201	\N	\N	\N	\N	2026-08-21 07:22:19.929
cmsrk2mox0003l70498wl0fy3	EIS/2026/0043	IN_REPAIR	EXTERNAL	org_eis_01	\N	cmsrk2mef0001l704l0tqylkn	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Lenovo V14 i3 16GB RAM/477GB	Lenovo V14 i3 16GB RAM/477GB	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	LAPTOP NOT POWERING AND NOT CHARGING	PARTS_PENDING	\N	Machine won’t power on	\N	\N	PROCEED_REPAIR	AWAITING_RESPONSE	We await client approvals	2026-09-03 04:39:19.732	NA	500000.00	890000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	\N	\N	\N	\N	\N	Lenovo thinkpad got short circuit on it's motherboard	Tried to fix board components but failed - We recommend replacing with another 12th Gen board	2026-08-13 13:30:17.314	\N	3	2026-12-03 04:48:06.009	\N	\N	\N	\N	2026-09-04 02:52:55.876
cmt2l8ddo0003if04ga8b6mik	EIS/2026/0045	IN_REPAIR	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5nkty00012lme8d0os7dx	cmns5va4t00002lsis3rrj31k	OTHER	Dell	Latitude 7200 2-in-1	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The Keyboard is not working.	NONE	\N	Keyboard issues.	X2 Dell Keyboard Failure	\N	PROCEED_REPAIR	NONE	\N	2026-08-27 13:05:13.767	NA	30000.00	470000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	2026-09-03 04:56:28.895	EIS/QT/2026/0014	5	\N	\N	\N	\N	\N	Replace the plug and Play X2 Dell Keyboard	Replace the plug and Play X2 Dell Keyboard	2026-08-21 06:48:12.732	\N	\N	\N	\N	\N	\N	\N	2026-09-03 04:56:29.45
cmt2mou050009la04jt0ezoar	EIS/2026/0046	COMPLETED	EXTERNAL	org_eis_01	\N	cmt2mornt0005la04h9yue6qa	cmt2morxu0007la0488yuz082	cmns5nkty00012lme8d0os7dx	cmpmcqrro0001l2042cc4lw6c	OTHER	Apple	MacBook Pro 13 Inch 2020	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	screen damage.	NONE	\N	Display issues when the machine tilts	the machine fails on display tilts	\N	PROCEED_REPAIR	NONE	\N	2026-08-25 15:52:34.068	NA	150000.00	450000.00	f	\N	t	2026-09-07 13:49:45.194	cmns5jbas00002lfw97nnwshd	\N	t	2026-08-30 07:58:41.38	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0046	2026-08-25 15:55:19.434	\N	\N	\N	\N	4	\N	\N	\N	\N	\N	Change the flex cable to give the screen a new life	Flex cable replacement	2026-08-21 10:29:00	2026-08-25 15:55:18.604	\N	\N	\N	\N	\N	\N	2026-09-07 13:49:45.194
cmt7ar99w0003ju04c9er75u9	EIS/2026/0047	COMPLETED	IN_HOUSE	org_eis_01	\N	cmt7ar8z00001ju04gzhve8ht	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	imac	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Drivers for Mac not responding	OTHER	\N	Machine wont have Keyboard and mouse working	\N	\N	PROCEED_REPAIR	NONE	\N	2026-08-25 15:45:51.157	NA	0.00	150000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	EIS/INV/2026/0043	2026-08-25 15:47:38.597	\N	\N	\N	\N	2	\N	\N	\N	\N	\N	Software support and Managing upgrading software	NA	2026-08-24 13:53:48.98	2026-08-25 15:47:37.673	\N	\N	\N	\N	\N	\N	2026-08-25 15:47:39.126
cmt7eivuy0003jn04a53ddidd	EIS/2026/0048	COMPLETED	\N	org_eis_01	\N	cmt7eivmb0001jn04xn977rlu	\N	cmns5jbas00002lfw97nnwshd	\N	MAC	Apple	Unknown	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Screen not displaying	OTHER	\N	Machine wont display	\N	\N	PROCEED_REPAIR	NONE	\N	2026-08-25 15:40:59.123	NA	0.00	40000.00	f	\N	f	\N	\N	\N	t	2026-08-25 15:43:41.399	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0048	2026-08-25 15:43:13.469	t	2026-08-25 15:42:54.75	\N	\N	1	\N	\N	\N	\N	\N	Servicing done on machine	NA	2026-08-24 15:39:16.811	2026-08-25 15:43:12.582	\N	\N	\N	\N	\N	\N	2026-08-25 15:43:41.532
cmt8tu2ib0003ky0481qbonqu	EIS/2026/0049	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	Lenovo	Lenovo Thinkbook i5 E15 16GB RAM/477GB	MP2FT9LC	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	BROKEN NEXT TO THE SCREEN BUT ITS WORKING FINE	NONE	\N	Machine has a broken body around the hinge caused by hinge movement	Machine had a cracked body around the screen and hinge areas	\N	PROCEED_REPAIR	NONE	\N	2026-08-27 12:59:14.625	NA	30000.00	120000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	EIS/INV/2026/0045	2026-08-27 13:00:25.674	\N	\N	\N	\N	2	\N	\N	\N	\N	\N	Cosmetic build for the hinge grounding and also broken body on the keyboard Panel	NA	2026-08-25 15:35:39.059	2026-08-27 13:00:10.141	3	2026-11-27 13:00:10.141	\N	\N	\N	\N	2026-08-27 13:07:15.401
cmtoceeb40005i804u5rgkbbh	EIS/2026/0050	DIAGNOSING	\N	org_eis_01	\N	cmtocedhi0001i804mk2kes8f	cmtocedjw0003i804ax0aewcy	cmns5nkty00012lme8d0os7dx	\N	MAC	Macbook	**	\N	\N	None responsive keyboard	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	None responsive keyboard	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-09-05 15:11:00	\N	\N	\N	\N	\N	\N	\N	2026-09-05 12:14:07.803
cmtrcxehd0001jm04kyz0a3gs	EIS/2026/0051	RECEIVED	\N	org_eis_01	\N	cmsrk2mef0001l704l0tqylkn	\N	cmns5jbas00002lfw97nnwshd	\N	WINDOWS_PC	Dell		\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Computer wasn't powering	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-09-07 14:49:58.418	\N	\N	\N	\N	\N	\N	\N	2026-09-07 14:49:58.418
cmtsg3gcs0003l704da1hlxqw	EIS/2026/0052	RECEIVED	\N	org_eis_01	\N	cmtsg3fmy0001l70433j81y7i	\N	cmns5jbas00002lfw97nnwshd	\N	WINDOWS_PC	DELL	Latitude 7200 2-in-1	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The laptop intermittently behaves as if there is no battery/power. The battery has already been replaced, and the problem can still occur even when powered directly from the original charger. I need motherboard-level diagnosis of the charging/power circuit, DC-in/USB-C power delivery, battery connector, charging IC/MOSFETs and BIOS/EC — not just another battery replacement.	NONE	\N	\N	\N	\N	\N	NONE	\N	\N	\N	\N	\N	t	\N	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-09-08 09:06:25.804	\N	\N	\N	\N	\N	\N	\N	2026-09-08 09:06:25.804
cmnsumh3m0006if04hjdra1gm	EIS-4/2026/0003	CLOSED	EXTERNAL	org_eis_01	\N	cmnsumgzj0004if04haj2vbki	\N	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	TABLET	Apple	iPad Pro 11	\N	Magnetic Flip case - Black	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The is disabled showing unavailable on the screen needs to be [redacted]	UNREPAIRABLE	Ordered for Lower Board and is expected on Friday to Monday at worst	\N	The fault has been traced to the U2 charging IC on the lower board. Repair/replacement is required	\N	RETURN_UNREPAIRED	NONE	Client Ok with the Repair and the charge	2026-08-28 12:07:04.58	Chargin IC	200000.00	0.00	f	0.00	f	\N	\N	\N	t	2026-08-28 12:07:22.348	cmns5jbas00002lfw97nnwshd	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Diagnose and Repair Charging IC	Charging IC - U2	2026-04-10 14:54:00	\N	\N	\N	\N	\N	\N	2026-08-28 12:07:22.348	2026-08-28 12:07:22.35
cmnwq8pos0007le04dhyv4ff9	EIS-4/2026/0012	COMPLETED	IN_HOUSE	org_eis_01	\N	cmnwq8pkk0005le04crjsvnv7	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	2010	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Won't [redacted] to display, it remains idol at the apple sign.	NONE	\N	Drive full machine can’t start	\N	\N	PROCEED_REPAIR	NONE	\N	2026-04-13 16:18:56.934	NA	0.00	120000.00	f	\N	f	\N	\N	\N	t	2026-06-03 09:42:57.272	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0012	2026-06-03 09:42:56.866	t	2026-04-13 16:22:19.555	\N	\N	\N	\N	\N	\N	\N	\N	Started online drive and drew data	NA	2026-04-13 05:03:18.029	2026-04-13 16:22:37.736	\N	\N	\N	PICKUP	Anne	\N	2026-06-03 09:42:57.273
cmshqrqp50003l504k4j3l3lr	EIS/2026/0041	COMPLETED	EXTERNAL	org_eis_01	\N	cmshqrqca0001l504n83r3qtl	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	hp	hp15-bs1np	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	needs more ram , speakers unclear,battery needs replacement, internal [redacted]	NONE	\N	\N	Machine was slow, broken speakers and battery issues	\N	\N	NONE	\N	\N	NA	280000.00	440000.00	f	\N	t	2026-08-25 16:03:31.432	cmns5jbas00002lfw97nnwshd	\N	t	2026-08-12 13:46:26.653	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0041	2026-08-10 13:09:45.805	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replaced Speakers 8GB Ram Battery Replacement	Speakers 8GB Ram Battery Replacement	2026-08-06 16:40:04.841	2026-08-10 13:09:44.826	\N	\N	\N	\N	\N	\N	2026-08-25 16:03:31.433
cmoir43zu0004jp04tsxa1qa6	EIS-4/2026/0026	COMPLETED	EXTERNAL	org_eis_01	\N	cmod4xwpv0000js042lj8dr7g	cmoir43uz0002jp04y3i5pwhe	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 13 Pro max	\N	Case	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPhone [redacted] intermittently	NONE	\N	iPhone has a hardware issue causing it to continuously [redacted]	\N	\N	\N	NONE	\N	\N	Hardware fix	130000.00	350000.00	f	130000.00	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Hardware fix performed	Hardware	2026-04-25 17:58:00	2026-04-28 15:01:44.363	\N	\N	\N	\N	\N	\N	2026-04-28 15:02:10.735
cmpmccutn0005l2048m8iktwp	EI-2026-0001	IN_REPAIR	EXTERNAL	org_eis_01	\N	cmpmccuiq0001l204sxqmwq91	cmpmccuom0003l204pkcgp77b	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 12	NA	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPhone wont [redacted]	NONE	\N	iPhone wont [redacted]	\N	\N	\N	NONE	\N	\N	NA	200000.00	250000.00	f	0.00	f	\N	\N	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Confirmed Base Band Issues	Board Repair	2026-05-20 10:56:00	\N	\N	\N	\N	\N	\N	\N	2026-05-26 08:12:13.652
cmsrji9xl0003l80458lzg6s5	EIS/2026/0042	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmpmcqrro0001l2042cc4lw6c	OTHER	Epson Printer	Epson	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The printer prints blank not un till you've done nozzle [redacted]	PARTS_PENDING	\N	Paper Prints Blank unless nozzle Nozzle [redacted] or colour alignments	Prints blank unless Nozzle [redacted] or colour alignments The printer also indicated that the maintenance box needs replacement. Replacement of the Print head, and the maintenance box to solve the problem	\N	PROCEED_REPAIR	NONE	\N	2026-08-13 13:19:49.116	NA	250000.00	395000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	EIS/INV/2026/0042	2026-08-13 13:28:01.067	\N	\N	\N	\N	2	\N	\N	\N	\N	\N	Printer Head sensor failure confirmed, failure to command papers to pass through service on the printer	Replace Print Head sensor	2026-08-13 13:14:27.658	2026-08-13 13:27:36.626	4	2026-12-13 13:22:30.387	\N	\N	\N	\N	2026-08-25 00:19:03.934
cmnsugszq0002l804mfj2hkph	EIS-4/2026/0002	COMPLETED	IN_HOUSE	org_eis_01	\N	cmnsugsv50000l804rlhd91sd	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Pro	C02Z6614LVCF	\N	Leaking Battery	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	The battery swollen and leaking - the liquids exposing to the Keyboard	OTHER	Client waiting for Waiting for client approval of battery price	Battery Leaking Spilled over the Logic Board and KeyBoard	\N	\N	PROCEED_REPAIR	NONE	\N	2026-04-10 12:14:24.636	[redacted] board and keyboard Need to replace Battery	550000.00	860000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:08:24.954	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:08:24.054	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Battery Replacement and Keyboard Replacement	Battery and KeyBoard	2026-04-10 14:50:00	2026-04-24 16:16:39.116	\N	\N	\N	COURIER	Imran Boda to Entebbe	\N	2026-06-05 16:08:24.955
cmnsuxym1000bif04edf7ar89	EIS-4/2026/0005	COMPLETED	IN_HOUSE	org_eis_01	\N	cmnsuxyi90009if04lcmfmiv3	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	WINDOWS_PC	Hp	ProBook 14 inch	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Faulty Hard Drive Someone Helped her fix the HDD Drive But machine still slow	NONE	\N	Slow Drive faulty drive failed and cant be recovered Recommended SSD Installation	\N	\N	PROCEED_REPAIR	NONE	\N	2026-04-10 16:02:27.976	SSD 256GB	0.00	180000.00	f	\N	f	\N	\N	\N	t	2026-06-05 16:08:59.531	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:08:58.824	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	SSD Installed and Windows installed all working [redacted]	SSD 256	2026-04-10 15:03:00	2026-04-10 15:36:39.373	\N	\N	\N	\N	\N	\N	2026-06-05 16:08:59.532
cmpmcm58i0005kz04ogpdluwq	EI-2026-0003	COMPLETED	EXTERNAL	org_eis_01	\N	cmpmcm50i0001kz04907ckjvr	cmpmcm5410003kz04gzabxgds	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_ANDROID	Samsung	S21 Ultra	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Phone wont install official WhatsApp	NONE	\N	Phone wont install Andrid official Apps -Whatsapp	\N	\N	RETURN_UNREPAIRED	NONE	\N	2026-07-30 13:02:23.561	NA	0.00	0.00	f	150000.00	f	\N	\N	\N	t	2026-05-26 08:17:41.717	cmns5jbas00002lfw97nnwshd	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	[redacted] Original software failed but they need new Board replacement	New Board	2026-05-25 11:03:00	2026-07-30 13:02:36.71	\N	\N	\N	\N	\N	\N	2026-07-30 13:03:23.035
cmq5btt3q0005kz040c821rqz	EI-2026-0013	CLOSED	EXTERNAL	org_eis_01	\N	cmq5btsu00001kz04gs7kwqll	cmq5btsz80003kz04xj5r9zxi	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 16 Pro max - Gold	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPhone wont charge	UNREPAIRABLE	After the client declined on basis of Price, we returned the device after a 50,000 diagnosis charge	iPhone wont Progressively charge	\N	\N	PROCEED_REPAIR	NONE	Client is skeptical of post repair issues - confident we should proceed	2026-06-08 14:51:41.525	Diagnosis still ongoing	700000.00	0.00	f	\N	f	\N	\N	\N	t	2026-06-16 13:18:12.047	cmns5jbas00002lfw97nnwshd	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Transfer Processor to another Logic Board to fix the charging issue since its been over repaired before Extra failure found that the iPhone [redacted] intermittently - Will need an extra bill to fix	Logic Board replacement	2026-06-05 16:48:00	\N	\N	\N	\N	\N	\N	2026-06-16 13:18:12.047	2026-06-16 13:18:12.048
cms65prca000bl404daeh0idg	EI-2026-0037	COMPLETED	IN_HOUSE	org_eis_01	\N	cms65pr6x0009l40444rvna1f	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	Macbook	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Water spilled on it yesterday	NONE	\N	Machine has a water spill	\N	\N	\N	NONE	\N	\N	NA	0.00	100000.00	f	\N	f	\N	\N	\N	t	2026-08-02 22:14:54.354	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-7/2026/0037	2026-07-30 12:57:35.762	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Alcohol [redacted]	NA	2026-07-29 14:05:12.49	2026-07-30 12:58:00.915	\N	\N	\N	\N	\N	\N	2026-08-02 22:14:54.428
cms65q5hk000jl404zid2jq7u	EI-2026-0038	COMPLETED	EXTERNAL	org_eis_01	\N	cmratfqe3000zkw04iv172urq	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	THINKBOOK	Unknown	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	There was lemonade spillage in the computer	NONE	\N	\N	Machine has a Spill,	\N	PROCEED_REPAIR	NONE	\N	2026-08-05 15:26:19.279	NA	30000.00	100000.00	f	\N	f	\N	\N	\N	f	\N	\N	\N	INV-EIS-8/2026/0038	2026-08-05 15:26:45.273	\N	\N	2026-07-29 14:08:44.273	QT-EI-2026-0038	\N	\N	\N	\N	\N	\N	[redacted] the Board to a non enhanced dry Tested all working as expected	NA	2026-07-29 14:05:30.825	2026-08-05 15:26:43.775	3	2026-11-05 15:26:43.775	\N	\N	\N	\N	2026-08-05 15:32:19.533
cmt2l4lgs0005jx04yvb82oo8	EIS/2026/0044	COMPLETED	EXTERNAL	org_eis_01	\N	cmt2l4l3j0001jx04pa3xz79t	cmt2l4l610003jx04rxx69hsv	cmns5nkty00012lme8d0os7dx	cmns5vd6400062lsig31tm6wk	MAC	Apple	A2338	\N	\N	Beer spill on the right side causing charging issues	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	He got a beer in the laptop and he continued using it as usual, but when the battery ran out, when he tried to recharge again, it wasn't charging.	OTHER	\N	\N	Beer spill in the laptop causing charging issues.	\N	PROCEED_REPAIR	NONE	\N	2026-08-25 15:59:04.904	NA	200000.00	300000.00	f	\N	t	2026-08-25 16:02:21.221	cmns5jbas00002lfw97nnwshd	\N	t	2026-08-25 16:01:58.21	cmns5jbas00002lfw97nnwshd	\N	EIS/INV/2026/0044	2026-08-25 16:01:22.231	\N	\N	\N	\N	2	\N	\N	\N	\N	\N	[redacted] the machine and fix Power	NA	2026-08-21 09:45:00	2026-08-25 16:01:21.477	\N	\N	\N	\N	\N	\N	2026-08-25 16:02:21.222
cmotx2kh10004js04gyz356jl	EIS-5/2026/0011	COMPLETED	EXTERNAL	org_eis_01	\N	cmotx2k6m0000js04npyykrqp	cmotx2kci0002js04ynut8w53	cmns5nlp700042lmerqro7219	cmns5vd6400062lsig31tm6wk	MAC	MacBook pro 2018 15 inches	A1990	S/N C02x	\N	Keeps [redacted]	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	it keeps [redacted]	NONE	\N	\N	Machine has EFI failure and and Firmware issue	\N	\N	NONE	\N	\N	EFI	150000.00	380000.00	f	150000.00	t	2026-05-07 16:11:38.606	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 05:37:00.158	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0011	2026-06-03 05:36:59.768	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replaced EFI, [redacted] system with Apple Configurator	EFI Chip	2026-05-06 13:30:00	2026-05-07 14:37:19.333	\N	\N	\N	PICKUP	\N	\N	2026-06-03 05:37:00.159
cmnyje50m0002l504rdwiruh6	EIS-4/2026/0014	COMPLETED	IN_HOUSE	org_eis_01	\N	cmnyjdki50000l504iksqfuv1	\N	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	TABLET	Apple	A1843	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Apple keyboard: main space bar and enter button on numeric keyboard are 'stuck' on one end 'raised up' on the other end.	NONE	\N	\N	\N	\N	PROCEED_REPAIR	NONE	Keyboard delivered by Ritah	2026-04-18 22:14:43.507	\N	20000.00	50000.00	f	\N	f	\N	\N	\N	t	2026-05-24 11:30:04.902	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0014	2026-05-10 09:36:05.906	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-14 11:27:06.214	2026-05-06 15:09:37.064	\N	\N	\N	DELIVERY	[redacted] Delivered to Kisementi	\N	2026-05-24 11:30:04.904
cmogy43mv0004l8046wgcw76x	EIS-4/2026/0019	COMPLETED	EXTERNAL	org_eis_01	\N	cmogy43fr0000l8046jorrnst	cmogy43iu0002l8044lfqaxoz	cmns5nlp700042lmerqro7219	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	hp ProBook 440	hp probook 440 G1	\N	none	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Note powering	NONE	\N	\N	The laptop was found to have paint contamination on the motherboard. As a result electrical power is not properly reaching the integrated circuits (ICs),preventing the machine from powering on	\N	PROCEED_REPAIR	NONE	\N	2026-04-27 09:39:37.068	\N	70000.00	180000.00	f	0.00	t	2026-06-05 15:14:07.386	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-05 15:13:39.22	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0019	2026-06-05 15:13:38.597	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-27 11:38:00	2026-04-28 12:58:02.961	\N	\N	\N	PICKUP	[redacted] [redacted]	\N	2026-06-05 15:14:07.387
cmoh5houk0002l4042cpk8nlw	EIS-4/2026/0021	COMPLETED	EXTERNAL	org_eis_01	\N	cmoh5hoq70000l404k2ftzok9	\N	cmns5jbas00002lfw97nnwshd	cmns5vd6400062lsig31tm6wk	MAC	Apple MacBook Pro	2017	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Auto powers off and freezes	NONE	\N	\N	Machine wont stay on consistently Further Diagnosis is pointing to a Logic Board issue	\N	\N	NONE	\N	\N	LogicBoard	350000.00	650000.00	f	0.00	t	2026-06-05 16:05:55.968	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-05 16:05:45.728	cmns5jbas00002lfw97nnwshd	\N	\N	2026-06-05 16:05:44.858	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Repairs on same logic board failed, Need to replace logic board	Logic Board	2026-04-27 12:05:34.604	2026-05-07 13:51:22.264	\N	\N	\N	PICKUP	[redacted]	\N	2026-06-05 16:05:55.968
cmoim4jhp0004l804jd1vspox	EIS-4/2026/0022	COMPLETED	EXTERNAL	org_eis_01	\N	cmoim4j9q0000l804pszxp1xn	cmoim4jdb0002l804dy4lco8y	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 13Pro Max	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Phone heats up, battery runs out too fast	NONE	\N	Battery Worn out	Battery Worn out	\N	\N	NONE	\N	\N	Battery Replacement	130000.00	220000.00	f	130000.00	t	2026-04-28 13:03:03.555	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 09:42:04.877	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0022	2026-06-02 15:41:58.869	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Battery replacement	Battery	2026-04-28 12:39:00.623	2026-04-28 13:03:59.025	\N	\N	\N	PICKUP	[redacted]	\N	2026-06-03 09:42:04.878
cmor9qqkw0004l704c3cbj82j	EIS-5/2026/0007	COMPLETED	IN_HOUSE	org_eis_01	\N	cmor9qqe70000l704sbyzxld9	cmor9qqh10002l704qx7sb5cm	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Air M3	\N	Case	\N	SOFTWARE	f	f	f	f	f	t	Ms office Installation	t	OTHER	\N	Ms office License issue	NONE	\N	Ms office license issue	\N	\N	\N	NONE	\N	\N	NA	0.00	80000.00	f	\N	f	\N	\N	\N	t	2026-06-03 05:31:25.887	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0007	2026-06-03 05:31:24.682	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Installed Office	NA	2026-05-04 17:02:00	2026-05-04 14:04:13.378	\N	\N	\N	PICKUP	[redacted]	\N	2026-06-03 05:31:25.888
cmor9zx400004l504vs4oykws	EIS-5/2026/0008	COMPLETED	IN_HOUSE	org_eis_01	\N	cmor9zwx30000l504pqrpadv4	cmor9zx030002l504bpd8e00z	cmns5jbas00002lfw97nnwshd	cmns5nnzs000f2lmeblzgrvrh	MAC	Apple	MacBook Air 2019	\N	Case	\N	SOFTWARE	t	f	t	t	f	f	\N	t	OPEN_SOURCE	\N	MacBook Wanted to be updated - never updated before	NONE	\N	Back up and reinstallation	\N	\N	\N	NONE	\N	\N	NA	0.00	50000.00	f	\N	f	\N	\N	\N	t	2026-06-03 05:38:34.681	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0008	2026-06-03 05:38:34.246	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Installed MacOS X Sonoma and Ms office	NA	2026-05-04 17:09:00	2026-05-05 10:55:55.032	\N	\N	\N	DELIVERY	[redacted]	\N	2026-06-03 05:38:34.682
cmora5dxz000eky04yfangbym	EIS-5/2026/0009	COMPLETED	EXTERNAL	org_eis_01	\N	cmora5dqm000aky04aeen65aa	cmora5dt0000cky0417oysgnm	cmns5jbas00002lfw97nnwshd	cmns5vd6400062lsig31tm6wk	MAC	Apple	MacBook Pro 13 2017	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	Machine doesn't power on	NONE	\N	\N	Machine wont Power On	\N	\N	NONE	\N	\N	NA	0.00	550000.00	f	0.00	t	2026-06-01 13:16:46.083	cmns5jbas00002lfw97nnwshd	\N	t	2026-08-06 20:22:10.7	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0009	2026-06-01 13:18:27.66	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Board Replacement after failed attempts to repair old board	Main logic Board replacement	2026-05-04 17:13:00	2026-05-30 13:58:59.939	\N	\N	\N	PICKUP	[redacted] [redacted]	\N	2026-08-06 20:22:10.78
cmoraeqna000pl504vmbmos7u	EIS-5/2026/0010	COMPLETED	EXTERNAL	org_eis_01	\N	cmoraeqfv000ll5047eq88izd	cmoraeqj6000nl504ojgf8nt5	cmns5jbas00002lfw97nnwshd	cmns5vc5200032lsil2f7rq0m	PHONE_IPHONE	Apple	iPhone 6s	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	iPhone has a battery issue	NONE	\N	Drained battery - Needs to be replaced	\N	\N	\N	NONE	\N	\N	Battery	35000.00	90000.00	f	0.00	t	2026-05-05 15:22:22.902	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 10:14:38.587	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0010	2026-06-03 05:37:42.605	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Replaced battery	Battery	2026-05-04 17:20:00	2026-05-04 14:22:40.115	\N	\N	\N	DELIVERY	[redacted]	\N	2026-06-03 10:14:38.588
cmnsu3ijh0002lb078t7sn6xy	EIS-4/2026/0001	COMPLETED	EXTERNAL	org_eis_01	\N	cmnsu3ifj0000lb0781yjo6cj	\N	cmns5jbas00002lfw97nnwshd	cmns5va4t00002lsis3rrj31k	WINDOWS_PC	HP	Hp Elite [redacted] 830 G8	\N	\N	\N	HARDWARE	f	f	f	f	f	f	\N	f	\N	\N	It heated up an blacked out. According to the user, and it has since refused to come up even after charging it. The user was attending Ann online class.	NONE	\N	\N	It needs bios updates bicoz power enters but it can not power on	\N	PROCEED_REPAIR	NONE	Client confirms that we proceed with the repair	2026-04-10 15:49:35.096	Firm ware	80000.00	150000.00	f	0.00	t	2026-04-13 16:24:25.902	cmns5jbas00002lfw97nnwshd	\N	t	2026-06-03 05:41:32.922	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-6/2026/0001	2026-06-03 05:41:32.337	\N	\N	\N	\N	1-2 hours	60	120	ESTIMATED	\N	\N	\N	\N	2026-04-10 11:40:09.245	2026-04-13 16:24:43.687	\N	\N	\N	DELIVERY	[redacted]	\N	2026-06-03 05:41:32.923
cmp0ze3it0004lb043j37ojgy	EIS-5/2026/0017	COMPLETED	\N	org_eis_01	\N	cmp0ze3b60000lb04a41a94y8	cmp0ze3ef0002lb04ujqmf16b	cmns5nkty00012lme8d0os7dx	\N	WINDOWS_PC	HP	Elite [redacted] 830 G6	\N	\N	\N	SOFTWARE	f	f	f	f	f	f	Office Installation	t	OPEN_SOURCE	\N	Office apps not working. flesh install needed	NONE	\N	Install of Office Apps	\N	\N	PROCEED_REPAIR	NONE	\N	2026-05-12 08:32:32.223	NA	0.00	120000.00	f	\N	f	\N	\N	\N	t	2026-06-01 13:14:40.833	cmns5jbas00002lfw97nnwshd	\N	INV-EIS-5/2026/0017	2026-05-29 20:37:10.852	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Install of Office Apps	NA	2026-05-11 12:09:00	2026-05-12 08:31:03.844	\N	\N	\N	DELIVERY	[redacted]	\N	2026-06-01 13:14:40.834
\.


--
-- Data for Name: JobAssignmentHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."JobAssignmentHistory" (id, "orgId", "jobId", "assignedToId", "assignedById", "assignmentType", "startedAt", "endedAt", note) FROM stdin;
\.


--
-- Data for Name: JobStatusHistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."JobStatusHistory" (id, "orgId", "jobId", "fromStatus", "toStatus", reason, "changedById", "changedAt", "metadataJson") FROM stdin;
cmsbmeehq000fjt044of8hadx	org_eis_01	cmotxn0s2000fjs04uihnur8z	READY_FOR_PICKUP	CLOSED	\N	cmns5jbas00002lfw97nnwshd	2026-08-02 09:51:06.975	\N
cmsf5n8f7000bla04phhcfx4c	org_eis_01	cmriyhnq50003l804ft3d3jgk	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-04 21:13:10.244	\N
cmsg8huag0007la04psh2ij94	org_eis_01	cms7gixy90003jo04s9gd3rpq	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:20:43.672	\N
cmsg8inrl000jla04wpy0qghj	org_eis_01	cms7gixy90003jo04s9gd3rpq	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:21:21.873	\N
cmsg8poxx000ijz0422wo6e75	org_eis_01	cms65q5hk000jl404zid2jq7u	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:26:49.989	\N
cmsg903il000bl204p92xox52	org_eis_01	cms65p1wt000bjt04eds8aj7f	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:34:55.437	\N
cmsg90t6k000vla04sbsfrpu4	org_eis_01	cms65p1wt000bjt04eds8aj7f	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:35:28.701	\N
cmsg95k1n0012jz04eldtnmdo	org_eis_01	cms65ob8f0003jt049xb0gvtv	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:39:10.14	\N
cmsg977kx0007id047nfvz158	org_eis_01	cms65ob8f0003jt049xb0gvtv	WAITING_FOR_PARTS	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:40:27.298	\N
cmsg98kpk000lid04eizmbq4c	org_eis_01	cms65ob8f0003jt049xb0gvtv	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:41:30.968	\N
cmsg9i1jb000ela04owf7gfl5	org_eis_01	cms65nsn30003l404ivvbxkkv	DIAGNOSING	REFERRED	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:48:52.679	\N
cmsg9obwv000ci804znwqflu4	org_eis_01	cms65nsn30003l404ivvbxkkv	REFERRED	IN_EXTERNAL_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:53:46.063	\N
cmsg9w0ky000jjr04biol20e7	org_eis_01	cms65nsn30003l404ivvbxkkv	IN_EXTERNAL_REPAIR	RETURNED_FROM_EXTERNAL	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 15:59:44.626	\N
cmsg9wddf000rjr04afv9dhj9	org_eis_01	cms65nsn30003l404ivvbxkkv	RETURNED_FROM_EXTERNAL	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 16:00:01.203	\N
cmsg9wula000zjr04atet7i8g	org_eis_01	cms65nsn30003l404ivvbxkkv	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 16:00:23.519	\N
cmsga4ju7000yid04mpiaxhqg	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 16:06:22.832	\N
cmsga6afr001cid04ini67s6e	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	WAITING_FOR_PARTS	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 16:07:43.96	\N
cmsga6rus001kid04cpj8782s	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-08-05 16:08:06.533	\N
cmsh7kvrc000jl804chwjjpuo	org_eis_01	cmsh7cf7x0003le04n0oj6n6l	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-06 07:42:52.104	\N
cmsh7lh3z000rl804g9lcn4p1	org_eis_01	cmsh7cf7x0003le04n0oj6n6l	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-06 07:43:19.776	\N
cmsh7oobw000dl404e73sm8eh	org_eis_01	cmsh7cf7x0003le04n0oj6n6l	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-06 07:45:49.101	\N
cmshqz8xi000bjm04c8451lsq	org_eis_01	cmshqrqp50003l504k4j3l3lr	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-06 16:45:55.063	\N
cmsmx5ack000cjp04yuazedb0	org_eis_01	cmshqrqp50003l504k4j3l3lr	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-10 07:37:25.412	\N
cmsmx5qo8000ljp040xi6ctg0	org_eis_01	cmshqrqp50003l504k4j3l3lr	IN_REPAIR	READY_FOR_PICKUP	\N	cmns5jbas00002lfw97nnwshd	2026-08-10 07:37:46.569	\N
cmsmx72l4000ujp04ifs326de	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	WAITING_FOR_PARTS	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-10 07:38:48.664	\N
cmsmx7w1f0013jp04hltkyk11	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	IN_REPAIR	READY_FOR_PICKUP	\N	cmns5jbas00002lfw97nnwshd	2026-08-10 07:39:26.835	\N
cmsn90s2t000clg04mo5nuzu6	org_eis_01	cmshqrqp50003l504k4j3l3lr	READY_FOR_PICKUP	COMPLETED	\N	cmns5nlp700042lmerqro7219	2026-08-10 13:09:50.502	\N
cmsq55mo8000al904oysrbw06	org_eis_01	cmrx4tb6t0005l604othosvz5	READY_FOR_PICKUP	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-12 13:44:56.841	\N
cmsqjp1ag000cla044i3e2fct	org_eis_01	cmrlt6nyo0003jr04ftpsm3rh	READY_FOR_PICKUP	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-12 20:31:56.873	\N
cmsrjptqw000qla045io3ecwp	org_eis_01	cmsrji9xl0003l80458lzg6s5	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-13 13:20:19.928	\N
cmsrjq7r1000zla0499i0o8b4	org_eis_01	cmsrji9xl0003l80458lzg6s5	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-13 13:20:38.078	\N
cmsrjs188001ela048zypxjg9	org_eis_01	cmsrji9xl0003l80458lzg6s5	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-08-13 13:22:02.937	\N
cmsrjyy3l0009ky04ctu5e3e2	org_eis_01	cmsrji9xl0003l80458lzg6s5	WAITING_FOR_PARTS	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-13 13:27:25.474	\N
cmsrjzahv000mky04e18dpnai	org_eis_01	cmsrji9xl0003l80458lzg6s5	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-13 13:27:41.54	\N
cmsrk3s1f001ola042m86x0ea	org_eis_01	cmsrk2mox0003l70498wl0fy3	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-13 13:31:10.899	\N
cmt8tujdz000hky04sh715l6k	org_eis_01	cmt8tu2ib0003ky0481qbonqu	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:36:00.936	\N
cmt8tvt7f000rky04upuk2ssv	org_eis_01	cmt8tu2ib0003ky0481qbonqu	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:37:00.316	\N
cmt8u2ak5000bjr04wsczrx60	org_eis_01	cmt7eivuy0003jn04a53ddidd	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:42:02.742	\N
cmt8u2lqn000kjl046u3jk6kq	org_eis_01	cmt7eivuy0003jn04a53ddidd	DIAGNOSING	REFERRED	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:42:17.232	\N
cmt8u351y000ljr04h3rlhio5	org_eis_01	cmt7eivuy0003jn04a53ddidd	REFERRED	AWAITING_APPROVAL	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:42:42.263	\N
cmt8u3gt3000vjr04lb17tkgf	org_eis_01	cmt7eivuy0003jn04a53ddidd	AWAITING_APPROVAL	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:42:57.496	\N
cmt8u3w19001ajr04z3eqs2cr	org_eis_01	cmt7eivuy0003jn04a53ddidd	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:43:17.229	\N
cmt8u7gk3001kjr04zfxt4yyg	org_eis_01	cmt7ar99w0003ju04c9er75u9	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:46:03.795	\N
cmt8u7qbc000bky04uilc05eg	org_eis_01	cmt7ar99w0003ju04c9er75u9	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:46:16.441	\N
cmt8u9jwz001xjr0418ufpzy7	org_eis_01	cmt7ar99w0003ju04c9er75u9	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:47:41.459	\N
cmt8ugg9t002hjl04fvkgz3dn	org_eis_01	cmt2mou050009la04jt0ezoar	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:53:03.329	\N
cmt8ugskc002rjl04akfdxnol	org_eis_01	cmt2mou050009la04jt0ezoar	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:53:19.261	\N
cmt8ujg3n001hky04u1ulyio3	org_eis_01	cmt2mou050009la04jt0ezoar	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:55:23.076	\N
cmt8uohxg0020ky04m959ks1a	org_eis_01	cmt2l4lgs0005jx04yvb82oo8	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:59:18.725	\N
cmt8uou1e002aky04i2636loi	org_eis_01	cmt2l4lgs0005jx04yvb82oo8	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 15:59:34.418	\N
cmt8ur7jw002cjr04zy3bj7bl	org_eis_01	cmt2l4lgs0005jx04yvb82oo8	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-25 16:01:25.245	\N
cmtbj5yw7000gjq044tnr7ui2	org_eis_01	cmt8tu2ib0003ky0481qbonqu	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-27 13:00:17	\N
cmtbj7l8u000vjq04jy4ffqwy	org_eis_01	cmt2l8ddo0003if04ga8b6mik	RECEIVED	DIAGNOSING	\N	cmns5jbas00002lfw97nnwshd	2026-08-27 13:01:32.622	\N
cmtbj9qwb000bl404b5vdhy17	org_eis_01	cmt2l8ddo0003if04ga8b6mik	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-27 13:03:13.26	\N
cmtbjcu0p000xla04lgsmicl8	org_eis_01	cmt2l8ddo0003if04ga8b6mik	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-08-27 13:05:37.274	\N
cmtcwpuw5000bie04s42kax1i	org_eis_01	cmnsumh3m0006if04hjdra1gm	IN_REPAIR	CLOSED	\N	cmns5jbas00002lfw97nnwshd	2026-08-28 12:07:26.118	\N
cmtcws2yt000gjr04caf2oep7	org_eis_01	cmo4wu4i6000al1042i4g5car	IN_REPAIR	COMPLETED	\N	cmns5jbas00002lfw97nnwshd	2026-08-28 12:09:09.893	\N
cmtcwu0ms0019jr04gimn0hum	org_eis_01	cmor28wvg0007ld040vdce04z	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-28 12:10:40.18	\N
cmthezeqb0007jv042axcjeyc	org_eis_01	cmsrk2mox0003l70498wl0fy3	DIAGNOSING	IN_REPAIR	\N	cmns5jbas00002lfw97nnwshd	2026-08-31 15:49:49.524	\N
cmtl1lxkk0009l7048npt2cs9	org_eis_01	cmsrk2mox0003l70498wl0fy3	IN_REPAIR	WAITING_FOR_PARTS	\N	cmns5jbas00002lfw97nnwshd	2026-09-03 04:46:30.452	\N
cmtochcg60007l104wbf0oqae	org_eis_01	cmtoceeb40005i804u5rgkbbh	RECEIVED	DIAGNOSING	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 12:14:10.758	\N
\.


--
-- Data for Name: JournalEntry; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."JournalEntry" (id, "orgId", "entryNumber", date, description, reference, status, "totalAmount", "createdById", "postedAt", "createdAt", "updatedAt") FROM stdin;
cmshf5ewh000ll504roo5dyzd	org_eis_01	JE-2026-0001	2026-08-06 11:14:47.069	Payment received (receipt EIS/RCT/2026/0002)	pay:cmshf5dt00003l5048b537t1w	POSTED	300000.00	cmns5nlp700042lmerqro7219	2026-08-06 11:14:47.344	2026-08-06 11:14:47.345	2026-08-06 11:14:47.345
cmshypclu0007ju058dt29hdn	org_eis_01	JE-2026-0002	2026-08-06 20:22:10.044	Payment received (receipt EIS/RCT/2026/0003)	pay:cmshypc0s0003ju05x5dikxq1	POSTED	500000.00	cmns5jbas00002lfw97nnwshd	2026-08-06 20:22:10.194	2026-08-06 20:22:10.195	2026-08-06 20:22:10.195
cmsj681bd0007la04js7qymjo	org_eis_01	JE-2026-0003	2026-08-07 16:40:25.381	Payment received (receipt EIS/RCT/2026/0004)	pay:cmsj680s30003la04u7yndvl9	POSTED	1588.00	cmns5jbas00002lfw97nnwshd	2026-08-07 16:40:25.512	2026-08-07 16:40:25.513	2026-08-07 16:40:25.513
cmsq54jkf0007kw04gxikih0n	org_eis_01	JE-2026-0004	2026-08-12 13:44:06.037	Payment received (receipt EIS/RCT/2026/0005)	pay:cmsq54j3c0003kw04x5dfq9h9	POSTED	200000.00	cmns5jbas00002lfw97nnwshd	2026-08-12 13:44:06.158	2026-08-12 13:44:06.159	2026-08-12 13:44:06.159
cmsq57jnl0007ju044j3oi3qz	org_eis_01	JE-2026-0005	2026-08-12 13:46:26.114	Payment received (receipt EIS/RCT/2026/0006)	pay:cmsq57j5t0003ju041ldbyfyl	POSTED	440000.00	cmns5jbas00002lfw97nnwshd	2026-08-12 13:46:26.241	2026-08-12 13:46:26.242	2026-08-12 13:46:26.242
cmsz05sgj000pl80405a474x3	org_eis_01	JE-2026-0006	2026-08-18 18:35:01.705	Payment received (receipt EIS/RCT/2026/0007)	pay:cmsz05rui000ll804mv8mx5jl	POSTED	2260000.00	cmns5nlp700042lmerqro7219	2026-08-18 18:35:01.842	2026-08-18 18:35:01.843	2026-08-18 18:35:01.843
cmsz09v810009js04bjwo6xa0	org_eis_01	JE-2026-0007	2026-08-18 18:38:11.911	Payment received (receipt EIS/RCT/2026/0008)	pay:cmsz09umv0005js0493nrcu22	POSTED	60000.00	cmns5nlp700042lmerqro7219	2026-08-18 18:38:12.048	2026-08-18 18:38:12.049	2026-08-18 18:38:12.049
cmsz0baze0005lc044mbfttnc	org_eis_01	JE-2026-0008	2026-08-18 18:39:19.007	Payment received (receipt EIS/RCT/2026/0009)	pay:cmsz0bag60001lc04ovo0pp9e	POSTED	80000.00	cmns5nlp700042lmerqro7219	2026-08-18 18:39:19.129	2026-08-18 18:39:19.131	2026-08-18 18:39:19.131
cmsz0jfyy0005ld04j30rpixh	org_eis_01	JE-2026-0009	2026-08-18 18:45:38.703	Payment received (receipt EIS/RCT/2026/0010)	pay:cmsz0jfce0001ld04hkyp2z9j	POSTED	200000.00	cmns5nlp700042lmerqro7219	2026-08-18 18:45:38.841	2026-08-18 18:45:38.842	2026-08-18 18:45:38.842
cmsz0lg79000eld04xyk9pwou	org_eis_01	JE-2026-0010	2026-08-18 18:47:12.29	Payment received (receipt EIS/RCT/2026/0011)	pay:cmsz0lfkc000ald049jp4gekb	POSTED	370000.00	cmns5nlp700042lmerqro7219	2026-08-18 18:47:12.452	2026-08-18 18:47:12.453	2026-08-18 18:47:12.453
cmsz0m2za000nld04xo48de5z	org_eis_01	JE-2026-0011	2026-08-18 18:47:41.829	Payment received (receipt EIS/RCT/2026/0012)	pay:cmsz0m2ey000jld041entljn3	POSTED	1874.00	cmns5nlp700042lmerqro7219	2026-08-18 18:47:41.973	2026-08-18 18:47:41.974	2026-08-18 18:47:41.974
cmt2mbend000bk204ly9b9myc	org_eis_01	JE-2026-0012	2026-08-21 07:18:33.824	Payment received (receipt EIS/RCT/2026/0013)	pay:cmt2mbdzw0007k2045ce096tw	POSTED	10000.00	cmns5nkty00012lme8d0os7dx	2026-08-21 07:18:33.96	2026-08-21 07:18:33.961	2026-08-21 07:18:33.961
cmt2mg8oa0005jy049sqy70qn	org_eis_01	JE-2026-0013	2026-08-21 07:22:19.372	Payment received (receipt EIS/RCT/2026/0014)	pay:cmt2mg81h0001jy04jli73dw5	POSTED	719800.00	cmns5jbas00002lfw97nnwshd	2026-08-21 07:22:19.497	2026-08-21 07:22:19.499	2026-08-21 07:22:19.499
cmt2n6t620005kw04pihi9spo	org_eis_01	JE-2026-0014	2026-08-21 07:42:58.972	Payment received (receipt EIS/RCT/2026/0015)	pay:cmt2n6sfk0001kw0481dq62ch	POSTED	24000000.00	cmns5jbas00002lfw97nnwshd	2026-08-21 07:42:59.113	2026-08-21 07:42:59.114	2026-08-21 07:42:59.114
cmt33g97y0005l304aikvvabd	org_eis_01	JE-2026-0015	2026-08-21 15:18:13.555	Payment received (receipt EIS/RCT/2026/0016)	pay:cmt33g8k60001l304cf9ivfiu	POSTED	80000.00	cmns5nkty00012lme8d0os7dx	2026-08-21 15:18:13.678	2026-08-21 15:18:13.679	2026-08-21 15:18:13.679
cmt33jz2z0009jl04vaz3q0ri	org_eis_01	JE-2026-0016	2026-08-21 15:21:07.035	Payment received (receipt EIS/RCT/2026/0017)	pay:cmt33jyf50005jl04ozeud9xr	POSTED	50000.00	cmns5nkty00012lme8d0os7dx	2026-08-21 15:21:07.162	2026-08-21 15:21:07.163	2026-08-21 15:21:07.163
cmt33lkxd000il304zs84dhbc	org_eis_01	JE-2026-0017	2026-08-21 15:22:21.995	Payment received (receipt EIS/RCT/2026/0018)	pay:cmt33lk8d000el304f7bu0abg	POSTED	20000.00	cmns5nkty00012lme8d0os7dx	2026-08-21 15:22:22.128	2026-08-21 15:22:22.129	2026-08-21 15:22:22.129
cmt34ixrg0007l8049cis3w87	org_eis_01	JE-2026-0018	2026-08-21 15:48:18.273	Payment received (receipt EIS/RCT/2026/0019)	pay:cmt34ix2f0003l804c68j9xfq	POSTED	20000.00	cmns5nkty00012lme8d0os7dx	2026-08-21 15:48:18.412	2026-08-21 15:48:18.413	2026-08-21 15:48:18.413
cmt45mudk0007ky048q0ho65k	org_eis_01	JE-2026-0019	2026-08-22 09:07:06.298	Payment received (receipt EIS/RCT/2026/0020)	pay:cmt45mtnu0003ky048snzcjsv	POSTED	100000.00	cmns5nkty00012lme8d0os7dx	2026-08-22 09:07:06.44	2026-08-22 09:07:06.44	2026-08-22 09:07:06.44
cmt8u4eck000rjl040t9zjhcx	org_eis_01	JE-2026-0020	2026-08-25 15:43:40.831	Payment received (receipt EIS/RCT/2026/0021)	pay:cmt8u4do8000njl044o0o6j6s	POSTED	40000.00	cmns5jbas00002lfw97nnwshd	2026-08-25 15:43:40.964	2026-08-25 15:43:40.965	2026-08-25 15:43:40.965
cmt8u938f001bjl04rqc9prru	org_eis_01	JE-2026-0021	2026-08-25 15:47:19.706	Payment received (receipt EIS/RCT/2026/0022)	pay:cmt8u91w00017jl04j852sisk	POSTED	100000.00	cmns5jbas00002lfw97nnwshd	2026-08-25 15:47:19.838	2026-08-25 15:47:19.839	2026-08-25 15:47:19.839
cmt8urwnp0030jl049t81ixvv	org_eis_01	JE-2026-0022	2026-08-25 16:01:57.638	Payment received (receipt EIS/RCT/2026/0023)	pay:cmt8urvxd002wjl045wod0m22	POSTED	300000.00	cmns5jbas00002lfw97nnwshd	2026-08-25 16:01:57.781	2026-08-25 16:01:57.782	2026-08-25 16:01:57.782
cmt8uselg002gjr046txv6k38	org_eis_01	JE-2026-0023	2026-08-25 16:02:20.899	Technician payout · EIS/2026/0044	techpay:cmt8useax002ejr0475fx07rs	POSTED	200000.00	cmns5jbas00002lfw97nnwshd	2026-08-25 16:02:21.028	2026-08-25 16:02:21.029	2026-08-25 16:02:21.029
cmt8utwqu003djl047iav9pfk	org_eis_01	JE-2026-0024	2026-08-25 16:03:31.068	Technician payout · EIS/2026/0041	techpay:cmt8utwfz003bjl04rk9mabro	POSTED	280000.00	cmns5jbas00002lfw97nnwshd	2026-08-25 16:03:31.206	2026-08-25 16:03:31.207	2026-08-25 16:03:31.207
bf3xg57olxbjmta4jgfj	org_eis_01	JE-BF-0026	2026-06-05 00:00:00	Expense EXP-2026-0002 — Shop Rent (backfill)	expense:cmq12sekb0001js04vfkdqw15	POSTED	935000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:05.839	2026-08-26 13:23:05.839	2026-08-26 13:23:05.839
bfds90kbobtdmta4jhfh	org_eis_01	JE-BF-0027	2026-06-04 00:00:00	Expense EXP-2026-0003 — Jeilo's salary (backfill)	expense:cmq12tmlh0001l204m1t71678	POSTED	500000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:07.133	2026-08-26 13:23:07.133	2026-08-26 13:23:07.133
bfjib9wdqq7fmta4jlo0	org_eis_01	JE-BF-0030	2026-06-05 00:00:00	Expense EXP-2026-0006 — Delivery fees (backfill)	expense:cmq12ylcq0007k104hd29ileo	POSTED	40000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:12.624	2026-08-26 13:23:12.624	2026-08-26 13:23:12.624
bfpqvk0mxa2kmta4jmns	org_eis_01	JE-BF-0031	2026-06-05 00:00:00	Expense EXP-2026-0007 — Director's Lunch and fruits (backfill)	expense:cmq12zy060007l204oz50xdyy	POSTED	13000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:13.912	2026-08-26 13:23:13.912	2026-08-26 13:23:13.912
bfoe05tcdtyjmta4joo7	org_eis_01	JE-BF-0032	2026-06-01 00:00:00	Expense EXP-2026-0008 — Milo Media (backfill)	expense:cmq130swa000al204mybh2vqb	POSTED	60000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:16.519	2026-08-26 13:23:16.519	2026-08-26 13:23:16.519
bfrd6vat99i3mta4jqk0	org_eis_01	JE-BF-0034	2026-06-01 00:00:00	Expense EXP-2026-0010 — Generator Fuel (backfill)	expense:cmq132wq00004l804l83lbt78	POSTED	20000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:18.96	2026-08-26 13:23:18.96	2026-08-26 13:23:18.96
bfhupz024h56mta4jsp5	org_eis_01	JE-BF-0035	2026-06-05 00:00:00	Expense EXP-2026-0011 — Generator maintenance (backfill)	expense:cmq134qag0007l80423488tw2	POSTED	50000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:21.737	2026-08-26 13:23:21.737	2026-08-26 13:23:21.737
bfgerxql3v6kmta4juqp	org_eis_01	JE-BF-0037	2026-06-09 00:00:00	Expense EXP-2026-0013 — Dell Charge-Zawedi (backfill)	expense:cmq6oowno0001jy04an51mqi8	POSTED	50000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:24.385	2026-08-26 13:23:24.385	2026-08-26 13:23:24.385
bfup8f0c2wb4mta4jvqo	org_eis_01	JE-BF-0038	2026-06-09 00:00:00	Expense EXP-2026-0014 — Taxes & Licenses (backfill)	expense:cmq6pb48s0006ld04c9k49rtl	POSTED	263000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:25.68	2026-08-26 13:23:25.68	2026-08-26 13:23:25.68
cmtbjj3q0000rjn04ftd77iqh	org_eis_01	JE-2026-0025	2026-08-27 13:10:29.647	Payment received (receipt EIS/RCT/2026/0024)	pay:cmtbjj325000njn04o6svmjw1	POSTED	610000.00	cmns5jbas00002lfw97nnwshd	2026-08-27 13:10:29.783	2026-08-27 13:10:29.784	2026-08-27 13:10:29.784
cmtbjjrzk0014jn0495vkz9n1	org_eis_01	JE-2026-0026	2026-08-27 13:11:01.098	Technician payout · EI-2026-0029	techpay:cmtbjjror0012jn04uc3qecdv	POSTED	230000.00	cmns5jbas00002lfw97nnwshd	2026-08-27 13:11:01.231	2026-08-27 13:11:01.232	2026-08-27 13:11:01.232
cmtcwsoqh000qjr041nlw2fau	org_eis_01	JE-2026-0027	2026-08-28 12:09:37.966	Payment received (receipt EIS/RCT/2026/0025)	pay:cmtcwso3o000mjr04afb4o7lt	POSTED	400000.00	cmns5jbas00002lfw97nnwshd	2026-08-28 12:09:38.104	2026-08-28 12:09:38.105	2026-08-28 12:09:38.105
cmtd3uwzi000ajr04etzvcw86	org_eis_01	JE-2026-0028	2026-08-28 15:27:19.28	Payment received (receipt EIS/RCT/2026/0026)	pay:cmtd3uwam0006jr043e7v9x6r	POSTED	250000.00	cmns5jbas00002lfw97nnwshd	2026-08-28 15:27:19.422	2026-08-28 15:27:19.423	2026-08-28 15:27:19.423
cmtd46r5g000aju04k243wbuf	org_eis_01	JE-2026-0029	2026-08-28 15:36:31.584	Payment received (receipt EIS/RCT/2026/0027)	pay:cmtd46qgq0006ju04ckh74byy	POSTED	50000.00	cmns5jbas00002lfw97nnwshd	2026-08-28 15:36:31.731	2026-08-28 15:36:31.732	2026-08-28 15:36:31.732
cmtd97wzl0005js046g78jtr8	org_eis_01	JE-2026-0030	2026-08-28 17:57:23.869	Payment received (receipt EIS/RCT/2026/0028)	pay:cmtd97w8v0001js04brp25p6u	POSTED	1220000.00	cmns5jbas00002lfw97nnwshd	2026-08-28 17:57:24.032	2026-08-28 17:57:24.033	2026-08-28 17:57:24.033
cmtfhafx50007ic04bmazsjz5	org_eis_01	JE-2026-0031	2026-08-30 07:18:51.023	Payment received (receipt EIS/RCT/2026/0029)	pay:cmtfhaf5a0001ic0440r4tkq1	POSTED	650000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:18:51.16	2026-08-30 07:18:51.161	2026-08-30 07:18:51.161
cmtfhcfzt000gic04y4cdktmv	org_eis_01	JE-2026-0032	2026-08-30 07:20:24.436	Payment received (receipt EIS/RCT/2026/0030)	pay:cmtfhcfb0000cic0427n8flf0	POSTED	450000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:20:24.568	2026-08-30 07:20:24.569	2026-08-30 07:20:24.569
cmtfig5l30003ky04ictkkm6q	org_eis_01	JE-2026-0033	2026-08-30 07:51:17.181	Refund against invoice cmt8ujde80016ky043ck12zdi	refund:cmtfig4x70001ky042uzsbg69	POSTED	450000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:51:17.318	2026-08-30 07:51:17.319	2026-08-30 07:51:17.319
cmtfiml4v0003l20450tm988x	org_eis_01	JE-2026-0034	2026-08-30 07:56:17.284	Reversal — receipt/payment deleted	pay:cmtfhcfb0000cic0427n8flf0:reversal	POSTED	450000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:56:17.406	2026-08-30 07:56:17.408	2026-08-30 07:56:17.408
cmtfin6rp0001la041lzbqb01	org_eis_01	JE-2026-0035	2026-08-30 07:56:45.32	Reversal — refund deleted	refund:cmtfig4x70001ky042uzsbg69:reversal	POSTED	450000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:56:45.444	2026-08-30 07:56:45.446	2026-08-30 07:56:45.446
cmtfiokm50009l204j47mktl9	org_eis_01	JE-2026-0036	2026-08-30 07:57:49.902	Reversal — receipt/payment deleted	pay:cmtfhaf5a0001ic0440r4tkq1:reversal	POSTED	650000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:57:50.044	2026-08-30 07:57:50.045	2026-08-30 07:57:50.045
cmtfipnvi0005le04phj5cfk9	org_eis_01	JE-2026-0037	2026-08-30 07:58:40.761	Payment received (receipt EIS/RCT/2026/0031)	pay:cmtfipn390001le04qjczs5yt	POSTED	450000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 07:58:40.925	2026-08-30 07:58:40.926	2026-08-30 07:58:40.926
cmtfiue9q000ele049cyk1ha0	org_eis_01	JE-2026-0038	2026-08-30 08:02:21.629	Payment received (receipt EIS/RCT/2026/0032)	pay:cmtfiudmp000ale04ohxi6bsn	POSTED	100000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 08:02:21.757	2026-08-30 08:02:21.758	2026-08-30 08:02:21.758
cmtfiwian000nle049kvkyc4j	org_eis_01	JE-2026-0039	2026-08-30 08:04:00.154	Payment received (receipt EIS/RCT/2026/0033)	pay:cmtfiwhm9000jle04sjyqmtoi	POSTED	40000.00	cmns5jbas00002lfw97nnwshd	2026-08-30 08:04:00.286	2026-08-30 08:04:00.287	2026-08-30 08:04:00.287
cmtoeffge000dl404e62jfzdq	org_eis_01	JE-2026-0040	2026-09-05 13:08:40.437	Payment received (receipt EIS/RCT/2026/0034)	pay:cmtoefer70009l404bwtyr6fb	POSTED	30000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:08:40.574	2026-09-05 13:08:40.575	2026-09-05 13:08:40.575
cmtoeg2y3000bkv04bu0b81n7	org_eis_01	JE-2026-0041	2026-09-05 13:09:10.881	Payment received (receipt EIS/RCT/2026/0035)	pay:cmtoeg28z0007kv04040tmcv2	POSTED	100000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:09:11.018	2026-09-05 13:09:11.019	2026-09-05 13:09:11.019
cmtoegour000gl404vhvikumu	org_eis_01	JE-2026-0042	2026-09-05 13:09:39.274	Payment received (receipt EIS/RCT/2026/0036)	pay:cmtoego5i000cl404lelzft8m	POSTED	120000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:09:39.411	2026-09-05 13:09:39.411	2026-09-05 13:09:39.411
cmtof5ruu0005k0041sdcz18h	org_eis_01	JE-2026-0043	2026-09-05 13:29:09.574	Payment received (receipt EIS/RCT/2026/0037)	pay:cmtof5r8d0001k0045jb5lj42	POSTED	60000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:29:09.702	2026-09-05 13:29:09.703	2026-09-05 13:29:09.703
cmtof82qd000bie0436zns8kd	org_eis_01	JE-2026-0044	2026-09-05 13:30:56.97	Payment received (receipt EIS/RCT/2026/0038)	pay:cmtof82080007ie04vrx4p0cd	POSTED	380000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:30:57.108	2026-09-05 13:30:57.109	2026-09-05 13:30:57.109
cmtof9jxx0009jo04fugplf21	org_eis_01	JE-2026-0045	2026-09-05 13:32:05.936	Payment received (receipt EIS/RCT/2026/0039)	pay:cmtof9j9y0005jo04j6gl936z	POSTED	25000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:32:06.068	2026-09-05 13:32:06.069	2026-09-05 13:32:06.069
cmtofbkz2000ik0046ycoxwyk	org_eis_01	JE-2026-0046	2026-09-05 13:33:40.59	Payment received (receipt EIS/RCT/2026/0040)	pay:cmtofbkbt000ek0049lfbewd7	POSTED	70000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:33:40.717	2026-09-05 13:33:40.718	2026-09-05 13:33:40.718
cmtofecui000rk004ewktv1fm	org_eis_01	JE-2026-0047	2026-09-05 13:35:50.028	Payment received (receipt EIS/RCT/2026/0041)	pay:cmtofec81000nk004rsdc6pxb	POSTED	100000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:35:50.154	2026-09-05 13:35:50.155	2026-09-05 13:35:50.155
cmtofh0f6000mie04es1fueue	org_eis_01	JE-2026-0048	2026-09-05 13:37:53.894	Payment received (receipt EIS/RCT/2026/0042)	pay:cmtofgzno000iie04q9xljms1	POSTED	50000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:37:54.018	2026-09-05 13:37:54.019	2026-09-05 13:37:54.019
cmtofiaai0009ju040c685dhn	org_eis_01	JE-2026-0049	2026-09-05 13:38:53.336	Payment received (receipt EIS/RCT/2026/0043)	pay:cmtofi9ms0005ju04vrpbkp38	POSTED	40000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:38:53.465	2026-09-05 13:38:53.466	2026-09-05 13:38:53.466
cmtofkdjq000oju0479q7d4jw	org_eis_01	JE-2026-0050	2026-09-05 13:40:30.861	Payment received (receipt EIS/RCT/2026/0044)	pay:cmtofkcuq000kju04o5e2bnwf	POSTED	20000.00	cmns5nkty00012lme8d0os7dx	2026-09-05 13:40:30.997	2026-09-05 13:40:30.998	2026-09-05 13:40:30.998
cmtr0fo3o0005l704ribmyqlx	org_eis_01	JE-2026-0051	2026-09-07 09:00:15.529	Payment received (receipt EIS/RCT/2026/0045)	pay:cmtr0fn9i0001l704qnig1ga3	POSTED	20000.00	cmns5nkty00012lme8d0os7dx	2026-09-07 09:00:15.684	2026-09-07 09:00:15.685	2026-09-07 09:00:15.685
cmtr0gt2s000el704xhyqe6jt	org_eis_01	JE-2026-0052	2026-09-07 09:01:08.661	Payment received (receipt EIS/RCT/2026/0046)	pay:cmtr0gsgg000al704ccsjz6ws	POSTED	30000.00	cmns5nkty00012lme8d0os7dx	2026-09-07 09:01:08.788	2026-09-07 09:01:08.789	2026-09-07 09:01:08.789
cmtr7gmb80006l504t5hkhtm3	org_eis_01	JE-2026-0053	2026-09-07 12:16:57.199	Payment received (receipt EIS/RCT/2026/0047)	pay:cmtr7glm80002l5045m6k6rei	POSTED	180000.00	cmns5jbas00002lfw97nnwshd	2026-09-07 12:16:57.332	2026-09-07 12:16:57.333	2026-09-07 12:16:57.333
cmtr7hj8k0003la04exyam8p7	org_eis_01	JE-2026-0054	2026-09-07 12:17:39.872	Technician payout · EI-2026-0025	techpay:cmtr7hixf0001la0401rhmvc7	POSTED	100000.00	cmns5jbas00002lfw97nnwshd	2026-09-07 12:17:40.003	2026-09-07 12:17:40.004	2026-09-07 12:17:40.004
cmtr7mm10000qla04468obxyp	org_eis_01	JE-2026-0055	2026-09-07 12:21:36.771	Payment received (receipt EIS/RCT/2026/0048)	pay:cmtr7mleo000mla04pmycr7fh	POSTED	120000.00	cmns5jbas00002lfw97nnwshd	2026-09-07 12:21:36.9	2026-09-07 12:21:36.901	2026-09-07 12:21:36.901
cmtr7nc8r0003jx04812fwf1k	org_eis_01	JE-2026-0056	2026-09-07 12:22:10.753	Technician payout · EI-2026-0033	techpay:cmtr7nby70001jx04mqu0pezb	POSTED	30000.00	cmns5jbas00002lfw97nnwshd	2026-09-07 12:22:10.875	2026-09-07 12:22:10.876	2026-09-07 12:22:10.876
cmtrarycy0003l10480t1h98l	org_eis_01	JE-2026-0057	2026-09-07 13:49:44.883	Technician payout · EIS/2026/0046	techpay:cmtrary220001l104rsm7whsm	POSTED	150000.00	cmns5jbas00002lfw97nnwshd	2026-09-07 13:49:45.01	2026-09-07 13:49:45.011	2026-09-07 13:49:45.011
cmtsin3io0005jo04r4s2s5la	org_eis_01	JE-2026-0058	2026-09-08 10:17:41.381	Payment received (receipt EIS/RCT/2026/0049)	pay:cmtsin24i0001jo04da3z15vz	POSTED	3800000.00	cmns5jbas00002lfw97nnwshd	2026-09-08 10:17:41.519	2026-09-08 10:17:41.52	2026-09-08 10:17:41.52
bflahcvz21zqmta4jfer	org_eis_01	JE-BF-0025	2026-06-05 00:00:00	Expense EXP-2026-0001 — [redacted]'s Salary (backfill)	expense:cmq12qyxy0001k1048wqdz798	POSTED	200000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:04.515	2026-08-26 13:23:04.515	2026-08-26 13:23:04.515
bfe3u2mxb0n6mta4jjlp	org_eis_01	JE-BF-0028	2026-06-04 00:00:00	Expense EXP-2026-0004 — [redacted]'s Allowance (backfill)	expense:cmq12vq7n0004l2049to85iye	POSTED	50000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:09.949	2026-08-26 13:23:09.949	2026-08-26 13:23:09.949
bftcq7blvt7jmta4jkmn	org_eis_01	JE-BF-0029	2026-06-04 00:00:00	Expense EXP-2026-0005 — [redacted]'s Allowance (backfill)	expense:cmq12x0ux0004k104ketbrzh6	POSTED	20000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:11.279	2026-08-26 13:23:11.279	2026-08-26 13:23:11.279
bfa5fcog7bunmta4jpl3	org_eis_01	JE-BF-0033	2026-06-02 00:00:00	Expense EXP-2026-0009 — [redacted] facilitation (backfill)	expense:cmq131wc90001l804bnp49tq9	POSTED	20000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:17.703	2026-08-26 13:23:17.703	2026-08-26 13:23:17.703
bf5a7ik4wjwumta4jtps	org_eis_01	JE-BF-0036	2026-06-09 00:00:00	Expense EXP-2026-0012 — Garbage & [redacted] (backfill)	expense:cmq6ogp850001jl04lncov6wx	POSTED	25000.00	cmns5nlp700042lmerqro7219	2026-08-26 13:23:23.056	2026-08-26 13:23:23.056	2026-08-26 13:23:23.056
\.


--
-- Data for Name: JournalLine; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."JournalLine" (id, "journalEntryId", "accountId", debit, credit, description) FROM stdin;
cmshf5ewh000nl504e5g9cw6e	cmshf5ewh000ll504roo5dyzd	cmshf5edt0008l504pyvnm9qp	300000.00	0.00	Cash received
cmshf5ewh000ol504mg6f6yxp	cmshf5ewh000ll504roo5dyzd	cmshf5ejf000el504inx6qykg	0.00	300000.00	Sales revenue
cmshypclv0009ju05o4iub73u	cmshypclu0007ju058dt29hdn	cmshf5edt0008l504pyvnm9qp	500000.00	0.00	Cash received
cmshypclv000aju05lnzh67og	cmshypclu0007ju058dt29hdn	cmshf5ejf000el504inx6qykg	0.00	500000.00	Sales revenue
cmsj681bd0009la04fp8xsv34	cmsj681bd0007la04js7qymjo	cmshf5edt0008l504pyvnm9qp	1588.00	0.00	Cash received
cmsj681bd000ala04m3hov4nk	cmsj681bd0007la04js7qymjo	cmshf5ejf000el504inx6qykg	0.00	1588.00	Sales revenue
cmsq54jkf0009kw04h8uhoarr	cmsq54jkf0007kw04gxikih0n	cmshf5edt0008l504pyvnm9qp	200000.00	0.00	Cash received
cmsq54jkf000akw04nwzzf2ud	cmsq54jkf0007kw04gxikih0n	cmshf5ejf000el504inx6qykg	0.00	200000.00	Sales revenue
cmsq57jnl0009ju04dqker0al	cmsq57jnl0007ju044j3oi3qz	cmshf5edt0008l504pyvnm9qp	440000.00	0.00	Cash received
cmsq57jnl000aju04p2uutpnq	cmsq57jnl0007ju044j3oi3qz	cmshf5ejf000el504inx6qykg	0.00	440000.00	Sales revenue
cmsz05sgj000rl804fupgee9p	cmsz05sgj000pl80405a474x3	cmshf5edt0008l504pyvnm9qp	2260000.00	0.00	Cash received
cmsz05sgj000sl804enlrqo74	cmsz05sgj000pl80405a474x3	cmshf5ejf000el504inx6qykg	0.00	2260000.00	Sales revenue
cmsz09v81000bjs04ynafw3ii	cmsz09v810009js04bjwo6xa0	cmshf5edt0008l504pyvnm9qp	60000.00	0.00	Cash received
cmsz09v81000cjs04eg5tvkzn	cmsz09v810009js04bjwo6xa0	cmshf5ejf000el504inx6qykg	0.00	60000.00	Sales revenue
cmsz0baze0007lc04de8d05x8	cmsz0baze0005lc044mbfttnc	cmshf5edt0008l504pyvnm9qp	80000.00	0.00	Cash received
cmsz0baze0008lc04ct2i4lp7	cmsz0baze0005lc044mbfttnc	cmshf5ejf000el504inx6qykg	0.00	80000.00	Sales revenue
cmsz0jfyy0007ld04pgta0lvm	cmsz0jfyy0005ld04j30rpixh	cmshf5edt0008l504pyvnm9qp	200000.00	0.00	Cash received
cmsz0jfyy0008ld048s7dnt85	cmsz0jfyy0005ld04j30rpixh	cmshf5ejf000el504inx6qykg	0.00	200000.00	Sales revenue
cmsz0lg79000gld04saw6qfo1	cmsz0lg79000eld04xyk9pwou	cmshf5edt0008l504pyvnm9qp	370000.00	0.00	Cash received
cmsz0lg79000hld04oy211x2p	cmsz0lg79000eld04xyk9pwou	cmshf5ejf000el504inx6qykg	0.00	370000.00	Sales revenue
cmsz0m2za000pld04mpan892i	cmsz0m2za000nld04xo48de5z	cmshf5edt0008l504pyvnm9qp	1874.00	0.00	Cash received
cmsz0m2za000qld040fwgqa2x	cmsz0m2za000nld04xo48de5z	cmshf5ejf000el504inx6qykg	0.00	1874.00	Sales revenue
cmt2mbend000dk204ji25jo85	cmt2mbend000bk204ly9b9myc	cmshf5edt0008l504pyvnm9qp	10000.00	0.00	Cash received
cmt2mbend000ek20467iyy4nc	cmt2mbend000bk204ly9b9myc	cmshf5ejf000el504inx6qykg	0.00	10000.00	Sales revenue
cmt2mg8oa0007jy04n1pacp5i	cmt2mg8oa0005jy049sqy70qn	cmshf5edt0008l504pyvnm9qp	719800.00	0.00	Cash received
cmt2mg8oa0008jy04s8cso2rt	cmt2mg8oa0005jy049sqy70qn	cmshf5ejf000el504inx6qykg	0.00	719800.00	Sales revenue
cmt2n6t620007kw04jh1vp6fr	cmt2n6t620005kw04pihi9spo	cmshf5edt0008l504pyvnm9qp	24000000.00	0.00	Cash received
cmt2n6t620008kw04v11z2ad8	cmt2n6t620005kw04pihi9spo	cmshf5ejf000el504inx6qykg	0.00	24000000.00	Sales revenue
cmt33g97y0007l304w6u80q98	cmt33g97y0005l304aikvvabd	cmshf5edt0008l504pyvnm9qp	80000.00	0.00	Cash received
cmt33g97y0008l304j03iggk7	cmt33g97y0005l304aikvvabd	cmshf5ejf000el504inx6qykg	0.00	80000.00	Sales revenue
cmt33jz2z000bjl04la1b1q0j	cmt33jz2z0009jl04vaz3q0ri	cmshf5edt0008l504pyvnm9qp	50000.00	0.00	Cash received
cmt33jz2z000cjl04zhkaobr1	cmt33jz2z0009jl04vaz3q0ri	cmshf5ejf000el504inx6qykg	0.00	50000.00	Sales revenue
cmt33lkxd000kl304xpb8eeck	cmt33lkxd000il304zs84dhbc	cmshf5edt0008l504pyvnm9qp	20000.00	0.00	Cash received
cmt33lkxd000ll304theq5qoe	cmt33lkxd000il304zs84dhbc	cmshf5ejf000el504inx6qykg	0.00	20000.00	Sales revenue
cmt34ixrg0009l804lnp8pzsu	cmt34ixrg0007l8049cis3w87	cmshf5edt0008l504pyvnm9qp	20000.00	0.00	Cash received
cmt34ixrg000al8043rap84dp	cmt34ixrg0007l8049cis3w87	cmshf5ejf000el504inx6qykg	0.00	20000.00	Sales revenue
cmt45mudk0009ky04zgthfdcn	cmt45mudk0007ky048q0ho65k	cmshf5edt0008l504pyvnm9qp	100000.00	0.00	Cash received
cmt45mudk000aky04zwq6vu9r	cmt45mudk0007ky048q0ho65k	cmshf5ejf000el504inx6qykg	0.00	100000.00	Sales revenue
cmt8u4eck000tjl04sjoyftu8	cmt8u4eck000rjl040t9zjhcx	cmshf5edt0008l504pyvnm9qp	40000.00	0.00	Cash received
cmt8u4eck000ujl04ubd1fheq	cmt8u4eck000rjl040t9zjhcx	cmshf5ejf000el504inx6qykg	0.00	40000.00	Sales revenue
cmt8u938f001djl04lao8v86b	cmt8u938f001bjl04rqc9prru	cmshf5edt0008l504pyvnm9qp	100000.00	0.00	Cash received
cmt8u938f001ejl04axt4iaoe	cmt8u938f001bjl04rqc9prru	cmshf5ejf000el504inx6qykg	0.00	100000.00	Sales revenue
cmt8urwnp0032jl04yevzhphj	cmt8urwnp0030jl049t81ixvv	cmshf5edt0008l504pyvnm9qp	300000.00	0.00	Cash received
cmt8urwnp0033jl04j1glkrgo	cmt8urwnp0030jl049t81ixvv	cmshf5ejf000el504inx6qykg	0.00	300000.00	Sales revenue
cmt8uselg002ijr04n0i6m3t6	cmt8uselg002gjr046txv6k38	cmshf5en0000il504cttdo136	200000.00	0.00	Technician labour
cmt8uselg002jjr04azzygfof	cmt8uselg002gjr046txv6k38	cmshf5edt0008l504pyvnm9qp	0.00	200000.00	Cash paid to technician
cmt8utwqu003fjl046osrxwmg	cmt8utwqu003djl047iav9pfk	cmshf5en0000il504cttdo136	280000.00	0.00	Technician labour
cmt8utwqu003gjl04cmxoqh6b	cmt8utwqu003djl047iav9pfk	cmshf5edt0008l504pyvnm9qp	0.00	280000.00	Cash paid to technician
bfh9t5d2pg1hmta4jfqh	bflahcvz21zqmta4jfer	cmshf5en0000il504cttdo136	200000.00	0.00	Operating expense
bfc1hz1p1y47mta4jfz4	bflahcvz21zqmta4jfer	cmshf5edt0008l504pyvnm9qp	0.00	200000.00	Cash paid
bfx7ue4ro7olmta4jgp1	bf3xg57olxbjmta4jgfj	cmshf5en0000il504cttdo136	935000.00	0.00	Operating expense
bf9vtinbutnbmta4jgxj	bf3xg57olxbjmta4jgfj	cmshf5edt0008l504pyvnm9qp	0.00	935000.00	Cash paid
bfixlbmanytjmta4jhns	bfds90kbobtdmta4jhfh	cmshf5en0000il504cttdo136	500000.00	0.00	Operating expense
bfap465ynkl3mta4jhzh	bfds90kbobtdmta4jhfh	cmshf5edt0008l504pyvnm9qp	0.00	500000.00	Cash paid
bfiv2apq7kf5mta4jjvb	bfe3u2mxb0n6mta4jjlp	cmshf5en0000il504cttdo136	50000.00	0.00	Operating expense
bfoxgij0chuhmta4jk3r	bfe3u2mxb0n6mta4jjlp	cmshf5edt0008l504pyvnm9qp	0.00	50000.00	Cash paid
bfimohtpiawfmta4jkv7	bftcq7blvt7jmta4jkmn	cmshf5en0000il504cttdo136	20000.00	0.00	Operating expense
bfiugwz9xtvymta4jl7w	bftcq7blvt7jmta4jkmn	cmshf5edt0008l504pyvnm9qp	0.00	20000.00	Cash paid
bfh4wkgoh17qmta4jlyb	bfjib9wdqq7fmta4jlo0	cmshf5en0000il504cttdo136	40000.00	0.00	Operating expense
bf2jjbtop2h8mta4jm6k	bfjib9wdqq7fmta4jlo0	cmshf5edt0008l504pyvnm9qp	0.00	40000.00	Cash paid
bfuqd0gy3jprmta4jner	bfpqvk0mxa2kmta4jmns	cmshf5en0000il504cttdo136	13000.00	0.00	Operating expense
bfz58uhgvwy0mta4jo5w	bfpqvk0mxa2kmta4jmns	cmshf5edt0008l504pyvnm9qp	0.00	13000.00	Cash paid
bfjjvct7xm5rmta4jowl	bfoe05tcdtyjmta4joo7	cmshf5en0000il504cttdo136	60000.00	0.00	Operating expense
bfp6cl2t8bz1mta4jp4x	bfoe05tcdtyjmta4joo7	cmshf5edt0008l504pyvnm9qp	0.00	60000.00	Cash paid
bfrc3mh6f4w2mta4jpuu	bfa5fcog7bunmta4jpl3	cmshf5en0000il504cttdo136	20000.00	0.00	Operating expense
bfd15d3jlz99mta4jq34	bfa5fcog7bunmta4jpl3	cmshf5edt0008l504pyvnm9qp	0.00	20000.00	Cash paid
bfi7pjfvoqdmmta4jqsa	bfrd6vat99i3mta4jqk0	cmshf5en0000il504cttdo136	20000.00	0.00	Operating expense
bfexjk7h9zc2mta4jr0k	bfrd6vat99i3mta4jqk0	cmshf5edt0008l504pyvnm9qp	0.00	20000.00	Cash paid
bf3ic32cibw4mta4jsxg	bfhupz024h56mta4jsp5	cmshf5en0000il504cttdo136	50000.00	0.00	Operating expense
bfn9y791an1qmta4jt74	bfhupz024h56mta4jsp5	cmshf5edt0008l504pyvnm9qp	0.00	50000.00	Cash paid
bf25hz64thn8mta4jty2	bf5a7ik4wjwumta4jtps	cmshf5en0000il504cttdo136	25000.00	0.00	Operating expense
bft8r01zhl2smta4ju8f	bf5a7ik4wjwumta4jtps	cmshf5edt0008l504pyvnm9qp	0.00	25000.00	Cash paid
bfgh8c7fgrqimta4jv10	bfgerxql3v6kmta4juqp	cmshf5en0000il504cttdo136	50000.00	0.00	Operating expense
bfjdhw9b0o4fmta4jv9c	bfgerxql3v6kmta4juqp	cmshf5edt0008l504pyvnm9qp	0.00	50000.00	Cash paid
bfakcgrimsxamta4jwky	bfup8f0c2wb4mta4jvqo	cmshf5en0000il504cttdo136	263000.00	0.00	Operating expense
bfmv8u76etb3mta4jxcw	bfup8f0c2wb4mta4jvqo	cmshf5edt0008l504pyvnm9qp	0.00	263000.00	Cash paid
cmtbjj3q0000tjn04ibablhmz	cmtbjj3q0000rjn04ftd77iqh	cmshf5edt0008l504pyvnm9qp	610000.00	0.00	Cash received
cmtbjj3q0000ujn04v6ylhvkx	cmtbjj3q0000rjn04ftd77iqh	cmshf5ejf000el504inx6qykg	0.00	610000.00	Sales revenue
cmtbjjrzk0016jn04isjedhr8	cmtbjjrzk0014jn0495vkz9n1	cmshf5en0000il504cttdo136	230000.00	0.00	Technician labour
cmtbjjrzk0017jn04apurshjn	cmtbjjrzk0014jn0495vkz9n1	cmshf5edt0008l504pyvnm9qp	0.00	230000.00	Cash paid to technician
cmtcwsoqh000sjr045h29knje	cmtcwsoqh000qjr041nlw2fau	cmshf5edt0008l504pyvnm9qp	400000.00	0.00	Cash received
cmtcwsoqh000tjr04szdichtc	cmtcwsoqh000qjr041nlw2fau	cmshf5ejf000el504inx6qykg	0.00	400000.00	Sales revenue
cmtd3uwzi000cjr04008zw61g	cmtd3uwzi000ajr04etzvcw86	cmshf5edt0008l504pyvnm9qp	250000.00	0.00	Cash received
cmtd3uwzi000djr04dw03m8vt	cmtd3uwzi000ajr04etzvcw86	cmshf5ejf000el504inx6qykg	0.00	250000.00	Sales revenue
cmtd46r5g000cju04siq2cli3	cmtd46r5g000aju04k243wbuf	cmshf5edt0008l504pyvnm9qp	50000.00	0.00	Cash received
cmtd46r5g000dju040kx6u7cg	cmtd46r5g000aju04k243wbuf	cmshf5ejf000el504inx6qykg	0.00	50000.00	Sales revenue
cmtd97wzl0007js04rs76h3p6	cmtd97wzl0005js046g78jtr8	cmshf5edt0008l504pyvnm9qp	1220000.00	0.00	Cash received
cmtd97wzl0008js049geqbf0d	cmtd97wzl0005js046g78jtr8	cmshf5ejf000el504inx6qykg	0.00	1220000.00	Sales revenue
cmtfhafx50009ic04jedk4kdw	cmtfhafx50007ic04bmazsjz5	cmshf5edt0008l504pyvnm9qp	650000.00	0.00	Cash received
cmtfhafx5000aic046hfxidar	cmtfhafx50007ic04bmazsjz5	cmshf5ejf000el504inx6qykg	0.00	650000.00	Sales revenue
cmtfhcfzt000iic04vkqaun22	cmtfhcfzt000gic04y4cdktmv	cmshf5edt0008l504pyvnm9qp	450000.00	0.00	Cash received
cmtfhcfzt000jic04u9vwm97v	cmtfhcfzt000gic04y4cdktmv	cmshf5ejf000el504inx6qykg	0.00	450000.00	Sales revenue
cmtfig5l30005ky04gd415yz6	cmtfig5l30003ky04ictkkm6q	cmshf5ejf000el504inx6qykg	450000.00	0.00	Refund of sales revenue
cmtfig5l30006ky04qhq4fojy	cmtfig5l30003ky04ictkkm6q	cmshf5edt0008l504pyvnm9qp	0.00	450000.00	Cash refunded
cmtfiml4v0005l204wwu0cjor	cmtfiml4v0003l20450tm988x	cmshf5edt0008l504pyvnm9qp	0.00	450000.00	Cash received
cmtfiml4v0006l204iubjvidx	cmtfiml4v0003l20450tm988x	cmshf5ejf000el504inx6qykg	450000.00	0.00	Sales revenue
cmtfin6rp0003la04po952csp	cmtfin6rp0001la041lzbqb01	cmshf5ejf000el504inx6qykg	0.00	450000.00	Refund of sales revenue
cmtfin6rp0004la04jihm9d4q	cmtfin6rp0001la041lzbqb01	cmshf5edt0008l504pyvnm9qp	450000.00	0.00	Cash refunded
cmtfiokm5000bl204dalutdby	cmtfiokm50009l204j47mktl9	cmshf5edt0008l504pyvnm9qp	0.00	650000.00	Cash received
cmtfiokm5000cl20465in5rij	cmtfiokm50009l204j47mktl9	cmshf5ejf000el504inx6qykg	650000.00	0.00	Sales revenue
cmtfipnvi0007le04puvn6w9j	cmtfipnvi0005le04phj5cfk9	cmshf5edt0008l504pyvnm9qp	450000.00	0.00	Cash received
cmtfipnvi0008le044tz9mro4	cmtfipnvi0005le04phj5cfk9	cmshf5ejf000el504inx6qykg	0.00	450000.00	Sales revenue
cmtfiue9q000gle04uyzx0lpg	cmtfiue9q000ele049cyk1ha0	cmshf5edt0008l504pyvnm9qp	100000.00	0.00	Cash received
cmtfiue9q000hle04m0k5nn00	cmtfiue9q000ele049cyk1ha0	cmshf5ejf000el504inx6qykg	0.00	100000.00	Sales revenue
cmtfiwian000ple048w7crgli	cmtfiwian000nle049kvkyc4j	cmshf5edt0008l504pyvnm9qp	40000.00	0.00	Cash received
cmtfiwian000qle04e4kfw8ph	cmtfiwian000nle049kvkyc4j	cmshf5ejf000el504inx6qykg	0.00	40000.00	Sales revenue
cmtoeffge000fl404tev8hs3t	cmtoeffge000dl404e62jfzdq	cmshf5edt0008l504pyvnm9qp	30000.00	0.00	Cash received
cmtoeffge000gl404mm6q2xjw	cmtoeffge000dl404e62jfzdq	cmshf5ejf000el504inx6qykg	0.00	30000.00	Sales revenue
cmtoeg2y3000dkv043dz70hlm	cmtoeg2y3000bkv04bu0b81n7	cmshf5edt0008l504pyvnm9qp	100000.00	0.00	Cash received
cmtoeg2y3000ekv046l2ujvm9	cmtoeg2y3000bkv04bu0b81n7	cmshf5ejf000el504inx6qykg	0.00	100000.00	Sales revenue
cmtoegour000il404izvj0zpu	cmtoegour000gl404vhvikumu	cmshf5edt0008l504pyvnm9qp	120000.00	0.00	Cash received
cmtoegour000jl404uz58u84x	cmtoegour000gl404vhvikumu	cmshf5ejf000el504inx6qykg	0.00	120000.00	Sales revenue
cmtof5ruu0007k004abk7fsi4	cmtof5ruu0005k0041sdcz18h	cmshf5edt0008l504pyvnm9qp	60000.00	0.00	Cash received
cmtof5ruu0008k004y4iba6ie	cmtof5ruu0005k0041sdcz18h	cmshf5ejf000el504inx6qykg	0.00	60000.00	Sales revenue
cmtof82qd000die04s8ykppdp	cmtof82qd000bie0436zns8kd	cmshf5edt0008l504pyvnm9qp	380000.00	0.00	Cash received
cmtof82qd000eie04zb250vro	cmtof82qd000bie0436zns8kd	cmshf5ejf000el504inx6qykg	0.00	380000.00	Sales revenue
cmtof9jxx000bjo04qtbukqjm	cmtof9jxx0009jo04fugplf21	cmshf5edt0008l504pyvnm9qp	25000.00	0.00	Cash received
cmtof9jxx000cjo041jxl8dml	cmtof9jxx0009jo04fugplf21	cmshf5ejf000el504inx6qykg	0.00	25000.00	Sales revenue
cmtofbkz2000kk004rs9xrt08	cmtofbkz2000ik0046ycoxwyk	cmshf5edt0008l504pyvnm9qp	70000.00	0.00	Cash received
cmtofbkz2000lk0047zb5nadn	cmtofbkz2000ik0046ycoxwyk	cmshf5ejf000el504inx6qykg	0.00	70000.00	Sales revenue
cmtofecuj000tk004uponl3qm	cmtofecui000rk004ewktv1fm	cmshf5edt0008l504pyvnm9qp	100000.00	0.00	Cash received
cmtofecuj000uk004fpml1fz6	cmtofecui000rk004ewktv1fm	cmshf5ejf000el504inx6qykg	0.00	100000.00	Sales revenue
cmtofh0f6000oie0489moaozk	cmtofh0f6000mie04es1fueue	cmshf5edt0008l504pyvnm9qp	50000.00	0.00	Cash received
cmtofh0f7000pie04wyjc5s3g	cmtofh0f6000mie04es1fueue	cmshf5ejf000el504inx6qykg	0.00	50000.00	Sales revenue
cmtofiaai000bju04a3tfm1gd	cmtofiaai0009ju040c685dhn	cmshf5edt0008l504pyvnm9qp	40000.00	0.00	Cash received
cmtofiaai000cju047e7mwv6m	cmtofiaai0009ju040c685dhn	cmshf5ejf000el504inx6qykg	0.00	40000.00	Sales revenue
cmtofkdjq000qju04v9tmmx7i	cmtofkdjq000oju0479q7d4jw	cmshf5edt0008l504pyvnm9qp	20000.00	0.00	Cash received
cmtofkdjq000rju046qj9nr02	cmtofkdjq000oju0479q7d4jw	cmshf5ejf000el504inx6qykg	0.00	20000.00	Sales revenue
cmtr0fo3p0007l704bbctvjvs	cmtr0fo3o0005l704ribmyqlx	cmshf5edt0008l504pyvnm9qp	20000.00	0.00	Cash received
cmtr0fo3p0008l7041l3bmt3g	cmtr0fo3o0005l704ribmyqlx	cmshf5ejf000el504inx6qykg	0.00	20000.00	Sales revenue
cmtr0gt2t000gl704h0ltftly	cmtr0gt2s000el704xhyqe6jt	cmshf5edt0008l504pyvnm9qp	30000.00	0.00	Cash received
cmtr0gt2t000hl704z6qwr5hp	cmtr0gt2s000el704xhyqe6jt	cmshf5ejf000el504inx6qykg	0.00	30000.00	Sales revenue
cmtr7gmb80008l5041jib0b8r	cmtr7gmb80006l504t5hkhtm3	cmshf5edt0008l504pyvnm9qp	180000.00	0.00	Cash received
cmtr7gmb80009l504bqmo6duz	cmtr7gmb80006l504t5hkhtm3	cmshf5ejf000el504inx6qykg	0.00	180000.00	Sales revenue
cmtr7hj8k0005la041qp0wrum	cmtr7hj8k0003la04exyam8p7	cmshf5en0000il504cttdo136	100000.00	0.00	Technician labour
cmtr7hj8k0006la048trsj840	cmtr7hj8k0003la04exyam8p7	cmshf5edt0008l504pyvnm9qp	0.00	100000.00	Cash paid to technician
cmtr7mm10000sla04s0qag9td	cmtr7mm10000qla04468obxyp	cmshf5edt0008l504pyvnm9qp	120000.00	0.00	Cash received
cmtr7mm10000tla0498k8hnm3	cmtr7mm10000qla04468obxyp	cmshf5ejf000el504inx6qykg	0.00	120000.00	Sales revenue
cmtr7nc8s0005jx045kazu5sd	cmtr7nc8r0003jx04812fwf1k	cmshf5en0000il504cttdo136	30000.00	0.00	Technician labour
cmtr7nc8s0006jx04eac3unp6	cmtr7nc8r0003jx04812fwf1k	cmshf5edt0008l504pyvnm9qp	0.00	30000.00	Cash paid to technician
cmtrarycy0005l104x4a1ikjr	cmtrarycy0003l10480t1h98l	cmshf5en0000il504cttdo136	150000.00	0.00	Technician labour
cmtrarycy0006l104q0kcubig	cmtrarycy0003l10480t1h98l	cmshf5edt0008l504pyvnm9qp	0.00	150000.00	Cash paid to technician
cmtsin3io0007jo04cmkbzowv	cmtsin3io0005jo04r4s2s5la	cmshf5edt0008l504pyvnm9qp	3800000.00	0.00	Cash received
cmtsin3io0008jo048tyinorc	cmtsin3io0005jo04r4s2s5la	cmshf5ejf000el504inx6qykg	0.00	3800000.00	Sales revenue
\.


--
-- Data for Name: Lead; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Lead" (id, "orgId", "branchId", "fullName", phone, email, organization, interest, source, status, "estimatedValue", score, notes, "lostReason", "clientId", "assignedToId", "createdById", "convertedAt", "closedAt", "followUpAt", "createdAt", "updatedAt") FROM stdin;
cmq111uaf000jjm04dbnseuij	org_eis_01	\N	Lead FE7746	+256730061941	lead-fe7746cb@example.test	Meridian Tobacco	Desktop i7/16.1TB SSD & 32Inch monitor	PHONE	WON	7000000.00	0	Send Options and Client confirms	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-06-10 13:43:24.928	\N	\N	2026-06-05 14:36:22.551	2026-06-10 13:43:24.929
cmt8rpnfn0001jm0487x3f0ux	org_eis_01	\N	Lead 4C1E5D	+256745344015	lead-4c1e5d0a@example.test	School	\N	WALK_IN	NEW	\N	0	Trying to connect with the it department	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:36:13.668	2026-08-25 14:36:13.668
cmt9wrmsq0001la04b34bgwpw	org_eis_01	\N	Lead 737A2B	+256764583702	\N	\N	\N	WALK_IN	NEW	\N	0	Has dell laptop that he will soon send to us for repair	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-26 09:45:30.41	2026-08-26 09:45:30.41
cmtbj559r0008la04yer4lclh	org_eis_01	\N	Lead 232DC9	+256702159892	\N	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 12:59:38.608	2026-08-27 12:59:38.608
cmtbjk45g001djn04g1rg3s8i	org_eis_01	\N	Lead 62237C	+256754407983	\N	\N	\N	WALK_IN	NEW	\N	0	Promising computer upgrade client	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 13:11:16.996	2026-08-27 13:11:16.996
cmth6g95c0001jo049iplt4f5	org_eis_01	\N	Lead F40193	+256752067911	lead-f4019339@example.test	Conch gas	\N	WALK_IN	NEW	\N	0	Kindly write an email	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:50:58.896	2026-08-31 11:50:58.896
cmth6hxau0001l404cn96vm2w	org_eis_01	\N	Lead 5630E7	+256781302576	lead-5630e73a@example.test	[redacted]	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:52:16.854	2026-08-31 11:52:16.854
cmth6rsa00009jo04loq90bxr	org_eis_01	\N	Lead 7CC024	+256737203671	lead-7cc02400@example.test	Africa coffe academy	\N	WALK_IN	NEW	\N	0	They need server storage system	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:59:56.904	2026-08-31 11:59:56.904
cmth6tifl0005l404zxe3raqv	org_eis_01	\N	Lead 94C579	+256707449681	lead-94c5792c@example.test	Sethro uganda Ltd	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:01:17.458	2026-08-31 12:01:17.458
cmth6ul52000djo045edj8clo	org_eis_01	\N	Lead 212753	+256780924905	\N	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:02:07.622	2026-08-31 12:02:07.622
cmth6vkby0009l404ohxb7s9o	org_eis_01	\N	Lead 052060	+256705146831	lead-052060e6@example.test	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:02:53.23	2026-08-31 12:02:53.23
cmth76gdv0009la04iuhxxg64	org_eis_01	\N	Lead F44337	+256707692117	lead-f443373f@example.test	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:11:21.332	2026-08-31 12:11:21.332
cmtjso7xs0001ld04j1vs3v57	org_eis_01	\N	Lead 94EC04	+256759262215	lead-94ec04c6@example.test	The life plus hub	Computer maintenance	WALK_IN	NEW	\N	0	They encouraged us to do pre.qualification the previous service providers contract is ending this month	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-09-02 07:48:34.481	2026-09-02 07:48:34.481
cmpv9ae150001jx04n8r458xo	org_eis_01	\N	Lead B34B20	+256769034408	\N	\N	Cheap Machines	SOCIAL_MEDIA	CONTACTED	500000.00	0	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	\N	\N	2026-06-01 13:40:21.257	2026-06-01 13:56:59.703
cmpw832w60001js04k3dky732	org_eis_01	\N	Lead C76F33	+256753314927	\N	Bio 7 information centre	He asked about computer accessories	PHONE	NEW	\N	0	He has a very large internet cafe center around kasese town . He does alot of tech business . He could be apotential prospect	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-06-02 05:54:26.791	2026-06-02 05:54:26.791
cmpw85n750001jk049zmlu9g4	org_eis_01	\N	Lead 5D8264	+256700628783	\N	Bio 7 information centre	He asked about computer accessories	PHONE	LOST	\N	0	Potentail prospect	Other	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	2026-06-05 16:31:03.969	\N	2026-06-02 05:56:26.417	2026-06-05 16:31:03.97
cmth758h80005la04tqnbsrto	org_eis_01	\N	Lead EB6A99	+256703850860	\N	GMT [redacted]	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:10:24.428	2026-08-31 12:10:24.428
cmpw835d40001i5047qmh4dim	org_eis_01	\N	Lead 16DAC0	+256701566524	\N	Bio 7 information centre	He asked about computer accessories	PHONE	LOST	\N	0	He has a very large internet cafe center around kasese town . He does alot of tech business . He could be apotential prospect	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	2026-08-30 18:48:06.869	\N	2026-06-02 05:54:29.992	2026-08-30 18:48:06.87
cmq114o4b0007l504lwjtawfd	org_eis_01	\N	Lead A41931	+256794981825	\N	AVSI	Adobe	PHONE	NEW	\N	0	Convert Current Account to Old instead of Education	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	\N	\N	2026-06-05 14:38:34.524	2026-06-05 14:38:34.524
cmq14q8er0001jr04ko4pesgs	org_eis_01	\N	Lead EDBD18	+256783818290	\N	UHRC	APC Smart-UPS RT 15kVA RM 230V, Model SURT15KRMXLI	WALK_IN	QUALIFIED	45000000.00	0	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	\N	\N	2026-06-05 16:19:19.443	2026-06-25 14:08:01.607
cmq15a23y0007jo04mwd6qsr4	org_eis_01	\N	Lead E5AA91	+256719485611	\N	\N	Low Price laptop	SOCIAL_MEDIA	LOST	500000.00	0	\N	No budget	\N	\N	cmns5jbas00002lfw97nnwshd	\N	2026-06-10 13:44:14.542	\N	2026-06-05 16:34:44.398	2026-06-10 13:44:14.543
cmq15bqq40001l204fitx80qh	org_eis_01	\N	Lead 0085CD	+256710888111	\N	\N	Laptop Hp Options	SOCIAL_MEDIA	LOST	1200000.00	0	\N	Chose competitor	\N	\N	cmns5jbas00002lfw97nnwshd	\N	2026-06-09 15:58:30.826	\N	2026-06-05 16:36:02.956	2026-06-09 15:58:30.827
cms7pphdk0001jo04y45g2n1q	org_eis_01	\N	Lead 621707	+256743161560	lead-621707da@example.test	Human company	He asked about computer accessories	OTHER	NEW	8.00	0	Visited their office at opposite tagore building in kamokya	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	2026-07-30 00:00:00	2026-07-30 16:12:38.072	2026-07-30 16:12:38.072
cms7psy6y0001kz0425fvcxb2	org_eis_01	\N	Lead E609B8	+256762957864	lead-e609b8c2@example.test	Windle international	He asked about computer accessories	OTHER	NEW	10.00	0	Visited windle international head office in kamokya mawanda Road	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	2026-07-30 00:00:00	2026-07-30 16:15:19.834	2026-07-30 16:15:19.834
cmt8rg2nk0001jp04l8t84uvu	org_eis_01	\N	Lead 2E422E	+256776867676	\N	\N	\N	WALK_IN	NEW	\N	0	Phone update	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:28:46.833	2026-08-25 14:28:46.833
cmt8rh96r0001jr042fagyabs	org_eis_01	\N	Lead A8BBD6	+256754335082	\N	\N	\N	WALK_IN	NEW	\N	0	Hp laptop upgrade	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:29:41.955	2026-08-25 14:29:41.955
cmt8rjpvl0005jr0401sizeys	org_eis_01	\N	Lead 946542	+256785980437	\N	\N	\N	WALK_IN	NEW	\N	0	He needs a desktop in the near future	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:31:36.897	2026-08-25 14:31:36.897
cmpwdad7m0001l404dm61ni5h	org_eis_01	\N	Lead A9A1BB	+256731540187	\N	Bulindo [redacted]	\N	WALK_IN	NEW	\N	0	She has one machine that needs windows update and antivirus installation. I gave her the costs and she told me to wait whenever she is readh with the 50k go pick it and do that work	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-06-02 08:20:04.834	2026-06-02 08:20:04.834
cmt8re4cv0001ju04w7rwjrwg	org_eis_01	\N	Lead A28067	+256734754533	\N	[redacted] shop	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:27:15.727	2026-08-25 14:27:15.727
cmt8re7p30005ju04ohzkh4pz	org_eis_01	\N	Lead A584B0	+256752472800	\N	[redacted] shop	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:27:20.056	2026-08-25 14:27:20.056
cmt8reait0009ju040grolcgz	org_eis_01	\N	Lead BEC742	+256756930975	\N	[redacted] shop	\N	WALK_IN	CONTACTED	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:27:23.718	2026-08-30 19:00:48.613
cmt8rn29h000dju043k2ocxp0	org_eis_01	\N	Lead 244CB1	+256798694633	lead-244cb12e@example.test	School	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-25 14:34:12.917	2026-08-25 14:34:12.917
cmt9t6jul0001l304p6p9j84z	org_eis_01	\N	Lead 024B72	+256708398880	lead-024b7203@example.test	Spen administrator	\N	WALK_IN	NEW	\N	0	They have a service provider but we can always switch minds	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-26 08:05:07.966	2026-08-26 08:05:07.966
cmtbd5stc0001l904wupbtt1i	org_eis_01	\N	Lead 65F254	+256776491130	\N	\N	\N	WALK_IN	NEW	\N	0	They need a double coloured printer	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 10:12:11.425	2026-08-27 10:12:11.425
cmtbj8bac000jla04p6ci7yin	org_eis_01	\N	Lead 1EEA31	+256720131119	\N	\N	\N	WALK_IN	NEW	\N	0	Hoh	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 13:02:06.372	2026-08-27 13:02:06.372
cmtbjdtoq0012la04qy3k72io	org_eis_01	\N	Lead 3F9CFB	+256778322389	\N	\N	\N	WALK_IN	NEW	\N	0	Cameras	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 13:06:23.498	2026-08-27 13:06:23.498
cmtbjf7v30002jn048gc0fuxm	org_eis_01	\N	Lead 0FA6E6	+256739084203	\N	\N	\N	WALK_IN	NEW	\N	0	Laptop	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 13:07:28.528	2026-08-27 13:07:28.528
cmtbjllxo000fl404za16kbdx	org_eis_01	\N	Lead 735651	+256747609412	\N	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 13:12:26.701	2026-08-27 13:12:26.701
cmtbjmnb4000jl404mk06npfm	org_eis_01	\N	Lead F61EA7	+256760404369	\N	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-27 13:13:15.136	2026-08-27 13:13:15.136
cmth61hr20001kz048v07wt51	org_eis_01	\N	Lead B343C4	+256758019206	lead-b343c42f@example.test	\N	\N	WALK_IN	NEW	\N	0	Kindly give them an intriductory email	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:39:30.206	2026-08-31 11:39:30.206
cmth68fyh0001ju04k7s3ob6p	org_eis_01	\N	Lead 9CBFDE	+256743752087	lead-9cbfde3a@example.test	The orthodontist	\N	WALK_IN	NEW	\N	0	Reach out in an email	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:44:54.473	2026-08-31 11:44:54.473
cmth6l0om0005jo04quoid0jc	org_eis_01	\N	Lead 8EB211	+256721373683	lead-8eb211ae@example.test	Clinic master	Computer supplies and repairs	WALK_IN	NEW	\N	0	They will need the prescribed services soon	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:54:41.206	2026-08-31 11:54:41.206
cmth6nbkx0001la04tatw7jft	org_eis_01	\N	Lead D7AD3C	+256773680129	lead-d7ad3c54@example.test	Clinic master	\N	WALK_IN	NEW	\N	0	Need our services . We need serious engagement	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:56:28.641	2026-08-31 11:56:28.641
cmth6pbel0001k104yc1nb1ba	org_eis_01	\N	Lead A9AB74	+256703047652	lead-a9ab7419@example.test	Utya	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:58:01.725	2026-08-31 11:58:01.725
cmth6y8qp0005k104ka87then	org_eis_01	\N	Lead 3782CF	+256786622115	lead-3782cf7d@example.test	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:04:58.178	2026-08-31 12:04:58.178
cmth70d82000hjo04fsezcxzm	org_eis_01	\N	Lead EE1640	+256735198068	lead-ee16404f@example.test	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:06:37.298	2026-08-31 12:06:37.298
cmth71wu20009k104x1a988q6	org_eis_01	\N	Lead 7CFF67	+256771278243	lead-7cff67a4@example.test	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:07:49.37	2026-08-31 12:07:49.37
cmth73rce000dl404flssf7lb	org_eis_01	\N	Lead 7DDF74	+256753706793	lead-7ddf7485@example.test	\N	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 12:09:15.566	2026-08-31 12:09:15.566
cmtjv4suj0005jp04vpm2pyuy	org_eis_01	\N	Lead E0EFF6	+256780511319	lead-e0eff6a0@example.test	School of auditors	\N	WALK_IN	NEW	\N	0	We can be their service providers they do not have a reliable one as of now. Lets start a professional relationship by sending them introductory emails to begin with	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-09-02 08:57:27.307	2026-09-02 08:57:27.307
cmtlq6tv70001ld04jidm34q8	org_eis_01	\N	Lead A14766	+256713330174	lead-a1476643@example.test	ALFUJAIRAH INTERNATIONAL GROUP LTD	\N	WALK_IN	NEW	\N	0	Lets kindly give them an introductory massege ..such that we can be in good touch with this organisation	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-09-03 16:14:36.211	2026-09-03 16:14:36.211
cmth652750005kz04t9yqsyw7	org_eis_01	\N	Lead 3076A1	+256786503401	lead-3076a138@example.test	DROIT [redacted]	\N	WALK_IN	NEW	\N	0	Kindly write an email to that organisation	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-31 11:42:16.674	2026-08-31 11:42:16.674
cmtjvhdtv0001l404th19j09z	org_eis_01	\N	Lead B2F327	+256762992227	lead-b2f3271e@example.test	[redacted] health systems	\N	WALK_IN	NEW	\N	0	\N	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-09-02 09:07:14.371	2026-09-02 09:07:14.371
cmt9swz9m0001k004i6zjacq6	org_eis_01	\N	Lead 522355	+256757563667	\N	\N	\N	WALK_IN	NEW	\N	0	Visited mid land [redacted]	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-08-26 07:57:41.387	2026-08-26 07:57:41.387
cmtjv1gha0001jp04bh3nztc9	org_eis_01	\N	Lead 5B8F40	+256718530720	lead-5b8f40c5@example.test	Homeland data services and Dash properties limited	Supllies of computers. And related Gadgets	WALK_IN	NEW	\N	0	They have no permanent service provider as of yet . Its therefore a better [redacted]. For us to get closer	\N	\N	\N	cmpvi0twl0001l204yd45lhqm	\N	\N	\N	2026-09-02 08:54:51.311	2026-09-02 08:54:51.311
\.


--
-- Data for Name: LeadActivity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LeadActivity" (id, "leadId", "userId", type, note, "createdAt") FROM stdin;
cmpv9ae4a0003jx044k324vs2	cmpv9ae150001jx04n8r458xo	cmns5jbas00002lfw97nnwshd	NOTE	Lead created	2026-06-01 13:40:21.37
cmpv9bxym0001gq047hqxrb7n	cmpv9ae150001jx04n8r458xo	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-06-01 13:41:33.743
cmpv9vsnv0001gp0482zxzvll	cmpv9ae150001jx04n8r458xo	cmns5jbas00002lfw97nnwshd	NOTE	Lead details updated	2026-06-01 13:56:59.995
cmpw832zw0003js04axi1cr67	cmpw832w60001js04k3dky732	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-06-02 05:54:26.924
cmpw835fk0003i504lxnqceu9	cmpw835d40001i5047qmh4dim	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-06-02 05:54:30.081
cmpw85naa0003jk04sas76bee	cmpw85n750001jk049zmlu9g4	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-06-02 05:56:26.531
cmpwdadw20003l404o8k9okoc	cmpwdad7m0001l404dm61ni5h	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-06-02 08:20:05.714
cmq111uer000ljm04yxi8132f	cmq111uaf000jjm04dbnseuij	cmns5jbas00002lfw97nnwshd	NOTE	Lead created	2026-06-05 14:36:22.708
cmq114o7s0009l504ugue34q3	cmq114o4b0007l504lwjtawfd	cmns5jbas00002lfw97nnwshd	NOTE	Lead created	2026-06-05 14:38:34.648
cmq14q8iy0003jr04orl8opg4	cmq14q8er0001jr04ko4pesgs	cmns5jbas00002lfw97nnwshd	NOTE	Lead created	2026-06-05 16:19:19.595
cmq154sv90001jo04e3k3s5dy	cmpw835d40001i5047qmh4dim	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-05 16:30:39.142
cmq154w6u0003jo04fyo3ib7m	cmpw835d40001i5047qmh4dim	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-05 16:30:43.447
cmq154zcm0005jo04tc2c971s	cmpw835d40001i5047qmh4dim	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-05 16:30:47.542
cmq1552f40001l504dsu62tnv	cmpw835d40001i5047qmh4dim	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-05 16:30:51.521
cmq155c610003l5046ok0nz4e	cmpw85n750001jk049zmlu9g4	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-05 16:31:04.153
cmq15a27g0009jo04fnngkvdp	cmq15a23y0007jo04mwd6qsr4	cmns5jbas00002lfw97nnwshd	NOTE	Lead created	2026-06-05 16:34:44.524
cmq15bqv10003l20413qh2dnv	cmq15bqq40001l204fitx80qh	cmns5jbas00002lfw97nnwshd	NOTE	Lead created	2026-06-05 16:36:03.133
cmq15daut0001jr04plscikwg	cmq15bqq40001l204fitx80qh	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-06-05 16:37:15.701
cmq15dfuo0003jr04f7z5zrri	cmq15a23y0007jo04mwd6qsr4	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-06-05 16:37:22.177
cmq2cuwax0001js045f6w3vxq	cmq111uaf000jjm04dbnseuij	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-06-06 12:54:40.137
cmq5diwan0001l204gjpki83u	cmq14q8er0001jr04ko4pesgs	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-06-08 15:36:38.4
cmq5djbji000hkv04ilpw4utw	cmq111uaf000jjm04dbnseuij	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to QUALIFIED	2026-06-08 15:36:58.159
cmq6tqvs70001l204k6nb72qa	cmq15bqq40001l204fitx80qh	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-09 15:58:31.015
cmq84ctlh0001l5046wlqdp56	cmq111uaf000jjm04dbnseuij	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to PROPOSAL_SENT	2026-06-10 13:43:16.95
cmq84czwg0001k004qj6eg580	cmq111uaf000jjm04dbnseuij	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to WON	2026-06-10 13:43:25.12
cmq84dh9i0001kz04cd4rrnqi	cmq14q8er0001jr04ko4pesgs	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to QUALIFIED	2026-06-10 13:43:47.622
cmq84e25r0003l504klekzb55	cmq15a23y0007jo04mwd6qsr4	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-06-10 13:44:14.704
cmqtkucbs0001l705azmbc9xd	cmq14q8er0001jr04ko4pesgs	cmns5jbas00002lfw97nnwshd	NOTE	Lead details updated	2026-06-25 14:07:57.928
cmqtkuff80003l705ls0o1gf6	cmq14q8er0001jr04ko4pesgs	cmns5jbas00002lfw97nnwshd	NOTE	Lead details updated	2026-06-25 14:08:01.941
cms7pphhq0003jo04y00vza15	cms7pphdk0001jo04y45g2n1q	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-07-30 16:12:38.223
cms7psyat0003kz042ahhbl41	cms7psy6y0001kz0425fvcxb2	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-07-30 16:15:19.973
cmt8re4fe0003ju04amhlkxwa	cmt8re4cv0001ju04w7rwjrwg	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:27:15.818
cmt8re7v10007ju04qrxtqhls	cmt8re7p30005ju04ohzkh4pz	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:27:20.269
cmt8real5000bju04cqzbgt2h	cmt8reait0009ju040grolcgz	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:27:23.802
cmt8rg2qn0003jp04jyqacijy	cmt8rg2nk0001jp04l8t84uvu	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:28:46.944
cmt8rh9920003jr04kodktnul	cmt8rh96r0001jr042fagyabs	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:29:42.038
cmt8rjpzn0007jr04dbfya9cr	cmt8rjpvl0005jr0401sizeys	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:31:37.043
cmt8rn2dn000fju04kt62vlrc	cmt8rn29h000dju043k2ocxp0	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:34:13.067
cmt8rpni20003jm04ygrra0lz	cmt8rpnfn0001jm0487x3f0ux	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-25 14:36:13.755
cmt9swzc90003k004979wenv1	cmt9swz9m0001k004i6zjacq6	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-26 07:57:41.482
cmt9t6jzk0003l304kbqr1rro	cmt9t6jul0001l304p6p9j84z	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-26 08:05:08.145
cmt9wrmvb0003la04rfo1j409	cmt9wrmsq0001la04b34bgwpw	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-26 09:45:30.503
cmtbd5svv0003l9048sqol9ga	cmtbd5stc0001l904wupbtt1i	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 10:12:11.516
cmtbj563g000ala04optok14q	cmtbj559r0008la04yer4lclh	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 12:59:39.677
cmtbj8bif000lla04jma80j3w	cmtbj8bac000jla04p6ci7yin	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 13:02:06.663
cmtbjdtr00014la04hud1ldqz	cmtbjdtoq0012la04qy3k72io	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 13:06:23.581
cmtbjf7xh0004jn04fg8s057t	cmtbjf7v30002jn048gc0fuxm	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 13:07:28.613
cmtbjk49u001fjn041ipf8twt	cmtbjk45g001djn04g1rg3s8i	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 13:11:17.154
cmtbjlm18000hl404v5i36wbm	cmtbjllxo000fl404za16kbdx	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 13:12:26.828
cmtbjmne4000ll404ij5esl4k	cmtbjmnb4000jl404mk06npfm	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-27 13:13:15.245
cmtg5wubr0001i204i4n1j4mq	cmpw835d40001i5047qmh4dim	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to LOST	2026-08-30 18:48:07.047
cmtg6d34i0001kt04gs0x8ker	cmt8reait0009ju040grolcgz	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-08-30 19:00:44.946
cmtg6d63i0003kt04dkjdjcg9	cmt8reait0009ju040grolcgz	cmns5jbas00002lfw97nnwshd	STATUS_CHANGE	Status changed to CONTACTED	2026-08-30 19:00:48.799
cmth61htm0003kz04unpmhl0k	cmth61hr20001kz048v07wt51	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:39:30.298
cmth6529j0007kz041g62djxz	cmth652750005kz04t9yqsyw7	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:42:16.76
cmth68g0x0003ju040fvor63m	cmth68fyh0001ju04k7s3ob6p	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:44:54.561
cmth6g9a30003jo045tyv4ni7	cmth6g95c0001jo049iplt4f5	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:50:59.068
cmth6hxd30003l404yjvgvugy	cmth6hxau0001l404cn96vm2w	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:52:16.935
cmth6l0r50007jo0445qmifv0	cmth6l0om0005jo04quoid0jc	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:54:41.298
cmth6nbn50003la04odnwvbp5	cmth6nbkx0001la04tatw7jft	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:56:28.721
cmth6pbho0003k104zy7ms692	cmth6pbel0001k104yc1nb1ba	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:58:01.836
cmth6rsfw000bjo04efuq24k1	cmth6rsa00009jo04loq90bxr	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 11:59:57.117
cmth6tiik0007l404m9ps72rs	cmth6tifl0005l404zxe3raqv	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:01:17.565
cmth6ul84000fjo04ukxwmihk	cmth6ul52000djo045edj8clo	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:02:07.732
cmth6vkel000bl404drazfitk	cmth6vkby0009l404ohxb7s9o	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:02:53.326
cmth6y8tt0007k104exj77mtx	cmth6y8qp0005k104ka87then	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:04:58.29
cmth70daf000jjo04ikntbogi	cmth70d82000hjo04fsezcxzm	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:06:37.384
cmth71ww9000bk104955e7976	cmth71wu20009k104x1a988q6	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:07:49.45
cmth73rel000fl4046ytv620w	cmth73rce000dl404flssf7lb	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:09:15.645
cmth758jo0007la04lwomspbc	cmth758h80005la04tqnbsrto	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:10:24.516
cmth76ggb000bla04yfn7myss	cmth76gdv0009la04iuhxxg64	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-08-31 12:11:21.42
cmtjso85i0003ld040zpjynzy	cmtjso7xs0001ld04j1vs3v57	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-09-02 07:48:34.758
cmtjv1gkb0003jp04nmzfkke6	cmtjv1gha0001jp04bh3nztc9	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-09-02 08:54:51.42
cmtjv4swt0007jp043lavr9gz	cmtjv4suj0005jp04vpm2pyuy	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-09-02 08:57:27.39
cmtjvhdw50003l404i9dbwov2	cmtjvhdtv0001l404th19j09z	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-09-02 09:07:14.454
cmtlq6txy0003ld04askfolpu	cmtlq6tv70001ld04jidm34q8	cmpvi0twl0001l204yd45lhqm	NOTE	Lead created	2026-09-03 16:14:36.31
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, type, title, message, "jobId", "userId", channel, "isRead", "readAt", "orgId", "createdAt") FROM stdin;
\.


--
-- Data for Name: NotificationPreferences; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."NotificationPreferences" (id, "userId", "notifyStatusChange", "notifyApprovalNeeded", "notifyJobAssigned", "notifyEstimateSubmitted", "notifyPaymentReceived", "notifyPayoutGenerated", "notifyTimelineUpdated", "notifyDelayNote", "notifyStockAlert", "notifyJobCreated", "notifyRepairRequest", "notifyQuotationStatus", "notifyLeadStatus", "notifyPurchaseRequest", "notifyStockMovement", "notifyFieldVisit", "notifyCreditNote", "whatsappEnabled", "emailEnabled", "createdAt", "updatedAt") FROM stdin;
cmnugupx70001jp042r6ypmh7	cmns5jbas00002lfw97nnwshd	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	f	2026-04-11 15:04:56.252	2026-04-11 15:24:16.287
cmnwy4et90001mi07mlzti21f	cmns5nkty00012lme8d0os7dx	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	t	f	2026-04-13 08:43:54.237	2026-04-13 08:43:54.237
\.


--
-- Data for Name: OneTimeExternalTechAssignment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OneTimeExternalTechAssignment" (id, "jobId", "technicianName", phone, specialization, "agreedRepairCost", "partsNotes", "expectedPartsCost", "assignedAt", "expectedReturnAt", "returnedAt", instructions, "progressNotes", "finalOutcome", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: OrgFeatureEntitlement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrgFeatureEntitlement" (id, "orgId", feature, enabled, "limitValue", "metadataJson", "startsAt", "endsAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: OrgModuleGrant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrgModuleGrant" ("orgId", module) FROM stdin;
org_eis_01	COMPLAINTS
org_eis_01	FIELD
org_eis_01	INVENTORY
org_eis_01	INVOICING
org_eis_01	JOBS
org_eis_01	POS
org_eis_01	PURCHASE_ORDERS
org_eis_01	REPORTS
org_eis_01	SALES
org_eis_01	TARGETS
\.


--
-- Data for Name: OrgSubscriptionEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrgSubscriptionEvent" (id, "orgId", provider, "eventType", "providerEventId", plan, status, amount, currency, "payloadJson", "occurredAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: OrgUsageSnapshot; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrgUsageSnapshot" (id, "orgId", "periodKey", metric, value, "capturedAt", "metadataJson") FROM stdin;
\.


--
-- Data for Name: OrgWhatsAppConfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OrgWhatsAppConfig" ("orgId", "businessNumber", "phoneNumberId", "accessToken", "businessAccountId", provider, "atApiKey", "atUsername", "atSenderId", "smsFallback", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Organization" (id, name, slug, plan, "isActive", "billingStatus", "flwCustomerId", "flwSubscriptionId", "flwPlanId", "trialEndsAt", "planRenewsAt", "planCancelledAt", "aiModel", "baseCurrency", "supportedCurrencies", "createdAt", "updatedAt") FROM stdin;
org_eis_01	Eagle Info Solutions	eagle-info-solutions	ENTERPRISE	t	ACTIVE	\N	\N	\N	\N	\N	\N	\N	UGX	UGX	2026-05-23 15:46:03	2026-05-23 15:46:03
\.


--
-- Data for Name: OutboundMessage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."OutboundMessage" (id, channel, status, type, "to", subject, body, "templateKey", "templateVars", "metaTemplateName", "metaTemplateLanguage", "metaTemplateVars", provider, "providerMessageId", "providerDeliveryStatus", "providerDeliveryAt", "providerDeliveryErrorCode", "providerDeliveryError", "attemptCount", "lastAttemptAt", "nextAttemptAt", "sentAt", "lastErrorCode", "lastError", "lockedAt", "repairRequestId", "jobId", "invoiceId", "clientId", "reminderStage", "orgId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Part; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Part" (id, sku, name, manufacturer, "unitCost", "sellingPrice", category, description, taxable, "taxRate", "baseUom", "saleUom", "purchaseUom", "saleUomFactor", "purchaseUomFactor", "qtyOnHand", "qtyReserved", "reorderLevel", "isActive", "orgId", "createdAt", "updatedAt", "shortDescription") FROM stdin;
cmppxp1i10002k004ps169io6	iPhone Cable	USB-C to Lightening	HeatZ	7000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	50	f	org_eis_01	2026-05-28 20:16:58.586	2026-08-04 20:02:54.377	\N
cmpqsx26z0001jl04mkfekxx4	Ram 001	Ram 16GB PC4	Samsung	180000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	5	f	org_eis_01	2026-05-29 10:51:00.828	2026-08-04 20:04:45.436	\N
cmq0ymb2r0001kz04ehxm1onr	001	Hp EliteBook 830  G6 8th Gen i5  16/256SSD x360	hp	1250000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	1	t	org_eis_01	2026-06-05 13:28:18.579	2026-07-07 14:00:51.719	\N
cmq0yorww0001la04ry2510lm	002	Hp EliteBook 840  G7 10th Gen i5  16/256SSD	hp	1200000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	1	t	org_eis_01	2026-06-05 13:30:13.712	2026-07-07 13:59:14.898	\N
cmq0yqq1h0001jt04tch2ihbd	003	Dell Latitude 3120 2 in 1  4/256 ssd Non-Touch	Dell	450000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-06-05 13:31:44.597	2026-07-04 08:38:36.276	\N
cmq0ysnmc0001js04liscikoo	004	Dell Latitude 3210 2 in 1   8/128 ssd Touch	Dell	450000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	1	t	org_eis_01	2026-06-05 13:33:14.772	2026-06-05 13:35:11.595	\N
cmq0yx54x0001js04z3btl8z0	005	Dell Latitude 7400 2in1  i7  8th Gen 16/512 ssd	Dell	1000000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 13:36:44.097	2026-06-05 13:37:11.509	\N
cmq0yzji60001kv04a1t37zsv	006	Dell Latitude 7410 i5 10th Gen 16/512 ssd	Dell	1200000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 13:38:36.03	2026-06-05 13:38:49.96	\N
cmq0z32u90001jo04yt3uhmqs	007	Dell Latitude 7420 i5 11th Gen 16/512 ssd	Dell	1300000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 13:41:21.057	2026-06-05 13:41:43.237	\N
cmq0z92a20001lh04e2hrx0ig	008	Lenovo 100e intel 4/128	Lenovo	350000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-06-05 13:46:00.267	2026-07-04 09:25:40.143	\N
cmq0zbb0n0005lh04eto9vafi	009	Lenovo X1 yoga i7 8th Gen 16/512	Lenovo	1200000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 13:47:44.903	2026-06-05 13:48:09.853	\N
cmq0zdar50001jr04z1sy1f1l	010	Lenovo T14s 11th Gen i7 16/256 ssd	Lenovo	1250000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 13:49:17.873	2026-06-05 13:49:57.509	\N
cmq0zp76n0001lb04co17xw4j	011	MacBook Air 2018 i5 16/512ssd	Mac	1120000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	3.000	0	1	t	org_eis_01	2026-06-05 13:58:33.119	2026-06-05 14:04:12.874	\N
cmq0ztqjs0001jp0433idwecb	012	MacBook Air  2020 M1  16/512ssd	Mac	1630000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:02:04.84	2026-06-05 14:03:49.168	\N
cmq0zyvn10001ky041xdh3h62	013	MacBook Air 2020 M1 16/512ssd without screen	Mac	1000000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:06:04.717	2026-06-05 14:11:24.179	\N
cmq100njx0003ky04re42nljc	014	Macbook Air 2018 i5 8/256ssd  Gold	Mac	1000000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:07:27.549	2026-06-05 14:07:55.53	\N
cmq1041zb0002l204qa46hqk9	015	MBA 13inch 2018 i5 8/256gb without battery	Mac	800000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:10:06.215	2026-06-05 14:10:38.038	\N
cmq1090td0001l204a26m2lki	016	MBP TB 13inch 2019 i7 8/512ssd	MBP	1500000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:13:57.985	2026-06-05 14:14:29.037	\N
cmq10bpvl0003l2046thnui1f	017	MacBook pro 13inch 2020 i5 16/256ssd	MBP	2250000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:16:03.777	2026-06-05 14:16:49.699	\N
cmq10ecah0001l5044h60n1ib	018	MacBook pro 13inch 2020  i7 32/1TB	MBP	2020000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:18:06.137	2026-06-05 14:18:27.787	\N
cmq10h3f70005jm04y16zevg7	019	MacBook pro 13inch 2020  i5 16/1TB	MBP	1720000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:20:14.611	2026-06-05 14:20:40.933	\N
cmq10k3ve0003l504om9d4rw2	020	MBP 13inch 2020 M1 13inch 16/256  no screen	MBP	1000000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:22:35.162	2026-06-05 14:23:08.363	\N
cmq10qbzk000bjm04fji6ytcb	021	MacBook Pro16 TB 2019 i9 16/1TB	MBP	2000000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:27:25.616	2026-06-05 14:27:44.706	\N
cmq10sv5e000djm04xxm8zn1e	022	MacBook Pro16 TB 2019 i9 64/2TB faulty board	MBP	1220000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:29:23.763	2026-06-05 14:29:43.017	\N
cmq10uuxr000fjm04sbvlzutp	023	MacBook Pro  13ich M2  2022 24/1TB  8core open box	MBP	2800000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-06-05 14:30:56.799	2026-09-08 10:17:30.466	\N
cmq1101ig0005l504d4o61vmd	024	MacBook Pro 16ich M1 pro 2021 16/1TB  New open box	MBP	4800000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:34:58.6	2026-06-05 14:35:19.19	\N
cmq111e98000hjm04fi3t9h65	025	MacBook Pro 14ich M4 2021 24/1TB	MBP	4800000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:36:01.772	2026-06-05 14:36:44.153	\N
cmq1183mv0003kz041dfa7e0g	026	MacMini 2014 i7 8/1TB	Macmini	800000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:41:14.599	2026-06-05 14:43:33.598	\N
cmq119dn40005l504x22p7nyz	027	MacMini 2021 M2  8/256SSD	Macmini	1400000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	2.000	0	0	t	org_eis_01	2026-06-05 14:42:14.225	2026-06-05 14:43:46.913	\N
cmq11diid000rjm042xeradip	028	Magic trackpad black	Accessories	523000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	2.000	0	0	t	org_eis_01	2026-06-05 14:45:27.157	2026-06-05 14:45:50.698	\N
cmq11f9is0009l5042bk9nr91	029	Office 365	Accessories	55000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	2.000	0	0	t	org_eis_01	2026-06-05 14:46:48.82	2026-06-05 14:47:08.719	\N
cmq11i5ns0007kz04bnfn9ojo	030	140W power adapter	Accessories	375000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:49:03.784	2026-06-05 14:49:27.775	\N
cmq11jwva0009kz04qzo33vxz	031	30W type c power adapter New	Accessories	72000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-06-05 14:50:25.702	2026-09-05 13:06:03.971	\N
cmq11lboe000bl204s96ohpgj	032	30W power adapter used	Accessories	50000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	5.000	0	1	t	org_eis_01	2026-06-05 14:51:31.55	2026-06-05 14:51:52.48	\N
cmq11n1xa000vjm04g1ifzxa2	033	Imac 24 143W power adapter with Ethernet	Accessories	465000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:52:52.223	2026-06-05 14:53:27.927	\N
cmq11pf0v000bkz044rrgk71z	034	Imac 24 143W power adapter with out  Ethernet	Accessories	405000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:54:42.511	2026-06-05 14:55:05.87	\N
cmq11rvww0001ii04h3196raf	035	Airtag case x4	Accessories	50000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:56:37.712	2026-06-05 14:57:05.949	\N
cmq11u27d0001ie04bjiu1ioq	036	ipad smart keyboard 10.5	Accessories	505000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:58:19.178	2026-06-05 14:58:38.491	\N
cmq11vrht0003ie04h3zwaoak	037	ipad smart keyboard 12.9	Accessories	505000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 14:59:38.609	2026-06-05 14:59:57.892	\N
cmq11y17l0003kz04wpftumq5	038	covers	Accessories	30000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	19.000	0	10	t	org_eis_01	2026-06-05 15:01:24.514	2026-06-06 15:47:28.586	\N
cmq120qu90005kz04cp0mctrn	039	laptop Non-Rotating stands	Accessories	50000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	2.000	0	0	t	org_eis_01	2026-06-05 15:03:31.041	2026-06-05 15:03:56.999	\N
cmq124c4b0009kz04zmxfdggr	040	MacBook pro 2020 i5 screen	Mac Spear Part	1000000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 15:06:18.588	2026-06-05 15:14:52.565	\N
cmq127d2z0003ii04lvvnbssy	041	MBP 13inch  NTB 2017 screen	Mac Spear Part	500000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-06-05 15:08:39.804	2026-06-05 15:12:47.938	\N
cmq128xst0007ie04vwvrusgz	042	MBP 13inch  TB 2017 screen	Mac Spear Part	800000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	2.000	0	0	t	org_eis_01	2026-06-05 15:09:53.309	2026-06-05 15:10:29.022	\N
cmq12bcin000bie044jdwd104	043	Hub 7 in 1	Accessories	25000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	37.000	0	10	t	org_eis_01	2026-06-05 15:11:45.696	2026-06-06 15:45:18.431	\N
cmr62bc5f0001l504pswy2ydi	0045	Sleeve bags	\N	28500.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	47.000	0	10	t	org_eis_01	2026-07-04 07:50:18.435	2026-08-18 18:37:53.773	\N
cmr62irx90003kz04fydvkqd6	0046	Bags with leather handles	Laptop bag	37600.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	43.000	0	10	t	org_eis_01	2026-07-04 07:56:05.469	2026-08-07 16:57:45.331	\N
cmr62mblu0003l504sl42tesg	0067	Leather Bag	Laptop bag	530000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	83.000	0	10	t	org_eis_01	2026-07-04 07:58:50.946	2026-08-30 08:01:05.6	\N
cmr62r9wj0001l404wf3cpcmb	0068	MBP 14 inch covers	Accessories	38600.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	20.000	0	10	t	org_eis_01	2026-07-04 08:02:42.02	2026-07-04 08:03:50.413	\N
cmr62xjff0005l404qsl784p5	0069	MBA 13 inch covers	Accessories	38600.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	38.000	0	10	t	org_eis_01	2026-07-04 08:07:34.3	2026-07-04 08:08:08.475	\N
cmr62zrpq0007jm04394tgcur	0070	MBP 13 inch covers	Accessories	38600.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	40.000	0	10	t	org_eis_01	2026-07-04 08:09:18.35	2026-07-04 08:09:46.44	\N
cmr632oxs0009l404gyamkoyi	0071	Mac Laptop cables	Accessories	11000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	295.000	0	10	t	org_eis_01	2026-07-04 08:11:34.721	2026-07-04 08:18:07.306	\N
cmr63edb30009jm04aq3mg72n	0073	USB-c to lightening cable	Accessories	3000.00	20000.00	\N	\N	t	\N	\N	\N	\N	\N	\N	991.000	0	10	t	org_eis_01	2026-07-04 08:20:39.52	2026-09-05 13:01:18.708	\N
cmr63l4dg0007l504yn32q477	0074	USB-C charger cables	Accessories	4000.00	20000.00	\N	\N	t	\N	\N	\N	\N	\N	\N	996.000	0	10	t	org_eis_01	2026-07-04 08:25:54.532	2026-08-30 08:08:14.66	\N
cmr63t3nn0001la04mvyancvg	0075	magsafe 3 Cables	Accessories	49000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	99.000	0	10	t	org_eis_01	2026-07-04 08:32:06.851	2026-07-04 08:33:29.841	\N
cmr64011h000fl504sf97arjl	0076	3pin plug	Accessories	17000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	220.000	0	10	t	org_eis_01	2026-07-04 08:37:30.053	2026-07-04 08:39:21.595	\N
cmr645xp40005la04tdgltu22	0077	85W L charger	Accessories	48500.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	50.000	0	10	t	org_eis_01	2026-07-04 08:42:05.657	2026-07-04 08:42:40.498	\N
cmr64859v0007la04bosay1x5	0078	85W T charger	Accessories	48500.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	48.000	0	10	t	org_eis_01	2026-07-04 08:43:48.788	2026-07-04 08:44:17.799	\N
cmr64bbff0009la04z4pq57wk	0079	60W T charger	Accessories	48500.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	48.000	0	10	t	org_eis_01	2026-07-04 08:46:16.732	2026-09-05 13:35:33.261	\N
cmr64g7zv0003jp04a7yd3cya	0080	61W type c power adapter New	Accessories	68000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	30.000	0	10	t	org_eis_01	2026-07-04 08:50:05.564	2026-07-04 08:50:29.956	\N
cmr64mhun0005jp04mzpqicox	0081	70W power adapter used	Accessories	72000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	20.000	0	10	t	org_eis_01	2026-07-04 08:54:58.271	2026-07-04 08:55:49.185	\N
cmr64plh4000rl504gw7rb3nw	0082	Hp 90W type-c charger	Accessories	42000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	20.000	0	10	t	org_eis_01	2026-07-04 08:57:22.937	2026-07-04 08:58:29.195	\N
cmr64y4x30009jp0490znpohn	0083	Hp 65w Type-C charger	Accessories	23000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	49.000	0	10	t	org_eis_01	2026-07-04 09:04:01.383	2026-07-07 14:10:28.623	\N
cmr653727000tl504v2wqwj9b	0084	Hp 65w Blue pin charger	Accessories	14000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	39.000	0	10	t	org_eis_01	2026-07-04 09:07:57.44	2026-09-05 13:40:15.753	\N
cmr656ipl000bjp04pm7stdw9	0085	Dell 65W Type-C charger	Accessories	22000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	33.000	0	10	t	org_eis_01	2026-07-04 09:10:32.506	2026-07-04 09:10:59.901	\N
cmr659omy000xl5040ojiilhs	0086	Lenovo type c	Accessories	25000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	10.000	0	5	t	org_eis_01	2026-07-04 09:13:00.155	2026-09-05 13:38:38.004	\N
cmr65ceuc000fjp0467ojg8ec	0087	Dell Big pin	Accessories	17500.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	49.000	0	10	t	org_eis_01	2026-07-04 09:15:07.428	2026-07-07 14:11:00.936	\N
cmr65ffcb000hjp04o8j3ubwf	0088	Power Cables	Accessories	2500.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	185.000	0	10	t	org_eis_01	2026-07-04 09:17:28.044	2026-09-05 13:03:00.366	\N
cmsssynt50001js04223kkt8e	200	OPPO Find X8 Pro 16/512	\N	3400000.00	\N	\N	\N	t	\N	\N	\N	\N	\N	\N	0.000	0	1	t	org_eis_01	2026-08-14 10:26:54.858	2026-08-14 10:26:54.858	\N
cmsyyeqg10001l104p3842il0	SKU-0001	HP EliteBook 840  i5 G6 8/256	\N	800000.00	1000000.00	\N	\N	t	18.000000	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-08-18 17:45:59.906	2026-08-18 18:34:23.824	\N
cmsyyi1e80003l104fiqewx3z	SKU-0002	hp EliteBook 840 g8 11th Gen 8/256	\N	1100000.00	1500000.00	\N	\N	t	18.000000	\N	\N	\N	\N	\N	5.000	0	1	t	org_eis_01	2026-08-18 17:48:34.064	2026-08-18 17:48:34.064	\N
cmsyyk3hk0001jr04w7f20epg	SKU-0003	MacBook pro 2019 13inch screen and Keyboard	\N	500000.00	1500000.00	\N	\N	t	18.000000	\N	\N	\N	\N	\N	1.000	0	0	t	org_eis_01	2026-08-18 17:50:10.088	2026-08-18 17:50:10.088	\N
cmtb30xg80001l904qz5hpp27	SKU-0004	Microsoft Surface Pro 13-inch (12th Edition) 2-in-1 Laptop — Snapdragon X2 Elite (12-Core), OLED Display, Dune, 16GB RAM, 1TB SSD, supplied with Surface Pro Keyboard with Slim Pen, Surface Slim Pen, Surface USB-C Travel Hub, Surface USB4 Dock, Surface Arc Mouse (Light Gray), Microsoft Complete protection and Microsoft 365 Personal.	\N	\N	\N	\N	\N	t	18.000000	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-08-27 05:28:27.993	2026-08-27 05:28:27.993	\N
cmtb31jqc0003l904p4oceh72	SKU-0005	Dell UltraSharp U4323QE 43-inch 4K UHD USB-C Hub Monitor, 42.51” IPS display, 3840 × 2160 resolution at 60Hz, 350 nits brightness, 1,000:1 contrast ratio, 95% sRGB, anti-glare coating, height/swivel/tilt adjustable stand, integrated USB-C hub with up to 90W Power Delivery, KVM functionality, 2× DisplayPort, 2× HDMI, USB-C and USB-A connectivity, Gigabit Ethernet (RJ45), and integrated speakers.	\N	\N	\N	\N	\N	t	18.000000	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-08-27 05:28:56.868	2026-08-27 05:28:56.868	\N
cmtc0fh6o0001l404684apaia	SKU-0006	HP EliteDesk 800 G3 Mini PC – Intel Core i5, 8GB DDR4 RAM, 512GB SSD, Intel HD Graphics, Wi-Fi/Bluetooth, DisplayPort, USB 3.0, Windows 10/11 Pro + 22” FHD Monitor, USB Keyboard & Mouse. Condition: Grade A Refurbished	\N	1000000.00	1600000.00	\N	\N	t	18.000000	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-08-27 21:03:34.08	2026-08-27 21:15:44.272	\N
cmtc0r9gz0001jp040olrnyd8	SKU-0007	HP ProDesk 600 G4 SFF – Intel Core i5-8500, 8th Gen, 8GB DDR4 RAM, 512GB SSD, HP 22” FHD Monitor, HP USB Keyboard & Mouse. Condition:  Refurbished	\N	1700000.00	2300000.00	\N	\N	t	18.000000	\N	\N	\N	\N	\N	0.000	0	0	t	org_eis_01	2026-08-27 21:12:43.956	2026-08-27 21:12:43.956	\N
\.


--
-- Data for Name: PartLocationStock; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PartLocationStock" (id, "orgId", "partId", "locationId", "qtyOnHand", "qtyReserved", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PartReservation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PartReservation" (id, "jobId", "partId", quantity, status, "unitCostSnapshot", "reservedById", "reservedAt", "consumedAt", "releasedAt", note) FROM stdin;
\.


--
-- Data for Name: PartStockTransaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PartStockTransaction" (id, "partId", type, quantity, reason, "orgId", "locationId", "unitCost", "sourceType", "sourceId", "jobId", "saleId", "createdById", "createdAt") FROM stdin;
cmppxq8w90001ji04ugz3etam	cmppxp1i10002k004ps169io6	IN	20000.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-05-28 20:17:54.825
cmpqsxxh50001js04adkmmx4l	cmpqsx26z0001jl04mkfekxx4	IN	19.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-05-29 10:51:41.37
cmq0yn1x10001l604eap45o6m	cmq0ymb2r0001kz04ehxm1onr	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:28:53.365
cmq0ypb3l0001jo04psx649s7	cmq0yorww0001la04ry2510lm	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:30:38.578
cmq0yqyxp0001jp04qmgw732i	cmq0yqq1h0001jt04tch2ihbd	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:31:56.126
cmq0yv5tc0001jr04yzcobp66	cmq0ysnmc0001js04liscikoo	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:35:11.664
cmq0yxqc80001kv04rf8wsryq	cmq0yx54x0001js04z3btl8z0	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:37:11.576
cmq0yzub70001jo04t1bivnew	cmq0yzji60001kv04a1t37zsv	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:38:50.035
cmq0z3k0j0001l404k0s2xhfe	cmq0z32u90001jo04yt3uhmqs	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:41:43.315
cmq0z9lrh0003lh04k9qifeyi	cmq0z92a20001lh04e2hrx0ig	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:46:25.517
cmq0zbubr0001l104gbpe4dv5	cmq0zbb0n0005lh04eto9vafi	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:48:09.927
cmq0ze5dz0001jr04r03yeaca	cmq0zdar50001jr04z1sy1f1l	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:49:57.575
cmq0zppuq0003lb0435c92iof	cmq0zp76n0001lb04co17xw4j	IN	3.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 13:58:57.315
cmq0zutvr0001jx04vju8geny	cmq0ztqjs0001jp0433idwecb	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:02:55.816
cmq0zzcub0001if04wkwch38c	cmq0zyvn10001ky041xdh3h62	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:06:27.011
cmq10196z0001jv04lee6v95v	cmq100njx0003ky04re42nljc	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:07:55.595
cmq104ql40005ky04xcahkbqj	cmq1041zb0002l204qa46hqk9	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:10:38.105
cmq109ou00001l504nrg881ka	cmq1090td0001l204a26m2lki	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:14:29.112
cmq10cpd90001jm04czgk7r2u	cmq10bpvl0003l2046thnui1f	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:16:49.773
cmq10et1o0003jm04fdlaphm2	cmq10ecah0001l5044h60n1ib	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:18:27.853
cmq10hnsi0007jm04s0m27t61	cmq10h3f70005jm04y16zevg7	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:20:41.01
cmq10ktjh0009jm0424ate1by	cmq10k3ve0003l504om9d4rw2	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:23:08.429
cmq10qqrt0005l204aco629iw	cmq10qbzk000bjm04fji6ytcb	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:27:44.777
cmq10ta2a0003l504kok0njhw	cmq10sv5e000djm04xxm8zn1e	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:29:43.09
cmq10vdtw0007l204cquawa2q	cmq10uuxr000fjm04sbvlzutp	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:31:21.284
cmq110hg90009l204mpcq9k0m	cmq1101ig0005l504d4o61vmd	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:35:19.257
cmq112b0f0001kz04dfkf33ov	cmq111e98000hjm04fi3t9h65	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:36:44.224
cmq11b2xm000njm04eapagj93	cmq1183mv0003kz041dfa7e0g	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:43:33.658
cmq11bd7m000pjm04dy4dntpn	cmq119dn40005l504x22p7nyz	IN	2.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:43:46.978
cmq11e0q60007l504q8mqat6d	cmq11diid000rjm042xeradip	IN	2.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:45:50.766
cmq11foxa0005kz04wk3jzpfj	cmq11f9is0009l5042bk9nr91	IN	2.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:47:08.783
cmq11io83000bl504sh9w1ncx	cmq11i5ns0007kz04bnfn9ojo	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:49:27.844
cmq11kcny000tjm044mfktx14	cmq11jwva0009kz04qzo33vxz	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:50:46.174
cmq11lrw4000dl5048zcmy62t	cmq11lboe000bl204s96ohpgj	IN	5.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:51:52.565
cmq11ntj2000fl504ltd0gp16	cmq11n1xa000vjm04g1ifzxa2	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:53:27.998
cmq11px3r000dkz04w3epf4fs	cmq11pf0v000bkz044rrgk71z	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:55:05.943
cmq11shrc0001jo04bgkbbba4	cmq11rvww0001ii04h3196raf	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:57:06.024
cmq11uh5u0001kz04lwix0c0d	cmq11u27d0001ie04bjiu1ioq	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:58:38.563
cmq11w6fe0001ky04w3halyrv	cmq11vrht0003ie04h3zwaoak	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 14:59:57.962
cmq11yi3i0003jo04pei769pu	cmq11y17l0003kz04wpftumq5	IN	19.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:01:46.398
cmq11yqpp0005ie04ls505ua2	cmq11y17l0003kz04wpftumq5	IN	19.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:01:57.565
cmq121axi0007kz04inv9j28w	cmq120qu90005kz04cp0mctrn	IN	2.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:03:57.078
cmq124q98000ckz04ke23my05	cmq124c4b0009kz04zmxfdggr	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:06:36.909
cmq127sjn000ekz04pj8sdp0m	cmq127d2z0003ii04lvvnbssy	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:08:59.844
cmq129fvd0001l4043w8qyjuq	cmq128xst0007ie04vwvrusgz	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:10:16.73
cmq129pew0009ie0423wmqrmd	cmq128xst0007ie04vwvrusgz	IN	1.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:10:29.096
cmq12bv690003l4049y63g3oz	cmq12bcin000bie044jdwd104	IN	44.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:12:09.873
cmq12moq00001l4044saw03ly	cmq0yqq1h0001jt04tch2ihbd	OUT	1.000	POS sale item (003 Dell Latitude 3120 2 in 1  4/256 ssd Non-Touch)	org_eis_01	\N	\N	\N	\N	\N	cmq12kzaf0001l8048telkg8u	\N	2026-06-05 15:20:34.728
cmq21up100001l2046xhvquog	cmq12bcin000bie044jdwd104	IN	37.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-06 07:46:34.932
cmq21uvnw0003l2049r7xb23q	cmq12bcin000bie044jdwd104	IN	37.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-06 07:46:43.533
cmq2iycaa0001ky0417u7c3mp	cmq12bcin000bie044jdwd104	ADJUST	81.000	Qty correction: 118 → 37	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-06 15:45:18.514
cmq2j14pl0001ky04f22v2xjw	cmq11y17l0003kz04wpftumq5	ADJUST	19.000	Qty correction: 38 → 19	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-06-06 15:47:28.666
cmr62efua0001kz0439xzlxxn	cmr62bc5f0001l504pswy2ydi	IN	50.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 07:52:43.186
cmr62fgzb0001jm04t7vn1cxk	cmr62bc5f0001l504pswy2ydi	ADJUST	2.000	Qty correction: 50 → 48	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 07:53:31.319
cmr62k6sa0003jm04femcqtjx	cmr62irx90003kz04fydvkqd6	IN	50.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 07:57:11.387
cmr62okuf0005jm0420xn3327	cmr62mblu0003l504sl42tesg	IN	87.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:00:36.232
cmr62sqqn0003l404s3exqrao	cmr62r9wj0001l404wf3cpcmb	IN	20.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:03:50.496
cmr62y9uq0005kz04xazv23n3	cmr62xjff0005l404qsl784p5	IN	38.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:08:08.546
cmr630dg60007l404ydzhxt9a	cmr62zrpq0007jm04394tgcur	IN	40.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:09:46.519
cmr634hu80007kz04lt5f8p5f	cmr632oxs0009l404gyamkoyi	IN	295.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:12:58.833
cmr63ey2b0005l504t9pvkobt	cmr63edb30009jm04aq3mg72n	IN	995.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:21:06.419
cmr63nohe0009l504b18ekji7	cmr63l4dg0007l504yn32q477	IN	996.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:27:53.906
cmr63tulh000bl5044yi6wntb	cmr63t3nn0001la04mvyancvg	IN	99.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:32:41.766
cmr63txqq000dl504idkn7c76	cmr63t3nn0001la04mvyancvg	IN	99.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:32:45.842
cmr63umu20003la0404wxvyt6	cmr63t3nn0001la04mvyancvg	ADJUST	99.000	Qty correction: 198 → 99	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:33:18.362
cmr640mz90009kz0423qguyhy	cmq0yqq1h0001jt04tch2ihbd	IN	220.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:37:58.485
cmr641g79000hl504uaqxcekv	cmq0yqq1h0001jt04tch2ihbd	ADJUST	220.000	Qty correction: 220 → 0	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:38:36.358
cmr641zxh000ll5048voawyow	cmr64011h000fl504sf97arjl	IN	220.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:39:01.925
cmr646omv000bkz04esi5lsnw	cmr645xp40005la04tdgltu22	IN	50.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:42:40.568
cmr648rq6000nl504umr4f5tp	cmr64859v0007la04bosay1x5	IN	48.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:44:17.887
cmr64c17l0001jp04on2f6aq8	cmr64bbff0009la04z4pq57wk	IN	50.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:46:50.146
cmr64gqva000pl5041jvhuf8j	cmr64g7zv0003jp04a7yd3cya	IN	30.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:50:30.023
cmr64nl730007jp041914wtze	cmr64mhun0005jp04mzpqicox	IN	20.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:55:49.264
cmr64r0np000dkz04oihip1n1	cmr64plh4000rl504gw7rb3nw	IN	20.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 08:58:29.27
cmr64yyu3000fkz04ncv8pgrm	cmr64y4x30009jp0490znpohn	IN	50.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:04:40.156
cmr653y5i000vl504zs7gszcx	cmr653727000tl504v2wqwj9b	IN	45.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:08:32.551
cmr6573we000djp04syap1q6x	cmr656ipl000bjp04pm7stdw9	IN	33.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:10:59.966
cmr65afn1000bla04o4a88td3	cmr659omy000xl5040ojiilhs	IN	11.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:13:35.149
cmr65ctqq000zl5047rbhc3ir	cmr65ceuc000fjp0467ojg8ec	IN	50.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:15:26.738
cmr65fxxt000dla044exirhhu	cmr65ffcb000hjp04o8j3ubwf	IN	195.000	\N	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:17:52.146
cmr65pz3n001al504nxjbrpph	cmq0z92a20001lh04e2hrx0ig	ADJUST	1.000	Qty correction: 1 → 0	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-07-04 09:25:40.212
cmraptctg0001l8043vwbyqba	cmq0yorww0001la04ry2510lm	OUT	1.000	POS sale item (002 Hp EliteBook 840  G7 10th Gen i5  16/256SSD)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 13:59:14.98
cmrapvfit0005l804t8er1bs4	cmq0ymb2r0001kz04ehxm1onr	OUT	1.000	POS sale item (001 Hp EliteBook 830  G6 8th Gen i5  16/256SSD x360)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:00:51.797
cmraq33kr0001ie04riq7rr8u	cmr62irx90003kz04fydvkqd6	OUT	2.000	POS sale item (0046 Bags with leather handles)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:06:49.564
cmraq4byd0007jv04wuqzj2g5	cmr64y4x30009jp0490znpohn	OUT	1.000	POS sale item (0083 Hp 65w Type-C charger)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:07:47.077
cmraq52qv0006jv04v1hmoynb	cmr653727000tl504v2wqwj9b	OUT	1.000	POS sale item (0084 Hp 65w Blue pin charger)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:08:21.8
cmraq65s5000ajv04u2tmklu1	cmr65ffcb000hjp04o8j3ubwf	OUT	5.000	POS sale item (0088 Power Cables)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:09:12.39
cmraq75pm000ejv046yyfytja	cmr64y4x30009jp0490znpohn	IN	1.000	POS sale item deleted (0083 Hp 65w Type-C charger)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	cmns5nlp700042lmerqro7219	2026-07-07 14:09:58.954
cmraq7snq000al80449esu5wl	cmr64y4x30009jp0490znpohn	OUT	1.000	POS sale item (0083 Hp 65w Type-C charger)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:10:28.695
cmraq8hlf000hjv04tep3jw6s	cmr65ceuc000fjp0467ojg8ec	OUT	1.000	POS sale item (0087 Dell Big pin)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:11:01.011
cmraq9g5p0005ie04dcnlb4o2	cmr653727000tl504v2wqwj9b	OUT	1.000	POS sale item (0084 Hp 65w Blue pin charger)	org_eis_01	\N	\N	\N	\N	\N	cmrapqzh70004jv0423mhm9b5	\N	2026-07-07 14:11:45.806
cmrdjpwxr0001jr04syxvthm2	cmr63edb30009jm04aq3mg72n	OUT	1.000	POS sale item (0073 USB-c to lightening cable)	org_eis_01	\N	\N	\N	\N	\N	cmrdjozsr0001l704urqn9862	\N	2026-07-09 13:31:55.264
cmrdjw4a30003l5045s20l94l	cmr653727000tl504v2wqwj9b	OUT	1.000	POS sale item (0084 Hp 65w Blue pin charger)	org_eis_01	\N	\N	\N	\N	\N	cmrdjuksi0007jr04pk5th985	\N	2026-07-09 13:36:44.716
cmrdjwpk50007l504epeb5ngh	cmr65ffcb000hjp04o8j3ubwf	OUT	1.000	POS sale item (0088 Power Cables)	org_eis_01	\N	\N	\N	\N	\N	cmrdjuksi0007jr04pk5th985	\N	2026-07-09 13:37:12.294
cmsf34vht0001jt04ojnqbh79	cmppxp1i10002k004ps169io6	ADJUST	20000.000	Qty correction: 20000 → 0	org_eis_01	\N	\N	ADJUSTMENT	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-04 20:02:54.45
cmsf379770001l7044h5c7o8o	cmpqsx26z0001jl04mkfekxx4	ADJUST	19.000	Wrongly Put	org_eis_01	\N	\N	ADJUSTMENT	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-04 20:04:45.523
cmshf19mw000aib04tdia86a6	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0023: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:33.896
cmshf19qu000cib04jbtecsrs	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0023: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:34.039
cmshf1aem000jib04p89rbeam	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0024: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:34.895
cmshf1ai8000lib04ej9nc0zt	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0024: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:35.025
cmshf1bvp000sib04k5kd2mcv	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0025: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:36.805
cmshf1bze000uib04gkrafowu	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0025: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:36.939
cmshf1cmo0011ib04m4q5lpbt	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0026: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:37.777
cmshf1cqq0013ib04bkvpklqb	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0026: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:37.922
cmshf1dfg001aib04ikijueh5	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0027: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:38.812
cmshf1dj4001cib04d6tqv3vc	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0027: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:38.944
cmshf1e5j001jib04tec9gmlb	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0028: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:39.752
cmshf1e92001lib04ab6vgoxj	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0028: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:39.878
cmshf1ets001sib04lx1x19b5	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0029: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:40.625
cmshf1exi001uib04ndbwjomt	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0029: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:40.758
cmshf1g6d0021ib04iyoj1a1u	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0030: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:42.373
cmshf1ga50023ib045y3vjwiq	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0030: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:42.51
cmshf1guz002aib046fx2e8yq	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0031: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:43.26
cmshf1gz2002cib04epqg95z7	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0031: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:11:43.407
cmshf1whx0007l4043g11z2dv	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0032: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:12:03.525
cmshf1wn40009l404i6oio23a	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0032: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:12:03.713
cmshf1xk3000gl404z5gi2cmb	cmr62mblu0003l504sl42tesg	OUT	3.000	Invoice EIS/INV/2026/0033: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:12:04.899
cmshf1xq9000il404xrcmt1ws	cmr62irx90003kz04fydvkqd6	OUT	5.000	Invoice EIS/INV/2026/0033: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 11:12:05.121
cmsj6u4dd0001ju0487oq8eh7	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0023 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:35.905
cmsj6u4k90003ju049kqygced	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0023 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:36.153
cmsj6u5s10006ju04em8bp9j3	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0024 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:37.729
cmsj6u5xq0008ju04smob6j4e	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0024 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:37.934
cmsj6u6h3000bju04e9scduil	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0025 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:38.632
cmsj6u6ms000dju04hhakguvc	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0025 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:38.836
cmsj6u785000gju04v5paan8e	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0026 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:39.606
cmsj6u7em000iju04tuaj1q9t	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0026 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:39.839
cmsj6u7vm000lju0488vtd6ie	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0027 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:40.45
cmsj6u81e000nju04m1z5nqsn	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0027 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:40.659
cmsj6u8fq000qju04xkeuyq6w	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0028 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:41.174
cmsj6u8lh000sju045u9x1shu	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0028 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:41.381
cmsj6u901000vju04nkq6dv3m	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0029 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:41.906
cmsj6u95u000xju04ts5xblvj	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0029 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:42.115
cmsj6uabg0010ju047iv6kozg	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0030 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:43.612
cmsj6uah50012ju04dgmojeh6	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0030 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:43.817
cmsj6uayw0015ju04hcbc7zfx	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0031 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:44.456
cmsj6ub4u0017ju04jkelw1oj	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0031 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:44.671
cmsj6ubj9001aju04f14a7clg	cmr62mblu0003l504sl42tesg	IN	3.000	Invoice EIS/INV/2026/0032 voided: 0067 · Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:45.189
cmsj6ubp5001cju04gav11ylr	cmr62irx90003kz04fydvkqd6	IN	5.000	Invoice EIS/INV/2026/0032 voided: 0046 · Bags with leather handles	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-07 16:57:45.401
cmsyzyaaf0001jv04tkezzrwk	cmsyyeqg10001l104p3842il0	OUT	2.000	POS sale item (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	\N	2026-08-18 18:29:11.704
cmsyzziro0001la0494tfebqk	cmsyyeqg10001l104p3842il0	IN	2.000	POS sale item deleted (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	cmns5nlp700042lmerqro7219	2026-08-18 18:30:09.348
cmsz0131q0003l804ij24l0gn	cmsyyeqg10001l104p3842il0	OUT	2.000	POS sale item (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	\N	2026-08-18 18:31:22.286
cmsz01iuo0007l804tl6bi8zi	cmsyyeqg10001l104p3842il0	IN	2.000	POS sale item deleted (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	cmns5nlp700042lmerqro7219	2026-08-18 18:31:42.768
cmsz02kdj000al804w5422h55	cmsyyeqg10001l104p3842il0	OUT	1.000	POS sale item (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	\N	2026-08-18 18:32:31.399
cmsz03ei7000el8049w38vm78	cmsyyeqg10001l104p3842il0	IN	1.000	POS sale item deleted (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	cmns5nlp700042lmerqro7219	2026-08-18 18:33:10.448
cmsz04z68000hl804g0hn39o8	cmsyyeqg10001l104p3842il0	OUT	2.000	POS sale item (HP EliteBook 840  i5 G6 8/256)	org_eis_01	\N	\N	\N	\N	\N	cmsyzux110001l804sky5qooo	\N	2026-08-18 18:34:23.888
cmsz09h630001js04l0l60ybr	cmr62bc5f0001l504pswy2ydi	OUT	1.000	POS sale item (Sleeve bags)	org_eis_01	\N	\N	\N	\N	\N	cmsz07n5y0001lb04mzqu01lz	\N	2026-08-18 18:37:53.835
cmsz0ax840003l10431sy7090	cmr653727000tl504v2wqwj9b	OUT	2.000	POS sale item (Hp 65w Blue pin charger)	org_eis_01	\N	\N	\N	\N	\N	cmsz0a72t0001l104wwwwffau	\N	2026-08-18 18:39:01.301
cmt2m9gw2000djv04s39b5qu0	cmr65ffcb000hjp04o8j3ubwf	OUT	2.000	POS sale item (Power Cables)	org_eis_01	\N	\N	\N	\N	\N	cmt2m84it0001k204z2r3a8cb	\N	2026-08-21 07:17:03.555
cmt2ma82g000hjv045f82qqcw	cmr65ffcb000hjp04o8j3ubwf	IN	2.000	POS sale item deleted (Power Cables)	org_eis_01	\N	\N	\N	\N	\N	cmt2m84it0001k204z2r3a8cb	cmns5nkty00012lme8d0os7dx	2026-08-21 07:17:38.777
cmt2mauoe0003k204fjbzi8o7	cmr65ffcb000hjp04o8j3ubwf	OUT	2.000	POS sale item (Power Cables)	org_eis_01	\N	\N	\N	\N	\N	cmt2m84it0001k204z2r3a8cb	\N	2026-08-21 07:18:08.079
cmt33ftb80001l804i6hm4lav	cmr64bbff0009la04z4pq57wk	OUT	1.000	POS sale item (60W T charger)	org_eis_01	\N	\N	\N	\N	\N	cmt33f7ct0001jl0410ylcthn	\N	2026-08-21 15:17:53.061
cmtfisrk7000il204y1vd2j64	cmr62mblu0003l504sl42tesg	OUT	1.000	Invoice EIS/INV/2026/0053: Leather Bag	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-30 08:01:05.672
cmtfiwbjq000rl204huxgtym6	cmr63edb30009jm04aq3mg72n	OUT	2.000	Invoice EIS/INV/2026/0054: USB-c to lightening cable	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-30 08:03:51.542
cmtoe5ykm0001l404sibugwge	cmr63edb30009jm04aq3mg72n	OUT	1.000	POS sale item (USB-c to lightening cable)	org_eis_01	\N	\N	\N	\N	\N	cmtoe1462000hjn04z15yuq5s	\N	2026-09-05 13:01:18.79
cmtoe85070001kv04qa3t1p4a	cmr65ffcb000hjp04o8j3ubwf	OUT	2.000	POS sale item (Power Cables)	org_eis_01	\N	\N	\N	\N	\N	cmtoe71yn0005l404w048am0t	\N	2026-09-05 13:03:00.439
cmtoec2of0003l4047dfnc0ui	cmq11jwva0009kz04qzo33vxz	OUT	1.000	POS sale item (30W type c power adapter New)	org_eis_01	\N	\N	\N	\N	\N	cmtoeb0h70001l404xbb1apkd	\N	2026-09-05 13:06:04.047
cmtofdzuz0001l804wf19d1xe	cmr64bbff0009la04z4pq57wk	OUT	1.000	POS sale item (60W T charger)	org_eis_01	\N	\N	\N	\N	\N	cmtofcll8000gie044ndr8paw	\N	2026-09-05 13:35:33.324
cmtofhyez000rie046riuoh1a	cmr659omy000xl5040ojiilhs	OUT	1.000	POS sale item (Lenovo type c)	org_eis_01	\N	\N	\N	\N	\N	cmtofhi7z000wk004ct3ogpci	\N	2026-09-05 13:38:38.076
cmtofk1ua000gju046avt8uuo	cmr653727000tl504v2wqwj9b	OUT	1.000	POS sale item (Hp 65w Blue pin charger)	org_eis_01	\N	\N	\N	\N	\N	cmtofjcri000eju04zz8qlai6	\N	2026-09-05 13:40:15.826
cmtsimv1o0004jy04jn7p8zom	cmq10uuxr000fjm04sbvlzutp	OUT	1.000	Invoice EIS/INV/2026/0056: MacBook Pro 13ich M2 2022 24/1TB 8core open box	org_eis_01	\N	\N	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	2026-09-08 10:17:30.54
\.


--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Payment" (id, "orgId", "invoiceId", "saleId", currency, "exchangeRateToBase", amount, method, kind, reference, "receivedAt", "createdById", note, "createdAt") FROM stdin;
cmpv8dd9s0005l104uejsn64h	org_eis_01	cmprduvp10001jo04c1sqhwt7	\N	UGX	\N	120000.00	CASH	PAYMENT	\N	2026-06-01 13:14:40.624	cmns5jbas00002lfw97nnwshd	\N	2026-06-01 13:14:40.624
cmpv8e3tf000bl104nyr8l5y4	org_eis_01	cmprdk67l0001kv04p0cfi95l	\N	UGX	\N	380000.00	CASH	PAYMENT	\N	2026-06-01 13:15:15.028	cmns5jbas00002lfw97nnwshd	\N	2026-06-01 13:15:15.028
cmpv8hcls0009jm04ykaq9u35	org_eis_01	cmpv8hchs0007jm04yl743320	\N	UGX	\N	690000.00	CASH	PAYMENT	\N	2026-06-01 13:17:46.384	cmns5jbas00002lfw97nnwshd	\N	2026-06-01 13:17:46.384
cmpv8i96t0005jp04otwod8qi	org_eis_01	cmpv8i9290003jp04u0i3x66q	\N	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-06-01 13:18:28.614	cmns5jbas00002lfw97nnwshd	\N	2026-06-01 13:18:28.614
cmpxmi6qr0003k004lcf8jhao	org_eis_01	cmpxmi6m30001k004vq910r64	\N	UGX	\N	300000.00	CASH	PAYMENT	\N	2026-06-03 05:25:52.419	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:25:52.419
cmpxmkj9w0003le04ilikrme8	org_eis_01	cmpxmkj5b0001le049adwslpo	\N	UGX	\N	1100000.00	CASH	PAYMENT	\N	2026-06-03 05:27:41.972	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:27:41.972
cmpxmlh160003ji04a3mpjsdc	org_eis_01	cmpxmlgxk0001ji04doqjcaly	\N	UGX	\N	270000.00	CASH	PAYMENT	\N	2026-06-03 05:28:25.722	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:28:25.722
cmpxmofgw0009ji04q5uecbif	org_eis_01	cmpxmofd40007ji04r92rtv0l	\N	UGX	\N	150000.00	CASH	PAYMENT	\N	2026-06-03 05:30:43.664	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:30:43.664
cmpxmpbvs000dk0043kcm7uj2	org_eis_01	cmpxmpb6d000bk004jmbltswb	\N	UGX	\N	80000.00	CASH	PAYMENT	\N	2026-06-03 05:31:25.673	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:31:25.673
cmpxmsnqa000hji04eu7gowz6	org_eis_01	cmpxmsnlg000fji04w7d0wpgh	\N	UGX	\N	250000.00	CASH	PAYMENT	\N	2026-06-03 05:34:00.995	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:34:00.995
cmpxmtncp0005l104r506l9kr	org_eis_01	cmpxmtn8f0003l104oibhnk9w	\N	UGX	\N	170000.00	CASH	PAYMENT	\N	2026-06-03 05:34:47.161	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:34:47.161
cmpxmvopp000bl1049zt9zp6x	org_eis_01	cmpxmvolx0009l104v1xykp5v	\N	UGX	\N	70000.00	CASH	PAYMENT	\N	2026-06-03 05:36:22.237	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:36:22.237
cmpxmwhtj000hl1044oenxv2e	org_eis_01	cmpxmwhq2000fl104lxn26axb	\N	UGX	\N	380000.00	CASH	PAYMENT	\N	2026-06-03 05:36:59.959	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:36:59.959
cmpxmxevg000rji04khuo7sex	org_eis_01	cmpxmxery000pji04uiif1hrb	\N	UGX	\N	55000.00	CASH	PAYMENT	\N	2026-06-03 05:37:42.797	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:37:42.797
cmpxmyiqs000ble043sw5md2z	org_eis_01	cmpxmyimt0009le043dh1xuo9	\N	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-06-03 05:38:34.468	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:38:34.468
cmpxmzxfj000xji047jsrc01a	org_eis_01	cmpxmzxa1000vji04a1yeh2yo	\N	UGX	\N	350000.00	CASH	PAYMENT	\N	2026-06-03 05:39:40.159	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:39:40.159
cmpxn2cak000lk004g9hw5p7g	org_eis_01	cmpxn2c72000jk004i55yvplj	\N	UGX	\N	150000.00	CASH	PAYMENT	\N	2026-06-03 05:41:32.733	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:41:32.733
cmpxnesas000nl104g8veg8yx	org_eis_01	cmpxnes74000ll104wwh2jv3p	\N	UGX	\N	330000.00	CASH	PAYMENT	\N	2026-06-03 05:51:13.348	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 05:51:13.348
cmpxvmmvd0003jm0463necmbx	org_eis_01	cmpxvmmrf0001jm04udpohd0y	\N	UGX	\N	120000.00	CASH	PAYMENT	\N	2026-06-03 09:41:16.489	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 09:41:16.489
cmpxvno0j0003jp04b55dhdaw	org_eis_01	cmpwt2no10001le04jw30yjie	\N	UGX	\N	220000.00	CASH	PAYMENT	\N	2026-06-03 09:42:04.628	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 09:42:04.628
cmpxvosha0009jp049xpfrvin	org_eis_01	cmpxvosdj0007jp049xtqaoy8	\N	UGX	\N	120000.00	CASH	PAYMENT	\N	2026-06-03 09:42:57.07	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 09:42:57.07
cmpxwtjix0001l504e80rwvj6	org_eis_01	cmpxmxery000pji04uiif1hrb	\N	UGX	\N	35000.00	CASH	PAYMENT	\N	2026-06-03 10:14:38.361	cmns5jbas00002lfw97nnwshd	\N	2026-06-03 10:14:38.361
cmq12caa1000fie04kr4rq4oh	org_eis_01	cmq12ca40000die04wolbcvlx	\N	UGX	\N	480000.00	CASH	PAYMENT	\N	2026-06-05 15:12:29.449	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 15:12:29.449
cmq12dryf000bii04gj10x1sp	org_eis_01	cmq12drs60009ii04qs907dly	\N	UGX	\N	180000.00	CASH	PAYMENT	\N	2026-06-05 15:13:39.015	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 15:13:39.015
cmq144m120003le040n9bjxz8	org_eis_01	cmq144lud0001le042hhnrekf	\N	UGX	\N	400000.00	CASH	PAYMENT	\N	2026-06-05 16:02:30.662	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:02:30.662
cmq1464dw0003ld04ty6tqd90	org_eis_01	cmq14645s0001ld04o4nl31gb	\N	UGX	\N	330000.00	CASH	PAYMENT	\N	2026-06-05 16:03:41.108	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:03:41.108
cmq14754z0009ld04esbvoq4b	org_eis_01	cmq1474w50007ld04r2scdhvj	\N	UGX	\N	480000.00	CASH	PAYMENT	\N	2026-06-05 16:04:28.739	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:04:28.739
cmq147uv10003l804p1ky9hf3	org_eis_01	cmq147uog0001l804qht3pf9n	\N	UGX	\N	150000.00	CASH	PAYMENT	\N	2026-06-05 16:05:02.077	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:05:02.077
cmq148sdg0009l804qelrq1pq	org_eis_01	cmq148s5g0007l80410ux22mw	\N	UGX	\N	650000.00	CASH	PAYMENT	\N	2026-06-05 16:05:45.508	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:05:45.508
cmq14bbe1000ble04d48vmdjy	org_eis_01	cmq14bb6d0009le04gpjaxwnn	\N	UGX	\N	200000.00	CASH	PAYMENT	\N	2026-06-05 16:07:43.466	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:07:43.466
cmq14c78h000jl804ybk1ol9u	org_eis_01	cmq14c725000hl804469o2zyl	\N	UGX	\N	860000.00	CASH	PAYMENT	\N	2026-06-05 16:08:24.737	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:08:24.737
cmq14cxxo0007jv043abdje5z	org_eis_01	cmq14cxru0005jv04qfbs3cgb	\N	UGX	\N	180000.00	CASH	PAYMENT	\N	2026-06-05 16:08:59.34	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:08:59.34
cmq14dmfg000djv04shm2i5k7	org_eis_01	cmq14dm8z000bjv04vqccjgvr	\N	UGX	\N	400000.00	CASH	PAYMENT	\N	2026-06-05 16:09:31.084	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:09:31.084
cmq14e8hk0003jr046pnbfmcs	org_eis_01	cmq14e83l0001jr04ljvky9mr	\N	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-06-05 16:09:59.673	cmns5jbas00002lfw97nnwshd	\N	2026-06-05 16:09:59.673
cmq2e0lcz0009l404d7dc52iv	org_eis_01	cmq2e0l6q0007l404ysgig4xl	\N	UGX	\N	220000.00	CASH	PAYMENT	\N	2026-06-06 13:27:05.507	cmns5jbas00002lfw97nnwshd	\N	2026-06-06 13:27:05.507
cmq5canj1000hjv04aw1f76sb	org_eis_01	cmq5canbu000fjv04tpp68ob5	\N	UGX	\N	430000.00	CASH	PAYMENT	\N	2026-06-08 15:02:14.173	cmns5jbas00002lfw97nnwshd	\N	2026-06-08 15:02:14.173
cmq6hhcy80003ld04r2vojnp2	org_eis_01	cmq6hhcrr0001ld04u8b5q65j	\N	UGX	\N	450000.00	CASH	PAYMENT	\N	2026-06-09 10:15:11.312	cmns5jbas00002lfw97nnwshd	\N	2026-06-09 10:15:11.312
cmq6p5ufg0004jy0475wvh6hj	org_eis_01	cmq6p4qoq0003ld04nfoenrev	\N	UGX	\N	600000.00	CASH	PAYMENT	\N	2026-06-09 13:50:11.02	cmns5jbas00002lfw97nnwshd	\N	2026-06-09 13:50:11.02
cmqb239he0003k4046h3s1myy	org_eis_01	cmqb239al0001k404gr27iba5	\N	UGX	\N	450000.00	MOBILE_MONEY	PAYMENT	\N	2026-06-12 15:03:10.275	cmns5nlp700042lmerqro7219	\N	2026-06-12 15:03:10.275
cmqcguemh0009jy04vi526t8n	org_eis_01	cmqcgueh50007jy0462130qci	\N	UGX	\N	150000.00	CASH	PAYMENT	\N	2026-06-13 14:43:57.449	cmns5nlp700042lmerqro7219	\N	2026-06-13 14:43:57.449
cmqhxar5g0003l404gj1v7bhf	org_eis_01	cmqhxaqy20001l404gtr7l21o	\N	UGX	\N	1200000.00	CASH	PAYMENT	\N	2026-06-17 10:23:24.916	cmns5jbas00002lfw97nnwshd	\N	2026-06-17 10:23:24.916
cmqtmhcwu0001jm04timzulju	org_eis_01	cmqtkv07r0001kw041kas0kun	\N	UGX	\N	320000.00	MOBILE_MONEY	PAYMENT	\N	2026-06-25 14:53:51.39	cmns5nlp700042lmerqro7219	\N	2026-06-25 14:53:51.39
cmqtmjjeu0009jm04ntqpo7me	org_eis_01	cmqtmjj780007jm04fy3t4mi7	\N	UGX	\N	360000.00	MOBILE_MONEY	PAYMENT	\N	2026-06-25 14:55:33.126	cmns5nlp700042lmerqro7219	\N	2026-06-25 14:55:33.126
cmqwjm9k50003lb04h779dt8c	org_eis_01	cmqwjm9dg0001lb04xo8nrpza	\N	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-06-27 15:57:00.005	cmns5nlp700042lmerqro7219	\N	2026-06-27 15:57:00.005
cmr52gnlb000kjs04c1yo5cn2	org_eis_01	cmr52gnda000ijs049odg5w7z	\N	UGX	\N	200000.00	CASH	PAYMENT	\N	2026-07-03 15:06:40.368	cmns5nlp700042lmerqro7219	\N	2026-07-03 15:06:40.368
cmr535mgo0005ih0414bmh4ny	org_eis_01	cmr535lpd0003ih04kz2lct3a	\N	UGX	\N	420000.00	CASH	PAYMENT	\N	2026-07-03 15:26:05.304	cmns5nlp700042lmerqro7219	\N	2026-07-03 15:26:05.304
cmrasy8sd000al8045qn92djw	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	1600000.00	CASH	PAYMENT	\N	2026-07-07 15:27:01.885	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:27:01.885
cmrasyl7e0001jp04nb6jsy88	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	1600000.00	CASH	PAYMENT	\N	2026-07-07 15:27:17.978	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:27:17.978
cmrasyzrv0001kw04kl5t5eqz	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	160000.00	CASH	PAYMENT	\N	2026-07-07 15:27:36.859	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:27:36.859
cmrasze6u0003jp046u4h8y4l	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	200000.00	CASH	PAYMENT	\N	2026-07-07 15:27:55.543	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:27:55.543
cmrat37x50005jp04ko7dzact	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	25000.00	CASH	PAYMENT	\N	2026-07-07 15:30:54.042	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:30:54.042
cmrat3jes0001if04xuh71an9	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	40000.00	CASH	PAYMENT	\N	2026-07-07 15:31:08.932	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:31:08.932
cmrat3ylz0007jp04r05w32od	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-07-07 15:31:28.632	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:31:28.632
cmrat48t60003kw046ah1qcyh	org_eis_01	\N	cmrapqzh70004jv0423mhm9b5	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-07-07 15:31:41.85	cmns5nlp700042lmerqro7219	\N	2026-07-07 15:31:41.85
cmrbt14uh000jl4048srw47wm	org_eis_01	cmrbt14l2000hl404y8d26a3t	\N	UGX	\N	550000.00	CASH	PAYMENT	\N	2026-07-08 08:17:02.921	cmns5jbas00002lfw97nnwshd	\N	2026-07-08 08:17:02.921
cmrbt3ay5000lkw04iinnkwy3	org_eis_01	cmrbt3aoo000jkw04pf28uea3	\N	UGX	\N	350000.00	CASH	PAYMENT	\N	2026-07-08 08:18:44.141	cmns5jbas00002lfw97nnwshd	\N	2026-07-08 08:18:44.141
cmrbt4k9t0009jr04ncza3gyi	org_eis_01	cmrbt4k230007jr04zqjn9vnu	\N	UGX	\N	180000.00	CASH	PAYMENT	\N	2026-07-08 08:19:42.881	cmns5jbas00002lfw97nnwshd	\N	2026-07-08 08:19:42.881
cmrbt55o5000tl404h6oddwlz	org_eis_01	cmqryiwbc0001kv04o2wp30vu	\N	UGX	\N	180000.00	CASH	PAYMENT	\N	2026-07-08 08:20:10.614	cmns5jbas00002lfw97nnwshd	\N	2026-07-08 08:20:10.614
cmrbtbofo000jjr041y46fqjr	org_eis_01	cmrbtboah000hjr04ttz4qxcc	\N	UGX	\N	220000.00	CASH	PAYMENT	\N	2026-07-08 08:25:14.868	cmns5jbas00002lfw97nnwshd	\N	2026-07-08 08:25:14.868
cmrbyqkj30005kw04ww1cg9hx	org_eis_01	cmrbyqkb70003kw04u80zz0a5	\N	UGX	\N	450000.00	CASH	PAYMENT	\N	2026-07-08 10:56:47.728	cmns5nlp700042lmerqro7219	\N	2026-07-08 10:56:47.728
cmrbz0mhg0003i804nwv2hfok	org_eis_01	cmrbz0m650001i804rlsimehk	\N	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-07-08 11:04:36.82	cmns5nlp700042lmerqro7219	\N	2026-07-08 11:04:36.82
cmrdjqf1e0005jr04qlpcefy0	org_eis_01	\N	cmrdjozsr0001l704urqn9862	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-07-09 13:32:18.722	cmns5nlp700042lmerqro7219	\N	2026-07-09 13:32:18.722
cmrdjskcg0001l5047oqvohh7	org_eis_01	\N	cmrdjozsr0001l704urqn9862	UGX	\N	3600.00	CASH	PAYMENT	\N	2026-07-09 13:33:58.912	cmns5nlp700042lmerqro7219	\N	2026-07-09 13:33:58.912
cmrdjydgk0003l704elguqwdi	org_eis_01	\N	cmrdjuksi0007jr04pk5th985	UGX	\N	29500.00	CASH	PAYMENT	\N	2026-07-09 13:38:29.924	cmns5nlp700042lmerqro7219	\N	2026-07-09 13:38:29.924
cmrm1yjdd0005l1049u3wt17w	org_eis_01	cmrm1yj5u0003l104ub0rrdvu	\N	UGX	\N	280000.00	CASH	PAYMENT	\N	2026-07-15 12:24:40.081	cmns5jbas00002lfw97nnwshd	\N	2026-07-15 12:24:40.081
cms7iqo7e000qld046gp9fec3	org_eis_01	cms7iqo2c000old040odspnx7	\N	UGX	\N	100000.00	CASH	PAYMENT	\N	2026-07-30 12:57:36.266	cmns5jbas00002lfw97nnwshd	\N	2026-07-30 12:57:36.266
cmshf5dt00003l5048b537t1w	org_eis_01	cmshf1xad000cl4047oxti93v	\N	UGX	\N	300000.00	CASH	PAYMENT	\N	2026-08-06 11:14:45.924	cmns5nlp700042lmerqro7219	\N	2026-08-06 11:14:45.924
cmshypc0s0003ju05x5dikxq1	org_eis_01	cmpv8i9290003jp04u0i3x66q	\N	UGX	\N	500000.00	CASH	PAYMENT	\N	2026-08-06 20:22:09.435	cmns5jbas00002lfw97nnwshd	\N	2026-08-06 20:22:09.436
cmsj680s30003la04u7yndvl9	org_eis_01	cmsj633r20005l804jdbs0n41	\N	UGX	\N	1588.00	CASH	PAYMENT	\N	2026-08-07 16:40:24.818	cmns5jbas00002lfw97nnwshd	\N	2026-08-07 16:40:24.819
cmsq54j3c0003kw04x5dfq9h9	org_eis_01	cms7hzehm0001lc04dpoamos1	\N	UGX	\N	200000.00	CASH	PAYMENT	\N	2026-08-12 13:44:05.544	cmns5jbas00002lfw97nnwshd	\N	2026-08-12 13:44:05.544
cmsq57j5t0003ju041ldbyfyl	org_eis_01	cmsn90okd0003lg04jwhk7us3	\N	UGX	\N	440000.00	CASH	PAYMENT	\N	2026-08-12 13:46:25.601	cmns5jbas00002lfw97nnwshd	\N	2026-08-12 13:46:25.601
cmsz05rui000ll804mv8mx5jl	org_eis_01	\N	cmsyzux110001l804sky5qooo	UGX	\N	2260000.00	CASH	PAYMENT	\N	2026-08-18 18:35:01.05	cmns5nlp700042lmerqro7219	\N	2026-08-18 18:35:01.05
cmsz09umv0005js0493nrcu22	org_eis_01	\N	cmsz07n5y0001lb04mzqu01lz	UGX	\N	60000.00	CASH	PAYMENT	\N	2026-08-18 18:38:11.287	cmns5nlp700042lmerqro7219	\N	2026-08-18 18:38:11.287
cmsz0bag60001lc04ovo0pp9e	org_eis_01	\N	cmsz0a72t0001l104wwwwffau	UGX	\N	80000.00	CASH	PAYMENT	\N	2026-08-18 18:39:18.438	cmns5nlp700042lmerqro7219	\N	2026-08-18 18:39:18.438
cmsz0jfce0001ld04hkyp2z9j	org_eis_01	cmrd9glwq0001ie048lr3czn2	\N	UGX	\N	200000.00	CASH	PAYMENT	\N	2026-08-18 18:45:38.029	cmns5nlp700042lmerqro7219	\N	2026-08-18 18:45:38.03
cmsz0lfkc000ald049jp4gekb	org_eis_01	cmqryg62w0003l404fuu1aa7i	\N	UGX	\N	370000.00	CASH	PAYMENT	\N	2026-08-18 18:47:11.627	cmns5nlp700042lmerqro7219	\N	2026-08-18 18:47:11.628
cmsz0m2ey000jld041entljn3	org_eis_01	cmsj66v6h0009l804vxdxo6o8	\N	UGX	\N	1874.00	CASH	PAYMENT	\N	2026-08-18 18:47:41.241	cmns5nlp700042lmerqro7219	\N	2026-08-18 18:47:41.242
cmt2mbdzw0007k2045ce096tw	org_eis_01	\N	cmt2m84it0001k204z2r3a8cb	UGX	\N	10000.00	CASH	PAYMENT	\N	2026-08-21 07:18:33.116	cmns5nkty00012lme8d0os7dx	\N	2026-08-21 07:18:33.116
cmt2mg81h0001jy04jli73dw5	org_eis_01	cmsh7ok7v0005l404ivxv06hs	\N	UGX	\N	719800.00	CASH	PAYMENT	\N	2026-08-21 07:22:18.676	cmns5jbas00002lfw97nnwshd	\N	2026-08-21 07:22:18.677
cmt2n6sfk0001kw0481dq62ch	org_eis_01	cmt2n0pks0001l304mx8llmen	\N	UGX	\N	24000000.00	CASH	PAYMENT	\N	2026-08-21 07:42:58.159	cmns5jbas00002lfw97nnwshd	\N	2026-08-21 07:42:58.16
cmt33g8k60001l304cf9ivfiu	org_eis_01	\N	cmt33f7ct0001jl0410ylcthn	UGX	\N	80000.00	CASH	PAYMENT	\N	2026-08-21 15:18:12.822	cmns5nkty00012lme8d0os7dx	\N	2026-08-21 15:18:12.822
cmt33jyf50005jl04ozeud9xr	org_eis_01	\N	cmt33ikwd000al304n26cada1	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-08-21 15:21:06.305	cmns5nkty00012lme8d0os7dx	\N	2026-08-21 15:21:06.305
cmt33lk8d000el304f7bu0abg	org_eis_01	\N	cmt33kfcs000ejl04fde8xgac	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-08-21 15:22:21.229	cmns5nkty00012lme8d0os7dx	\N	2026-08-21 15:22:21.229
cmt34ix2f0003l804c68j9xfq	org_eis_01	\N	cmt34i10q0001jm04iba9ric5	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-08-21 15:48:17.511	cmns5nkty00012lme8d0os7dx	\N	2026-08-21 15:48:17.511
cmt45mtnu0003ky048snzcjsv	org_eis_01	\N	cmt45ltff0001ky04tvds5gog	UGX	\N	100000.00	CASH	PAYMENT	\N	2026-08-22 09:07:05.514	cmns5nkty00012lme8d0os7dx	\N	2026-08-22 09:07:05.514
cmt8u4do8000njl044o0o6j6s	org_eis_01	cmt8u3t8j000zjr040km4mcql	\N	UGX	\N	40000.00	CASH	BALANCE	\N	2026-08-25 15:43:40.088	cmns5jbas00002lfw97nnwshd	\N	2026-08-25 15:43:40.088
cmt8u91w00017jl04j852sisk	org_eis_01	cmt8u91ft0014jl04jnulauut	\N	UGX	\N	100000.00	CASH	PAYMENT	\N	2026-08-25 15:47:18.096	cmns5jbas00002lfw97nnwshd	\N	2026-08-25 15:47:18.096
cmt8urvxd002wjl045wod0m22	org_eis_01	cmt8ur5c70021jr04ev3ltmyp	\N	UGX	\N	300000.00	CASH	PAYMENT	\N	2026-08-25 16:01:56.833	cmns5jbas00002lfw97nnwshd	\N	2026-08-25 16:01:56.833
cmtbjj325000njn04o6svmjw1	org_eis_01	cmtbjj1v8000kjn044f8e6ke8	\N	UGX	\N	610000.00	CASH	PAYMENT	\N	2026-08-27 13:10:28.925	cmns5jbas00002lfw97nnwshd	\N	2026-08-27 13:10:28.925
cmtcwso3o000mjr04afb4o7lt	org_eis_01	cmtcws0ki0005jr04ozickr78	\N	UGX	\N	400000.00	CASH	BALANCE	\N	2026-08-28 12:09:37.284	cmns5jbas00002lfw97nnwshd	\N	2026-08-28 12:09:37.284
cmtd3uwam0006jr043e7v9x6r	org_eis_01	cmtd3uvra0003jr048qiz8y98	\N	UGX	\N	250000.00	CASH	PAYMENT	\N	2026-08-28 15:27:18.526	cmns5jbas00002lfw97nnwshd	\N	2026-08-28 15:27:18.526
cmtd46qgq0006ju04ckh74byy	org_eis_01	cmtd46py70003ju04hdcssbcn	\N	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-08-28 15:36:30.843	cmns5jbas00002lfw97nnwshd	\N	2026-08-28 15:36:30.843
cmtd97w8v0001js04brp25p6u	org_eis_01	cmtcsfsen0001jv04fz4aemy1	\N	UGX	\N	1220000.00	CASH	PAYMENT	\N	2026-08-28 17:57:23.07	cmns5jbas00002lfw97nnwshd	\N	2026-08-28 17:57:23.071
cmtfipn390001le04qjczs5yt	org_eis_01	cmt8ujde80016ky043ck12zdi	\N	UGX	\N	450000.00	CASH	PAYMENT	\N	2026-08-30 07:58:39.908	cmns5jbas00002lfw97nnwshd	\N	2026-08-30 07:58:39.909
cmtfiudmp000ale04ohxi6bsn	org_eis_01	cmtfisrah000fl204o6fem91v	\N	UGX	\N	100000.00	CASH	PAYMENT	\N	2026-08-30 08:02:20.928	cmns5jbas00002lfw97nnwshd	\N	2026-08-30 08:02:20.929
cmtfiwhm9000jle04sjyqmtoi	org_eis_01	cmtfiwbb9000ol204gldyd1xm	\N	UGX	\N	40000.00	CASH	PAYMENT	\N	2026-08-30 08:03:59.408	cmns5jbas00002lfw97nnwshd	\N	2026-08-30 08:03:59.409
cmtoefer70009l404bwtyr6fb	org_eis_01	\N	cmtoee34u0007l404zc8x7opy	UGX	\N	30000.00	CASH	PAYMENT	\N	2026-09-05 13:08:39.667	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:08:39.667
cmtoeg28z0007kv04040tmcv2	org_eis_01	\N	cmtoecj180008l404xww7ymz2	UGX	\N	100000.00	CASH	PAYMENT	\N	2026-09-05 13:09:10.116	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:09:10.116
cmtoego5i000cl404lelzft8m	org_eis_01	\N	cmtoeb0h70001l404xbb1apkd	UGX	\N	120000.00	CASH	PAYMENT	\N	2026-09-05 13:09:38.502	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:09:38.502
cmtof5r8d0001k0045jb5lj42	org_eis_01	\N	cmtof4d1m0001ie04gyymbyk3	UGX	\N	60000.00	CASH	PAYMENT	\N	2026-09-05 13:29:08.893	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:29:08.893
cmtof82080007ie04vrx4p0cd	org_eis_01	\N	cmtof6qu80001jo04nfbc8o32	UGX	\N	380000.00	CASH	PAYMENT	\N	2026-09-05 13:30:56.168	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:30:56.168
cmtof9j9y0005jo04j6gl936z	org_eis_01	\N	cmtof8vs90003jo040xu2gloc	UGX	\N	25000.00	CASH	PAYMENT	\N	2026-09-05 13:32:05.206	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:32:05.206
cmtofbkbt000ek0049lfbewd7	org_eis_01	\N	cmtof9ywv000ak004lvmx265e	UGX	\N	70000.00	CASH	PAYMENT	\N	2026-09-05 13:33:39.881	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:33:39.881
cmtofec81000nk004rsdc6pxb	org_eis_01	\N	cmtofcll8000gie044ndr8paw	UGX	\N	100000.00	CASH	PAYMENT	\N	2026-09-05 13:35:49.346	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:35:49.346
cmtofgzno000iie04q9xljms1	org_eis_01	\N	cmtofga580005l804qo0d1200	UGX	\N	50000.00	CASH	PAYMENT	\N	2026-09-05 13:37:53.029	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:37:53.029
cmtofi9ms0005ju04vrpbkp38	org_eis_01	\N	cmtofhi7z000wk004ct3ogpci	UGX	\N	40000.00	CASH	PAYMENT	\N	2026-09-05 13:38:52.613	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:38:52.613
cmtofkcuq000kju04o5e2bnwf	org_eis_01	\N	cmtofjcri000eju04zz8qlai6	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-09-05 13:40:30.098	cmns5nkty00012lme8d0os7dx	\N	2026-09-05 13:40:30.098
cmtr0fn9i0001l704qnig1ga3	org_eis_01	\N	cmtoe71yn0005l404w048am0t	UGX	\N	20000.00	CASH	PAYMENT	\N	2026-09-07 09:00:14.599	cmns5nkty00012lme8d0os7dx	\N	2026-09-07 09:00:14.599
cmtr0gsgg000al704ccsjz6ws	org_eis_01	\N	cmtoe1462000hjn04z15yuq5s	UGX	\N	30000.00	CASH	PAYMENT	\N	2026-09-07 09:01:07.985	cmns5nkty00012lme8d0os7dx	\N	2026-09-07 09:01:07.985
cmtr7glm80002l5045m6k6rei	org_eis_01	cmsbmp6g00003jm04qnsh3z3y	\N	UGX	\N	180000.00	CASH	PAYMENT	\N	2026-09-07 12:16:56.433	cmns5jbas00002lfw97nnwshd	\N	2026-09-07 12:16:56.433
cmtr7mleo000mla04pmycr7fh	org_eis_01	cmtr7mkyo000jla04mmzlut58	\N	UGX	\N	120000.00	CASH	PAYMENT	\N	2026-09-07 12:21:36.096	cmns5jbas00002lfw97nnwshd	\N	2026-09-07 12:21:36.096
cmtsin24i0001jo04da3z15vz	org_eis_01	cmtsimutg0001jy04p3rg7061	\N	UGX	\N	3800000.00	CASH	PAYMENT	\N	2026-09-08 10:17:39.714	cmns5jbas00002lfw97nnwshd	\N	2026-09-08 10:17:39.715
\.


--
-- Data for Name: PaymentAllocation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentAllocation" (id, "orgId", "paymentId", "targetType", "targetId", amount, "allocatedAt", note) FROM stdin;
\.


--
-- Data for Name: PaymentReminderSettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PaymentReminderSettings" (id, "orgId", enabled, "dryRun", "paymentTermsDays", "manualReviewAbove", "statementForMultiInvoice", "quietHourStart", "quietHourEnd", "createdAt", "updatedAt") FROM stdin;
prs_care_01	org_eis_01	t	f	30	2000000.00	t	8	20	2026-08-28 12:44:22	2026-08-28 13:39:44.039
\.


--
-- Data for Name: Photo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Photo" (id, "jobId", url, label, "orgId", visibility, "storageKey", "mimeType", "uploadedById", "uploadedAt") FROM stdin;
cmsyqrj9s0001if04y43exjk3	cmsrji9xl0003l80458lzg6s5	https://umfgqyqdiaircumv.private.blob.vercel-storage.com/jobs/cmsrji9xl0003l80458lzg6s5/1787062317002-8ef07d17-20e3-4400-a578-3c3f92314e6e.jpg	during	org_eis_01	CLIENT	jobs/cmsrji9xl0003l80458lzg6s5/1787062317002-8ef07d17-20e3-4400-a578-3c3f92314e6e.jpg	image/jpeg	cmns5jbas00002lfw97nnwshd	2026-08-18 14:12:00.208
\.


--
-- Data for Name: PlatformSetting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PlatformSetting" (key, value, "updatedAt") FROM stdin;
\.


--
-- Data for Name: PortalSession; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PortalSession" (id, token, "portalUserId", "expiresAt", "ipAddress", "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: PortalUser; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PortalUser" (id, "orgId", "clientId", name, email, phone, department, "position", role, "passwordHash", "isActive", "mustChangePassword", "lastLoginAt", "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PortalUserClient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PortalUserClient" (id, "portalUserId", "clientId", "orgId", "createdAt") FROM stdin;
\.


--
-- Data for Name: PosSession; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PosSession" (id, "orgId", "branchId", "operatorId", status, "openingFloat", "closingCash", "cashTotal", "cardTotal", "mobileTotal", "totalSales", "salesCount", "actualClosingBalance", "openedAt", "closedAt", notes) FROM stdin;
\.


--
-- Data for Name: PurchaseOrder; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrder" (id, "orgId", "supplierId", status, currency, "exchangeRateToBase", reference, "orderedAt", "expectedAt", "receivedAt", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PurchaseOrderItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseOrderItem" (id, "poId", "partId", description, "qtyOrdered", "qtyReceived", "unitCost", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PurchaseRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseRequest" (id, "orgId", "requestNumber", status, priority, "supplierId", "neededBy", reason, notes, "requestedById", "reviewedById", "reviewedAt", "reviewNote", "convertedPoId", "convertedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: PurchaseRequestItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PurchaseRequestItem" (id, "requestId", "partId", description, quantity, "estimatedUnitCost", "createdAt") FROM stdin;
\.


--
-- Data for Name: QualityCheck; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QualityCheck" (id, "orgId", "jobId", "checkedById", status, "checklistJson", notes, "checkedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Quotation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Quotation" (id, "orgId", "quoteNumber", status, currency, "exchangeRateToBase", "leadId", "clientId", "jobId", subtotal, "discountAmount", "vatAmount", "taxLabel", "taxRate", "totalAmount", notes, "issueDate", "validUntil", "sentAt", "acceptedAt", "rejectedAt", "createdById", "approvedById", "convertedToInvoiceId", "createdAt", "updatedAt") FROM stdin;
cmpva8dfx0003gp041brntu52	org_eis_01	QT-2026-0001	ACCEPTED	UGX	\N	cmpv9ae150001jx04n8r458xo	\N	\N	12300000.00	0.00	0.00	\N	\N	12300000.00	\N	\N	2026-06-02 00:00:00	2026-06-01 14:07:43.194	2026-06-01 14:08:39.261	\N	cmns5jbas00002lfw97nnwshd	cmns5jbas00002lfw97nnwshd	\N	2026-06-01 14:06:46.797	2026-06-01 14:08:39.263
cmqp0g9y30003kz04crfa1cn3	org_eis_01	QT-2026-0002	DRAFT	UGX	\N	\N	cmqp0g9sn0001kz04gzwse2m9	\N	24000000.00	0.00	0.00	\N	\N	24000000.00	Payment to: Eagle info solutions SMC Limited DFCU Account 01413656284446 Bugolobi Branch Payment to: Eagle info solutions SMC Limited ABSA UGX Account: 6007782592 SWIFT code: BARCUG Terms & Conditions All Goods remain property of Eagle info solutions SMC Limited until fully paid for 100% payment before delivery of the goods 1YR warranty	2026-06-16 00:00:00	2026-07-15 00:00:00	\N	\N	\N	cmns5nlp700042lmerqro7219	\N	cmt2n0pks0001l304mx8llmen	2026-06-22 09:26:04.635	2026-08-21 07:38:14.758
cmqp0qe930007jm04pnnou3x3	org_eis_01	QT-2026-0003	DRAFT	UGX	\N	\N	cmqp0qe4m0005jm046ysctsqn	\N	13300000.00	0.00	0.00	\N	\N	13300000.00	Payment to: Eagle info solutions SMC Limited DFCU Account 01413656284446 Bugolobi Branch Payment to: Eagle info solutions SMC Limited ABSA UGX Account: 6007782592 SWIFT code: BARCUG Terms & Conditions All Goods remain property of Eagle info solutions SMC Limited until fully paid for 100% payment before delivery of the goods 1YR warranty	2026-06-16 00:00:00	2026-07-16 00:00:00	\N	\N	\N	cmns5nlp700042lmerqro7219	\N	cmt2mim8u0001la04vd7c9vor	2026-06-22 09:33:56.775	2026-08-21 07:24:10.6
cmqrvix360003l8048cd5xxgp	org_eis_01	QT-2026-0004	DRAFT	UGX	\N	\N	cmqrviwz30001l804b3yf4pie	\N	8000000.00	0.00	0.00	\N	\N	8000000.00	\N	\N	2026-07-24 00:00:00	\N	\N	\N	cmns5nlp700042lmerqro7219	\N	\N	2026-06-24 09:31:28.387	2026-06-24 09:31:28.387
cmqtm4lm10001ky0455v2thy5	org_eis_01	QT-2026-0005	DRAFT	UGX	\N	\N	cmqrviwz30001l804b3yf4pie	\N	10000000.00	0.00	0.00	\N	\N	10000000.00	\N	\N	2026-07-25 00:00:00	\N	\N	\N	cmns5nlp700042lmerqro7219	\N	\N	2026-06-25 14:43:56.137	2026-06-25 14:43:56.137
cmraczu4o0003gy04r6cqcib8	org_eis_01	QT-2026-0006	DRAFT	UGX	\N	\N	cmracztxm0001gy04a93n2rwc	\N	5500000.00	0.00	990000.00	VAT	18.000000	6490000.00	\N	\N	2026-07-07 00:00:00	\N	\N	\N	cmns5nlp700042lmerqro7219	\N	\N	2026-07-07 08:00:22.345	2026-07-07 08:00:22.345
cmrueqsqy0003jr044sw6rppx	org_eis_01	QT-2026-0007	DRAFT	UGX	\N	\N	cmrueqsnj0001jr041drjwi60	\N	380000.00	0.00	0.00	\N	\N	380000.00	\N	\N	\N	\N	\N	\N	cmns5nlp700042lmerqro7219	\N	\N	2026-07-21 08:44:43.402	2026-07-23 09:15:41.55
cmt0b2x400002l704a3ja4t95	org_eis_01	EIS/QT/2026/0008	ACCEPTED	UGX	\N	\N	cmratfqe3000zkw04iv172urq	\N	3800000.00	0.00	684000.00	VAT	18.000000	4484000.00	\N	2026-08-19 00:00:00	\N	2026-08-19 16:28:41.209	2026-08-19 16:28:50.695	\N	cmns5jbas00002lfw97nnwshd	cmns5jbas00002lfw97nnwshd	\N	2026-08-19 16:28:29.856	2026-08-19 16:28:50.696
cmt8l8so80001jp04o8w6q4so	org_eis_01	EIS/QT/2026/0009	DRAFT	UGX	\N	\N	cmt8hxza70001jx0441s93o2k	\N	1220000.00	0.00	219600.00	VAT	18.000000	1439600.00	\N	2026-08-25 00:00:00	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	cmtcsfsen0001jv04fz4aemy1	2026-08-25 11:35:09.608	2026-08-28 10:07:38.069
cmtbo2i250001l20498fxl0rp	org_eis_01	EIS/QT/2026/0010	DRAFT	UGX	\N	\N	cmtb2zxbk0001l704tj29danq	\N	25500000.00	0.00	4590000.00	VAT	18.000000	30090000.00	Lead Time: Delivery within 3 weeks from receipt of the LPO and agreed partial/advance payment, as the items are special-order imports. Warranty: All items will be supplied brand-new and genuine, with applicable manufacturer warranty; warranty claims are subject to the manufacturer’s terms and conditions.	2026-08-27 00:00:00	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	\N	2026-08-27 15:17:33.293	2026-08-28 11:15:07.175
cmtc0llt30001jo04h6kw9fbk	org_eis_01	EIS/QT/2026/0011	DRAFT	UGX	\N	\N	cmt8hxza70001jx0441s93o2k	\N	0.00	0.00	0.00	VAT	18.000000	0.00	\N	2026-08-27 00:00:00	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	\N	2026-08-27 21:08:20.008	2026-08-27 21:16:34.866
cmtc0tiu50005jo045ot75e70	org_eis_01	EIS/QT/2026/0012	DRAFT	UGX	\N	\N	cmt8hxza70001jx0441s93o2k	\N	4600000.00	0.00	828000.00	VAT	18.000000	5428000.00	\N	2026-08-27 00:00:00	\N	\N	\N	\N	cmns5jbas00002lfw97nnwshd	\N	\N	2026-08-27 21:14:29.405	2026-08-27 21:14:29.405
cmtcva7jz0001ju04urjfibwk	org_eis_01	EIS/QT/2026/0013	ACCEPTED	UGX	\N	\N	cmqrviwz30001l804b3yf4pie	\N	10000000.00	0.00	0.00	\N	\N	10000000.00	\N	2026-08-28 00:00:00	\N	2026-08-28 11:27:27.99	2026-08-28 11:27:47.266	\N	cmns5jbas00002lfw97nnwshd	cmns5jbas00002lfw97nnwshd	\N	2026-08-28 11:27:16.415	2026-08-28 11:27:47.266
\.


--
-- Data for Name: QuotationItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."QuotationItem" (id, "quotationId", "partId", description, quantity, "unitPrice", discount, "lineTotal", "createdAt") FROM stdin;
cmpva8dfx0004gp04gg8nvgim	cmpva8dfx0003gp041brntu52	\N	MacBook Air M5 16/512	1	5650000.00	0.00	5650000.00	2026-06-01 14:06:46.797
cmpva8dfx0005gp04b284543j	cmpva8dfx0003gp041brntu52	\N	MacBook Pro M5 16/512	1	6650000.00	0.00	6650000.00	2026-06-01 14:06:46.797
cmqp0qe930009jm044pvhuweh	cmqp0qe930007jm04pnnou3x3	\N	Dell Tower Desktop – Professional Specifications Intel® Core™ i3 Processor 4GB RAM 128GB SSD + 500GB HDD 19-inch Monitor USB Keyboard & Mouse Windows Operating System	10	1300000.00	0.00	13000000.00	2026-06-22 09:33:56.775
cmqp0qe93000ajm04m3s8ghn8	cmqp0qe930007jm04pnnou3x3	\N	Transport	1	300000.00	0.00	300000.00	2026-06-22 09:33:56.775
cmqtm4lm10004ky04pnysi6no	cmqtm4lm10001ky0455v2thy5	\N	Hollyland Lark M2S Combo (Camera RX+USB-C RX+ Lightning Cable) Wireless Lavalier Microphone for iPhone/Camera/Android/PC, Titanium Clip, Noise Cancelling, 30H Use, Vlog, Interview, Content Creation	1	1200000.00	0.00	1200000.00	2026-06-25 14:43:56.137
cmqtm4lm10005ky04gmvfdgxk	cmqtm4lm10001ky0455v2thy5	\N	External SSD Drive – 2TB, USB-C/USB 3.2, High-Speed Portable Storage	1	800000.00	0.00	800000.00	2026-06-25 14:43:56.137
cmraczu4o0005gy04amux9g88	cmraczu4o0003gy04r6cqcib8	\N	Dell Latitude 5350*360 Intel Core i7 13th Generation 32gb Ram Memory, 512gb SSD storage drive, Touch Screen, 13.3” inch Display, Fingerprint Reader, Backlite Keyboard, Grey Colour, Sim Card Slot (GSM)	1	5500000.00	0.00	5500000.00	2026-07-07 08:00:22.345
cmruewu0z0001la040h4dgb85	cmrueqsqy0003jr044sw6rppx	\N	Apple Magic Mouse 3 (USB-C Version) Wireless Bluetooth Mouse Multi-Touch Surface (Scroll & Gesture Support) Rechargeable Built-in Battery USB-C Charging Port Compatible with Mac & iPad Automatic Pairing with Apple Devices Color: White	1	380000.00	0.00	380000.00	2026-07-21 08:49:24.995
cmt0b2x400004l704ahbrd83a	cmt0b2x400002l704a3ja4t95	\N	IPHONE 17 256GB -6.3-inch Super Retina XDR OLED, 120Hz	1	3800000.00	0.00	3800000.00	2026-08-19 16:28:29.856
cmt2mzn2t0001k0040q4l1l7b	cmqp0g9y30003kz04crfa1cn3	\N	Dell Tower Desktop – Professional Specifications Intel® Core™ i3 Processor 4GB RAM 128GB SSD + 500GB HDD 19-inch Monitor USB Keyboard & Mouse Windows Operating System	10	2400000.00	0.00	24000000.00	2026-08-21 07:37:24.63
cmt8l8so80003jp04gd77awnm	cmt8l8so80001jp04o8w6q4so	\N	Tecno Spark 50 — 8GB RAM / 128GB ROM	2	610000.00	0.00	1220000.00	2026-08-25 11:35:09.608
cmtbo2i250003l204tiu0q3i1	cmtbo2i250001l20498fxl0rp	cmtb30xg80001l904qz5hpp27	Microsoft Surface Pro 13-inch (12th Edition) 2-in-1 Laptop — Snapdragon X2 Elite (12-Core), OLED Display, Dune, 16GB RAM, 1TB SSD, supplied with Surface Pro Keyboard with Slim Pen, Surface Slim Pen, Surface USB-C Travel Hub, Surface USB4 Dock, Surface Arc Mouse (Light Gray), Microsoft Complete protection and Microsoft 365 Personal.	1	19500000.00	0.00	19500000.00	2026-08-27 15:17:33.293
cmtbo2i250004l204dawfvrtd	cmtbo2i250001l20498fxl0rp	cmtb31jqc0003l904p4oceh72	Dell UltraSharp U4323QE 43-inch 4K UHD USB-C Hub Monitor, 42.51” IPS display, 3840 × 2160 resolution at 60Hz, 350 nits brightness, 1,000:1 contrast ratio, 95% sRGB, anti-glare coating, height/swivel/tilt adjustable stand, integrated USB-C hub with up to 90W Power Delivery, KVM functionality, 2× DisplayPort, 2× HDMI, USB-C and USB-A connectivity, Gigabit Ethernet (RJ45), and integrated speakers.	1	6000000.00	0.00	6000000.00	2026-08-27 15:17:33.293
cmtc0tiu50007jo0463z67ete	cmtc0tiu50005jo045ot75e70	cmtc0r9gz0001jp040olrnyd8	HP ProDesk 600 G4 SFF – Intel Core i5-8500, 8th Gen, 8GB DDR4 RAM, 512GB SSD, HP 22” FHD Monitor, HP USB Keyboard & Mouse. Condition: Refurbished	2	2300000.00	0.00	4600000.00	2026-08-27 21:14:29.405
cmqrvix370005l804w8kbanmv	cmqrvix360003l8048cd5xxgp	\N	Apple iMac 24" 4.5K Retina (2024) – Refurbished ([redacted] Condition) 24-inch 4.5K Retina Display Apple M4 Chip 24GB Unified Memory (RAM) 512GB SSD Storage Wireless Keyboard & Mouse Included Refurbished – [redacted] Condition	1	8000000.00	0.00	8000000.00	2026-06-24 09:31:28.387
cmqtm4lm10003ky04msv18689	cmqtm4lm10001ky0455v2thy5	\N	Apple iMac 24" 4.5K Retina (2024) – Refurbished ([redacted] Condition) 24-inch 4.5K Retina Display Apple M4 Chip 24GB Unified Memory (RAM) 512GB SSD Storage Wireless Keyboard & Mouse Included Refurbished – [redacted] Condition	1	8000000.00	0.00	8000000.00	2026-06-25 14:43:56.137
cmtcva7jz0003ju046kv7nsrt	cmtcva7jz0001ju04urjfibwk	\N	Apple iMac 24" 4.5K Retina (2024) – Refurbished ([redacted] Con-dition) 24-inch 4.5K Retina Display Apple M4 Chip 24GB Uni-fied Memory (RAM) 512GB SSD Storage Wireless Keyboard & Mouse Included	1	10000000.00	0.00	10000000.00	2026-08-28 11:27:16.415
\.


--
-- Data for Name: RateLimit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RateLimit" (key, count, "resetAt") FROM stdin;
\.


--
-- Data for Name: Receipt; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Receipt" (id, "orgId", "receiptNumber", "paymentId", "saleId", "invoiceId", "branchId", "clientId", amount, currency, "exchangeRateToBase", "issuedAt", "issuedById", "voidedAt", "voidReason") FROM stdin;
cmq6p5v7b0005jy0475un093h	org_eis_01	RCT-2026-0001	cmq6p5ufg0004jy0475wvh6hj	\N	cmq6p4qoq0003ld04nfoenrev	\N	cmq6p2rvx0001ld040fcrj2m2	600000.00	UGX	\N	2026-06-09 13:50:12.024	cmns5jbas00002lfw97nnwshd	\N	\N
cmshf5e630006l504mqgo44ra	org_eis_01	EIS/RCT/2026/0002	cmshf5dt00003l5048b537t1w	\N	cmshf1xad000cl4047oxti93v	\N	\N	300000.00	UGX	\N	2026-08-06 11:14:46.395	cmns5nlp700042lmerqro7219	\N	\N
cmshypc950005ju05n54ggmbf	org_eis_01	EIS/RCT/2026/0003	cmshypc0s0003ju05x5dikxq1	\N	cmpv8i9290003jp04u0i3x66q	\N	\N	500000.00	UGX	\N	2026-08-06 20:22:09.737	cmns5jbas00002lfw97nnwshd	\N	\N
cmsj680zm0005la04z8e2jujf	org_eis_01	EIS/RCT/2026/0004	cmsj680s30003la04u7yndvl9	\N	cmsj633r20005l804jdbs0n41	\N	\N	1588.00	UGX	\N	2026-08-07 16:40:25.09	cmns5jbas00002lfw97nnwshd	\N	\N
cmsq54ja20005kw04go4w4tu1	org_eis_01	EIS/RCT/2026/0005	cmsq54j3c0003kw04x5dfq9h9	\N	cms7hzehm0001lc04dpoamos1	\N	cmrx4tatr0001l604eup4vzz5	200000.00	UGX	\N	2026-08-12 13:44:05.787	cmns5jbas00002lfw97nnwshd	\N	\N
cmsq57jcp0005ju0467fsskm5	org_eis_01	EIS/RCT/2026/0006	cmsq57j5t0003ju041ldbyfyl	\N	cmsn90okd0003lg04jwhk7us3	\N	cmshqrqca0001l504n83r3qtl	440000.00	UGX	\N	2026-08-12 13:46:25.849	cmns5jbas00002lfw97nnwshd	\N	\N
cmsz05s4p000nl804m07rbbbj	org_eis_01	EIS/RCT/2026/0007	cmsz05rui000ll804mv8mx5jl	cmsyzux110001l804sky5qooo	\N	\N	\N	2260000.00	UGX	\N	2026-08-18 18:35:01.417	cmns5nlp700042lmerqro7219	\N	\N
cmsz09uwi0007js046z7q49nv	org_eis_01	EIS/RCT/2026/0008	cmsz09umv0005js0493nrcu22	cmsz07n5y0001lb04mzqu01lz	\N	\N	\N	60000.00	UGX	\N	2026-08-18 18:38:11.634	cmns5nlp700042lmerqro7219	\N	\N
cmsz0baoy0003lc04xp2e4ve7	org_eis_01	EIS/RCT/2026/0009	cmsz0bag60001lc04ovo0pp9e	cmsz0a72t0001l104wwwwffau	\N	\N	\N	80000.00	UGX	\N	2026-08-18 18:39:18.755	cmns5nlp700042lmerqro7219	\N	\N
cmsz0jfn20003ld0449s69e51	org_eis_01	EIS/RCT/2026/0010	cmsz0jfce0001ld04hkyp2z9j	\N	cmrd9glwq0001ie048lr3czn2	\N	\N	200000.00	UGX	\N	2026-08-18 18:45:38.415	cmns5nlp700042lmerqro7219	\N	\N
cmsz0lfuf000cld04b5ao0yxj	org_eis_01	EIS/RCT/2026/0011	cmsz0lfkc000ald049jp4gekb	\N	cmqryg62w0003l404fuu1aa7i	\N	\N	370000.00	UGX	\N	2026-08-18 18:47:11.992	cmns5nlp700042lmerqro7219	\N	\N
cmsz0m2n9000lld04tto4h2am	org_eis_01	EIS/RCT/2026/0012	cmsz0m2ey000jld041entljn3	\N	cmsj66v6h0009l804vxdxo6o8	\N	\N	1874.00	UGX	\N	2026-08-18 18:47:41.541	cmns5nlp700042lmerqro7219	\N	\N
cmt2mbeau0009k2043s4nxbcj	org_eis_01	EIS/RCT/2026/0013	cmt2mbdzw0007k2045ce096tw	cmt2m84it0001k204z2r3a8cb	\N	\N	\N	10000.00	UGX	\N	2026-08-21 07:18:33.511	cmns5nkty00012lme8d0os7dx	\N	\N
cmt2mg8bq0003jy04n5ffj99s	org_eis_01	EIS/RCT/2026/0014	cmt2mg81h0001jy04jli73dw5	\N	cmsh7ok7v0005l404ivxv06hs	\N	\N	719800.00	UGX	\N	2026-08-21 07:22:19.046	cmns5jbas00002lfw97nnwshd	\N	\N
cmt2n6ss90003kw04jafl4c11	org_eis_01	EIS/RCT/2026/0015	cmt2n6sfk0001kw0481dq62ch	\N	cmt2n0pks0001l304mx8llmen	\N	\N	24000000.00	UGX	\N	2026-08-21 07:42:58.618	cmns5jbas00002lfw97nnwshd	\N	\N
cmt33g8um0003l3048twejclq	org_eis_01	EIS/RCT/2026/0016	cmt33g8k60001l304cf9ivfiu	cmt33f7ct0001jl0410ylcthn	\N	\N	\N	80000.00	UGX	\N	2026-08-21 15:18:13.198	cmns5nkty00012lme8d0os7dx	\N	\N
cmt33jyqc0007jl04gt3753e6	org_eis_01	EIS/RCT/2026/0017	cmt33jyf50005jl04ozeud9xr	cmt33ikwd000al304n26cada1	\N	\N	\N	50000.00	UGX	\N	2026-08-21 15:21:06.709	cmns5nkty00012lme8d0os7dx	\N	\N
cmt33lkjz000gl304g4w2lch0	org_eis_01	EIS/RCT/2026/0018	cmt33lk8d000el304f7bu0abg	cmt33kfcs000ejl04fde8xgac	\N	\N	\N	20000.00	UGX	\N	2026-08-21 15:22:21.648	cmns5nkty00012lme8d0os7dx	\N	\N
cmt34ixdq0005l804nvq3sjgb	org_eis_01	EIS/RCT/2026/0019	cmt34ix2f0003l804c68j9xfq	cmt34i10q0001jm04iba9ric5	\N	\N	\N	20000.00	UGX	\N	2026-08-21 15:48:17.918	cmns5nkty00012lme8d0os7dx	\N	\N
cmt45mtz80005ky04zclff901	org_eis_01	EIS/RCT/2026/0020	cmt45mtnu0003ky048snzcjsv	cmt45ltff0001ky04tvds5gog	\N	\N	\N	100000.00	UGX	\N	2026-08-22 09:07:05.924	cmns5nkty00012lme8d0os7dx	\N	\N
cmt8u4dzs000pjl040exr5ylh	org_eis_01	EIS/RCT/2026/0021	cmt8u4do8000njl044o0o6j6s	\N	cmt8u3t8j000zjr040km4mcql	\N	cmt7eivmb0001jn04xn977rlu	40000.00	UGX	\N	2026-08-25 15:43:40.504	cmns5jbas00002lfw97nnwshd	\N	\N
cmt8u92550019jl04b1z3x1g7	org_eis_01	EIS/RCT/2026/0022	cmt8u91w00017jl04j852sisk	\N	cmt8u91ft0014jl04jnulauut	\N	cmt7ar8z00001ju04gzhve8ht	100000.00	UGX	\N	2026-08-25 15:47:18.426	cmns5jbas00002lfw97nnwshd	\N	\N
cmt8urw9i002yjl04ukhg6fft	org_eis_01	EIS/RCT/2026/0023	cmt8urvxd002wjl045wod0m22	\N	cmt8ur5c70021jr04ev3ltmyp	\N	cmt2l4l3j0001jx04pa3xz79t	300000.00	UGX	\N	2026-08-25 16:01:57.27	cmns5jbas00002lfw97nnwshd	\N	\N
cmtbjj3c6000pjn04r15ti8j6	org_eis_01	EIS/RCT/2026/0024	cmtbjj325000njn04o6svmjw1	\N	cmtbjj1v8000kjn044f8e6ke8	\N	cmrkk87s20001k104tq42br03	610000.00	UGX	\N	2026-08-27 13:10:29.286	cmns5jbas00002lfw97nnwshd	\N	\N
cmtcwsod4000ojr04i1diz61h	org_eis_01	EIS/RCT/2026/0025	cmtcwso3o000mjr04afb4o7lt	\N	cmtcws0ki0005jr04ozickr78	\N	cmo4wu48c0006l104rou4hqx4	400000.00	UGX	\N	2026-08-28 12:09:37.625	cmns5jbas00002lfw97nnwshd	\N	\N
cmtd3uwkf0008jr041uri3h4p	org_eis_01	EIS/RCT/2026/0026	cmtd3uwam0006jr043e7v9x6r	\N	cmtd3uvra0003jr048qiz8y98	\N	cmor28wrb0005ld047nu8xay5	250000.00	UGX	\N	2026-08-28 15:27:18.879	cmns5jbas00002lfw97nnwshd	\N	\N
cmtd46qqx0008ju042l8bv620	org_eis_01	EIS/RCT/2026/0027	cmtd46qgq0006ju04ckh74byy	\N	cmtd46py70003ju04hdcssbcn	\N	cmor28wrb0005ld047nu8xay5	50000.00	UGX	\N	2026-08-28 15:36:31.209	cmns5jbas00002lfw97nnwshd	\N	\N
cmtd97wli0003js040obeadfq	org_eis_01	EIS/RCT/2026/0028	cmtd97w8v0001js04brp25p6u	\N	cmtcsfsen0001jv04fz4aemy1	\N	\N	1220000.00	UGX	\N	2026-08-28 17:57:23.527	cmns5jbas00002lfw97nnwshd	\N	\N
cmtfhafhn0003ic044jc4s2di	org_eis_01	EIS/RCT/2026/0029	\N	\N	cmt6zope10001jt04cy5ca1wf	\N	\N	650000.00	UGX	\N	2026-08-30 07:18:50.604	cmns5jbas00002lfw97nnwshd	2026-08-30 07:57:49.55	Payment deleted
cmtfhcfmr000eic04xtm52xr6	org_eis_01	EIS/RCT/2026/0030	\N	\N	cmt8ujde80016ky043ck12zdi	\N	\N	450000.00	UGX	\N	2026-08-30 07:20:24.099	cmns5jbas00002lfw97nnwshd	2026-08-30 07:56:16.945	Payment deleted
cmtfipng50003le04p0yhivuw	org_eis_01	EIS/RCT/2026/0031	cmtfipn390001le04qjczs5yt	\N	cmt8ujde80016ky043ck12zdi	\N	\N	450000.00	UGX	\N	2026-08-30 07:58:40.374	cmns5jbas00002lfw97nnwshd	\N	\N
cmtfiudxe000cle04i40nxwzj	org_eis_01	EIS/RCT/2026/0032	cmtfiudmp000ale04ohxi6bsn	\N	cmtfisrah000fl204o6fem91v	\N	\N	100000.00	UGX	\N	2026-08-30 08:02:21.314	cmns5jbas00002lfw97nnwshd	\N	\N
cmtfiwhxl000lle04b4bo3w3n	org_eis_01	EIS/RCT/2026/0033	cmtfiwhm9000jle04sjyqmtoi	\N	cmtfiwbb9000ol204gldyd1xm	\N	\N	40000.00	UGX	\N	2026-08-30 08:03:59.817	cmns5jbas00002lfw97nnwshd	\N	\N
cmtoeff30000bl404s23zwwqe	org_eis_01	EIS/RCT/2026/0034	cmtoefer70009l404bwtyr6fb	cmtoee34u0007l404zc8x7opy	\N	\N	\N	30000.00	UGX	\N	2026-09-05 13:08:40.093	cmns5nkty00012lme8d0os7dx	\N	\N
cmtoeg2kc0009kv04hcwj1ti2	org_eis_01	EIS/RCT/2026/0035	cmtoeg28z0007kv04040tmcv2	cmtoecj180008l404xww7ymz2	\N	\N	\N	100000.00	UGX	\N	2026-09-05 13:09:10.524	cmns5nkty00012lme8d0os7dx	\N	\N
cmtoegohc000el404fwardlaq	org_eis_01	EIS/RCT/2026/0036	cmtoego5i000cl404lelzft8m	cmtoeb0h70001l404xbb1apkd	\N	\N	\N	120000.00	UGX	\N	2026-09-05 13:09:38.929	cmns5nkty00012lme8d0os7dx	\N	\N
cmtof5rio0003k004neetq6lk	org_eis_01	EIS/RCT/2026/0037	cmtof5r8d0001k0045jb5lj42	cmtof4d1m0001ie04gyymbyk3	\N	\N	\N	60000.00	UGX	\N	2026-09-05 13:29:09.265	cmns5nkty00012lme8d0os7dx	\N	\N
cmtof82bq0009ie04bpueat1p	org_eis_01	EIS/RCT/2026/0038	cmtof82080007ie04vrx4p0cd	cmtof6qu80001jo04nfbc8o32	\N	\N	\N	380000.00	UGX	\N	2026-09-05 13:30:56.583	cmns5nkty00012lme8d0os7dx	\N	\N
cmtof9jkz0007jo04xhcbbzgw	org_eis_01	EIS/RCT/2026/0039	cmtof9j9y0005jo04j6gl936z	cmtof8vs90003jo040xu2gloc	\N	\N	\N	25000.00	UGX	\N	2026-09-05 13:32:05.604	cmns5nkty00012lme8d0os7dx	\N	\N
cmtofbkm9000gk004634n7b74	org_eis_01	EIS/RCT/2026/0040	cmtofbkbt000ek0049lfbewd7	cmtof9ywv000ak004lvmx265e	\N	\N	\N	70000.00	UGX	\N	2026-09-05 13:33:40.258	cmns5nkty00012lme8d0os7dx	\N	\N
cmtofecif000pk004vb9h159m	org_eis_01	EIS/RCT/2026/0041	cmtofec81000nk004rsdc6pxb	cmtofcll8000gie044ndr8paw	\N	\N	\N	100000.00	UGX	\N	2026-09-05 13:35:49.719	cmns5nkty00012lme8d0os7dx	\N	\N
cmtofh02s000kie04y9gdqapr	org_eis_01	EIS/RCT/2026/0042	cmtofgzno000iie04q9xljms1	cmtofga580005l804qo0d1200	\N	\N	\N	50000.00	UGX	\N	2026-09-05 13:37:53.572	cmns5nkty00012lme8d0os7dx	\N	\N
cmtofi9y00007ju04a0vei37t	org_eis_01	EIS/RCT/2026/0043	cmtofi9ms0005ju04vrpbkp38	cmtofhi7z000wk004ct3ogpci	\N	\N	\N	40000.00	UGX	\N	2026-09-05 13:38:53.016	cmns5nkty00012lme8d0os7dx	\N	\N
cmtofkd5u000mju043f1m9wzh	org_eis_01	EIS/RCT/2026/0044	cmtofkcuq000kju04o5e2bnwf	cmtofjcri000eju04zz8qlai6	\N	\N	\N	20000.00	UGX	\N	2026-09-05 13:40:30.498	cmns5nkty00012lme8d0os7dx	\N	\N
cmtr0fnnr0003l704bgzhozv1	org_eis_01	EIS/RCT/2026/0045	cmtr0fn9i0001l704qnig1ga3	cmtoe71yn0005l404w048am0t	\N	\N	\N	20000.00	UGX	\N	2026-09-07 09:00:15.111	cmns5nkty00012lme8d0os7dx	\N	\N
cmtr0gsoz000cl704f17b0x2c	org_eis_01	EIS/RCT/2026/0046	cmtr0gsgg000al704ccsjz6ws	cmtoe1462000hjn04z15yuq5s	\N	\N	\N	30000.00	UGX	\N	2026-09-07 09:01:08.291	cmns5nkty00012lme8d0os7dx	\N	\N
cmtr7gly30004l504ylq0t6r1	org_eis_01	EIS/RCT/2026/0047	cmtr7glm80002l5045m6k6rei	\N	cmsbmp6g00003jm04qnsh3z3y	\N	cmntvqwbw0000l704etryfmwr	180000.00	UGX	\N	2026-09-07 12:16:56.86	cmns5jbas00002lfw97nnwshd	\N	\N
cmtr7mlnl000ola04o5skqi4r	org_eis_01	EIS/RCT/2026/0048	cmtr7mleo000mla04pmycr7fh	\N	cmtr7mkyo000jla04mmzlut58	\N	cmratfqe3000zkw04iv172urq	120000.00	UGX	\N	2026-09-07 12:21:36.417	cmns5jbas00002lfw97nnwshd	\N	\N
cmtsin2ev0003jo04lltexedw	org_eis_01	EIS/RCT/2026/0049	cmtsin24i0001jo04da3z15vz	\N	cmtsimutg0001jy04p3rg7061	\N	\N	3800000.00	UGX	\N	2026-09-08 10:17:40.087	cmns5jbas00002lfw97nnwshd	\N	\N
\.


--
-- Data for Name: RecurringExpense; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RecurringExpense" (id, "orgId", description, category, amount, currency, "supplierId", frequency, "nextDueAt", "lastIssuedAt", "isActive", "autoIssue", notes, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RecurringInvoice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RecurringInvoice" (id, "orgId", "clientId", subject, "invoiceType", frequency, "nextDueAt", "lastIssuedAt", currency, "exchangeRateToBase", notes, "isActive", "autoIssue", "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RecurringInvoiceItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RecurringInvoiceItem" (id, "recurringInvoiceId", description, quantity, "unitPrice", "discountAmount", "lineTotal") FROM stdin;
\.


--
-- Data for Name: Refund; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Refund" (id, "orgId", "saleId", "invoiceId", "creditNoteId", currency, "exchangeRateToBase", amount, method, reference, "refundedAt", "createdById", note, "createdAt") FROM stdin;
\.


--
-- Data for Name: ReorderRule; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReorderRule" (id, "orgId", "partId", "locationId", "minQty", "targetQty", "preferredSupplierId", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: RepairMessage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RepairMessage" (id, "orgId", "jobId", "clientId", "authorType", "authorId", "authorName", body, "createdAt") FROM stdin;
\.


--
-- Data for Name: RepairRequest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RepairRequest" (id, "requestNumber", "requestStatus", "handoverStatus", "orgId", "customerName", phone, email, "preferredContactMethod", "deviceType", brand, model, "serialNumber", "problemDescription", "handoverMethod", "preferredDropoffDate", "preferredDropoffTime", "dropoffNotes", "deliveryPersonName", "deliveryPersonPhone", "deliveryCompany", "dispatchDate", "expectedArrivalTime", "deliveryTrackingReference", "deliveryFeeResponsibility", "deliveryNotes", "pickupAddress", "pickupLandmark", "preferredPickupDate", "preferredPickupTime", "alternateContactPerson", "alternateContactPhone", "pickupNotes", "linkedJobId", "clientId", "submittedByPortalUserId", "submissionIp", "createdAt", "updatedAt") FROM stdin;
cmnwoq01w0000jy04cawvlfvo	REQ-2026-0009	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer C775F5	+256784642449	request-c775f527@example.test	WHATSAPP	MAC	Apple	MacBook Air 11 inch - 2010	\N	The keyboard isn't working after liquid accident.	SELF_DROPOFF	2026-04-13	08:00-10:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmnwq8etq0002le040f85l0el	\N	\N	41.210.155.145	2026-04-13 04:20:45.38	2026-04-25 18:36:43.121
cmnstknfq0000jy04ckofpp35	REQ-2026-0001	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer F9EFAF	+256713494270	request-f9efaf6c@example.test	WHATSAPP	WINDOWS_PC	HP	Hp Elite [redacted] 830 G8	\N	It heated up an blacked out. According to the user, and it has since refused to come up even after charging it. The user was attending Ann online class.	REQUEST_PICKUP	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	Plot 270, Kampala	\N	2026-04-10	14:00-16:00	\N	\N	\N	cmnsu3ijh0002lb078t7sn6xy	\N	\N	196.0.19.10	2026-04-10 11:25:29.126	2026-04-25 18:37:10.274
cmnwj306z0000ju048ae568os	REQ-2026-0008	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer F18D2E	+256712035617	request-f18d2eb8@example.test	WHATSAPP	MAC	Apple	2010	\N	Won't [redacted] to display, it remains idol at the apple sign.	SELF_DROPOFF	2026-04-13	08:00-10:00	Will call when on my way.	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmnwq8pos0007le04dhyv4ff9	\N	\N	41.210.154.24	2026-04-13 01:42:54.395	2026-04-25 18:36:52.908
cmo1nrqvo0000l104sdo0ptm0	REQ-2026-0007	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 989C06	+256780621038	\N	WHATSAPP	PHONE_IPHONE	Apple	A1688	\N	Charging Failure,\\Malfunction its not charging so am not sure if some exchanged my battery, charging cable rejection. no response after charger connection .	SELF_DROPOFF	2026-04-16	16:00-17:00	i have dropped it	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmo1rje8j0002l604c33r6eaa	\N	\N	102.222.235.205	2026-04-16 15:52:58.068	2026-04-25 18:36:07.868
cmog7k9q70000js04pkzpgnce	REQ-2026-0017	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer E2CFB1	+256700147884	request-e2cfb131@example.test	WHATSAPP	MAC	Apple	M1	\N	Machine has a water spill, cant start	SELF_DROPOFF	2026-04-27	10:00-12:00	I hope to spend a little time to diagnose	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmog7m2lf0002l204qn71ckls	\N	\N	102.215.109.178	2026-04-26 20:15:48.031	2026-04-26 20:17:12.306
cmoh5gu450000l1047kk3rpwg	REQ-2026-0018	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 4277AA	+256775714004	request-4277aa1c@example.test	WHATSAPP	MAC	Apple	2017	\N	Auto powers off and freezes	SELF_DROPOFF	2026-04-27	14:00-16:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmoh5houk0002l4042cpk8nlw	\N	\N	102.222.234.184	2026-04-27 12:04:54.773	2026-04-27 12:05:34.775
cmomrvcqi0000lk04324awkpk	REQ-2026-0019	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 43EAFD	+256793559085	request-43eafddb@example.test	WHATSAPP	PHONE_IPHONE	Apple	Apple iPhone 15 Pro Max	\N	Fix my iphone 15 pro max	SELF_DROPOFF	2026-05-01	10:00-12:00	Please help my wife fix her phone	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmoq1uf4r0008ic04v6upkayn	\N	\N	41.84.201.83	2026-05-01 10:30:54.522	2026-05-03 17:33:25.822
cmor27a1a0000ld04emqljquy	REQ-2026-0024	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 0ABA2E	+256759391383	request-0aba2e09@example.test	WHATSAPP	MAC	Apple	A1398	\N	machine Doesnt power on, Came Open with no screws	SELF_DROPOFF	2026-05-04	12:00-14:00	Dropped off by [redacted]	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmor290bl000cld04m1gr8l7e	\N	\N	102.222.234.162	2026-05-04 10:31:11.758	2026-05-04 10:32:32.746
cmor27aax0001ld04snvlw2zv	REQ-2026-0025	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 75C01E	+256755624907	request-75c01eef@example.test	WHATSAPP	MAC	Apple	A1398	\N	No Power, abrupt power off	SELF_DROPOFF	2026-05-04	12:00-14:00	Dropped off by [redacted]	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmor28wvg0007ld040vdce04z	\N	\N	102.222.234.162	2026-05-04 10:31:12.105	2026-05-04 10:32:28.168
cmpjofb500000jt04bmrir1ea	REQ-2026-0026	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer B1000A	+256705707300	request-b1000a07@example.test	WHATSAPP	WINDOWS_PC	Dell	Dell xps	\N	It sat in water after heavy downpour	SELF_DROPOFF	2026-05-25	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmpjp0oae0002jv0407uuhi7e	\N	\N	102.222.235.20	2026-05-24 11:10:50.917	2026-05-24 11:27:27.916
cmq2dhb0c0001ii04f84i8wyj	REQ-2026-0028	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 2EFC95	+256777187915	request-2efc95b3@example.test	WHATSAPP	WINDOWS_PC	Lenovo ThinkPad	ThinkPad	\N	Power issue pc doesn’t start	SELF_DROPOFF	2026-06-06	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmq2dj66v000bii049kc7ehpq	\N	\N	102.222.235.4	2026-06-06 13:12:05.628	2026-06-06 13:13:32.914
cmq9ji6fu0001l204l4x653r6	REQ-2026-0029	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 0894FE	+256738680926	request-0894fe6f@example.test	WHATSAPP	PHONE_IPHONE	iPhone	iPhone 14 Pro Max	\N	The screen is damaged and it can't show anything. The behind glass also has issues	SELF_DROPOFF	2026-06-12	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmqfb4wou0003ic046xu0e4o7	\N	\N	41.210.141.17	2026-06-11 13:35:07.291	2026-06-15 14:27:29.043
cmras1j500001k0043q8jklq7	REQ-2026-0030	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 96C180	+256717874882	request-96c180ae@example.test	WHATSAPP	WINDOWS_PC	Lenovo ThinkPad T14	\N	\N	The Laptop is not charging.	SELF_DROPOFF	2026-07-07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmratfqqd0011kw04x57howiv	\N	\N	45.221.72.130	2026-07-07 15:01:35.652	2026-07-07 15:40:38.884
cms37t0b30001jy04nfmclqic	REQ-2026-0036	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 82697E	+256796517811	request-82697eee@example.test	WHATSAPP	WINDOWS_PC	LENOVO THINKPAD	\N	\N	Laptop wasn't powering	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 8269	+256767871993	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cms65nsn30003l404ivvbxkkv	\N	\N	102.217.133.179	2026-07-27 12:40:24.784	2026-07-29 14:03:41.1
cmt78u2pm0001l304agl7jhe9	REQ-2026-0047	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer D7DDF7	+256771214578	request-d7ddf7d8@example.test	WHATSAPP	MAC	Apple	\N	\N	Screen not displaying	SELF_DROPOFF	2026-08-24	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmt7eivuy0003jn04a53ddidd	\N	\N	102.222.235.151	2026-08-24 13:00:01.21	2026-08-24 15:39:17.022
cms37wdli0001jr04mrx2a9t5	REQ-2026-0037	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer F0D06A	+256722665821	request-f0d06a8d@example.test	WHATSAPP	WINDOWS_PC	THINKBOOK	\N	\N	There was lemonade spillage in the computer	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier F0D0	+256742189400	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cms65q5hk000jl404zid2jq7u	\N	\N	102.217.133.179	2026-07-27 12:43:01.974	2026-07-29 14:05:31.1
cms4iea8r0001ic04fkiciibc	REQ-2026-0038	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer F67B25	+256783855770	request-f67b25e3@example.test	WHATSAPP	MAC	Apple	Macbook	\N	Water spilled on it yesterday	SELF_DROPOFF	2026-07-28	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cms65prca000bl404daeh0idg	\N	\N	102.222.235.60	2026-07-28 10:24:39.772	2026-07-29 14:05:12.66
cms5qu1zz0001ji04snj7sprf	REQ-2026-0039	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 236C32	+256783396787	request-236c3246@example.test	WHATSAPP	WINDOWS_PC	DELL INC	DELL	\N	LAPTOP NOT CHARGING	SELF_DROPOFF	2026-02-07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cms65p1wt000bjt04eds8aj7f	\N	\N	45.221.72.130	2026-07-29 07:08:38.687	2026-07-29 14:04:39.732
cmsh7bmtc0007jo04vqfqw4na	REQ-2026-0042	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer A22E9F	+256770421078	request-a22e9fe4@example.test	WHATSAPP	WINDOWS_PC	Hp	Hp 450 G8	MAAD - 024/2021	Machine is slow, faulty touchPad and with Keyboard issues	SELF_DROPOFF	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmsh7cf7x0003le04n0oj6n6l	cmrkk87s20001k104tq42br03	cmsh77rju0002jo04ftu1wwz8	\N	2026-08-06 07:35:40.608	2026-08-06 07:36:18.045
cmsqbmegc0001l40402su0c6a	REQ-2026-0044	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer BED7D1	+256742417706	request-bed7d175@example.test	WHATSAPP	WINDOWS_PC	Lenovo V14 i3 16GB RAM/477GB	Lenovo V14 i3 16GB RAM/477GB	\N	LAPTOP NOT POWERING AND NOT CHARGING	SELF_DROPOFF	2026-08-12	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmsrk2mox0003l70498wl0fy3	\N	\N	45.221.72.130	2026-08-12 16:45:57.036	2026-08-13 13:30:17.862
cmt7aq8j50001l204o8hbqm0k	REQ-2026-0048	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer D9CAB7	+256713946184	request-d9cab716@example.test	WHATSAPP	MAC	Apple	imac	\N	Drivers for Mac not responding	SELF_DROPOFF	2026-08-25	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmt7ar99w0003ju04c9er75u9	\N	\N	102.222.235.151	2026-08-24 13:53:01.361	2026-08-24 13:53:49.381
cmt8okflp0001jl04hcz1ktl5	REQ-2026-0049	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer D63B76	+256723810235	request-d63b7679@example.test	WHATSAPP	WINDOWS_PC	Lenovo	Lenovo Thinkbook i5 E15 16GB RAM/477GB	MP2FT9LC	BROKEN NEXT TO THE SCREEN BUT ITS WORKING FINE	SELF_DROPOFF	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmt8tu2ib0003ky0481qbonqu	cmratfqe3000zkw04iv172urq	cmsd0s7rk0001jj04bbtru39h	\N	2026-08-25 13:08:11.389	2026-08-25 15:35:39.257
cmtr8uc150001lg04djmmxu24	REQ-2026-0050	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer F500AF	+256778815364	request-f500afb9@example.test	WHATSAPP	WINDOWS_PC	Dell	\N	\N	Computer wasn't powering	SELF_DROPOFF	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmtrcxehd0001jm04kyz0a3gs	cmsrk2mef0001l704l0tqylkn	cmsd0s7rk0001jj04bbtru39h	\N	2026-09-07 12:55:36.81	2026-09-07 14:49:59.726
cmtsfy32z0001i304etuwxlas	REQ-2026-0051	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 783ACE	+256754444037	request-783ace97@example.test	WHATSAPP	WINDOWS_PC	DELL	Latitude 7200 2-in-1	\N	The laptop intermittently behaves as if there is no battery/power. The battery has already been replaced, and the problem can still occur even when powered directly from the original charger. I need motherboard-level diagnosis of the charging/power circuit, DC-in/USB-C power delivery, battery connector, charging IC/MOSFETs and BIOS/EC — not just another battery replacement.	SELF_DROPOFF	2026-09-08	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmtsg3gcs0003l704da1hlxqw	\N	\N	41.210.141.107	2026-09-08 09:02:15.323	2026-09-08 09:06:26.126
cmtslu9zv0001i904sy9orrsi	REQ-2026-0052	PENDING_FRONT_DESK	PENDING	org_eis_01	Customer 68BA09	+256706138940	request-68ba0923@example.test	WHATSAPP	WINDOWS_PC	LENOVO	Lenovo Thinkbook i5 E15 16GB RAM/477GB	MP2KZH7M	WATER SPILLED IN IT	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmratfqe3000zkw04iv172urq	cmsd0s7rk0001jj04bbtru39h	\N	2026-09-08 11:47:15.355	2026-09-08 11:47:15.488
cmtsmiqz70001l1044ek0qqj2	REQ-2026-0053	PENDING_FRONT_DESK	PENDING	org_eis_01	Customer 2F1746	+256718520967	request-2f1746cc@example.test	WHATSAPP	MAC	MacBook pro	MacBook pro 14 inch	\N	The computer is not booting fully and only displays the apple logo for a bit and then goes blank.	SELF_DROPOFF	2026-09-08	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	41.210.145.35	2026-09-08 12:06:17.107	2026-09-08 12:06:17.107
cmrkox8yr0001l3048x6d23tx	REQ-2026-0034	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 9E9A0D	+256720442983	request-9e9a0d66@example.test	WHATSAPP	WINDOWS_PC	Dell	Optiplex 5090	\N	It keeps on going on and off	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 9E9A	+256735471234	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmrlt6nyo0003jr04ftpsm3rh	cmratfqe3000zkw04iv172urq	\N	45.221.72.130	2026-07-14 13:31:58.756	2026-08-05 14:49:44.303
cmnufbx3a0000i804flrwhae0	REQ-2026-0002	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer E279DE	+256713660393	request-e279de52@example.test	WHATSAPP	WINDOWS_PC	Dell	Dell Latitude E7270 “ intel core i5	\N	My PC failed to turn back on after I had not used it for a while, so I really can’t point out a particular issue	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier E279	+256721126266	Personal Jaj guy	2026-04-06	09:00	\N	customer	Please notify me on what the issue is and how much it would cost to fix it	\N	\N	\N	\N	\N	\N	\N	cmnvkb8cr0002js04uodxmzrb	\N	\N	102.209.111.210	2026-04-11 14:22:19.462	2026-04-25 18:37:01.794
cmnx4ql7z0005jo04u8pu1b5o	REQ-2026-0012	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 91E3A4	+256753189101	request-91e3a4ab@example.test	WHATSAPP	MAC	Apple	MacBook Pro 13 inch - 2012	\N	Laptop does not power on There were issues with the sound prior to this I have included the power cable	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 91E3	+256742906194	\N	2026-04-13	15:50	\N	customer	\N	\N	\N	\N	\N	\N	\N	\N	cmnx5s5230002l1043j1ijvi7	\N	\N	129.205.21.175	2026-04-13 11:49:06.671	2026-04-25 18:36:31.337
cmnyisllr0000jp04cbq44nl4	REQ-2026-0006	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 939E9C	+256712244321	request-939e9cb7@example.test	WHATSAPP	OTHER	Apple	A1843	\N	Apple keyboard: main space bar and enter button on numeric keyboard are 'stuck' on one end 'raised up' on the other end.	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 939E	+256746766524	\N	2026-04-17	\N	\N	customer	Fred will be picking the keyboard from me on Thursday and bringing it / sending it to you on Friday sometime. He will be in contact to arrange transport etc.	\N	\N	\N	\N	\N	\N	\N	cmnyje50m0002l504rdwiruh6	\N	\N	102.86.6.150	2026-04-14 11:10:21.279	2026-04-25 18:36:20.458
cmriujv3j0001ks046cl8sq6m	REQ-2026-0031	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer FC2810	+256783858994	request-fc281060@example.test	WHATSAPP	WINDOWS_PC	LENOVO THINKPAD	THINKPAD	\N	IT IS NOT POWERING ON	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier FC28	+256775112935	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmriyhnq50003l804ft3d3jgk	\N	\N	102.217.133.179	2026-07-13 06:33:59.599	2026-07-13 08:24:15.43
cmrivc1050001lc045jfbliz7	REQ-2026-0032	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer DFC449	+256752010929	request-dfc44960@example.test	WHATSAPP	WINDOWS_PC	Lenovo	thinkbook 14	\N	Broken hinges	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier DFC4	+256781029673	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmriyhtv4000bl804u73oft3m	\N	\N	45.221.72.130	2026-07-13 06:55:53.621	2026-07-13 08:24:23.769
cmrjphsfo0001l504kcmlht5j	REQ-2026-0033	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer CCB8C5	+256741002351	request-ccb8c5ec@example.test	WHATSAPP	WINDOWS_PC	HP	HP	\N	- Keyboard - the ctrl button is spoilt - Mouse pad - it's faulty, you can't right click - Slow performance because of space, perhaps the RAM issues - Sometimes it freezes when working on heavy documents - I suggest you recommend a new machine with better performance because i receive heavy files from different sources - the machine can be allocated for other tasks that are less heavy.	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier CCB8	+256712252056	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmrkk87x70003k1047soc8sxe	\N	\N	196.250.68.199	2026-07-13 21:00:10.932	2026-07-14 11:20:32.811
cmroru8vd0001la04rkntkc61	REQ-2026-0035	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer D2FC35	+256757315416	request-d2fc359f@example.test	WHATSAPP	WINDOWS_PC	Lenovo	ThinkPad	\N	Not powering on	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier D2FC	+256736278173	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmrysqgod0003l204x47oh6gn	\N	\N	102.217.133.179	2026-07-17 10:04:42.218	2026-07-24 10:27:27.322
cms5rv7460001jr04j871rayp	REQ-2026-0040	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 0F52DD	+256747941784	request-0f52ddec@example.test	WHATSAPP	WINDOWS_PC	LENOVO	\N	\N	Computer has issue with charging System	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 0F52	+256714164278	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cms7gixy90003jo04s9gd3rpq	\N	\N	102.217.133.179	2026-07-29 07:37:31.59	2026-07-30 11:55:36.593
cms5rzobn0009jr04p3xfezqg	REQ-2026-0041	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 32C5DE	+256770134930	request-32c5dee8@example.test	WHATSAPP	WINDOWS_PC	lenovo	\N	\N	Broken Hinges	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 32C5	+256774688043	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cms65ob8f0003jt049xb0gvtv	\N	\N	102.217.133.179	2026-07-29 07:41:00.515	2026-07-29 14:04:05.241
cmshgkx8d0001ky04fd9corzc	REQ-2026-0043	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 05BF8F	+256765892441	request-05bf8f8d@example.test	WHATSAPP	WINDOWS_PC	hp	hp15-bs1np	\N	needs more ram , speakers unclear,battery needs replacement, internal [redacted]	SELF_DROPOFF	2026-08-07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmshqrqp50003l504k4j3l3lr	\N	\N	102.222.235.157	2026-08-06 11:54:50.558	2026-08-06 16:40:05.044
cmsrczo150001l504my50jz2e	REQ-2026-0045	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 9519D2	+256797002339	request-9519d25e@example.test	WHATSAPP	OTHER	Epson Printer	Epson	\N	The printer prints blank  not un till you've done nozzle [redacted]	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmsrji9xl0003l80458lzg6s5	cmratfqe3000zkw04iv172urq	cmsd5hgk20002l404w3jhfbmg	\N	2026-08-13 10:12:01.769	2026-08-13 13:14:28.005
cmt1am69y0001l704329zlk0a	REQ-2026-0046	CONVERTED_TO_JOB	PENDING	org_eis_01	Customer 2ED445	+256720605562	request-2ed445b4@example.test	WHATSAPP	OTHER	Dell	Latitude 7200 2-in-1	\N	The Keyboard is not working.	SEND_WITH_DELIVERY_PERSON	\N	\N	\N	Courier 2ED4	+256761116133	Board	2026-08-20	\N	\N	shop	The Tab is for International Medical Centre, delivery is International Hospital Kampala (Namuwongo) the head office [redacted]	\N	\N	\N	\N	\N	\N	\N	cmt2l8ddo0003if04ga8b6mik	\N	\N	102.217.133.179	2026-08-20 09:03:14.758	2026-08-21 06:48:13.006
\.


--
-- Data for Name: RepairRequestSequence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RepairRequestSequence" (id, "orgId", year, value, "updatedAt") FROM stdin;
53e1c4426efb557938b1f9771302dc12	org_eis_01	2026	53	2026-09-08 12:06:17
\.


--
-- Data for Name: RepairTask; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RepairTask" (id, "orgId", "jobId", title, description, status, priority, "assignedToId", "dueAt", "completedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Sale" (id, "orgId", "branchId", "clientId", "posSessionId", status, "saleNumber", "billingMode", "invoiceNumber", "invoicedAt", currency, "exchangeRateToBase", subtotal, "discountAmount", "vatAmount", "taxApplicable", "totalAmount", "paidAmount", "paidAt", notes, "createdById", "createdAt", "updatedAt", name) FROM stdin;
cmq12kzaf0001l8048telkg8u	org_eis_01	\N	\N	\N	OPEN	S-202606-0001	CASH	\N	\N	UGX	\N	550000.00	0.00	99000.00	t	649000.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-06-05 15:19:15.111	2026-06-05 15:20:35.185	\N
cmrapqzh70004jv0423mhm9b5	org_eis_01	\N	\N	\N	OPEN	S-202607-0002	CASH	\N	\N	UGX	\N	3485000.00	0.00	627300.00	t	4112300.00	3665000.00	\N	\N	cmns5nlp700042lmerqro7219	2026-07-07 13:57:24.379	2026-07-07 15:31:42.026	\N
cmrdjozsr0001l704urqn9862	org_eis_01	\N	\N	\N	PAID	S-202607-0003	CASH	\N	\N	UGX	\N	20000.00	0.00	3600.00	t	23600.00	23600.00	2026-07-09 13:33:59.043	\N	cmns5nlp700042lmerqro7219	2026-07-09 13:31:12.315	2026-07-09 13:33:59.044	\N
cmrdjuksi0007jr04pk5th985	org_eis_01	\N	\N	\N	PAID	S-202607-0004	CASH	\N	\N	UGX	\N	25000.00	0.00	4500.00	t	29500.00	29500.00	2026-07-09 13:38:30.083	\N	cmns5nlp700042lmerqro7219	2026-07-09 13:35:32.803	2026-07-09 13:38:30.084	\N
cmrp2vt7q0001l5041s9kf8dp	org_eis_01	\N	\N	\N	OPEN	S-202607-0005	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	t	0.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-07-17 15:13:51.014	2026-07-17 15:13:51.014	\N
cmshakmr90005l204l1gaajwh	org_eis_01	\N	\N	\N	OPEN	EAGLE-INFO-SOLUTIONS-S-202608-0001	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	f	0.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 09:06:39.285	2026-08-06 09:06:39.285	\N
cmshakr3f0007l2046p13diul	org_eis_01	\N	\N	\N	OPEN	EAGLE-INFO-SOLUTIONS-S-202608-0002	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	f	0.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 09:06:44.907	2026-08-06 09:06:44.907	\N
cmshc3ktq0001ju04ugt4ij7b	org_eis_01	\N	\N	\N	OPEN	EAGLE-INFO-SOLUTIONS-S-202608-0003	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	f	0.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 09:49:22.862	2026-08-06 09:49:22.862	\N
cmshcbxeq0001l804f1eeo3v1	org_eis_01	\N	\N	\N	OPEN	EAGLE-INFO-SOLUTIONS-S-202608-0004	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	f	0.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-08-06 09:55:52.419	2026-08-06 09:55:52.419	\N
cmsyyusw90001l204q4zngmp3	org_eis_01	\N	\N	\N	OPEN	EAGLE-INFO-SOLUTIONS-S-202608-0005	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	f	0.00	0.00	\N	\N	cmns5nlp700042lmerqro7219	2026-08-18 17:58:29.578	2026-08-18 17:58:29.578	\N
cmsyzux110001l804sky5qooo	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0006	CASH	\N	\N	UGX	\N	2260000.00	0.00	0.00	f	2260000.00	2260000.00	2026-08-18 18:35:03.379	\N	cmns5nlp700042lmerqro7219	2026-08-18 18:26:34.549	2026-08-18 18:35:03.379	\N
cmsz07n5y0001lb04mzqu01lz	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0007	CASH	\N	\N	UGX	\N	60000.00	0.00	0.00	f	60000.00	60000.00	2026-08-18 18:38:13.562	\N	cmns5nlp700042lmerqro7219	2026-08-18 18:36:28.295	2026-08-18 18:38:13.563	\N
cmsz0a72t0001l104wwwwffau	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0008	CASH	\N	\N	UGX	\N	80000.00	0.00	0.00	f	80000.00	80000.00	2026-08-18 18:39:19.697	\N	cmns5nlp700042lmerqro7219	2026-08-18 18:38:27.413	2026-08-18 18:39:19.698	\N
cmt2m84it0001k204z2r3a8cb	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0009	CASH	\N	\N	UGX	\N	10000.00	0.00	0.00	f	10000.00	10000.00	2026-08-21 07:18:34.548	\N	cmns5nkty00012lme8d0os7dx	2026-08-21 07:16:00.87	2026-08-21 07:18:34.549	\N
cmt33f7ct0001jl0410ylcthn	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0010	CASH	\N	\N	UGX	\N	80000.00	0.00	0.00	f	80000.00	80000.00	2026-08-21 15:18:14.245	\N	cmns5nkty00012lme8d0os7dx	2026-08-21 15:17:24.606	2026-08-21 15:18:14.245	\N
cmt33ikwd000al304n26cada1	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0011	CASH	\N	\N	UGX	\N	50000.00	0.00	0.00	f	50000.00	50000.00	2026-08-21 15:21:07.777	\N	cmns5nkty00012lme8d0os7dx	2026-08-21 15:20:02.125	2026-08-21 15:21:07.778	\N
cmt33kfcs000ejl04fde8xgac	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0012	CASH	\N	\N	UGX	\N	20000.00	0.00	0.00	f	20000.00	20000.00	2026-08-21 15:22:22.743	\N	cmns5nkty00012lme8d0os7dx	2026-08-21 15:21:28.253	2026-08-21 15:22:22.744	\N
cmt34i10q0001jm04iba9ric5	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0013	CASH	\N	\N	UGX	\N	20000.00	0.00	0.00	f	20000.00	20000.00	2026-08-21 15:48:19.958	\N	cmns5nkty00012lme8d0os7dx	2026-08-21 15:47:35.979	2026-08-21 15:48:19.959	\N
cmt45ltff0001ky04tvds5gog	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202608-0014	CASH	\N	\N	UGX	\N	100000.00	0.00	0.00	f	100000.00	100000.00	2026-08-22 09:07:07.058	\N	cmns5nkty00012lme8d0os7dx	2026-08-22 09:06:18.555	2026-08-22 09:07:07.059	\N
cmthevcvs0001l8043ygqurqz	org_eis_01	\N	\N	\N	OPEN	EAGLE-INFO-SOLUTIONS-S-202608-0015	CASH	\N	\N	UGX	\N	0.00	0.00	0.00	f	0.00	0.00	\N	\N	cmns5jbas00002lfw97nnwshd	2026-08-31 15:46:40.505	2026-08-31 15:46:40.505	\N
cmtoe1462000hjn04z15yuq5s	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0001	CASH	\N	\N	UGX	\N	30000.00	0.00	0.00	f	30000.00	30000.00	2026-09-07 09:01:09.348	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 12:57:32.762	2026-09-07 09:01:09.348	\N
cmtoe71yn0005l404w048am0t	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0002	CASH	\N	\N	UGX	\N	10000.00	0.00	0.00	f	10000.00	20000.00	2026-09-07 09:00:16.378	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:02:09.84	2026-09-07 09:00:16.379	\N
cmtoeb0h70001l404xbb1apkd	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0003	CASH	\N	\N	UGX	\N	120000.00	0.00	0.00	f	120000.00	120000.00	2026-09-05 13:09:40.052	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:05:14.539	2026-09-05 13:09:40.053	\N
cmtoecj180008l404xww7ymz2	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0004	CASH	\N	\N	UGX	\N	100000.00	0.00	0.00	f	100000.00	100000.00	2026-09-05 13:09:11.646	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:06:25.244	2026-09-05 13:09:11.647	\N
cmtoee34u0007l404zc8x7opy	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0005	CASH	\N	\N	UGX	\N	30000.00	0.00	0.00	f	30000.00	30000.00	2026-09-05 13:08:41.243	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:07:37.95	2026-09-05 13:08:41.244	\N
cmtof4d1m0001ie04gyymbyk3	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0006	CASH	\N	\N	UGX	\N	60000.00	0.00	0.00	f	60000.00	60000.00	2026-09-05 13:29:10.293	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:28:03.851	2026-09-05 13:29:10.294	\N
cmtof6qu80001jo04nfbc8o32	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0007	CASH	\N	\N	UGX	\N	380000.00	0.00	0.00	f	380000.00	380000.00	2026-09-05 13:30:57.736	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:29:55.04	2026-09-05 13:30:57.736	\N
cmtof8vs90003jo040xu2gloc	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0008	CASH	\N	\N	UGX	\N	25000.00	0.00	0.00	f	25000.00	25000.00	2026-09-05 13:32:06.672	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:31:34.762	2026-09-05 13:32:06.673	\N
cmtof9ywv000ak004lvmx265e	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0009	CASH	\N	\N	UGX	\N	70000.00	0.00	0.00	f	70000.00	70000.00	2026-09-05 13:33:41.349	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:32:25.471	2026-09-05 13:33:41.35	\N
cmtofcll8000gie044ndr8paw	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0010	CASH	\N	\N	UGX	\N	100000.00	0.00	0.00	f	100000.00	100000.00	2026-09-05 13:35:50.71	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:34:28.172	2026-09-05 13:35:50.71	\N
cmtofga580005l804qo0d1200	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0011	CASH	\N	\N	UGX	\N	50000.00	0.00	0.00	f	50000.00	50000.00	2026-09-05 13:37:54.588	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:37:19.964	2026-09-05 13:37:54.589	\N
cmtofhi7z000wk004ct3ogpci	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0012	CASH	\N	\N	UGX	\N	40000.00	0.00	0.00	f	40000.00	40000.00	2026-09-05 13:38:54.053	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:38:17.087	2026-09-05 13:38:54.054	\N
cmtofjcri000eju04zz8qlai6	org_eis_01	\N	\N	\N	PAID	EAGLE-INFO-SOLUTIONS-S-202609-0013	CASH	\N	\N	UGX	\N	20000.00	0.00	0.00	f	20000.00	20000.00	2026-09-05 13:40:31.607	\N	cmns5nkty00012lme8d0os7dx	2026-09-05 13:39:43.326	2026-09-05 13:40:31.608	\N
\.


--
-- Data for Name: SaleItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SaleItem" (id, "saleId", "partId", description, quantity, "unitPrice", "lineTotal", "saleUomFactor", "costAtSale", "createdAt") FROM stdin;
cmq12mort0003l404iek18una	cmq12kzaf0001l8048telkg8u	cmq0yqq1h0001jt04tch2ihbd	003 Dell Latitude 3120 2 in 1  4/256 ssd Non-Touch	1	550000.00	550000.00	\N	\N	2026-06-05 15:20:34.793
cmraptcvt0003l804nzap1rv5	cmrapqzh70004jv0423mhm9b5	cmq0yorww0001la04ry2510lm	Hp EliteBook 840  G7 10th Gen i5  16/256SSD	1	1600000.00	1600000.00	\N	\N	2026-07-07 13:59:15.066
cmrapvfnh0007l8048kbjxkai	cmrapqzh70004jv0423mhm9b5	cmq0ymb2r0001kz04ehxm1onr	001 Hp EliteBook 830  G6 8th Gen i5  16/256SSD x360	1	1600000.00	1600000.00	\N	\N	2026-07-07 14:00:51.965
cmraq33nd0003ie0407gk9u29	cmrapqzh70004jv0423mhm9b5	cmr62irx90003kz04fydvkqd6	0046 Bags with leather handles	2	80000.00	160000.00	\N	\N	2026-07-07 14:06:49.657
cmraq52ul0008jv042xao592z	cmrapqzh70004jv0423mhm9b5	cmr653727000tl504v2wqwj9b	0084 Hp 65w Blue pin charger	1	20000.00	20000.00	\N	\N	2026-07-07 14:08:21.933
cmraq65v9000cjv04hpufnb72	cmrapqzh70004jv0423mhm9b5	cmr65ffcb000hjp04o8j3ubwf	0088 Power Cables	5	5000.00	25000.00	\N	\N	2026-07-07 14:09:12.502
cmraq7sra000cl804ss0piv3s	cmrapqzh70004jv0423mhm9b5	cmr64y4x30009jp0490znpohn	0083 Hp 65w Type-C charger	1	40000.00	40000.00	\N	\N	2026-07-07 14:10:28.822
cmraq8hpb000jjv047fbd0arl	cmrapqzh70004jv0423mhm9b5	cmr65ceuc000fjp0467ojg8ec	0087 Dell Big pin	1	20000.00	20000.00	\N	\N	2026-07-07 14:11:01.152
cmraq9g8d0007ie04voyz96mk	cmrapqzh70004jv0423mhm9b5	cmr653727000tl504v2wqwj9b	0084 Hp 65w Blue pin charger	1	20000.00	20000.00	\N	\N	2026-07-07 14:11:45.902
cmrdjpwzx0003jr04ni047c2p	cmrdjozsr0001l704urqn9862	cmr63edb30009jm04aq3mg72n	0073 USB-c to lightening cable	1	20000.00	20000.00	\N	\N	2026-07-09 13:31:55.342
cmrdjw4c20005l504ytgu78z4	cmrdjuksi0007jr04pk5th985	cmr653727000tl504v2wqwj9b	0084 Hp 65w Blue pin charger	1	20000.00	20000.00	\N	\N	2026-07-09 13:36:44.786
cmrdjwpm20009l504lue0zchv	cmrdjuksi0007jr04pk5th985	cmr65ffcb000hjp04o8j3ubwf	0088 Power Cables	1	5000.00	5000.00	\N	\N	2026-07-09 13:37:12.363
cmsz04z80000jl804pxxbough	cmsyzux110001l804sky5qooo	cmsyyeqg10001l104p3842il0	HP EliteBook 840  i5 G6 8/256	2	1130000.00	2260000.00	1.000000	800000.00	2026-08-18 18:34:23.952
cmsz09h7u0003js0487dyh7hi	cmsz07n5y0001lb04mzqu01lz	cmr62bc5f0001l504pswy2ydi	Sleeve bags	1	60000.00	60000.00	1.000000	28500.00	2026-08-18 18:37:53.899
cmsz0axaa0005l1048dnc6jc6	cmsz0a72t0001l104wwwwffau	cmr653727000tl504v2wqwj9b	Hp 65w Blue pin charger	2	40000.00	80000.00	1.000000	14000.00	2026-08-18 18:39:01.378
cmt2mauq40005k204wepdiclb	cmt2m84it0001k204z2r3a8cb	cmr65ffcb000hjp04o8j3ubwf	Power Cables	2	5000.00	10000.00	1.000000	2500.00	2026-08-21 07:18:08.141
cmt33ftd40003l804k3g9krof	cmt33f7ct0001jl0410ylcthn	cmr64bbff0009la04z4pq57wk	60W T charger	1	80000.00	80000.00	1.000000	48500.00	2026-08-21 15:17:53.128
cmt33jlpq0003jl0410vek55a	cmt33ikwd000al304n26cada1	\N	past payments - Mulishidi	1	50000.00	50000.00	1.000000	\N	2026-08-21 15:20:49.838
cmt33l6l4000cl304czqooyf2	cmt33kfcs000ejl04fde8xgac	\N	Detached Screen Repair	1	20000.00	20000.00	1.000000	\N	2026-08-21 15:22:03.544
cmt34igou0001l8042vf0v90n	cmt34i10q0001jm04iba9ric5	\N	dell small pin adapter	1	20000.00	20000.00	1.000000	\N	2026-08-21 15:47:56.286
cmt45mh0o0001jr04wn8ia5dl	cmt45ltff0001ky04tvds5gog	\N	Water spill repair	1	100000.00	100000.00	1.000000	\N	2026-08-22 09:06:49.128
cmtoe5yn10003l4049o9eveam	cmtoe1462000hjn04z15yuq5s	cmr63edb30009jm04aq3mg72n	USB-c to lightening cable	1	30000.00	30000.00	1.000000	3000.00	2026-09-05 13:01:18.877
cmtoe85280003kv04bfr4rfc6	cmtoe71yn0005l404w048am0t	cmr65ffcb000hjp04o8j3ubwf	Power Cables	2	5000.00	10000.00	1.000000	2500.00	2026-09-05 13:03:00.513
cmtoec2r40005l4043h5k3wn3	cmtoeb0h70001l404xbb1apkd	cmq11jwva0009kz04qzo33vxz	30W type c power adapter New	1	120000.00	120000.00	1.000000	72000.00	2026-09-05 13:06:04.144
cmtoedcu2000al404h59dcchv	cmtoecj180008l404xww7ymz2	\N	Software Installation	1	100000.00	100000.00	1.000000	\N	2026-09-05 13:07:03.866
cmtoeeqdc0005kv04i5p3qbgb	cmtoee34u0007l404zc8x7opy	\N	Printer Repair (Smik)	1	30000.00	30000.00	1.000000	\N	2026-09-05 13:08:08.065
cmtof59h70003ie04oyxhz47o	cmtof4d1m0001ie04gyymbyk3	\N	Wireless Mouse	1	60000.00	60000.00	1.000000	\N	2026-09-05 13:28:45.884
cmtof7pys0005ie04vrq15cm3	cmtof6qu80001jo04nfbc8o32	\N	Iphone	1	380000.00	380000.00	1.000000	\N	2026-09-05 13:30:40.564
cmtof980h0001ju04dm1ozqht	cmtof8vs90003jo040xu2gloc	\N	Adapter Aggie	1	25000.00	25000.00	1.000000	\N	2026-09-05 13:31:50.61
cmtofbafu000ck004l2ozxpj1	cmtof9ywv000ak004lvmx265e	\N	30 W Adapter	1	70000.00	70000.00	1.000000	\N	2026-09-05 13:33:27.067
cmtofdzwr0003l804qjep4apv	cmtofcll8000gie044ndr8paw	cmr64bbff0009la04z4pq57wk	60W T charger	1	100000.00	100000.00	1.000000	48500.00	2026-09-05 13:35:33.387
cmtofgo0w0003ju041u7fal1b	cmtofga580005l804qo0d1200	\N	Phone Repair	1	50000.00	50000.00	1.000000	\N	2026-09-05 13:37:37.953
cmtofhygt000tie04qyw0d66b	cmtofhi7z000wk004ct3ogpci	cmr659omy000xl5040ojiilhs	Lenovo type c	1	40000.00	40000.00	1.000000	25000.00	2026-09-05 13:38:38.141
cmtofk1w5000iju04kmi3oypn	cmtofjcri000eju04zz8qlai6	cmr653727000tl504v2wqwj9b	Hp 65w Blue pin charger	1	20000.00	20000.00	1.000000	14000.00	2026-09-05 13:40:15.893
\.


--
-- Data for Name: SalesTarget; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SalesTarget" (id, "orgId", "userId", "departmentId", "branchId", "setById", "entityType", metric, period, "periodLabel", "targetRevenue", "targetJobs", "targetValue", "actualValue", notes, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Session" (id, "expiresAt", token, "ipAddress", "userAgent", "userId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SmsUsage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SmsUsage" ("orgId", year, month, count) FROM stdin;
\.


--
-- Data for Name: StockCount; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockCount" (id, "orgId", "countNumber", status, "locationId", "countedAt", "submittedAt", "approvedAt", note, "createdById", "approvedById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: StockCountItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockCountItem" (id, "stockCountId", "partId", "systemQty", "countedQty", "varianceQty", note, "createdAt") FROM stdin;
\.


--
-- Data for Name: StockLocation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockLocation" (id, "orgId", "branchId", name, code, "isActive", "createdAt", "updatedAt") FROM stdin;
cmppxljtu0000k004iotd7e4g	org_eis_01	branch_eis_main	Nalubega	EIS-NAL-001	t	2026-05-28 20:14:15.715	2026-08-27 12:55:52.375
cmppxswtb0002l804nfo3ludd	org_eis_01	branch_eis_main	Gayaza	EIS-GAY-001	f	2026-05-28 20:19:59.136	2026-06-05 16:58:10.136
\.


--
-- Data for Name: StockTransfer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockTransfer" (id, "orgId", "transferNumber", status, "fromLocationId", "toLocationId", "requestedAt", "approvedAt", "dispatchedAt", "receivedAt", "cancelledAt", note, "createdById", "approvedById", "dispatchedById", "receivedById", "createdAt", "updatedAt") FROM stdin;
cmppxtm5p0004l8041r2lhwan	org_eis_01	ST-2026-0001	APPROVED	cmppxljtu0000k004iotd7e4g	cmppxswtb0002l804nfo3ludd	2026-05-28 20:20:31.981	2026-05-28 20:20:43.409	\N	\N	\N	Client Order	cmns5jbas00002lfw97nnwshd	cmns5jbas00002lfw97nnwshd	\N	\N	2026-05-28 20:20:31.981	2026-05-28 20:20:43.41
\.


--
-- Data for Name: StockTransferItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."StockTransferItem" (id, "transferId", "partId", quantity, "qtyDispatched", "qtyReceived", note, "createdAt", "updatedAt") FROM stdin;
cmppxtm5p0006l804brqikx75	cmppxtm5p0004l8041r2lhwan	cmppxp1i10002k004ps169io6	50	0	0	\N	2026-05-28 20:20:31.981	2026-05-28 20:20:31.981
\.


--
-- Data for Name: Supplier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Supplier" (id, "orgId", name, "contactName", email, phone, address, notes, "isActive", "createdAt", "updatedAt") FROM stdin;
cmq3j8dnr0001l804cdsrl3u1	org_eis_01	Supplier 72D1	Contact 72D1	supplier-72d1c9ad@example.test	\N	\N	\N	t	2026-06-07 08:40:53.031	2026-06-07 08:40:53.031
\.


--
-- Data for Name: SupplierBill; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupplierBill" (id, "orgId", "billNumber", "supplierRef", status, "supplierId", "poId", "grnId", currency, "exchangeRateToBase", subtotal, "taxAmount", "totalAmount", "paidAmount", "issuedAt", "dueAt", notes, "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SupplierBillItem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupplierBillItem" (id, "billId", description, quantity, "unitCost", "lineTotal", "createdAt") FROM stdin;
\.


--
-- Data for Name: SupplierPayment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupplierPayment" (id, "orgId", "billId", currency, "exchangeRateToBase", amount, "feeAmount", "baseAmountSent", method, reference, "paidAt", note, "createdById", "createdAt") FROM stdin;
\.


--
-- Data for Name: SupplierPrice; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SupplierPrice" (id, "orgId", "supplierId", "partId", sku, description, "unitCost", currency, "exchangeRateToBase", "minQuantity", "leadTimeDays", "validFrom", "validTo", "createdAt") FROM stdin;
\.


--
-- Data for Name: SystemAnnouncement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemAnnouncement" (id, title, body, level, "isActive", "startsAt", "endsAt", "createdById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SystemAuditEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SystemAuditEvent" (id, "orgId", "actorUserId", "entityType", "entityId", action, summary, "beforeJson", "afterJson", "ipAddress", "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: TaxRate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TaxRate" (id, "orgId", name, code, rate, "isDefault", "isActive", "appliesToSales", "appliesToPurchases", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: TechnicianPayout; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TechnicianPayout" (id, "orgId", "jobId", amount, method, reference, note, "paidAt", "recordedById", "createdAt") FROM stdin;
cmt8useax002ejr0475fx07rs	org_eis_01	cmt2l4lgs0005jx04yvb82oo8	200000.00	CASH	\N	\N	2026-08-25 16:02:20.649	cmns5jbas00002lfw97nnwshd	2026-08-25 16:02:20.649
cmt8utwfz003bjl04rk9mabro	org_eis_01	cmshqrqp50003l504k4j3l3lr	280000.00	CASH	\N	\N	2026-08-25 16:03:30.815	cmns5jbas00002lfw97nnwshd	2026-08-25 16:03:30.815
cmtbjjror0012jn04uc3qecdv	org_eis_01	cmrkk87x70003k1047soc8sxe	230000.00	CASH	\N	\N	2026-08-27 13:11:00.844	cmns5jbas00002lfw97nnwshd	2026-08-27 13:11:00.844
cmtr7hixf0001la0401rhmvc7	org_eis_01	cmratf42y000tkw04ohmxbx8t	100000.00	CASH	\N	\N	2026-09-07 12:17:39.603	cmns5jbas00002lfw97nnwshd	2026-09-07 12:17:39.603
cmtr7nby70001jx04mqu0pezb	org_eis_01	cmrysqgod0003l204x47oh6gn	30000.00	CASH	\N	\N	2026-09-07 12:22:10.496	cmns5jbas00002lfw97nnwshd	2026-09-07 12:22:10.496
cmtrary220001l104rsm7whsm	org_eis_01	cmt2mou050009la04jt0ezoar	150000.00	CASH	\N	\N	2026-09-07 13:49:44.619	cmns5jbas00002lfw97nnwshd	2026-09-07 13:49:44.619
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, name, email, phone, "emailVerified", image, role, "isActive", "accessMode", "orgId", "branchId", "departmentId", "techType", "employeeId", specializations, "createdAt", "updatedAt") FROM stdin;
cmns5jbas00002lfw97nnwshd	Admin 1	admin1@eagle.test	+256709166664	f	\N	ADMIN	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:12:35.956	2026-04-19 07:05:19.333
cmns5nkty00012lme8d0os7dx	Admin 2	admin2@eagle.test	\N	t	\N	ADMIN	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:15:54.934	2026-09-05 12:56:47.042
cmns5nlp700042lmerqro7219	Admin 3	admin3@eagle.test	\N	t	\N	ADMIN	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:15:56.06	2026-04-27 18:23:59.471
cmpvi0twl0001l204yd45lhqm	Sales Corporate 1	salescorporate1@eagle.test	+256718359882	t	\N	SALES_CORPORATE	t	FULL	org_eis_01	\N	\N	\N	\N	\N	2026-06-01 17:44:51.813	2026-06-01 17:44:51.813
eSpNxZMk7s8t01mkBNHCx3mMnChQBNLZ	Ops 1	ops1@eagle.test	\N	f	\N	OPS	t	FULL	org_eis_01	\N	\N	\N	\N	\N	2026-07-02 12:07:31.831	2026-07-02 12:07:31.831
Qk49HF5DKXKnKhhFenrTJkAOAnAIgLch	Ops 2	ops2@eagle.test	\N	f	\N	OPS	f	FULL	org_eis_01	\N	\N	\N	\N	\N	2026-08-08 06:58:23.782	2026-08-28 12:12:52.747
cmns5nnzs000f2lmeblzgrvrh	Technician Internal 1	technicianinternal1@eagle.test	\N	t	\N	TECHNICIAN_INTERNAL	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:15:59.033	2026-04-10 00:22:07.06
cmns5va4t00002lsis3rrj31k	Technician External 1	technicianexternal1@eagle.test	\N	t	\N	TECHNICIAN_EXTERNAL	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:21:54.315	2026-04-10 00:21:54.315
cmns5vc5200032lsil2f7rq0m	Technician External 2	technicianexternal2@eagle.test	\N	t	\N	TECHNICIAN_EXTERNAL	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:21:56.919	2026-04-10 00:21:56.919
cmns5vd6400062lsig31tm6wk	Technician External 3	technicianexternal3@eagle.test	\N	t	\N	TECHNICIAN_EXTERNAL	t	FULL	org_eis_01	branch_eis_main	\N	\N	\N	\N	2026-04-10 00:21:58.252	2026-04-10 00:21:58.252
cmpmcqrro0001l2042cc4lw6c	Technician External 4	technicianexternal4@eagle.test	\N	t	\N	TECHNICIAN_EXTERNAL	t	FULL	org_eis_01	\N	\N	\N	\N	\N	2026-05-26 08:07:08.82	2026-05-26 08:07:08.82
\.


--
-- Data for Name: UserAccessAudit; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserAccessAudit" (id, "targetUserId", "actorUserId", action, detail, "createdAt") FROM stdin;
cmpgsuxe4000cjs04elwxwmni	cmns5nkty00012lme8d0os7dx	cmns5jbas00002lfw97nnwshd	PERMISSION_UPDATED	{"fromRole":"TECHNICIAN_INTERNAL","toRole":"TECHNICIAN_INTERNAL","added":["can_approve_invoices","can_view_external_quotes","can_view_approved_cost","can_generate_job_cards","can_manage_intake"],"removed":[]}	2026-05-22 10:51:39.532
cmsyjoa9x0001l704v1y85rgc	cmpvi0twl0001l204yd45lhqm	cmns5jbas00002lfw97nnwshd	PASSWORD_RESET	{"method":"ADMIN_RESET","signedOutAllSessions":true}	2026-08-18 10:53:31.27
cmt2m5esc000ajv0430oxfbdc	cmns5nkty00012lme8d0os7dx	cmns5jbas00002lfw97nnwshd	ROLE_AND_PERMISSION_UPDATED	{"fromRole":"TECHNICIAN_INTERNAL","toRole":"OPS","added":["can_review_external_bills","can_view_accounts_summary"],"removed":["can_intake","can_run_internal_repairs","can_view_approved_cost","can_view_job_progress"]}	2026-08-21 07:13:54.204
cmtcyxfpp000bl404rk3vpse6	cmns5nkty00012lme8d0os7dx	cmns5jbas00002lfw97nnwshd	ROLE_AND_PERMISSION_UPDATED	{"fromRole":"OPS","toRole":"TECH_MANAGER","added":["can_run_internal_repairs","can_view_job_progress","can_view_approved_cost"],"removed":["can_approve_invoices","can_view_accounts_summary"]}	2026-08-28 13:09:18.925
cmtoe053c000ejn04dy88cn54	cmns5nkty00012lme8d0os7dx	cmns5jbas00002lfw97nnwshd	ROLE_AND_PERMISSION_UPDATED	{"fromRole":"TECH_MANAGER","toRole":"ADMIN","added":["can_intake","can_view_accounts_summary","can_approve_invoices"],"removed":[]}	2026-09-05 12:56:47.304
\.


--
-- Data for Name: UserGroup; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserGroup" (id, "orgId", name, description, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: UserGroupMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserGroupMember" (id, "groupId", "userId", "createdAt") FROM stdin;
\.


--
-- Data for Name: UserGroupPermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserGroupPermission" (id, "groupId", permission, "createdAt") FROM stdin;
\.


--
-- Data for Name: UserInvite; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserInvite" (id, token, email, role, "orgId", "invitedById", "expiresAt", "usedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: UserPermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."UserPermission" (id, "userId", permission, "createdAt") FROM stdin;
cmns5vlb6000u2lsi4chhdlsk	cmns5nnzs000f2lmeblzgrvrh	can_run_internal_repairs	2026-04-10 00:22:08.803
cmnsper0m00012l60zsguzehp	cmns5jbas00002lfw97nnwshd	can_run_internal_repairs	2026-04-10 09:28:55.365
cmnsperam00032l60ot00ckfp	cmns5jbas00002lfw97nnwshd	can_intake	2026-04-10 09:28:55.726
cmnsperln00052l601hgblk69	cmns5jbas00002lfw97nnwshd	can_manage_intake	2026-04-10 09:28:56.124
cmnsperw600072l604lmecehp	cmns5jbas00002lfw97nnwshd	can_search_jobs	2026-04-10 09:28:56.503
cmnspes6800092l6076x5a254	cmns5jbas00002lfw97nnwshd	can_generate_job_cards	2026-04-10 09:28:56.864
cmnspeshw000b2l60ulaouvp5	cmns5jbas00002lfw97nnwshd	can_view_job_progress	2026-04-10 09:28:57.285
cmnspessw000d2l60mhwmmpj0	cmns5jbas00002lfw97nnwshd	can_view_approved_cost	2026-04-10 09:28:57.681
cmnspet3k000f2l60z46zkhip	cmns5jbas00002lfw97nnwshd	can_assign_jobs	2026-04-10 09:28:58.064
cmnspete1000h2l602bn8suam	cmns5jbas00002lfw97nnwshd	can_view_external_updates	2026-04-10 09:28:58.442
cmnspetpn000j2l60crvrzmob	cmns5jbas00002lfw97nnwshd	can_view_external_quotes	2026-04-10 09:28:58.859
cmnspetzm000l2l60i26wojty	cmns5jbas00002lfw97nnwshd	can_review_external_bills	2026-04-10 09:28:59.219
cmnspeuaa000n2l602ub08efs	cmns5jbas00002lfw97nnwshd	can_view_accounts_summary	2026-04-10 09:28:59.602
cmnspeukd000p2l60eevzkocw	cmns5jbas00002lfw97nnwshd	can_approve_invoices	2026-04-10 09:28:59.965
cmohj0c560000i804yrn4nzfp	cmns5nlp700042lmerqro7219	can_run_internal_repairs	2026-04-27 18:23:59.61
cmohj0c560001i80426lxe9n1	cmns5nlp700042lmerqro7219	can_intake	2026-04-27 18:23:59.61
cmohj0c560002i804hzigkaki	cmns5nlp700042lmerqro7219	can_manage_intake	2026-04-27 18:23:59.61
cmohj0c560003i8042tbm286b	cmns5nlp700042lmerqro7219	can_search_jobs	2026-04-27 18:23:59.61
cmohj0c560004i804nrew4y1n	cmns5nlp700042lmerqro7219	can_generate_job_cards	2026-04-27 18:23:59.61
cmohj0c560005i804m3m9u8zr	cmns5nlp700042lmerqro7219	can_view_job_progress	2026-04-27 18:23:59.61
cmohj0c560006i804zby9lqnc	cmns5nlp700042lmerqro7219	can_view_approved_cost	2026-04-27 18:23:59.61
cmohj0c560007i804robllb3t	cmns5nlp700042lmerqro7219	can_assign_jobs	2026-04-27 18:23:59.61
cmohj0c560008i8048dzzrbhb	cmns5nlp700042lmerqro7219	can_view_external_updates	2026-04-27 18:23:59.61
cmohj0c560009i804k4tzcl09	cmns5nlp700042lmerqro7219	can_view_external_quotes	2026-04-27 18:23:59.61
cmohj0c56000ai804ssf5j30g	cmns5nlp700042lmerqro7219	can_review_external_bills	2026-04-27 18:23:59.61
cmohj0c56000bi804esln4xpb	cmns5nlp700042lmerqro7219	can_view_accounts_summary	2026-04-27 18:23:59.61
cmohj0c56000ci8044bqtnheo	cmns5nlp700042lmerqro7219	can_approve_invoices	2026-04-27 18:23:59.61
cmtoe04zh0000jn048liydh22	cmns5nkty00012lme8d0os7dx	can_run_internal_repairs	2026-09-05 12:56:47.165
cmtoe04zh0001jn04wdilxt13	cmns5nkty00012lme8d0os7dx	can_intake	2026-09-05 12:56:47.165
cmtoe04zh0002jn04tkyhb3hl	cmns5nkty00012lme8d0os7dx	can_manage_intake	2026-09-05 12:56:47.165
cmtoe04zh0003jn04fey0urj1	cmns5nkty00012lme8d0os7dx	can_search_jobs	2026-09-05 12:56:47.165
cmtoe04zh0004jn04chqk0tqf	cmns5nkty00012lme8d0os7dx	can_generate_job_cards	2026-09-05 12:56:47.165
cmtoe04zh0005jn04dou780nl	cmns5nkty00012lme8d0os7dx	can_view_job_progress	2026-09-05 12:56:47.165
cmtoe04zh0006jn04ux87n0is	cmns5nkty00012lme8d0os7dx	can_view_approved_cost	2026-09-05 12:56:47.165
cmtoe04zh0007jn04asrvlzhv	cmns5nkty00012lme8d0os7dx	can_assign_jobs	2026-09-05 12:56:47.165
cmtoe04zh0008jn04jjek9qsk	cmns5nkty00012lme8d0os7dx	can_view_external_updates	2026-09-05 12:56:47.165
cmtoe04zh0009jn044amkj0ga	cmns5nkty00012lme8d0os7dx	can_view_external_quotes	2026-09-05 12:56:47.165
cmtoe04zh000ajn04davbsi2o	cmns5nkty00012lme8d0os7dx	can_review_external_bills	2026-09-05 12:56:47.165
cmtoe04zh000bjn049bp6uvir	cmns5nkty00012lme8d0os7dx	can_view_accounts_summary	2026-09-05 12:56:47.165
cmtoe04zh000cjn04liijcfvs	cmns5nkty00012lme8d0os7dx	can_approve_invoices	2026-09-05 12:56:47.165
\.


--
-- Data for Name: Verification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: WarrantyClaim; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."WarrantyClaim" (id, "orgId", "originalJobId", "warrantyJobId", status, reason, resolution, "openedAt", "closedAt") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
54edd646-9a5e-4a17-a9d9-444d4455afc9	89b15abaf48fdac3e5717e7dcac816ce9318ce74b3ac9e77bed2519eaec050b5	2026-09-13 06:10:28.593899+00	0_init	\N	\N	2026-09-13 06:10:27.943772+00	1
6f494bb5-831f-4d3a-90bb-997e9f041072	9d534d2a9d092c8ac71a4b2d1a25e1f3ce75e22e964b46eafef1aa1e7b829a18	2026-09-13 18:55:21.855914+00	20260913120000_sms_usage	\N	\N	2026-09-13 18:55:21.835995+00	1
b5aaaaed-5f11-4f82-ba2d-09c3dbc520bd	4fa98a488ebd3f5b410f46d8b90a0a4e4bad20ada265943016cbd9a5bcec0f92	2026-09-21 08:50:25.52929+00	20260921120000_expense_payments_and_monthly_sequences	\N	\N	2026-09-21 08:50:25.498468+00	1
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: AiFeedback AiFeedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiFeedback"
    ADD CONSTRAINT "AiFeedback_pkey" PRIMARY KEY (id);


--
-- Name: AiKnowledgeArticle AiKnowledgeArticle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiKnowledgeArticle"
    ADD CONSTRAINT "AiKnowledgeArticle_pkey" PRIMARY KEY (id);


--
-- Name: AiOrgSettings AiOrgSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiOrgSettings"
    ADD CONSTRAINT "AiOrgSettings_pkey" PRIMARY KEY ("orgId");


--
-- Name: AiPromptLog AiPromptLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AiPromptLog"
    ADD CONSTRAINT "AiPromptLog_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BankAccount BankAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BankAccount"
    ADD CONSTRAINT "BankAccount_pkey" PRIMARY KEY (id);


--
-- Name: BankTransaction BankTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BankTransaction"
    ADD CONSTRAINT "BankTransaction_pkey" PRIMARY KEY (id);


--
-- Name: BillingEvent BillingEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BillingEvent"
    ADD CONSTRAINT "BillingEvent_pkey" PRIMARY KEY (id);


--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: CampaignContact CampaignContact_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignContact"
    ADD CONSTRAINT "CampaignContact_pkey" PRIMARY KEY (id);


--
-- Name: Campaign Campaign_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_pkey" PRIMARY KEY (id);


--
-- Name: CashierShift CashierShift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CashierShift"
    ADD CONSTRAINT "CashierShift_pkey" PRIMARY KEY (id);


--
-- Name: ChartOfAccount ChartOfAccount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChartOfAccount"
    ADD CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY (id);


--
-- Name: ClientMergeRecord ClientMergeRecord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientMergeRecord"
    ADD CONSTRAINT "ClientMergeRecord_pkey" PRIMARY KEY (id);


--
-- Name: ClientNote ClientNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientNote"
    ADD CONSTRAINT "ClientNote_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: CommunicationPolicy CommunicationPolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommunicationPolicy"
    ADD CONSTRAINT "CommunicationPolicy_pkey" PRIMARY KEY (id);


--
-- Name: CommunicationTemplateVersion CommunicationTemplateVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommunicationTemplateVersion"
    ADD CONSTRAINT "CommunicationTemplateVersion_pkey" PRIMARY KEY (id);


--
-- Name: CommunicationTemplate CommunicationTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommunicationTemplate"
    ADD CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY (id);


--
-- Name: Complaint Complaint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Complaint"
    ADD CONSTRAINT "Complaint_pkey" PRIMARY KEY (id);


--
-- Name: ConversationMessage ConversationMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ConversationMessage"
    ADD CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY (id);


--
-- Name: Conversation Conversation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conversation"
    ADD CONSTRAINT "Conversation_pkey" PRIMARY KEY (id);


--
-- Name: CreditNoteItem CreditNoteItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNoteItem"
    ADD CONSTRAINT "CreditNoteItem_pkey" PRIMARY KEY (id);


--
-- Name: CreditNote CreditNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNote"
    ADD CONSTRAINT "CreditNote_pkey" PRIMARY KEY (id);


--
-- Name: CustomerApproval CustomerApproval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerApproval"
    ADD CONSTRAINT "CustomerApproval_pkey" PRIMARY KEY (id);


--
-- Name: CustomerConsent CustomerConsent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CustomerConsent"
    ADD CONSTRAINT "CustomerConsent_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryNoteItem DeliveryNoteItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNoteItem"
    ADD CONSTRAINT "DeliveryNoteItem_pkey" PRIMARY KEY (id);


--
-- Name: DeliveryNote DeliveryNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNote"
    ADD CONSTRAINT "DeliveryNote_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: DeviceSpecification DeviceSpecification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeviceSpecification"
    ADD CONSTRAINT "DeviceSpecification_pkey" PRIMARY KEY (id);


--
-- Name: Device Device_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_pkey" PRIMARY KEY (id);


--
-- Name: DiagnosisReport DiagnosisReport_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DiagnosisReport"
    ADD CONSTRAINT "DiagnosisReport_pkey" PRIMARY KEY (id);


--
-- Name: DocumentBrandingSettings DocumentBrandingSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBrandingSettings"
    ADD CONSTRAINT "DocumentBrandingSettings_pkey" PRIMARY KEY (id);


--
-- Name: DocumentSequence DocumentSequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentSequence"
    ADD CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY (id);


--
-- Name: DocumentTaxLine DocumentTaxLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentTaxLine"
    ADD CONSTRAINT "DocumentTaxLine_pkey" PRIMARY KEY (id);


--
-- Name: ExpensePayment ExpensePayment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY (id);


--
-- Name: Expense Expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_pkey" PRIMARY KEY (id);


--
-- Name: FieldVisit FieldVisit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FieldVisit"
    ADD CONSTRAINT "FieldVisit_pkey" PRIMARY KEY (id);


--
-- Name: FileAsset FileAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FileAsset"
    ADD CONSTRAINT "FileAsset_pkey" PRIMARY KEY (id);


--
-- Name: FxReferenceRate FxReferenceRate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FxReferenceRate"
    ADD CONSTRAINT "FxReferenceRate_pkey" PRIMARY KEY (id);


--
-- Name: GoodsReceivedItem GoodsReceivedItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceivedItem"
    ADD CONSTRAINT "GoodsReceivedItem_pkey" PRIMARY KEY (id);


--
-- Name: GoodsReceived GoodsReceived_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceived"
    ADD CONSTRAINT "GoodsReceived_pkey" PRIMARY KEY (id);


--
-- Name: InboundMessage InboundMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InboundMessage"
    ADD CONSTRAINT "InboundMessage_pkey" PRIMARY KEY (id);


--
-- Name: InventoryCategory InventoryCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InventoryCategory"
    ADD CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceAttachment InvoiceAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceAttachment"
    ADD CONSTRAINT "InvoiceAttachment_pkey" PRIMARY KEY (id);


--
-- Name: InvoiceLine InvoiceLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY (id);


--
-- Name: Invoice Invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);


--
-- Name: JobAssignmentHistory JobAssignmentHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JobAssignmentHistory"
    ADD CONSTRAINT "JobAssignmentHistory_pkey" PRIMARY KEY (id);


--
-- Name: JobStatusHistory JobStatusHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JobStatusHistory"
    ADD CONSTRAINT "JobStatusHistory_pkey" PRIMARY KEY (id);


--
-- Name: Job Job_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_pkey" PRIMARY KEY (id);


--
-- Name: JournalEntry JournalEntry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JournalEntry"
    ADD CONSTRAINT "JournalEntry_pkey" PRIMARY KEY (id);


--
-- Name: JournalLine JournalLine_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JournalLine"
    ADD CONSTRAINT "JournalLine_pkey" PRIMARY KEY (id);


--
-- Name: LeadActivity LeadActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadActivity"
    ADD CONSTRAINT "LeadActivity_pkey" PRIMARY KEY (id);


--
-- Name: Lead Lead_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_pkey" PRIMARY KEY (id);


--
-- Name: NotificationPreferences NotificationPreferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationPreferences"
    ADD CONSTRAINT "NotificationPreferences_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OneTimeExternalTechAssignment OneTimeExternalTechAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OneTimeExternalTechAssignment"
    ADD CONSTRAINT "OneTimeExternalTechAssignment_pkey" PRIMARY KEY (id);


--
-- Name: OrgFeatureEntitlement OrgFeatureEntitlement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrgFeatureEntitlement"
    ADD CONSTRAINT "OrgFeatureEntitlement_pkey" PRIMARY KEY (id);


--
-- Name: OrgModuleGrant OrgModuleGrant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrgModuleGrant"
    ADD CONSTRAINT "OrgModuleGrant_pkey" PRIMARY KEY ("orgId", module);


--
-- Name: OrgSubscriptionEvent OrgSubscriptionEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrgSubscriptionEvent"
    ADD CONSTRAINT "OrgSubscriptionEvent_pkey" PRIMARY KEY (id);


--
-- Name: OrgUsageSnapshot OrgUsageSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrgUsageSnapshot"
    ADD CONSTRAINT "OrgUsageSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: OrgWhatsAppConfig OrgWhatsAppConfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrgWhatsAppConfig"
    ADD CONSTRAINT "OrgWhatsAppConfig_pkey" PRIMARY KEY ("orgId");


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: OutboundMessage OutboundMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY (id);


--
-- Name: PartLocationStock PartLocationStock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartLocationStock"
    ADD CONSTRAINT "PartLocationStock_pkey" PRIMARY KEY (id);


--
-- Name: PartReservation PartReservation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartReservation"
    ADD CONSTRAINT "PartReservation_pkey" PRIMARY KEY (id);


--
-- Name: PartStockTransaction PartStockTransaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartStockTransaction"
    ADD CONSTRAINT "PartStockTransaction_pkey" PRIMARY KEY (id);


--
-- Name: Part Part_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Part"
    ADD CONSTRAINT "Part_pkey" PRIMARY KEY (id);


--
-- Name: PaymentAllocation PaymentAllocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentAllocation"
    ADD CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY (id);


--
-- Name: PaymentReminderSettings PaymentReminderSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentReminderSettings"
    ADD CONSTRAINT "PaymentReminderSettings_pkey" PRIMARY KEY (id);


--
-- Name: Payment Payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY (id);


--
-- Name: Photo Photo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Photo"
    ADD CONSTRAINT "Photo_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSetting PlatformSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY (key);


--
-- Name: PortalSession PortalSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalSession"
    ADD CONSTRAINT "PortalSession_pkey" PRIMARY KEY (id);


--
-- Name: PortalUserClient PortalUserClient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalUserClient"
    ADD CONSTRAINT "PortalUserClient_pkey" PRIMARY KEY (id);


--
-- Name: PortalUser PortalUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalUser"
    ADD CONSTRAINT "PortalUser_pkey" PRIMARY KEY (id);


--
-- Name: PosSession PosSession_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PosSession"
    ADD CONSTRAINT "PosSession_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseOrderItem PurchaseOrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseOrder PurchaseOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseRequestItem PurchaseRequestItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequestItem"
    ADD CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY (id);


--
-- Name: PurchaseRequest PurchaseRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY (id);


--
-- Name: QualityCheck QualityCheck_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QualityCheck"
    ADD CONSTRAINT "QualityCheck_pkey" PRIMARY KEY (id);


--
-- Name: QuotationItem QuotationItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuotationItem"
    ADD CONSTRAINT "QuotationItem_pkey" PRIMARY KEY (id);


--
-- Name: Quotation Quotation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_pkey" PRIMARY KEY (id);


--
-- Name: RateLimit RateLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RateLimit"
    ADD CONSTRAINT "RateLimit_pkey" PRIMARY KEY (key);


--
-- Name: Receipt Receipt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_pkey" PRIMARY KEY (id);


--
-- Name: RecurringExpense RecurringExpense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringExpense"
    ADD CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY (id);


--
-- Name: RecurringInvoiceItem RecurringInvoiceItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringInvoiceItem"
    ADD CONSTRAINT "RecurringInvoiceItem_pkey" PRIMARY KEY (id);


--
-- Name: RecurringInvoice RecurringInvoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringInvoice"
    ADD CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY (id);


--
-- Name: Refund Refund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_pkey" PRIMARY KEY (id);


--
-- Name: ReorderRule ReorderRule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReorderRule"
    ADD CONSTRAINT "ReorderRule_pkey" PRIMARY KEY (id);


--
-- Name: RepairMessage RepairMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairMessage"
    ADD CONSTRAINT "RepairMessage_pkey" PRIMARY KEY (id);


--
-- Name: RepairRequestSequence RepairRequestSequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairRequestSequence"
    ADD CONSTRAINT "RepairRequestSequence_pkey" PRIMARY KEY (id);


--
-- Name: RepairRequest RepairRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairRequest"
    ADD CONSTRAINT "RepairRequest_pkey" PRIMARY KEY (id);


--
-- Name: RepairTask RepairTask_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairTask"
    ADD CONSTRAINT "RepairTask_pkey" PRIMARY KEY (id);


--
-- Name: SaleItem SaleItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_pkey" PRIMARY KEY (id);


--
-- Name: Sale Sale_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_pkey" PRIMARY KEY (id);


--
-- Name: SalesTarget SalesTarget_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesTarget"
    ADD CONSTRAINT "SalesTarget_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SmsUsage SmsUsage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SmsUsage"
    ADD CONSTRAINT "SmsUsage_pkey" PRIMARY KEY ("orgId", year, month);


--
-- Name: StockCountItem StockCountItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCountItem"
    ADD CONSTRAINT "StockCountItem_pkey" PRIMARY KEY (id);


--
-- Name: StockCount StockCount_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCount"
    ADD CONSTRAINT "StockCount_pkey" PRIMARY KEY (id);


--
-- Name: StockLocation StockLocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockLocation"
    ADD CONSTRAINT "StockLocation_pkey" PRIMARY KEY (id);


--
-- Name: StockTransferItem StockTransferItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransferItem"
    ADD CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY (id);


--
-- Name: StockTransfer StockTransfer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransfer"
    ADD CONSTRAINT "StockTransfer_pkey" PRIMARY KEY (id);


--
-- Name: SupplierBillItem SupplierBillItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBillItem"
    ADD CONSTRAINT "SupplierBillItem_pkey" PRIMARY KEY (id);


--
-- Name: SupplierBill SupplierBill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBill"
    ADD CONSTRAINT "SupplierBill_pkey" PRIMARY KEY (id);


--
-- Name: SupplierPayment SupplierPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierPayment"
    ADD CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY (id);


--
-- Name: SupplierPrice SupplierPrice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierPrice"
    ADD CONSTRAINT "SupplierPrice_pkey" PRIMARY KEY (id);


--
-- Name: Supplier Supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY (id);


--
-- Name: SystemAnnouncement SystemAnnouncement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemAnnouncement"
    ADD CONSTRAINT "SystemAnnouncement_pkey" PRIMARY KEY (id);


--
-- Name: SystemAuditEvent SystemAuditEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SystemAuditEvent"
    ADD CONSTRAINT "SystemAuditEvent_pkey" PRIMARY KEY (id);


--
-- Name: TaxRate TaxRate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaxRate"
    ADD CONSTRAINT "TaxRate_pkey" PRIMARY KEY (id);


--
-- Name: TechnicianPayout TechnicianPayout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TechnicianPayout"
    ADD CONSTRAINT "TechnicianPayout_pkey" PRIMARY KEY (id);


--
-- Name: UserAccessAudit UserAccessAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAccessAudit"
    ADD CONSTRAINT "UserAccessAudit_pkey" PRIMARY KEY (id);


--
-- Name: UserGroupMember UserGroupMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroupMember"
    ADD CONSTRAINT "UserGroupMember_pkey" PRIMARY KEY (id);


--
-- Name: UserGroupPermission UserGroupPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroupPermission"
    ADD CONSTRAINT "UserGroupPermission_pkey" PRIMARY KEY (id);


--
-- Name: UserGroup UserGroup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroup"
    ADD CONSTRAINT "UserGroup_pkey" PRIMARY KEY (id);


--
-- Name: UserInvite UserInvite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserInvite"
    ADD CONSTRAINT "UserInvite_pkey" PRIMARY KEY (id);


--
-- Name: UserPermission UserPermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPermission"
    ADD CONSTRAINT "UserPermission_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Verification Verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Verification"
    ADD CONSTRAINT "Verification_pkey" PRIMARY KEY (id);


--
-- Name: WarrantyClaim WarrantyClaim_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WarrantyClaim"
    ADD CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AiFeedback_orgId_feature_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiFeedback_orgId_feature_createdAt_idx" ON public."AiFeedback" USING btree ("orgId", feature, "createdAt");


--
-- Name: AiFeedback_rating_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiFeedback_rating_createdAt_idx" ON public."AiFeedback" USING btree (rating, "createdAt");


--
-- Name: AiKnowledgeArticle_isActive_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiKnowledgeArticle_isActive_updatedAt_idx" ON public."AiKnowledgeArticle" USING btree ("isActive", "updatedAt");


--
-- Name: AiKnowledgeArticle_orgId_module_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiKnowledgeArticle_orgId_module_isActive_idx" ON public."AiKnowledgeArticle" USING btree ("orgId", module, "isActive");


--
-- Name: AiPromptLog_orgId_feature_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPromptLog_orgId_feature_createdAt_idx" ON public."AiPromptLog" USING btree ("orgId", feature, "createdAt");


--
-- Name: AiPromptLog_promptVersion_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AiPromptLog_promptVersion_createdAt_idx" ON public."AiPromptLog" USING btree ("promptVersion", "createdAt");


--
-- Name: AuditLog_jobId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_jobId_createdAt_idx" ON public."AuditLog" USING btree ("jobId", "createdAt");


--
-- Name: AuditLog_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_orgId_createdAt_idx" ON public."AuditLog" USING btree ("orgId", "createdAt");


--
-- Name: AuditLog_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_userId_createdAt_idx" ON public."AuditLog" USING btree ("userId", "createdAt");


--
-- Name: BankAccount_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BankAccount_orgId_idx" ON public."BankAccount" USING btree ("orgId");


--
-- Name: BankAccount_orgId_ledgerCode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BankAccount_orgId_ledgerCode_idx" ON public."BankAccount" USING btree ("orgId", "ledgerCode");


--
-- Name: BankTransaction_bankAccountId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BankTransaction_bankAccountId_date_idx" ON public."BankTransaction" USING btree ("bankAccountId", date);


--
-- Name: BankTransaction_orgId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BankTransaction_orgId_date_idx" ON public."BankTransaction" USING btree ("orgId", date);


--
-- Name: BillingEvent_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BillingEvent_orgId_createdAt_idx" ON public."BillingEvent" USING btree ("orgId", "createdAt");


--
-- Name: BillingEvent_status_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BillingEvent_status_event_idx" ON public."BillingEvent" USING btree (status, event);


--
-- Name: Branch_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Branch_orgId_idx" ON public."Branch" USING btree ("orgId");


--
-- Name: CampaignContact_campaignId_clientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CampaignContact_campaignId_clientId_key" ON public."CampaignContact" USING btree ("campaignId", "clientId");


--
-- Name: CampaignContact_campaignId_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CampaignContact_campaignId_leadId_key" ON public."CampaignContact" USING btree ("campaignId", "leadId");


--
-- Name: CampaignContact_campaignId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CampaignContact_campaignId_status_idx" ON public."CampaignContact" USING btree ("campaignId", status);


--
-- Name: CampaignContact_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CampaignContact_orgId_idx" ON public."CampaignContact" USING btree ("orgId");


--
-- Name: Campaign_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Campaign_orgId_status_idx" ON public."Campaign" USING btree ("orgId", status);


--
-- Name: CashierShift_cashierId_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CashierShift_cashierId_openedAt_idx" ON public."CashierShift" USING btree ("cashierId", "openedAt");


--
-- Name: CashierShift_orgId_branchId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CashierShift_orgId_branchId_status_idx" ON public."CashierShift" USING btree ("orgId", "branchId", status);


--
-- Name: ChartOfAccount_orgId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ChartOfAccount_orgId_code_key" ON public."ChartOfAccount" USING btree ("orgId", code);


--
-- Name: ChartOfAccount_orgId_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ChartOfAccount_orgId_type_idx" ON public."ChartOfAccount" USING btree ("orgId", type);


--
-- Name: ClientMergeRecord_orgId_mergedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ClientMergeRecord_orgId_mergedAt_idx" ON public."ClientMergeRecord" USING btree ("orgId", "mergedAt");


--
-- Name: ClientMergeRecord_sourceClientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ClientMergeRecord_sourceClientId_idx" ON public."ClientMergeRecord" USING btree ("sourceClientId");


--
-- Name: ClientMergeRecord_targetClientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ClientMergeRecord_targetClientId_idx" ON public."ClientMergeRecord" USING btree ("targetClientId");


--
-- Name: Client_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_orgId_idx" ON public."Client" USING btree ("orgId");


--
-- Name: Client_orgId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Client_orgId_updatedAt_idx" ON public."Client" USING btree ("orgId", "updatedAt");


--
-- Name: Client_phone_orgId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Client_phone_orgId_key" ON public."Client" USING btree (phone, "orgId");


--
-- Name: CommunicationPolicy_orgId_templateKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CommunicationPolicy_orgId_templateKey_idx" ON public."CommunicationPolicy" USING btree ("orgId", "templateKey");


--
-- Name: CommunicationPolicy_status_orgId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CommunicationPolicy_status_orgId_key" ON public."CommunicationPolicy" USING btree (status, "orgId");


--
-- Name: CommunicationTemplateVersion_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CommunicationTemplateVersion_orgId_status_idx" ON public."CommunicationTemplateVersion" USING btree ("orgId", status);


--
-- Name: CommunicationTemplateVersion_templateId_version_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CommunicationTemplateVersion_templateId_version_key" ON public."CommunicationTemplateVersion" USING btree ("templateId", version);


--
-- Name: CommunicationTemplate_key_channel_orgId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CommunicationTemplate_key_channel_orgId_key" ON public."CommunicationTemplate" USING btree (key, channel, "orgId");


--
-- Name: CommunicationTemplate_orgId_channel_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CommunicationTemplate_orgId_channel_isActive_idx" ON public."CommunicationTemplate" USING btree ("orgId", channel, "isActive");


--
-- Name: Complaint_complaintNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Complaint_complaintNumber_key" ON public."Complaint" USING btree ("complaintNumber");


--
-- Name: Complaint_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Complaint_jobId_idx" ON public."Complaint" USING btree ("jobId");


--
-- Name: Complaint_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Complaint_orgId_createdAt_idx" ON public."Complaint" USING btree ("orgId", "createdAt");


--
-- Name: Complaint_orgId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Complaint_orgId_status_createdAt_idx" ON public."Complaint" USING btree ("orgId", status, "createdAt");


--
-- Name: ConversationMessage_orgId_conversationId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConversationMessage_orgId_conversationId_createdAt_idx" ON public."ConversationMessage" USING btree ("orgId", "conversationId", "createdAt");


--
-- Name: ConversationMessage_providerMessageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ConversationMessage_providerMessageId_idx" ON public."ConversationMessage" USING btree ("providerMessageId");


--
-- Name: Conversation_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_clientId_idx" ON public."Conversation" USING btree ("clientId");


--
-- Name: Conversation_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_jobId_idx" ON public."Conversation" USING btree ("jobId");


--
-- Name: Conversation_orgId_status_lastMessageAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conversation_orgId_status_lastMessageAt_idx" ON public."Conversation" USING btree ("orgId", status, "lastMessageAt");


--
-- Name: CreditNoteItem_creditNoteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreditNoteItem_creditNoteId_idx" ON public."CreditNoteItem" USING btree ("creditNoteId");


--
-- Name: CreditNoteItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreditNoteItem_partId_idx" ON public."CreditNoteItem" USING btree ("partId");


--
-- Name: CreditNote_creditNoteNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON public."CreditNote" USING btree ("creditNoteNumber");


--
-- Name: CreditNote_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreditNote_invoiceId_idx" ON public."CreditNote" USING btree ("invoiceId");


--
-- Name: CreditNote_orgId_issuedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreditNote_orgId_issuedAt_idx" ON public."CreditNote" USING btree ("orgId", "issuedAt");


--
-- Name: CreditNote_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CreditNote_saleId_idx" ON public."CreditNote" USING btree ("saleId");


--
-- Name: CustomerApproval_orgId_jobId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerApproval_orgId_jobId_status_idx" ON public."CustomerApproval" USING btree ("orgId", "jobId", status);


--
-- Name: CustomerApproval_orgId_requestedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerApproval_orgId_requestedAt_idx" ON public."CustomerApproval" USING btree ("orgId", "requestedAt");


--
-- Name: CustomerConsent_orgId_capturedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerConsent_orgId_capturedAt_idx" ON public."CustomerConsent" USING btree ("orgId", "capturedAt");


--
-- Name: CustomerConsent_orgId_clientId_consentType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CustomerConsent_orgId_clientId_consentType_idx" ON public."CustomerConsent" USING btree ("orgId", "clientId", "consentType");


--
-- Name: DeliveryNoteItem_deliveryNoteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryNoteItem_deliveryNoteId_idx" ON public."DeliveryNoteItem" USING btree ("deliveryNoteId");


--
-- Name: DeliveryNoteItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryNoteItem_partId_idx" ON public."DeliveryNoteItem" USING btree ("partId");


--
-- Name: DeliveryNoteItem_saleItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryNoteItem_saleItemId_idx" ON public."DeliveryNoteItem" USING btree ("saleItemId");


--
-- Name: DeliveryNote_deliveryNoteNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeliveryNote_deliveryNoteNumber_key" ON public."DeliveryNote" USING btree ("deliveryNoteNumber");


--
-- Name: DeliveryNote_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryNote_invoiceId_idx" ON public."DeliveryNote" USING btree ("invoiceId");


--
-- Name: DeliveryNote_orgId_deliveredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryNote_orgId_deliveredAt_idx" ON public."DeliveryNote" USING btree ("orgId", "deliveredAt");


--
-- Name: DeliveryNote_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeliveryNote_saleId_idx" ON public."DeliveryNote" USING btree ("saleId");


--
-- Name: Department_orgId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Department_orgId_code_key" ON public."Department" USING btree ("orgId", code);


--
-- Name: DeviceSpecification_deviceId_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeviceSpecification_deviceId_key_key" ON public."DeviceSpecification" USING btree ("deviceId", key);


--
-- Name: DeviceSpecification_orgId_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DeviceSpecification_orgId_key_idx" ON public."DeviceSpecification" USING btree ("orgId", key);


--
-- Name: Device_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Device_clientId_idx" ON public."Device" USING btree ("clientId");


--
-- Name: Device_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Device_orgId_idx" ON public."Device" USING btree ("orgId");


--
-- Name: Device_serialOrImei_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Device_serialOrImei_idx" ON public."Device" USING btree ("serialOrImei");


--
-- Name: DiagnosisReport_orgId_jobId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DiagnosisReport_orgId_jobId_createdAt_idx" ON public."DiagnosisReport" USING btree ("orgId", "jobId", "createdAt");


--
-- Name: DocumentBrandingSettings_orgId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DocumentBrandingSettings_orgId_key" ON public."DocumentBrandingSettings" USING btree ("orgId");


--
-- Name: DocumentSequence_orgId_type_year_month_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DocumentSequence_orgId_type_year_month_key" ON public."DocumentSequence" USING btree ("orgId", type, year, month);


--
-- Name: DocumentTaxLine_orgId_documentType_documentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "DocumentTaxLine_orgId_documentType_documentId_idx" ON public."DocumentTaxLine" USING btree ("orgId", "documentType", "documentId");


--
-- Name: ExpensePayment_expenseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExpensePayment_expenseId_idx" ON public."ExpensePayment" USING btree ("expenseId");


--
-- Name: ExpensePayment_orgId_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ExpensePayment_orgId_paidAt_idx" ON public."ExpensePayment" USING btree ("orgId", "paidAt");


--
-- Name: Expense_expenseNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Expense_expenseNumber_key" ON public."Expense" USING btree ("expenseNumber");


--
-- Name: Expense_orgId_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_orgId_category_idx" ON public."Expense" USING btree ("orgId", category);


--
-- Name: Expense_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_orgId_createdAt_idx" ON public."Expense" USING btree ("orgId", "createdAt");


--
-- Name: Expense_orgId_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_orgId_dueAt_idx" ON public."Expense" USING btree ("orgId", "dueAt");


--
-- Name: Expense_orgId_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_orgId_paidAt_idx" ON public."Expense" USING btree ("orgId", "paidAt");


--
-- Name: Expense_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Expense_supplierId_idx" ON public."Expense" USING btree ("supplierId");


--
-- Name: FieldVisit_assignedToId_scheduledAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FieldVisit_assignedToId_scheduledAt_idx" ON public."FieldVisit" USING btree ("assignedToId", "scheduledAt");


--
-- Name: FieldVisit_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FieldVisit_branchId_idx" ON public."FieldVisit" USING btree ("branchId");


--
-- Name: FieldVisit_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FieldVisit_jobId_idx" ON public."FieldVisit" USING btree ("jobId");


--
-- Name: FieldVisit_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FieldVisit_orgId_status_idx" ON public."FieldVisit" USING btree ("orgId", status);


--
-- Name: FileAsset_orgId_ownerType_ownerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FileAsset_orgId_ownerType_ownerId_idx" ON public."FileAsset" USING btree ("orgId", "ownerType", "ownerId");


--
-- Name: FileAsset_storageKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FileAsset_storageKey_idx" ON public."FileAsset" USING btree ("storageKey");


--
-- Name: FxReferenceRate_base_quote_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "FxReferenceRate_base_quote_key" ON public."FxReferenceRate" USING btree (base, quote);


--
-- Name: FxReferenceRate_fetchedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "FxReferenceRate_fetchedAt_idx" ON public."FxReferenceRate" USING btree ("fetchedAt");


--
-- Name: GoodsReceivedItem_grnId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceivedItem_grnId_idx" ON public."GoodsReceivedItem" USING btree ("grnId");


--
-- Name: GoodsReceivedItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceivedItem_partId_idx" ON public."GoodsReceivedItem" USING btree ("partId");


--
-- Name: GoodsReceivedItem_poItemId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceivedItem_poItemId_idx" ON public."GoodsReceivedItem" USING btree ("poItemId");


--
-- Name: GoodsReceived_grnNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "GoodsReceived_grnNumber_key" ON public."GoodsReceived" USING btree ("grnNumber");


--
-- Name: GoodsReceived_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceived_locationId_idx" ON public."GoodsReceived" USING btree ("locationId");


--
-- Name: GoodsReceived_orgId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceived_orgId_receivedAt_idx" ON public."GoodsReceived" USING btree ("orgId", "receivedAt");


--
-- Name: GoodsReceived_poId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceived_poId_idx" ON public."GoodsReceived" USING btree ("poId");


--
-- Name: GoodsReceived_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "GoodsReceived_supplierId_idx" ON public."GoodsReceived" USING btree ("supplierId");


--
-- Name: InboundMessage_clientId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InboundMessage_clientId_isRead_idx" ON public."InboundMessage" USING btree ("clientId", "isRead");


--
-- Name: InboundMessage_from_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InboundMessage_from_timestamp_idx" ON public."InboundMessage" USING btree ("from", "timestamp");


--
-- Name: InboundMessage_isRead_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InboundMessage_isRead_createdAt_idx" ON public."InboundMessage" USING btree ("isRead", "createdAt");


--
-- Name: InboundMessage_jobId_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InboundMessage_jobId_timestamp_idx" ON public."InboundMessage" USING btree ("jobId", "timestamp");


--
-- Name: InboundMessage_orgId_isRead_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InboundMessage_orgId_isRead_createdAt_idx" ON public."InboundMessage" USING btree ("orgId", "isRead", "createdAt");


--
-- Name: InboundMessage_wamid_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InboundMessage_wamid_key" ON public."InboundMessage" USING btree (wamid);


--
-- Name: InventoryCategory_orgId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InventoryCategory_orgId_isActive_idx" ON public."InventoryCategory" USING btree ("orgId", "isActive");


--
-- Name: InventoryCategory_orgId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "InventoryCategory_orgId_name_key" ON public."InventoryCategory" USING btree ("orgId", name);


--
-- Name: InvoiceAttachment_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceAttachment_invoiceId_idx" ON public."InvoiceAttachment" USING btree ("invoiceId");


--
-- Name: InvoiceAttachment_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceAttachment_orgId_idx" ON public."InvoiceAttachment" USING btree ("orgId");


--
-- Name: InvoiceLine_orgId_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceLine_orgId_invoiceId_idx" ON public."InvoiceLine" USING btree ("orgId", "invoiceId");


--
-- Name: InvoiceLine_sourceType_sourceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "InvoiceLine_sourceType_sourceId_idx" ON public."InvoiceLine" USING btree ("sourceType", "sourceId");


--
-- Name: Invoice_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_clientId_idx" ON public."Invoice" USING btree ("clientId");


--
-- Name: Invoice_invoiceNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON public."Invoice" USING btree ("invoiceNumber");


--
-- Name: Invoice_jobId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invoice_jobId_key" ON public."Invoice" USING btree ("jobId");


--
-- Name: Invoice_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_orgId_createdAt_idx" ON public."Invoice" USING btree ("orgId", "createdAt");


--
-- Name: Invoice_orgId_invoiceType_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_orgId_invoiceType_idx" ON public."Invoice" USING btree ("orgId", "invoiceType");


--
-- Name: Invoice_orgId_issuedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_orgId_issuedAt_idx" ON public."Invoice" USING btree ("orgId", "issuedAt");


--
-- Name: Invoice_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invoice_orgId_status_idx" ON public."Invoice" USING btree ("orgId", status);


--
-- Name: JobAssignmentHistory_assignedToId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JobAssignmentHistory_assignedToId_startedAt_idx" ON public."JobAssignmentHistory" USING btree ("assignedToId", "startedAt");


--
-- Name: JobAssignmentHistory_orgId_jobId_startedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JobAssignmentHistory_orgId_jobId_startedAt_idx" ON public."JobAssignmentHistory" USING btree ("orgId", "jobId", "startedAt");


--
-- Name: JobStatusHistory_orgId_jobId_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JobStatusHistory_orgId_jobId_changedAt_idx" ON public."JobStatusHistory" USING btree ("orgId", "jobId", "changedAt");


--
-- Name: JobStatusHistory_orgId_toStatus_changedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JobStatusHistory_orgId_toStatus_changedAt_idx" ON public."JobStatusHistory" USING btree ("orgId", "toStatus", "changedAt");


--
-- Name: Job_assignedToId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_assignedToId_status_idx" ON public."Job" USING btree ("assignedToId", status);


--
-- Name: Job_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_clientId_idx" ON public."Job" USING btree ("clientId");


--
-- Name: Job_completedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_completedAt_idx" ON public."Job" USING btree ("completedAt");


--
-- Name: Job_createdById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_createdById_idx" ON public."Job" USING btree ("createdById");


--
-- Name: Job_deviceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_deviceId_idx" ON public."Job" USING btree ("deviceId");


--
-- Name: Job_invoiceNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Job_invoiceNumber_key" ON public."Job" USING btree ("invoiceNumber");


--
-- Name: Job_jobNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Job_jobNumber_key" ON public."Job" USING btree ("jobNumber");


--
-- Name: Job_orgId_completedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_orgId_completedAt_idx" ON public."Job" USING btree ("orgId", "completedAt");


--
-- Name: Job_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_orgId_idx" ON public."Job" USING btree ("orgId");


--
-- Name: Job_orgId_jobNumber_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_orgId_jobNumber_idx" ON public."Job" USING btree ("orgId", "jobNumber");


--
-- Name: Job_orgId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_orgId_receivedAt_idx" ON public."Job" USING btree ("orgId", "receivedAt");


--
-- Name: Job_orgId_repairPath_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_orgId_repairPath_status_idx" ON public."Job" USING btree ("orgId", "repairPath", status);


--
-- Name: Job_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_orgId_status_idx" ON public."Job" USING btree ("orgId", status);


--
-- Name: Job_quotationNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Job_quotationNumber_key" ON public."Job" USING btree ("quotationNumber");


--
-- Name: Job_repairPath_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_repairPath_idx" ON public."Job" USING btree ("repairPath");


--
-- Name: Job_status_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_status_receivedAt_idx" ON public."Job" USING btree (status, "receivedAt");


--
-- Name: Job_status_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Job_status_updatedAt_idx" ON public."Job" USING btree (status, "updatedAt");


--
-- Name: JournalEntry_orgId_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JournalEntry_orgId_date_idx" ON public."JournalEntry" USING btree ("orgId", date);


--
-- Name: JournalEntry_orgId_entryNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "JournalEntry_orgId_entryNumber_key" ON public."JournalEntry" USING btree ("orgId", "entryNumber");


--
-- Name: JournalEntry_orgId_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JournalEntry_orgId_reference_idx" ON public."JournalEntry" USING btree ("orgId", reference);


--
-- Name: JournalEntry_orgId_status_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JournalEntry_orgId_status_date_idx" ON public."JournalEntry" USING btree ("orgId", status, date);


--
-- Name: JournalEntry_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JournalEntry_orgId_status_idx" ON public."JournalEntry" USING btree ("orgId", status);


--
-- Name: JournalLine_accountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JournalLine_accountId_idx" ON public."JournalLine" USING btree ("accountId");


--
-- Name: JournalLine_journalEntryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "JournalLine_journalEntryId_idx" ON public."JournalLine" USING btree ("journalEntryId");


--
-- Name: LeadActivity_leadId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON public."LeadActivity" USING btree ("leadId", "createdAt");


--
-- Name: LeadActivity_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LeadActivity_userId_createdAt_idx" ON public."LeadActivity" USING btree ("userId", "createdAt");


--
-- Name: Lead_assignedToId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_assignedToId_idx" ON public."Lead" USING btree ("assignedToId");


--
-- Name: Lead_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_createdAt_idx" ON public."Lead" USING btree ("createdAt");


--
-- Name: Lead_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_orgId_status_idx" ON public."Lead" USING btree ("orgId", status);


--
-- Name: Lead_orgId_updatedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Lead_orgId_updatedAt_idx" ON public."Lead" USING btree ("orgId", "updatedAt");


--
-- Name: NotificationPreferences_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NotificationPreferences_userId_key" ON public."NotificationPreferences" USING btree ("userId");


--
-- Name: Notification_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_jobId_idx" ON public."Notification" USING btree ("jobId");


--
-- Name: Notification_orgId_isRead_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_orgId_isRead_createdAt_idx" ON public."Notification" USING btree ("orgId", "isRead", "createdAt");


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: OneTimeExternalTechAssignment_assignedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OneTimeExternalTechAssignment_assignedAt_idx" ON public."OneTimeExternalTechAssignment" USING btree ("assignedAt");


--
-- Name: OneTimeExternalTechAssignment_jobId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OneTimeExternalTechAssignment_jobId_key" ON public."OneTimeExternalTechAssignment" USING btree ("jobId");


--
-- Name: OrgFeatureEntitlement_orgId_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrgFeatureEntitlement_orgId_enabled_idx" ON public."OrgFeatureEntitlement" USING btree ("orgId", enabled);


--
-- Name: OrgFeatureEntitlement_orgId_feature_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OrgFeatureEntitlement_orgId_feature_key" ON public."OrgFeatureEntitlement" USING btree ("orgId", feature);


--
-- Name: OrgModuleGrant_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrgModuleGrant_orgId_idx" ON public."OrgModuleGrant" USING btree ("orgId");


--
-- Name: OrgSubscriptionEvent_orgId_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrgSubscriptionEvent_orgId_occurredAt_idx" ON public."OrgSubscriptionEvent" USING btree ("orgId", "occurredAt");


--
-- Name: OrgSubscriptionEvent_provider_providerEventId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrgSubscriptionEvent_provider_providerEventId_idx" ON public."OrgSubscriptionEvent" USING btree (provider, "providerEventId");


--
-- Name: OrgUsageSnapshot_orgId_metric_capturedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrgUsageSnapshot_orgId_metric_capturedAt_idx" ON public."OrgUsageSnapshot" USING btree ("orgId", metric, "capturedAt");


--
-- Name: OrgUsageSnapshot_orgId_periodKey_metric_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "OrgUsageSnapshot_orgId_periodKey_metric_key" ON public."OrgUsageSnapshot" USING btree ("orgId", "periodKey", metric);


--
-- Name: OrgWhatsAppConfig_phoneNumberId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OrgWhatsAppConfig_phoneNumberId_idx" ON public."OrgWhatsAppConfig" USING btree ("phoneNumberId");


--
-- Name: Organization_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_isActive_idx" ON public."Organization" USING btree ("isActive");


--
-- Name: Organization_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Organization_slug_idx" ON public."Organization" USING btree (slug);


--
-- Name: Organization_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_slug_key" ON public."Organization" USING btree (slug);


--
-- Name: OutboundMessage_channel_status_nextAttemptAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_channel_status_nextAttemptAt_idx" ON public."OutboundMessage" USING btree (channel, status, "nextAttemptAt");


--
-- Name: OutboundMessage_clientId_reminderStage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_clientId_reminderStage_idx" ON public."OutboundMessage" USING btree ("clientId", "reminderStage");


--
-- Name: OutboundMessage_invoiceId_reminderStage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_invoiceId_reminderStage_idx" ON public."OutboundMessage" USING btree ("invoiceId", "reminderStage");


--
-- Name: OutboundMessage_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_jobId_idx" ON public."OutboundMessage" USING btree ("jobId");


--
-- Name: OutboundMessage_orgId_channel_status_nextAttemptAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_orgId_channel_status_nextAttemptAt_idx" ON public."OutboundMessage" USING btree ("orgId", channel, status, "nextAttemptAt");


--
-- Name: OutboundMessage_providerMessageId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_providerMessageId_idx" ON public."OutboundMessage" USING btree ("providerMessageId");


--
-- Name: OutboundMessage_repairRequestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_repairRequestId_idx" ON public."OutboundMessage" USING btree ("repairRequestId");


--
-- Name: OutboundMessage_templateKey_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OutboundMessage_templateKey_idx" ON public."OutboundMessage" USING btree ("templateKey");


--
-- Name: PartLocationStock_orgId_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartLocationStock_orgId_locationId_idx" ON public."PartLocationStock" USING btree ("orgId", "locationId");


--
-- Name: PartLocationStock_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartLocationStock_partId_idx" ON public."PartLocationStock" USING btree ("partId");


--
-- Name: PartLocationStock_partId_locationId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PartLocationStock_partId_locationId_key" ON public."PartLocationStock" USING btree ("partId", "locationId");


--
-- Name: PartReservation_jobId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartReservation_jobId_status_idx" ON public."PartReservation" USING btree ("jobId", status);


--
-- Name: PartReservation_partId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartReservation_partId_status_idx" ON public."PartReservation" USING btree ("partId", status);


--
-- Name: PartStockTransaction_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartStockTransaction_jobId_idx" ON public."PartStockTransaction" USING btree ("jobId");


--
-- Name: PartStockTransaction_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartStockTransaction_orgId_createdAt_idx" ON public."PartStockTransaction" USING btree ("orgId", "createdAt");


--
-- Name: PartStockTransaction_partId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartStockTransaction_partId_createdAt_idx" ON public."PartStockTransaction" USING btree ("partId", "createdAt");


--
-- Name: PartStockTransaction_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PartStockTransaction_saleId_idx" ON public."PartStockTransaction" USING btree ("saleId");


--
-- Name: Part_orgId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Part_orgId_isActive_idx" ON public."Part" USING btree ("orgId", "isActive");


--
-- Name: Part_sku_orgId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Part_sku_orgId_key" ON public."Part" USING btree (sku, "orgId");


--
-- Name: PaymentAllocation_orgId_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentAllocation_orgId_paymentId_idx" ON public."PaymentAllocation" USING btree ("orgId", "paymentId");


--
-- Name: PaymentAllocation_targetType_targetId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PaymentAllocation_targetType_targetId_idx" ON public."PaymentAllocation" USING btree ("targetType", "targetId");


--
-- Name: PaymentReminderSettings_orgId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PaymentReminderSettings_orgId_key" ON public."PaymentReminderSettings" USING btree ("orgId");


--
-- Name: Payment_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_invoiceId_idx" ON public."Payment" USING btree ("invoiceId");


--
-- Name: Payment_orgId_kind_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_orgId_kind_receivedAt_idx" ON public."Payment" USING btree ("orgId", kind, "receivedAt");


--
-- Name: Payment_orgId_receivedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_orgId_receivedAt_idx" ON public."Payment" USING btree ("orgId", "receivedAt");


--
-- Name: Payment_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Payment_saleId_idx" ON public."Payment" USING btree ("saleId");


--
-- Name: Photo_jobId_uploadedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Photo_jobId_uploadedAt_idx" ON public."Photo" USING btree ("jobId", "uploadedAt");


--
-- Name: Photo_jobId_visibility_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Photo_jobId_visibility_idx" ON public."Photo" USING btree ("jobId", visibility);


--
-- Name: Photo_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Photo_orgId_idx" ON public."Photo" USING btree ("orgId");


--
-- Name: PortalSession_portalUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalSession_portalUserId_idx" ON public."PortalSession" USING btree ("portalUserId");


--
-- Name: PortalSession_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PortalSession_token_key" ON public."PortalSession" USING btree (token);


--
-- Name: PortalUserClient_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalUserClient_clientId_idx" ON public."PortalUserClient" USING btree ("clientId");


--
-- Name: PortalUserClient_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalUserClient_orgId_idx" ON public."PortalUserClient" USING btree ("orgId");


--
-- Name: PortalUserClient_portalUserId_clientId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PortalUserClient_portalUserId_clientId_key" ON public."PortalUserClient" USING btree ("portalUserId", "clientId");


--
-- Name: PortalUserClient_portalUserId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalUserClient_portalUserId_idx" ON public."PortalUserClient" USING btree ("portalUserId");


--
-- Name: PortalUser_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalUser_clientId_idx" ON public."PortalUser" USING btree ("clientId");


--
-- Name: PortalUser_orgId_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PortalUser_orgId_email_key" ON public."PortalUser" USING btree ("orgId", email);


--
-- Name: PortalUser_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PortalUser_orgId_idx" ON public."PortalUser" USING btree ("orgId");


--
-- Name: PosSession_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PosSession_branchId_idx" ON public."PosSession" USING btree ("branchId");


--
-- Name: PosSession_operatorId_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PosSession_operatorId_openedAt_idx" ON public."PosSession" USING btree ("operatorId", "openedAt");


--
-- Name: PosSession_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PosSession_orgId_status_idx" ON public."PosSession" USING btree ("orgId", status);


--
-- Name: PurchaseOrderItem_poId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseOrderItem_poId_idx" ON public."PurchaseOrderItem" USING btree ("poId");


--
-- Name: PurchaseOrder_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseOrder_orgId_idx" ON public."PurchaseOrder" USING btree ("orgId");


--
-- Name: PurchaseOrder_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseOrder_supplierId_idx" ON public."PurchaseOrder" USING btree ("supplierId");


--
-- Name: PurchaseRequestItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseRequestItem_partId_idx" ON public."PurchaseRequestItem" USING btree ("partId");


--
-- Name: PurchaseRequestItem_requestId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseRequestItem_requestId_idx" ON public."PurchaseRequestItem" USING btree ("requestId");


--
-- Name: PurchaseRequest_orgId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseRequest_orgId_status_createdAt_idx" ON public."PurchaseRequest" USING btree ("orgId", status, "createdAt");


--
-- Name: PurchaseRequest_requestNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PurchaseRequest_requestNumber_key" ON public."PurchaseRequest" USING btree ("requestNumber");


--
-- Name: PurchaseRequest_requestedById_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseRequest_requestedById_idx" ON public."PurchaseRequest" USING btree ("requestedById");


--
-- Name: PurchaseRequest_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PurchaseRequest_supplierId_idx" ON public."PurchaseRequest" USING btree ("supplierId");


--
-- Name: QualityCheck_orgId_jobId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QualityCheck_orgId_jobId_status_idx" ON public."QualityCheck" USING btree ("orgId", "jobId", status);


--
-- Name: QuotationItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuotationItem_partId_idx" ON public."QuotationItem" USING btree ("partId");


--
-- Name: QuotationItem_quotationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "QuotationItem_quotationId_idx" ON public."QuotationItem" USING btree ("quotationId");


--
-- Name: Quotation_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quotation_clientId_idx" ON public."Quotation" USING btree ("clientId");


--
-- Name: Quotation_convertedToInvoiceId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Quotation_convertedToInvoiceId_key" ON public."Quotation" USING btree ("convertedToInvoiceId");


--
-- Name: Quotation_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quotation_jobId_idx" ON public."Quotation" USING btree ("jobId");


--
-- Name: Quotation_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quotation_leadId_idx" ON public."Quotation" USING btree ("leadId");


--
-- Name: Quotation_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quotation_orgId_createdAt_idx" ON public."Quotation" USING btree ("orgId", "createdAt");


--
-- Name: Quotation_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Quotation_orgId_status_idx" ON public."Quotation" USING btree ("orgId", status);


--
-- Name: Quotation_quoteNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Quotation_quoteNumber_key" ON public."Quotation" USING btree ("quoteNumber");


--
-- Name: RateLimit_resetAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RateLimit_resetAt_idx" ON public."RateLimit" USING btree ("resetAt");


--
-- Name: Receipt_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Receipt_clientId_idx" ON public."Receipt" USING btree ("clientId");


--
-- Name: Receipt_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Receipt_invoiceId_idx" ON public."Receipt" USING btree ("invoiceId");


--
-- Name: Receipt_orgId_issuedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Receipt_orgId_issuedAt_idx" ON public."Receipt" USING btree ("orgId", "issuedAt");


--
-- Name: Receipt_orgId_paymentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Receipt_orgId_paymentId_key" ON public."Receipt" USING btree ("orgId", "paymentId");


--
-- Name: Receipt_paymentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Receipt_paymentId_idx" ON public."Receipt" USING btree ("paymentId");


--
-- Name: Receipt_receiptNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON public."Receipt" USING btree ("receiptNumber");


--
-- Name: Receipt_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Receipt_saleId_idx" ON public."Receipt" USING btree ("saleId");


--
-- Name: RecurringExpense_orgId_isActive_nextDueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecurringExpense_orgId_isActive_nextDueAt_idx" ON public."RecurringExpense" USING btree ("orgId", "isActive", "nextDueAt");


--
-- Name: RecurringExpense_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecurringExpense_supplierId_idx" ON public."RecurringExpense" USING btree ("supplierId");


--
-- Name: RecurringInvoiceItem_recurringInvoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecurringInvoiceItem_recurringInvoiceId_idx" ON public."RecurringInvoiceItem" USING btree ("recurringInvoiceId");


--
-- Name: RecurringInvoice_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecurringInvoice_clientId_idx" ON public."RecurringInvoice" USING btree ("clientId");


--
-- Name: RecurringInvoice_orgId_isActive_nextDueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RecurringInvoice_orgId_isActive_nextDueAt_idx" ON public."RecurringInvoice" USING btree ("orgId", "isActive", "nextDueAt");


--
-- Name: Refund_creditNoteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refund_creditNoteId_idx" ON public."Refund" USING btree ("creditNoteId");


--
-- Name: Refund_invoiceId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refund_invoiceId_idx" ON public."Refund" USING btree ("invoiceId");


--
-- Name: Refund_orgId_refundedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refund_orgId_refundedAt_idx" ON public."Refund" USING btree ("orgId", "refundedAt");


--
-- Name: Refund_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Refund_saleId_idx" ON public."Refund" USING btree ("saleId");


--
-- Name: ReorderRule_orgId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReorderRule_orgId_isActive_idx" ON public."ReorderRule" USING btree ("orgId", "isActive");


--
-- Name: ReorderRule_partId_locationId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ReorderRule_partId_locationId_key" ON public."ReorderRule" USING btree ("partId", "locationId");


--
-- Name: RepairMessage_jobId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairMessage_jobId_createdAt_idx" ON public."RepairMessage" USING btree ("jobId", "createdAt");


--
-- Name: RepairMessage_orgId_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairMessage_orgId_jobId_idx" ON public."RepairMessage" USING btree ("orgId", "jobId");


--
-- Name: RepairRequestSequence_orgId_year_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RepairRequestSequence_orgId_year_key" ON public."RepairRequestSequence" USING btree ("orgId", year);


--
-- Name: RepairRequest_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairRequest_clientId_idx" ON public."RepairRequest" USING btree ("clientId");


--
-- Name: RepairRequest_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairRequest_orgId_createdAt_idx" ON public."RepairRequest" USING btree ("orgId", "createdAt");


--
-- Name: RepairRequest_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairRequest_phone_idx" ON public."RepairRequest" USING btree (phone);


--
-- Name: RepairRequest_requestNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RepairRequest_requestNumber_key" ON public."RepairRequest" USING btree ("requestNumber");


--
-- Name: RepairRequest_requestStatus_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairRequest_requestStatus_createdAt_idx" ON public."RepairRequest" USING btree ("requestStatus", "createdAt");


--
-- Name: RepairTask_assignedToId_status_dueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairTask_assignedToId_status_dueAt_idx" ON public."RepairTask" USING btree ("assignedToId", status, "dueAt");


--
-- Name: RepairTask_orgId_jobId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RepairTask_orgId_jobId_status_idx" ON public."RepairTask" USING btree ("orgId", "jobId", status);


--
-- Name: SaleItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleItem_partId_idx" ON public."SaleItem" USING btree ("partId");


--
-- Name: SaleItem_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleItem_saleId_idx" ON public."SaleItem" USING btree ("saleId");


--
-- Name: Sale_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_branchId_idx" ON public."Sale" USING btree ("branchId");


--
-- Name: Sale_clientId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_clientId_idx" ON public."Sale" USING btree ("clientId");


--
-- Name: Sale_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_orgId_createdAt_idx" ON public."Sale" USING btree ("orgId", "createdAt");


--
-- Name: Sale_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_orgId_status_idx" ON public."Sale" USING btree ("orgId", status);


--
-- Name: Sale_posSessionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_posSessionId_idx" ON public."Sale" USING btree ("posSessionId");


--
-- Name: Sale_saleNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Sale_saleNumber_key" ON public."Sale" USING btree ("saleNumber");


--
-- Name: SalesTarget_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTarget_branchId_idx" ON public."SalesTarget" USING btree ("branchId");


--
-- Name: SalesTarget_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTarget_departmentId_idx" ON public."SalesTarget" USING btree ("departmentId");


--
-- Name: SalesTarget_entityType_period_periodLabel_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTarget_entityType_period_periodLabel_idx" ON public."SalesTarget" USING btree ("entityType", period, "periodLabel");


--
-- Name: SalesTarget_orgId_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTarget_orgId_period_idx" ON public."SalesTarget" USING btree ("orgId", period);


--
-- Name: SalesTarget_orgId_userId_period_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SalesTarget_orgId_userId_period_key" ON public."SalesTarget" USING btree ("orgId", "userId", period);


--
-- Name: SalesTarget_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SalesTarget_userId_idx" ON public."SalesTarget" USING btree ("userId");


--
-- Name: Session_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_token_key" ON public."Session" USING btree (token);


--
-- Name: SmsUsage_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SmsUsage_year_month_idx" ON public."SmsUsage" USING btree (year, month);


--
-- Name: StockCountItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockCountItem_partId_idx" ON public."StockCountItem" USING btree ("partId");


--
-- Name: StockCountItem_stockCountId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockCountItem_stockCountId_idx" ON public."StockCountItem" USING btree ("stockCountId");


--
-- Name: StockCount_countNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StockCount_countNumber_key" ON public."StockCount" USING btree ("countNumber");


--
-- Name: StockCount_locationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockCount_locationId_idx" ON public."StockCount" USING btree ("locationId");


--
-- Name: StockCount_orgId_status_countedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockCount_orgId_status_countedAt_idx" ON public."StockCount" USING btree ("orgId", status, "countedAt");


--
-- Name: StockLocation_orgId_branchId_isActive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockLocation_orgId_branchId_isActive_idx" ON public."StockLocation" USING btree ("orgId", "branchId", "isActive");


--
-- Name: StockLocation_orgId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StockLocation_orgId_code_key" ON public."StockLocation" USING btree ("orgId", code);


--
-- Name: StockTransferItem_partId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockTransferItem_partId_idx" ON public."StockTransferItem" USING btree ("partId");


--
-- Name: StockTransferItem_transferId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockTransferItem_transferId_idx" ON public."StockTransferItem" USING btree ("transferId");


--
-- Name: StockTransfer_fromLocationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockTransfer_fromLocationId_idx" ON public."StockTransfer" USING btree ("fromLocationId");


--
-- Name: StockTransfer_orgId_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockTransfer_orgId_status_createdAt_idx" ON public."StockTransfer" USING btree ("orgId", status, "createdAt");


--
-- Name: StockTransfer_toLocationId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockTransfer_toLocationId_idx" ON public."StockTransfer" USING btree ("toLocationId");


--
-- Name: StockTransfer_transferNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "StockTransfer_transferNumber_key" ON public."StockTransfer" USING btree ("transferNumber");


--
-- Name: SupplierBillItem_billId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierBillItem_billId_idx" ON public."SupplierBillItem" USING btree ("billId");


--
-- Name: SupplierBill_billNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SupplierBill_billNumber_key" ON public."SupplierBill" USING btree ("billNumber");


--
-- Name: SupplierBill_grnId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierBill_grnId_idx" ON public."SupplierBill" USING btree ("grnId");


--
-- Name: SupplierBill_orgId_issuedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierBill_orgId_issuedAt_idx" ON public."SupplierBill" USING btree ("orgId", "issuedAt");


--
-- Name: SupplierBill_orgId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierBill_orgId_status_idx" ON public."SupplierBill" USING btree ("orgId", status);


--
-- Name: SupplierBill_poId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierBill_poId_idx" ON public."SupplierBill" USING btree ("poId");


--
-- Name: SupplierBill_supplierId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierBill_supplierId_idx" ON public."SupplierBill" USING btree ("supplierId");


--
-- Name: SupplierPayment_billId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierPayment_billId_idx" ON public."SupplierPayment" USING btree ("billId");


--
-- Name: SupplierPayment_orgId_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierPayment_orgId_paidAt_idx" ON public."SupplierPayment" USING btree ("orgId", "paidAt");


--
-- Name: SupplierPrice_orgId_supplierId_validFrom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierPrice_orgId_supplierId_validFrom_idx" ON public."SupplierPrice" USING btree ("orgId", "supplierId", "validFrom");


--
-- Name: SupplierPrice_partId_validFrom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SupplierPrice_partId_validFrom_idx" ON public."SupplierPrice" USING btree ("partId", "validFrom");


--
-- Name: Supplier_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Supplier_orgId_idx" ON public."Supplier" USING btree ("orgId");


--
-- Name: SystemAnnouncement_isActive_startsAt_endsAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemAnnouncement_isActive_startsAt_endsAt_idx" ON public."SystemAnnouncement" USING btree ("isActive", "startsAt", "endsAt");


--
-- Name: SystemAuditEvent_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemAuditEvent_actorUserId_createdAt_idx" ON public."SystemAuditEvent" USING btree ("actorUserId", "createdAt");


--
-- Name: SystemAuditEvent_entityType_entityId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemAuditEvent_entityType_entityId_createdAt_idx" ON public."SystemAuditEvent" USING btree ("entityType", "entityId", "createdAt");


--
-- Name: SystemAuditEvent_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SystemAuditEvent_orgId_createdAt_idx" ON public."SystemAuditEvent" USING btree ("orgId", "createdAt");


--
-- Name: TaxRate_orgId_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TaxRate_orgId_code_key" ON public."TaxRate" USING btree ("orgId", code);


--
-- Name: TaxRate_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TaxRate_orgId_idx" ON public."TaxRate" USING btree ("orgId");


--
-- Name: TechnicianPayout_jobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TechnicianPayout_jobId_idx" ON public."TechnicianPayout" USING btree ("jobId");


--
-- Name: TechnicianPayout_orgId_paidAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TechnicianPayout_orgId_paidAt_idx" ON public."TechnicianPayout" USING btree ("orgId", "paidAt");


--
-- Name: UserAccessAudit_actorUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAccessAudit_actorUserId_createdAt_idx" ON public."UserAccessAudit" USING btree ("actorUserId", "createdAt");


--
-- Name: UserAccessAudit_targetUserId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserAccessAudit_targetUserId_createdAt_idx" ON public."UserAccessAudit" USING btree ("targetUserId", "createdAt");


--
-- Name: UserGroupMember_groupId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserGroupMember_groupId_userId_key" ON public."UserGroupMember" USING btree ("groupId", "userId");


--
-- Name: UserGroupMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserGroupMember_userId_idx" ON public."UserGroupMember" USING btree ("userId");


--
-- Name: UserGroupPermission_groupId_permission_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserGroupPermission_groupId_permission_key" ON public."UserGroupPermission" USING btree ("groupId", permission);


--
-- Name: UserGroupPermission_permission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserGroupPermission_permission_idx" ON public."UserGroupPermission" USING btree (permission);


--
-- Name: UserGroup_orgId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserGroup_orgId_createdAt_idx" ON public."UserGroup" USING btree ("orgId", "createdAt");


--
-- Name: UserGroup_orgId_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserGroup_orgId_name_key" ON public."UserGroup" USING btree ("orgId", name);


--
-- Name: UserInvite_email_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserInvite_email_orgId_idx" ON public."UserInvite" USING btree (email, "orgId");


--
-- Name: UserInvite_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserInvite_orgId_idx" ON public."UserInvite" USING btree ("orgId");


--
-- Name: UserInvite_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserInvite_token_idx" ON public."UserInvite" USING btree (token);


--
-- Name: UserInvite_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserInvite_token_key" ON public."UserInvite" USING btree (token);


--
-- Name: UserPermission_permission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UserPermission_permission_idx" ON public."UserPermission" USING btree (permission);


--
-- Name: UserPermission_userId_permission_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON public."UserPermission" USING btree ("userId", permission);


--
-- Name: User_branchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_branchId_idx" ON public."User" USING btree ("branchId");


--
-- Name: User_departmentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_departmentId_idx" ON public."User" USING btree ("departmentId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_orgId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_orgId_idx" ON public."User" USING btree ("orgId");


--
-- Name: WarrantyClaim_orgId_status_openedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WarrantyClaim_orgId_status_openedAt_idx" ON public."WarrantyClaim" USING btree ("orgId", status, "openedAt");


--
-- Name: WarrantyClaim_originalJobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WarrantyClaim_originalJobId_idx" ON public."WarrantyClaim" USING btree ("originalJobId");


--
-- Name: WarrantyClaim_warrantyJobId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "WarrantyClaim_warrantyJobId_idx" ON public."WarrantyClaim" USING btree ("warrantyJobId");


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: BankAccount BankAccount_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BankAccount"
    ADD CONSTRAINT "BankAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BankTransaction BankTransaction_bankAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BankTransaction"
    ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES public."BankAccount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BankTransaction BankTransaction_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BankTransaction"
    ADD CONSTRAINT "BankTransaction_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Branch Branch_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CampaignContact CampaignContact_campaignId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignContact"
    ADD CONSTRAINT "CampaignContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES public."Campaign"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CampaignContact CampaignContact_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignContact"
    ADD CONSTRAINT "CampaignContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CampaignContact CampaignContact_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CampaignContact"
    ADD CONSTRAINT "CampaignContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Campaign Campaign_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Campaign Campaign_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Campaign"
    ADD CONSTRAINT "Campaign_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChartOfAccount ChartOfAccount_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChartOfAccount"
    ADD CONSTRAINT "ChartOfAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChartOfAccount ChartOfAccount_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ChartOfAccount"
    ADD CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."ChartOfAccount"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ClientNote ClientNote_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientNote"
    ADD CONSTRAINT "ClientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ClientNote ClientNote_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClientNote"
    ADD CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Client Client_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CommunicationPolicy CommunicationPolicy_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommunicationPolicy"
    ADD CONSTRAINT "CommunicationPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CommunicationTemplate CommunicationTemplate_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CommunicationTemplate"
    ADD CONSTRAINT "CommunicationTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Complaint Complaint_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Complaint"
    ADD CONSTRAINT "Complaint_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Complaint Complaint_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Complaint"
    ADD CONSTRAINT "Complaint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Complaint Complaint_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Complaint"
    ADD CONSTRAINT "Complaint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Complaint Complaint_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Complaint"
    ADD CONSTRAINT "Complaint_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditNoteItem CreditNoteItem_creditNoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNoteItem"
    ADD CONSTRAINT "CreditNoteItem_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES public."CreditNote"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditNoteItem CreditNoteItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNoteItem"
    ADD CONSTRAINT "CreditNoteItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CreditNote CreditNote_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNote"
    ADD CONSTRAINT "CreditNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CreditNote CreditNote_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNote"
    ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditNote CreditNote_itemsReceivedBackById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNote"
    ADD CONSTRAINT "CreditNote_itemsReceivedBackById_fkey" FOREIGN KEY ("itemsReceivedBackById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CreditNote CreditNote_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNote"
    ADD CONSTRAINT "CreditNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CreditNote CreditNote_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CreditNote"
    ADD CONSTRAINT "CreditNote_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeliveryNoteItem DeliveryNoteItem_deliveryNoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNoteItem"
    ADD CONSTRAINT "DeliveryNoteItem_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES public."DeliveryNote"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeliveryNoteItem DeliveryNoteItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNoteItem"
    ADD CONSTRAINT "DeliveryNoteItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DeliveryNoteItem DeliveryNoteItem_saleItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNoteItem"
    ADD CONSTRAINT "DeliveryNoteItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES public."SaleItem"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DeliveryNote DeliveryNote_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNote"
    ADD CONSTRAINT "DeliveryNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DeliveryNote DeliveryNote_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNote"
    ADD CONSTRAINT "DeliveryNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeliveryNote DeliveryNote_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNote"
    ADD CONSTRAINT "DeliveryNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeliveryNote DeliveryNote_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeliveryNote"
    ADD CONSTRAINT "DeliveryNote_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Department Department_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Device Device_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Device Device_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DocumentBrandingSettings DocumentBrandingSettings_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentBrandingSettings"
    ADD CONSTRAINT "DocumentBrandingSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ExpensePayment ExpensePayment_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ExpensePayment ExpensePayment_expenseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES public."Expense"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ExpensePayment ExpensePayment_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ExpensePayment"
    ADD CONSTRAINT "ExpensePayment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Expense Expense_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Expense Expense_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Expense Expense_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Expense"
    ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FieldVisit FieldVisit_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FieldVisit"
    ADD CONSTRAINT "FieldVisit_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FieldVisit FieldVisit_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FieldVisit"
    ADD CONSTRAINT "FieldVisit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FieldVisit FieldVisit_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FieldVisit"
    ADD CONSTRAINT "FieldVisit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FieldVisit FieldVisit_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FieldVisit"
    ADD CONSTRAINT "FieldVisit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: FieldVisit FieldVisit_scheduledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."FieldVisit"
    ADD CONSTRAINT "FieldVisit_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GoodsReceivedItem GoodsReceivedItem_grnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceivedItem"
    ADD CONSTRAINT "GoodsReceivedItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES public."GoodsReceived"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GoodsReceivedItem GoodsReceivedItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceivedItem"
    ADD CONSTRAINT "GoodsReceivedItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GoodsReceived GoodsReceived_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceived"
    ADD CONSTRAINT "GoodsReceived_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GoodsReceived GoodsReceived_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceived"
    ADD CONSTRAINT "GoodsReceived_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."StockLocation"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: GoodsReceived GoodsReceived_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceived"
    ADD CONSTRAINT "GoodsReceived_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GoodsReceived GoodsReceived_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceived"
    ADD CONSTRAINT "GoodsReceived_poId_fkey" FOREIGN KEY ("poId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GoodsReceived GoodsReceived_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GoodsReceived"
    ADD CONSTRAINT "GoodsReceived_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: InboundMessage InboundMessage_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InboundMessage"
    ADD CONSTRAINT "InboundMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InboundMessage InboundMessage_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InboundMessage"
    ADD CONSTRAINT "InboundMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InboundMessage InboundMessage_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InboundMessage"
    ADD CONSTRAINT "InboundMessage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InvoiceAttachment InvoiceAttachment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceAttachment"
    ADD CONSTRAINT "InvoiceAttachment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InvoiceAttachment InvoiceAttachment_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceAttachment"
    ADD CONSTRAINT "InvoiceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: InvoiceLine InvoiceLine_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."InvoiceLine"
    ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invoice Invoice_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invoice Invoice_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Job Job_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Job Job_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Job Job_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Job Job_clientPaidById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_clientPaidById_fkey" FOREIGN KEY ("clientPaidById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Job Job_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Job Job_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public."Device"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Job Job_externalPaidById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_externalPaidById_fkey" FOREIGN KEY ("externalPaidById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Job Job_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: JournalEntry JournalEntry_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JournalEntry"
    ADD CONSTRAINT "JournalEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: JournalEntry JournalEntry_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JournalEntry"
    ADD CONSTRAINT "JournalEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: JournalLine JournalLine_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JournalLine"
    ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."ChartOfAccount"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: JournalLine JournalLine_journalEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."JournalLine"
    ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES public."JournalEntry"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadActivity LeadActivity_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadActivity"
    ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LeadActivity LeadActivity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LeadActivity"
    ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Lead Lead_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Lead Lead_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Lead"
    ADD CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: NotificationPreferences NotificationPreferences_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationPreferences"
    ADD CONSTRAINT "NotificationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OneTimeExternalTechAssignment OneTimeExternalTechAssignment_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OneTimeExternalTechAssignment"
    ADD CONSTRAINT "OneTimeExternalTechAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrgModuleGrant OrgModuleGrant_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrgModuleGrant"
    ADD CONSTRAINT "OrgModuleGrant_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OutboundMessage OutboundMessage_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OutboundMessage OutboundMessage_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OutboundMessage OutboundMessage_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OutboundMessage OutboundMessage_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OutboundMessage OutboundMessage_repairRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OutboundMessage"
    ADD CONSTRAINT "OutboundMessage_repairRequestId_fkey" FOREIGN KEY ("repairRequestId") REFERENCES public."RepairRequest"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PartLocationStock PartLocationStock_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartLocationStock"
    ADD CONSTRAINT "PartLocationStock_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartReservation PartReservation_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartReservation"
    ADD CONSTRAINT "PartReservation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartReservation PartReservation_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartReservation"
    ADD CONSTRAINT "PartReservation_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PartReservation PartReservation_reservedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartReservation"
    ADD CONSTRAINT "PartReservation_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PartStockTransaction PartStockTransaction_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartStockTransaction"
    ADD CONSTRAINT "PartStockTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PartStockTransaction PartStockTransaction_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartStockTransaction"
    ADD CONSTRAINT "PartStockTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PartStockTransaction PartStockTransaction_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartStockTransaction"
    ADD CONSTRAINT "PartStockTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PartStockTransaction PartStockTransaction_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PartStockTransaction"
    ADD CONSTRAINT "PartStockTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Part Part_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Part"
    ADD CONSTRAINT "Part_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentAllocation PaymentAllocation_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentAllocation"
    ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PaymentReminderSettings PaymentReminderSettings_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PaymentReminderSettings"
    ADD CONSTRAINT "PaymentReminderSettings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Payment Payment_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Payment Payment_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Payment"
    ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Photo Photo_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Photo"
    ADD CONSTRAINT "Photo_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalSession PortalSession_portalUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalSession"
    ADD CONSTRAINT "PortalSession_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES public."PortalUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalUserClient PortalUserClient_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalUserClient"
    ADD CONSTRAINT "PortalUserClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalUserClient PortalUserClient_portalUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalUserClient"
    ADD CONSTRAINT "PortalUserClient_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES public."PortalUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalUser PortalUser_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalUser"
    ADD CONSTRAINT "PortalUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PortalUser PortalUser_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PortalUser"
    ADD CONSTRAINT "PortalUser_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PosSession PosSession_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PosSession"
    ADD CONSTRAINT "PosSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PosSession PosSession_operatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PosSession"
    ADD CONSTRAINT "PosSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PosSession PosSession_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PosSession"
    ADD CONSTRAINT "PosSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseOrderItem PurchaseOrderItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseOrderItem PurchaseOrderItem_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseOrder PurchaseOrder_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseOrder PurchaseOrder_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PurchaseRequestItem PurchaseRequestItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequestItem"
    ADD CONSTRAINT "PurchaseRequestItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseRequestItem PurchaseRequestItem_requestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequestItem"
    ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES public."PurchaseRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseRequest PurchaseRequest_convertedPoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_convertedPoId_fkey" FOREIGN KEY ("convertedPoId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseRequest PurchaseRequest_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PurchaseRequest PurchaseRequest_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: PurchaseRequest PurchaseRequest_reviewedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PurchaseRequest PurchaseRequest_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuotationItem QuotationItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuotationItem"
    ADD CONSTRAINT "QuotationItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: QuotationItem QuotationItem_quotationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."QuotationItem"
    ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES public."Quotation"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Quotation Quotation_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Quotation Quotation_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Quotation Quotation_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Quotation Quotation_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Quotation Quotation_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public."Lead"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Quotation Quotation_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Quotation"
    ADD CONSTRAINT "Quotation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Receipt Receipt_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Receipt Receipt_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Receipt Receipt_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Receipt Receipt_issuedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Receipt Receipt_paymentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES public."Payment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Receipt Receipt_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Receipt"
    ADD CONSTRAINT "Receipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecurringExpense RecurringExpense_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringExpense"
    ADD CONSTRAINT "RecurringExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RecurringExpense RecurringExpense_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringExpense"
    ADD CONSTRAINT "RecurringExpense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RecurringExpense RecurringExpense_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringExpense"
    ADD CONSTRAINT "RecurringExpense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RecurringInvoiceItem RecurringInvoiceItem_recurringInvoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringInvoiceItem"
    ADD CONSTRAINT "RecurringInvoiceItem_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES public."RecurringInvoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RecurringInvoice RecurringInvoice_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringInvoice"
    ADD CONSTRAINT "RecurringInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RecurringInvoice RecurringInvoice_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringInvoice"
    ADD CONSTRAINT "RecurringInvoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RecurringInvoice RecurringInvoice_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RecurringInvoice"
    ADD CONSTRAINT "RecurringInvoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Refund Refund_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Refund Refund_creditNoteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES public."CreditNote"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Refund Refund_invoiceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Refund Refund_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Refund Refund_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Refund"
    ADD CONSTRAINT "Refund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RepairRequestSequence RepairRequestSequence_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairRequestSequence"
    ADD CONSTRAINT "RepairRequestSequence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: RepairRequest RepairRequest_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RepairRequest"
    ADD CONSTRAINT "RepairRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SaleItem SaleItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SaleItem SaleItem_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Sale Sale_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Sale Sale_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Sale Sale_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Sale Sale_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Sale Sale_posSessionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES public."PosSession"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTarget SalesTarget_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesTarget"
    ADD CONSTRAINT "SalesTarget_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTarget SalesTarget_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesTarget"
    ADD CONSTRAINT "SalesTarget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTarget SalesTarget_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesTarget"
    ADD CONSTRAINT "SalesTarget_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SalesTarget SalesTarget_setById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesTarget"
    ADD CONSTRAINT "SalesTarget_setById_fkey" FOREIGN KEY ("setById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SalesTarget SalesTarget_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SalesTarget"
    ADD CONSTRAINT "SalesTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockCountItem StockCountItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCountItem"
    ADD CONSTRAINT "StockCountItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockCountItem StockCountItem_stockCountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCountItem"
    ADD CONSTRAINT "StockCountItem_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES public."StockCount"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockCount StockCount_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCount"
    ADD CONSTRAINT "StockCount_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StockCount StockCount_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCount"
    ADD CONSTRAINT "StockCount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockCount StockCount_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCount"
    ADD CONSTRAINT "StockCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public."StockLocation"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockCount StockCount_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockCount"
    ADD CONSTRAINT "StockCount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockTransferItem StockTransferItem_partId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransferItem"
    ADD CONSTRAINT "StockTransferItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES public."Part"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockTransferItem StockTransferItem_transferId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransferItem"
    ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES public."StockTransfer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockTransfer StockTransfer_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransfer"
    ADD CONSTRAINT "StockTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StockTransfer StockTransfer_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransfer"
    ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: StockTransfer StockTransfer_dispatchedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransfer"
    ADD CONSTRAINT "StockTransfer_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: StockTransfer StockTransfer_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransfer"
    ADD CONSTRAINT "StockTransfer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: StockTransfer StockTransfer_receivedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockTransfer"
    ADD CONSTRAINT "StockTransfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupplierBillItem SupplierBillItem_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBillItem"
    ADD CONSTRAINT "SupplierBillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES public."SupplierBill"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplierBill SupplierBill_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBill"
    ADD CONSTRAINT "SupplierBill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupplierBill SupplierBill_grnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBill"
    ADD CONSTRAINT "SupplierBill_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES public."GoodsReceived"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupplierBill SupplierBill_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBill"
    ADD CONSTRAINT "SupplierBill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplierBill SupplierBill_poId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBill"
    ADD CONSTRAINT "SupplierBill_poId_fkey" FOREIGN KEY ("poId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupplierBill SupplierBill_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierBill"
    ADD CONSTRAINT "SupplierBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupplierPayment SupplierPayment_billId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierPayment"
    ADD CONSTRAINT "SupplierPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES public."SupplierBill"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupplierPayment SupplierPayment_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierPayment"
    ADD CONSTRAINT "SupplierPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SupplierPayment SupplierPayment_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SupplierPayment"
    ADD CONSTRAINT "SupplierPayment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Supplier Supplier_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TaxRate TaxRate_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TaxRate"
    ADD CONSTRAINT "TaxRate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TechnicianPayout TechnicianPayout_jobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TechnicianPayout"
    ADD CONSTRAINT "TechnicianPayout_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TechnicianPayout TechnicianPayout_recordedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TechnicianPayout"
    ADD CONSTRAINT "TechnicianPayout_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: UserAccessAudit UserAccessAudit_actorUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAccessAudit"
    ADD CONSTRAINT "UserAccessAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserAccessAudit UserAccessAudit_targetUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserAccessAudit"
    ADD CONSTRAINT "UserAccessAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserGroupMember UserGroupMember_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroupMember"
    ADD CONSTRAINT "UserGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."UserGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserGroupMember UserGroupMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroupMember"
    ADD CONSTRAINT "UserGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserGroupPermission UserGroupPermission_groupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroupPermission"
    ADD CONSTRAINT "UserGroupPermission_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES public."UserGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserGroup UserGroup_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserGroup"
    ADD CONSTRAINT "UserGroup_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserInvite UserInvite_invitedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserInvite"
    ADD CONSTRAINT "UserInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserInvite UserInvite_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserInvite"
    ADD CONSTRAINT "UserInvite_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserPermission UserPermission_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UserPermission"
    ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: WarrantyClaim WarrantyClaim_orgId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WarrantyClaim"
    ADD CONSTRAINT "WarrantyClaim_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WarrantyClaim WarrantyClaim_originalJobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WarrantyClaim"
    ADD CONSTRAINT "WarrantyClaim_originalJobId_fkey" FOREIGN KEY ("originalJobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: WarrantyClaim WarrantyClaim_warrantyJobId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."WarrantyClaim"
    ADD CONSTRAINT "WarrantyClaim_warrantyJobId_fkey" FOREIGN KEY ("warrantyJobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict hATBZhmc20SfXWo8WgZHxBJQVcXHWOoMMe7ueOM2otFgwAdsG5BMBD2a46CAP44

