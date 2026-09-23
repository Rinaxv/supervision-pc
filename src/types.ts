export interface SystemMetrics {
  cpu_usage: number;
  ram_used: number;
  ram_total: number;
  disk_used: number;
  disk_total: number;
}

export interface NetworkMetrics {
  download_kbps: number;
  upload_kbps: number;
  is_peak: boolean;
}

export interface HistoryPoint {
  t: number;
  download: number;
  upload: number;
}

export interface ConnectionInfo {
  protocol: string;
  local_addr: string;
  local_port: number;
  remote_addr: string;
  remote_port: number;
  state: string;
  pid: number;
  process_name: string;
}

export interface SpeedTestEntry {
  date: string;
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
}

export interface ActionLogEntry {
  date: string;
  action: string;
  detail: string;
}

export interface AppData {
  data_limit_gb: number;
  monthly_usage: Record<string, number>;
  daily_usage: Record<string, number>;
  known_apps: string[];
  speed_test_history: SpeedTestEntry[];
  disabled_startup: Record<string, string>;
  actions_log: ActionLogEntry[];
}

export interface SpeedTestResult {
  download_mbps: number;
  upload_mbps: number;
  ping_ms: number;
}

export interface SpeedProgress {
  phase: "ping" | "download" | "upload";
  mbps: number;
}

export interface DataUsagePayload {
  monthly_bytes: number;
  limit_gb: number;
  percent: number;
  daily: [string, number][];
}

export interface WifiCredentials {
  ssid: string;
  password: string | null;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory_mb: number;
}

export interface TempCleanupResult {
  freed_mb: number;
  before_mb: number;
  after_mb: number;
}

export interface StartupApp {
  name: string;
  command: string;
  enabled: boolean;
}

export interface BatteryInfoPayload {
  percent: number;
  is_charging: boolean;
  health_percent: number;
  time_remaining_min: number | null;
}

export interface ClosedResult {
  closed: string[];
  freed_mb: number;
}

export interface TopWriter {
  pid: number;
  name: string;
  write_kbps: number;
}

export interface DiskIoMetrics {
  read_kbps: number;
  write_kbps: number;
  top_writer: TopWriter | null;
  is_heavy: boolean;
}

export interface DiskIoPoint {
  t: number;
  read: number;
  write: number;
}

export interface DiagnosticIssue {
  title: string;
  detail: string;
  severity: "ok" | "info" | "warning" | "critical";
}

export interface DiagnosticReport {
  cpu_usage: number;
  ram_percent: number;
  disk_percent: number;
  temp_mb: number;
  issues: DiagnosticIssue[];
}

export interface FullFixResult {
  closed_apps: string[];
  freed_ram_mb: number;
  freed_disk_mb: number;
}

export interface ScanTarget {
  label: string;
  path: string;
}

export interface DiskPartition {
  name: string;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
}

export interface FileEntry {
  path: string;
  name: string;
  size_mb: number;
  last_modified: string;
  file_type: "image" | "video" | "audio" | "other";
}

export interface DuplicateGroup {
  size_mb: number;
  file_type: string;
  files: FileEntry[];
}

export interface DeleteFilesResult {
  deleted: number;
  freed_mb: number;
  errors: number;
}

export interface ScanProgress {
  phase: string;
  current: number;
  total: number;
}

export type Theme = "dark" | "light" | "custom";
export type Page =
  | "dashboard"
  | "connections"
  | "network-apps"
  | "data-usage"
  | "speed-test"
  | "wifi-health"
  | "processes"
  | "maintenance"
  | "battery"
  | "quick-actions"
  | "historique"
  | "disk-io"
  | "diagnostic"
  | "disk-cleaner";
