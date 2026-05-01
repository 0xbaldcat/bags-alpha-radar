import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function compactAddress(address: string, chars = 4) {
  if (address.length <= chars * 2 + 3) {
    return address;
  }

  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatTokenSymbol(symbol: string) {
  const cleanSymbol = symbol.trim();
  return cleanSymbol.startsWith("$") ? cleanSymbol : `$${cleanSymbol}`;
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-US", options).format(value);
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
