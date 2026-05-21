/**
 * In-memory inventory state machine for smoke tests (mirrors ProductStock buckets).
 */
export type StockRow = {
  available: number;
  reserved: number;
  paid: number;
  shipped: number;
  returned: number;
};

export function emptyStock(total = 0): StockRow {
  return { available: total, reserved: 0, paid: 0, shipped: 0, returned: 0 };
}

export function reserve(row: StockRow, qty: number): StockRow | null {
  if (row.available < qty) return null;
  return {
    ...row,
    available: row.available - qty,
    reserved: row.reserved + qty,
  };
}

export function release(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.reserved, qty);
  return {
    ...row,
    reserved: row.reserved - n,
    available: row.available + n,
  };
}

export function commitPaid(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.reserved, qty);
  return {
    ...row,
    reserved: row.reserved - n,
    paid: row.paid + n,
  };
}

export function restorePaid(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.paid, qty);
  return {
    ...row,
    paid: row.paid - n,
    available: row.available + n,
  };
}

export function ship(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.paid, qty);
  return {
    ...row,
    paid: row.paid - n,
    shipped: row.shipped + n,
  };
}

export function restoreShipped(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.shipped, qty);
  return {
    ...row,
    shipped: row.shipped - n,
    available: row.available + n,
  };
}

export function receiveReturn(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.shipped, qty);
  return {
    ...row,
    shipped: row.shipped - n,
    returned: row.returned + n,
  };
}

export function restock(row: StockRow, qty: number): StockRow {
  const n = Math.min(row.returned, qty);
  return {
    ...row,
    returned: row.returned - n,
    available: row.available + n,
  };
}

export function totalUnits(row: StockRow): number {
  return row.available + row.reserved + row.paid + row.shipped + row.returned;
}
