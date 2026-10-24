export interface VoucherTx {
  id: string;
  providerReference: string;
  status: "CONFIRMED" | "REJECTED";
  settlementStatus: "AWAITING_SETTLEMENT" | "SETTLED" | "NOT_APPLICABLE";
  grossAmount: string;
  providerFee: string;
  netAmount: string;
  createdAt: string;
  settledAt: string | null;
  settlementBatch: string | null;
  note: string | null;
  event: string;
  household: string;
  receiptNumber: string | null;
}

export interface VoucherSummary {
  totals: { gross: string; fees: string; net: string; awaiting: string; settled: string };
  counts: {
    confirmed: number;
    rejected: number;
    awaitingOver24h: number;
    settledCount: number;
    settledWithin24h: number;
  };
  transactions: VoucherTx[];
}
