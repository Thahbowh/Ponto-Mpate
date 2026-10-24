export type Role = "ADMIN" | "VIEWER" | "MEMBER";
export type EventStatus = "ACTIVE" | "CLOSED" | "CANCELLED";
export type ObligationStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "UNDER_REVIEW";
export type PaymentMethod = "CASH" | "EFT" | "OTHER" | "ONLINE" | "VOUCHER";
export type ReconStatus = "MATCHED" | "NEEDS_REVIEW" | "AWAITING_HANDOVER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Ward {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Household {
  id: string;
  reference: string;
  householdName: string;
  wardId: string;
  isActive: boolean;
  ward: { id: string; name: string };
}

export interface EventListItem {
  id: string;
  reference: string;
  title: string;
  eventDate: string;
  status: EventStatus;
  contributionAmount: string;
  homeWardId: string;
  homeWard: { id: string; name: string };
  _count: { obligations: number };
}

export interface ObligationRow {
  id: string;
  household: {
    id: string;
    reference: string;
    householdName: string;
    ward: { id: string; name: string };
  };
  amountDue: string;
  amountPaid: string;
  status: ObligationStatus;
}

export interface EventObligations {
  event: {
    id: string;
    reference: string;
    title: string;
    eventDate: string;
    status: EventStatus;
    contributionAmount: string;
    homeWard: { id: string; name: string };
    eligibleWards: { id: string; name: string }[];
  };
  summary: {
    households: number;
    householdsPaid: number;
    householdsUnpaid: number;
    expected: string;
    recorded: string;
    outstanding: string;
  };
  obligations: ObligationRow[];
}

export interface PaymentResult {
  paymentId: string;
  householdId: string;
  amount: string;
  method: PaymentMethod;
  receiptNumber: string | null;
  obligationStatus: ObligationStatus;
  outstanding?: string;
}

export interface Receipt {
  receiptNumber: string;
  issuedAt: string;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  recordedBy: string;
  household: { reference: string; householdName: string; ward: { name: string } };
  event: { reference: string; title: string; eventDate: string };
}

export interface Totals {
  households: number;
  householdsPaid: number;
  householdsPartiallyPaid: number;
  householdsUnpaid: number;
  householdsUnderReview: number;
  expected: string;
  recorded: string;
  outstanding: string;
  collectionRate: string;
}

export interface DashboardEvent extends Totals {
  id: string;
  reference: string;
  title: string;
  eventDate: string;
  status: EventStatus;
  homeWard: string;
}

export interface DashboardWard extends Totals {
  id: string;
  name: string;
}

export interface RecentPayment {
  receiptNumber: string | null;
  amount: string;
  method: PaymentMethod;
  paidAt: string;
  household: { reference: string; householdName: string };
  event: string;
}

export interface Dashboard {
  scope: "all" | "event";
  totals: Totals;
  allEventsTotals: Totals;
  events: DashboardEvent[];
  wards: DashboardWard[];
  recentPayments: RecentPayment[];
}

export interface Reconciliation {
  status: ReconStatus;
  message: string;
  cashRecorded: string;
  nonCashRecorded: string;
  handedOver: string;
  difference: string;
  handoverCount: number;
}

export interface Handover {
  id: string;
  amount: string;
  handedOverAt: string;
  note: string | null;
  recordedBy: string;
}

export interface Insight {
  type: string;
  severity: "info" | "attention";
  title: string;
  detail: string;
  basis: string;
}

export interface Insights {
  generatedAt: string;
  summary: { attention: number; info: number };
  insights: Insight[];
  trend: { reference: string; eventDate: string; status: EventStatus; collectionRate: number }[];
  forecast:
    | { available: false; reason: string }
    | { available: true; method: string; expectedCollectionRate: number; caveat: string };
}



