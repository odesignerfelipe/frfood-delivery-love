import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function checkStoreStatus(store: any): boolean {
  if (!store) return false;

  const mode = store.status_mode || "auto";
  if (mode === "manual_open") return true;
  if (mode === "manual_closed") return false;

  if (!store.opening_hours || !Array.isArray(store.opening_hours)) return store.is_open;

  const now = new Date();
  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const today = dayNames[now.getDay()];
  const todayConfig = store.opening_hours.find((d: any) => d.day === today);

  if (!todayConfig?.enabled) return false;

  const currentTime = now.getHours() * 60 + now.getMinutes();

  return todayConfig.periods.some((p: any) => {
    if (!p.open || !p.close) return false;
    const [hO, mO] = p.open.split(":").map(Number);
    const [hC, mC] = p.close.split(":").map(Number);
    const openTime = hO * 60 + mO;
    let closeTime = hC * 60 + mC;

    if (closeTime < openTime) closeTime += 24 * 60; // Crosses midnight

    let checkTime = currentTime;
    if (checkTime < openTime && closeTime > 24 * 60) checkTime += 24 * 60;

    return checkTime >= openTime && checkTime <= closeTime;
  });
}
