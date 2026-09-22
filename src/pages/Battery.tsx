import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BatteryFull,
  BatteryWarning,
  Zap,
  HeartPulse,
  Clock,
} from "lucide-react";
import type { BatteryInfoPayload } from "../types";

export default function Battery() {
  const [battery, setBattery] = useState<BatteryInfoPayload | null | undefined>(
    undefined,
  );

  const load = () => {
    invoke<BatteryInfoPayload | null>("get_battery_info").then(setBattery);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (battery === undefined) {
    return <p className="text-(--text-muted)">Chargement...</p>;
  }

  if (battery === null) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Batterie</h1>
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-6 shadow-lg text-(--text-muted)">
          Aucune batterie détectée sur cet appareil (PC de bureau).
        </div>
      </div>
    );
  }

  const isLow = battery.percent <= 20 && !battery.is_charging;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Batterie</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            {isLow ? (
              <BatteryWarning size={18} className="text-(--danger)" />
            ) : (
              <BatteryFull size={18} />
            )}
            <span className="text-sm font-medium">Charge</span>
          </div>
          <div
            className={`text-3xl font-bold ${isLow ? "text-(--danger)" : ""}`}
          >
            {battery.percent.toFixed(0)}%
          </div>
          <div className="w-full h-2 bg-(--border) rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 ${isLow ? "bg-(--danger)" : "bg-(--ok)"}`}
              style={{ width: `${battery.percent}%` }}
            />
          </div>
          {battery.is_charging && (
            <div className="flex items-center gap-1 text-(--accent) text-xs font-medium mt-2">
              <Zap size={13} /> En charge
            </div>
          )}
        </div>

        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            <HeartPulse size={18} />
            <span className="text-sm font-medium">Santé de la batterie</span>
          </div>
          <div className="text-3xl font-bold">
            {battery.health_percent.toFixed(0)}%
          </div>
          <div className="text-xs text-(--text-muted) mt-2">
            Capacité actuelle vs capacité d'origine
          </div>
        </div>

        <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 text-(--text-muted) mb-3">
            <Clock size={18} />
            <span className="text-sm font-medium">Autonomie estimée</span>
          </div>
          <div className="text-3xl font-bold">
            {battery.time_remaining_min !== null
              ? `${Math.round(battery.time_remaining_min)} min`
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
