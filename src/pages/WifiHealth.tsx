import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeSVG } from "qrcode.react";
import {
  Wifi,
  TrendingDown,
  CheckCircle,
  Share2,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  NetworkMetrics,
  AppData,
  ConnectionInfo,
  WifiCredentials,
} from "../types";

export default function WifiHealth({
  network,
}: {
  network: NetworkMetrics | null;
}) {
  const [baseline, setBaseline] = useState<number | null>(null);
  const [topApps, setTopApps] = useState<{ name: string; count: number }[]>([]);
  const [wifi, setWifi] = useState<WifiCredentials | null>(null);
  const [wifiError, setWifiError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loadingWifi, setLoadingWifi] = useState(false);

  useEffect(() => {
    invoke<AppData>("get_app_data").then((data) => {
      if (data.speed_test_history.length > 0) {
        setBaseline(
          Math.max(...data.speed_test_history.map((h) => h.download_mbps)),
        );
      }
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const conns = await invoke<ConnectionInfo[]>("get_active_connections");
      const map = new Map<string, number>();
      conns.forEach((c) => {
        if (c.process_name === "Inconnu") return;
        map.set(c.process_name, (map.get(c.process_name) ?? 0) + 1);
      });
      const sorted = Array.from(map.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopApps(sorted);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentMbps = network ? network.download_kbps / 1000 : 0;
  const ratio = baseline && baseline > 0 ? currentMbps / baseline : null;
  const isSlow = ratio !== null && ratio < 0.3 && currentMbps < 5;

  const generateQr = async () => {
    setLoadingWifi(true);
    setWifiError(null);
    setWifi(null);
    try {
      const result = await invoke<WifiCredentials>("get_wifi_credentials");
      setWifi(result);
    } catch (e) {
      setWifiError(String(e));
    } finally {
      setLoadingWifi(false);
    }
  };

  const qrValue = wifi
    ? wifi.password
      ? `WIFI:T:WPA;S:${wifi.ssid};P:${wifi.password};;`
      : `WIFI:T:nopass;S:${wifi.ssid};;`
    : "";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Santé du Wi-Fi</h1>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-6 shadow-lg mb-6 flex items-center gap-4">
        {isSlow ? (
          <>
            <div className="bg-(--alert-bg) p-3 rounded-xl">
              <TrendingDown className="text-(--danger)" size={24} />
            </div>
            <div>
              <div className="font-semibold text-(--danger)">
                Ralentissement détecté
              </div>
              <div className="text-sm text-(--text-muted)">
                Débit actuel ({currentMbps.toFixed(1)} Mb/s) bien en dessous de
                votre meilleur test ({baseline?.toFixed(1)} Mb/s)
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[rgba(34,197,94,0.12)] p-3 rounded-xl">
              <CheckCircle className="text-(--ok)" size={24} />
            </div>
            <div>
              <div className="font-semibold text-(--ok)">Connexion normale</div>
              <div className="text-sm text-(--text-muted)">
                {baseline
                  ? `Débit actuel : ${currentMbps.toFixed(1)} Mb/s (référence : ${baseline.toFixed(1)} Mb/s)`
                  : "Lancez un test de vitesse pour établir une référence."}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-(--text-muted)">
            <Share2 size={16} />
            <span className="text-sm font-medium">
              Partager ma connexion Wi-Fi
            </span>
          </div>
          <button
            onClick={generateQr}
            disabled={loadingWifi}
            className="bg-(--accent) text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loadingWifi ? "Génération..." : "Générer le QR code"}
          </button>
        </div>

        {wifiError && (
          <p className="text-sm text-(--danger)">
            Impossible de récupérer les informations Wi-Fi : {wifiError}.
            Essayez de lancer l'application en tant qu'administrateur.
          </p>
        )}

        {wifi && (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={qrValue} size={160} />
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <div className="text-xs text-(--text-muted)">Réseau</div>
                <div className="font-semibold text-(--text-main)">
                  {wifi.ssid}
                </div>
              </div>
              {wifi.password && (
                <div>
                  <div className="text-xs text-(--text-muted)">
                    Mot de passe
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-(--text-main)">
                      {showPassword
                        ? wifi.password
                        : "•".repeat(wifi.password.length)}
                    </span>
                    <button
                      onClick={() => setShowPassword((s) => !s)}
                      className="text-(--text-muted)"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-(--text-muted) max-w-xs">
                Scannez ce QR code avec un smartphone pour rejoindre ce réseau
                Wi-Fi automatiquement.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-(--bg-card) border border-(--border) rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4 text-(--text-muted)">
          <Wifi size={16} />
          <span className="text-sm font-medium">
            Applications les plus actives sur le réseau
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {topApps.length === 0 && (
            <p className="text-sm text-(--text-muted)">
              Aucune activité détectée.
            </p>
          )}
          {topApps.map((app) => (
            <div
              key={app.name}
              className="flex items-center justify-between text-sm border-b border-(--border) py-2 last:border-0"
            >
              <span className="text-(--text-main) font-medium">{app.name}</span>
              <span className="text-(--text-muted)">
                {app.count} connexion(s)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
