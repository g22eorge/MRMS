/** Stable React keys for editable line-item rows. */
let lineItemKeyCounter = 0;

export function createLineItemKey(): number {
  lineItemKeyCounter += 1;
  return lineItemKeyCounter;
}

export function parseFormNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function appendJsonLineItems<T>(
  formData: FormData,
  fieldName: string,
  items: T[],
  mapper: (item: T) => unknown,
): void {
  formData.set(fieldName, JSON.stringify(items.map(mapper)));
}

export type CommercialLineItemData = {
  partId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

export function emptyCommercialLineItem(): CommercialLineItemData {
  return { partId: "", description: "", quantity: 1, unitPrice: 0, discount: 0 };
}

export function commercialLineTotal(item: CommercialLineItemData, allowDiscount = true): number {
  const discount = allowDiscount ? Math.max(0, item.discount) : 0;
  return item.quantity * item.unitPrice * (1 - discount / 100);
}

export type ClientPickerOption = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  address: string | null;
};

export type NewClientFields = {
  fullName: string;
  phone: string;
  email: string;
  organization: string;
  address: string;
};

export const emptyNewClientFields = (): NewClientFields => ({
  fullName: "",
  phone: "",
  email: "",
  organization: "",
  address: "",
});
