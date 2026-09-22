import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Gauge as GaugeIcon,
  Play,
  Clock,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import Gauge from "../components/Gauge";
import type {
  SpeedTestResult,
  SpeedProgress,
  AppData,
  SpeedTestEntry,
} from "../types";

export default function SpeedTest() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "ping" | "download" | "upload" | "done"
  >("idle");
  const [liveValue, setLiveValue] = useState(0);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [history, setHistory] = useState<SpeedTestEntry[]>([]);

  const loadHistory = async () => {
    const data = await invoke<AppData>("get_app_data");
    setHistory([...data.speed_test_history].reverse());
  };

  useEffect(() => {
    loadHistory();
    const unlisten = listen<SpeedProgress>("speed-test-progress", (event) => {
      setPhase(event.payload.phase as "ping" | "download" | "upload");
      setLiveValue(event.payload.mbps);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const startTest = async () => {
    setRunning(true);
    setResult(null);
    setLiveValue(0);
    setPhase("ping");
    try {
      const res = await invoke<SpeedTestResult>("run_speed_test");
      setResult(res);
      setLiveValue(res.download_mbps);
      setPhase("done");
      loadHistory();
    } catch {
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  };

  const phaseLabel: Record<string, string> = {
    idle: "Prêt à tester",
    ping: "Mesure du ping...",
    download: "Test de téléchargement...",
    upload: "Test d'envoi...",
    done: "Test terminé",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Test de vitesse Internet</h1>
          <p className="text-sm text-(--text-muted)">{phaseLabel[phase]}</p>
        </div>
        <button
          onClick={startTest}
          disabled={running}
          className="flex items-center gap-2 bg-(--accent) text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Play size={16} />
          {running ? "Test en cours..." : "Lancer le test"}
        </button>
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-8 shadow-lg flex flex-col items-center mb-6">
        <Gauge
          value={liveValue}
          label={phase === "upload" ? "Envoi" : "Téléchargement"}
        />

        {result && (
          <div className="grid grid-cols-3 gap-6 mt-4 w-full max-w-md text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-(--text-muted) text-xs mb-1">
                <Clock size={13} /> Ping
              </div>
              <div className="text-lg font-bold">
                {result.ping_ms.toFixed(0)} ms
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-(--text-muted) text-xs mb-1">
                <ArrowDown size={13} /> Téléchargement
              </div>
              <div className="text-lg font-bold">
                {result.download_mbps.toFixed(1)} Mb/s
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-(--text-muted) text-xs mb-1">
                <ArrowUp size={13} /> Envoi
              </div>
              <div className="text-lg font-bold">
                {result.upload_mbps.toFixed(1)} Mb/s
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4 text-(--text-muted)">
          <GaugeIcon size={16} />
          <span className="text-sm font-medium">Historique des tests</span>
        </div>
        <div className="flex flex-col gap-2">
          {history.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              Aucun test effectué pour l'instant.
            </p>
          )}
          {history.map((h, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm border-b border-(--border) py-2 last:border-0"
            >
              <span className="text-(--text-muted)">
                {new Date(h.date).toLocaleString()}
              </span>
              <span className="text-(--accent) font-medium">
                {h.download_mbps.toFixed(1)} Mb/s ↓
              </span>
              <span className="text-(--upload) font-medium">
                {h.upload_mbps.toFixed(1)} Mb/s ↑
              </span>
              <span className="text-(--text-muted)">
                {h.ping_ms.toFixed(0)} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
