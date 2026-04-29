export type MyOrderRow = {
  id: number;
  /** Тенант (магазин) */
  businessId?: number;
  userId?: number;
  total: number;
  status: string;
  paymentMethod?: string;
  paymentId?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  tracking?: string | null;
  phone?: string | null;
  customerPhone?: string | null;
  receiptUrl?: string | null;
  receiptType?: string | null;
  /** Present only if backend adds the field */
  createdAt?: string;
  items?: {
    id: number;
    name: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }[];
};
