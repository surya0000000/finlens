import dayjs from "dayjs";

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

export const formatDate = (value: string | Date): string => dayjs(value).format("MMM D, YYYY");

export const percentLabel = (value: number | null): string =>
  value === null ? "N/A" : `${value.toFixed(2)}%`;

