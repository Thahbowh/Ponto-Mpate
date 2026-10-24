const money = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "12.00" -> "R12,00". Display only: never do money arithmetic in the browser. */
export function formatRand(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "R0,00";
  return `R${money.format(Number(value))}`;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function methodLabel(method: string): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "EFT":
      return "Electronic transfer";
    case "VOUCHER":
      return "Shop voucher";
    case "ONLINE":
      return "Online payment";
    default:
      return "Other approved method";
  }
}

/** One key per form submission. Reuse it if the user retries the same payment. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

