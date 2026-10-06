use sysinfo::{System, Disks, Networks, ProcessesToUpdate, ProcessRefreshKind, Pid, MINIMUM_CPU_UPDATE_INTERVAL};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_notification::NotificationExt;
use serde::{Serialize, Deserialize};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
    collections::{VecDeque, HashMap, HashSet},
};
use netstat2::{get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo};
use futures_util::StreamExt;
use winreg::enums::*;
use winreg::RegKey;
use wmi::WMIConnection;

#[derive(Clone, Serialize)]
struct SystemMetrics {
    cpu_usage: f32,
    ram_used: u64,
    ram_total: u64,
    disk_used: u64,
    disk_total: u64,
}

#[derive(Clone, Serialize)]
struct NetworkMetrics {
    download_kbps: f64,
    upload_kbps: f64,
    is_peak: bool,
}

#[derive(Clone, Serialize)]
struct TopWriter {
    pid: u32,
    name: String,
    write_kbps: f64,
}

#[derive(Clone, Serialize)]
struct DiskIoMetrics {
    read_kbps: f64,
    write_kbps: f64,
    top_writer: Option<TopWriter>,
    is_heavy: bool,
}

#[derive(Clone, Serialize)]
struct ConnectionInfo {
    protocol: String,
    local_addr: String,
    local_port: u16,
    remote_addr: String,
    remote_port: u16,
    state: String,
    pid: u32,
    process_name: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct SpeedTestEntry {
    date: String,
    download_mbps: f64,
    upload_mbps: f64,
    ping_ms: f64,
}

#[derive(Clone, Serialize, Deserialize)]
struct ActionLogEntry {
    date: String,
    action: String,
    detail: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct AppData {
    data_limit_gb: f64,
    monthly_usage: HashMap<String, u64>,
    daily_usage: HashMap<String, u64>,
    known_apps: Vec<String>,
    speed_test_history: Vec<SpeedTestEntry>,
    #[serde(default)]
    disabled_startup: HashMap<String, String>,
    #[serde(default)]
    actions_log: Vec<ActionLogEntry>,
}

#[derive(Clone, Serialize)]
struct DataUsagePayload {
    monthly_bytes: u64,
    limit_gb: f64,
    percent: f64,
    daily: Vec<(String, u64)>,
}

#[derive(Clone, Serialize)]
struct SpeedTestResult {
    download_mbps: f64,
    upload_mbps: f64,
    ping_ms: f64,
}

#[derive(Clone, Serialize)]
struct SpeedProgress {
    phase: String,
    mbps: f64,
}

#[derive(Clone, Serialize)]
struct WifiCredentials {
    ssid: String,
    password: Option<String>,
}

#[derive(Clone, Serialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_usage: f32,
    memory_mb: f64,
}

#[derive(Clone, Serialize)]
struct TempCleanupResult {
    freed_mb: f64,
    before_mb: f64,
    after_mb: f64,
}

#[derive(Clone, Serialize)]
struct StartupApp {
    name: String,
    command: String,
    enabled: bool,
}

#[derive(Clone, Serialize)]
struct BatteryInfoPayload {
    percent: f64,
    is_charging: bool,
    health_percent: f64,
    time_remaining_min: Option<f64>,
}

#[derive(Clone, Serialize)]
struct ClosedResult {
    closed: Vec<String>,
    freed_mb: f64,
}

#[derive(Clone, Serialize)]
struct DiagnosticIssue {
    title: String,
    detail: String,
    severity: String,
}

#[derive(Clone, Serialize)]
struct DiagnosticReport {
    cpu_usage: f32,
    ram_percent: f64,
    disk_percent: f64,
    temp_mb: f64,
    issues: Vec<DiagnosticIssue>,
}

#[derive(Clone, Serialize)]
struct FullFixResult {
    closed_apps: Vec<String>,
    freed_ram_mb: f64,
    freed_disk_mb: f64,
}

#[derive(Clone, Serialize)]
struct ScanTarget {
    label: String,
    path: String,
}

#[derive(Clone, Serialize)]
struct DiskPartition {
    name: String,
    mount_point: String,
    total_gb: f64,
    used_gb: f64,
    free_gb: f64,
}

#[derive(Clone, Serialize)]
struct FileEntry {
    path: String,
    name: String,
    size_mb: f64,
    last_modified: String,
    file_type: String,
}

#[derive(Clone, Serialize)]
struct DuplicateGroup {
    size_mb: f64,
    file_type: String,
    files: Vec<FileEntry>,
}

#[derive(Clone, Serialize)]
struct DeleteFilesResult {
    deleted: usize,
    freed_mb: f64,
    errors: usize,
}

#[derive(Clone, Serialize)]
struct ScanProgress {
    phase: String,
    current: usize,
    total: usize,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32PnPSignedDriverRaw {
    device_name: Option<String>,
    manufacturer: Option<String>,
    driver_version: Option<String>,
    driver_date: Option<String>,
}

#[derive(Clone, Serialize)]
struct DriverInfo {
    device_name: String,
    manufacturer: String,
    version: String,
    date: String,
    age_years: f64,
    is_old: bool,
}

#[derive(Clone, Serialize)]
struct PendingUpdate {
    title: String,
    size_mb: f64,
}

#[derive(Clone, Serialize)]
struct WindowsUpdateReport {
    pending: Vec<PendingUpdate>,
    total_size_gb: f64,
    estimated_download_minutes: f64,
    estimated_install_minutes: f64,
    last_install_date: String,
    days_since_last_update: i64,
}

#[derive(Deserialize, Debug)]
struct WuRawUpdate {
    #[serde(rename = "Title")]
    title: Option<String>,
    #[serde(rename = "SizeBytes")]
    size_bytes: Option<i64>,
}

#[derive(Deserialize, Debug, Default)]
struct WuRawOutput {
    #[serde(rename = "Updates")]
    updates: Option<serde_json::Value>,
    #[serde(rename = "LastInstallDate")]
    last_install_date: Option<String>,
}

#[derive(Deserialize, Debug, Default)]
struct InstallRawOutput {
    #[serde(rename = "Status")]
    status: Option<String>,
    #[serde(rename = "Installed")]
    installed: Option<i32>,
    #[serde(rename = "RebootRequired")]
    reboot_required: Option<bool>,
    #[serde(rename = "Message")]
    message: Option<String>,
}

#[derive(Clone, Serialize)]
struct InstallUpdatesResult {
    success: bool,
    installed_count: i32,
    reboot_required: bool,
    message: String,
}

const WU_SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $result = $searcher.Search('IsInstalled=0 and IsHidden=0')
    $updates = @()
    foreach ($u in $result.Updates) {
        $updates += [PSCustomObject]@{ Title = $u.Title; SizeBytes = [int64]$u.MaxDownloadSize }
    }
} catch {
    $updates = @()
}
$lastDate = $null
try {
    $lastDate = (Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 1 -ExpandProperty InstalledOn)
} catch {}
$lastDateStr = if ($lastDate) { $lastDate.ToString('yyyy-MM-dd') } else { '' }
$output = [PSCustomObject]@{ Updates = @($updates); LastInstallDate = $lastDateStr }
$output | ConvertTo-Json -Compress -Depth 4
"#;

const WU_INSTALL_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
try {
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $result = $searcher.Search('IsInstalled=0 and IsHidden=0')
    if ($result.Updates.Count -eq 0) {
        [PSCustomObject]@{ Status = 'NoUpdates' } | ConvertTo-Json -Compress
        exit
    }
    $toDownload = New-Object -ComObject Microsoft.Update.UpdateColl
    foreach ($u in $result.Updates) {
        if ($u.EulaAccepted -eq $false) { $u.AcceptEula() | Out-Null }
        $toDownload.Add($u) | Out-Null
    }
    $downloader = $session.CreateUpdateDownloader()
    $downloader.Updates = $toDownload
    $downloader.Download() | Out-Null

    $toInstall = New-Object -ComObject Microsoft.Update.UpdateColl
    foreach ($u in $toDownload) {
        if ($u.IsDownloaded) { $toInstall.Add($u) | Out-Null }
    }
    $installer = $session.CreateUpdateInstaller()
    $installer.Updates = $toInstall
    $installResult = $installer.Install()

    [PSCustomObject]@{
        Status = 'Done'
        Installed = $toInstall.Count
        RebootRequired = [bool]$installResult.RebootRequired
    } | ConvertTo-Json -Compress
} catch {
    [PSCustomObject]@{ Status = 'Error'; Message = $_.Exception.Message } | ConvertTo-Json -Compress
}
"#;

const WU_PROCESS_NAMES: [&str; 6] = [
    "wuauclt.exe", "usoclient.exe", "mousocoreworker.exe",
    "tiworker.exe", "wuaueng.exe", "trustedinstaller.exe",
];

fn normalize_updates(v: Option<serde_json::Value>) -> Vec<WuRawUpdate> {
    match v {
        None => vec![],
        Some(serde_json::Value::Array(arr)) => arr
            .into_iter()
            .filter_map(|x| serde_json::from_value(x).ok())
            .collect(),
        Some(obj @ serde_json::Value::Object(_)) => {
            serde_json::from_value::<WuRawUpdate>(obj).ok().into_iter().collect()
        }
        _ => vec![],
    }
}

fn data_file_path(app: &AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&dir);
    dir.join("data.json")
}

fn load_app_data(app: &AppHandle) -> AppData {
    let path = data_file_path(app);
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_app_data(app: &AppHandle, data: &AppData) {
    let path = data_file_path(app);
    if let Ok(json) = serde_json::to_string_pretty(data) {
        let _ = fs::write(path, json);
    }
}

fn log_action(app: &AppHandle, data: &mut AppData, action: &str, detail: &str) {
    data.actions_log.push(ActionLogEntry {
        date: chrono::Local::now().to_rfc3339(),
        action: action.to_string(),
        detail: detail.to_string(),
    });
    if data.actions_log.len() > 50 {
        let excess = data.actions_log.len() - 50;
        data.actions_log.drain(0..excess);
    }
    save_app_data(app, data);
}

fn is_protected(name: &str) -> bool {
    const SAFE: [&str; 32] = [
        "system", "registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe",
        "lsass.exe", "winlogon.exe", "explorer.exe", "dwm.exe", "svchost.exe",
        "runtimebroker.exe", "sihost.exe", "taskhostw.exe", "ctfmon.exe",
        "searchindexer.exe", "searchhost.exe", "shellexperiencehost.exe",
        "startmenuexperiencehost.exe", "fontdrvhost.exe", "spoolsv.exe",
        "audiodg.exe", "memcompression",
        "code.exe", "code - insiders.exe", "devenv.exe", "cursor.exe",
        "windowsterminal.exe", "openconsole.exe", "powershell.exe",
        "cmd.exe", "cargo.exe",
    ];
    let n = name.to_lowercase();
    SAFE.iter().any(|s| n == *s) || n.contains("supervision-pc") || n.contains("conhost")
}

fn get_ancestor_pids(sys: &System) -> HashSet<u32> {
    let mut ancestors = HashSet::new();
    let mut current = Some(Pid::from_u32(std::process::id()));
    while let Some(pid) = current {
        ancestors.insert(pid.as_u32());
        current = sys.process(pid).and_then(|p| p.parent());
    }
    ancestors
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    total += dir_size(&entry.path());
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}

fn classify_extension(ext: &str) -> &'static str {
    let e = ext.to_lowercase();
    const IMAGES: [&str; 9] = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "tiff", "svg"];
    const VIDEOS: [&str; 8] = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v"];
    const AUDIOS: [&str; 7] = ["mp3", "wav", "flac", "aac", "ogg", "wma", "m4a"];
    if IMAGES.contains(&e.as_str()) {
        "image"
    } else if VIDEOS.contains(&e.as_str()) {
        "video"
    } else if AUDIOS.contains(&e.as_str()) {
        "audio"
    } else {
        "other"
    }
}

fn is_excluded_dir(path: &Path) -> bool {
    const EXCLUDED: [&str; 6] = [
        "windows", "program files", "program files (x86)",
        "programdata", "$recycle.bin", "system volume information",
    ];
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| EXCLUDED.contains(&n.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn walk_files(root: &Path, out: &mut Vec<PathBuf>, limit: usize) {
    if out.len() >= limit {
        return;
    }
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if out.len() >= limit {
                return;
            }
            let path = entry.path();
            if path.is_dir() {
                if is_excluded_dir(&path) {
                    continue;
                }
                walk_files(&path, out, limit);
            } else {
                out.push(path);
            }
        }
    }
}

fn hash_file(path: &Path) -> Option<String> {
    use sha2::{Digest, Sha256};
    let mut file = fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).ok()?;
    Some(format!("{:x}", hasher.finalize()))
}

fn quick_hash(path: &Path) -> Option<String> {
    use sha2::{Digest, Sha256};
    let mut file = fs::File::open(path).ok()?;
    let mut buffer = vec![0u8; 65536];
    let read_bytes = file.read(&mut buffer).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&buffer[..read_bytes]);
    Some(format!("{:x}", hasher.finalize()))
}

fn fetch_connections() -> Vec<ConnectionInfo> {
    let af_flags = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto_flags = ProtocolFlags::TCP | ProtocolFlags::UDP;

    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let sockets_info = get_sockets_info(af_flags, proto_flags).unwrap_or_default();

    sockets_info
        .into_iter()
        .map(|si| {
            let pid = si.associated_pids.first().copied().unwrap_or(0);
            let process_name = sys
                .process(Pid::from_u32(pid))
                .map(|p| p.name().to_string_lossy().to_string())
                .unwrap_or_else(|| "Inconnu".to_string());

            match si.protocol_socket_info {
                ProtocolSocketInfo::Tcp(tcp) => ConnectionInfo {
                    protocol: "TCP".to_string(),
                    local_addr: tcp.local_addr.to_string(),
                    local_port: tcp.local_port,
                    remote_addr: tcp.remote_addr.to_string(),
                    remote_port: tcp.remote_port,
                    state: format!("{:?}", tcp.state),
                    pid,
                    process_name,
                },
                ProtocolSocketInfo::Udp(udp) => ConnectionInfo {
                    protocol: "UDP".to_string(),
                    local_addr: udp.local_addr.to_string(),
                    local_port: udp.local_port,
                    remote_addr: "-".to_string(),
                    remote_port: 0,
                    state: "-".to_string(),
                    pid,
                    process_name,
                },
            }
        })
        .collect()
}

#[tauri::command]
fn get_active_connections() -> Vec<ConnectionInfo> {
    fetch_connections()
}

#[tauri::command]
fn kill_process(pid: u32) -> bool {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    match sys.process(Pid::from_u32(pid)) {
        Some(process) => process.kill(),
        None => false,
    }
}

#[tauri::command]
fn get_app_data(state: tauri::State<'_, Mutex<AppData>>) -> AppData {
    state.lock().unwrap().clone()
}

#[tauri::command]
fn set_data_limit(gb: f64, app: AppHandle, state: tauri::State<'_, Mutex<AppData>>) {
    let mut data = state.lock().unwrap();
    data.data_limit_gb = gb;
    save_app_data(&app, &data);
}

#[tauri::command]
fn get_wifi_credentials() -> Result<WifiCredentials, String> {
    use std::process::Command;

    let interfaces_output = Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .output()
        .map_err(|e| e.to_string())?;
    let interfaces_text = String::from_utf8_lossy(&interfaces_output.stdout);

    let ssid = interfaces_text
        .lines()
        .find(|l| {
            let t = l.trim_start();
            (t.starts_with("SSID") || t.starts_with("Nom du SSID")) && !t.starts_with("BSSID")
        })
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Aucun réseau Wi-Fi connecté n'a été détecté.".to_string())?;

    let profile_output = Command::new("netsh")
        .args(["wlan", "show", "profile", &format!("name={}", ssid), "key=clear"])
        .output()
        .map_err(|e| e.to_string())?;
    let profile_text = String::from_utf8_lossy(&profile_output.stdout);

    let password = profile_text
        .lines()
        .find(|l| {
            let t = l.trim_start();
            t.starts_with("Key Content") || t.contains("Contenu de la cl")
        })
        .and_then(|l| l.split(':').nth(1))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    Ok(WifiCredentials { ssid, password })
}

#[tauri::command]
fn get_top_processes(sort_by: String) -> Vec<ProcessInfo> {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_processes(ProcessesToUpdate::All, true);
    sys.refresh_cpu_usage();

    let mut list: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_usage: p.cpu_usage(),
            memory_mb: p.memory() as f64 / 1024.0 / 1024.0,
        })
        .collect();

    if sort_by == "memory" {
        list.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap());
    } else {
        list.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap());
    }
    list.truncate(15);
    list
}

#[tauri::command]
fn get_top_ram_processes() -> Vec<ProcessInfo> {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let ancestors = get_ancestor_pids(&sys);

    let mut list: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .filter(|p| {
            let pid = p.pid().as_u32();
            !ancestors.contains(&pid) && !is_protected(&p.name().to_string_lossy())
        })
        .map(|p| ProcessInfo {
            pid: p.pid().as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_usage: p.cpu_usage(),
            memory_mb: p.memory() as f64 / 1024.0 / 1024.0,
        })
        .collect();

    list.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap());
    list.truncate(8);
    list
}

#[tauri::command]
fn close_processes(
    pids: Vec<u32>,
    app: AppHandle,
    state: tauri::State<'_, Mutex<AppData>>,
) -> ClosedResult {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let ancestors = get_ancestor_pids(&sys);

    let mut closed = Vec::new();
    let mut freed_mb = 0.0;

    for pid in pids {
        if ancestors.contains(&pid) {
            continue;
        }
        if let Some(p) = sys.process(Pid::from_u32(pid)) {
            let name = p.name().to_string_lossy().to_string();
            if is_protected(&name) {
                continue;
            }
            let mem = p.memory() as f64 / 1024.0 / 1024.0;
            if p.kill() {
                closed.push(name);
                freed_mb += mem;
            }
        }
    }

    if !closed.is_empty() {
        let mut data = state.lock().unwrap();
        log_action(
            &app,
            &mut data,
            "Libération de RAM",
            &format!("{} application(s) fermée(s), {:.0} Mo libérés : {}", closed.len(), freed_mb, closed.join(", ")),
        );
    }

    ClosedResult { closed, freed_mb }
}

#[tauri::command]
fn run_focus_mode(app: AppHandle, state: tauri::State<'_, Mutex<AppData>>) -> ClosedResult {
    let candidates = get_top_ram_processes();
    let pids: Vec<u32> = candidates.iter().filter(|p| p.memory_mb > 150.0).map(|p| p.pid).collect();
    let result = close_processes(pids, app.clone(), state.clone());

    if !result.closed.is_empty() {
        let mut data = state.lock().unwrap();
        log_action(
            &app,
            &mut data,
            "Mode Focus",
            &format!("{:.0} Mo libérés en fermant : {}", result.freed_mb, result.closed.join(", ")),
        );
    }

    result
}

#[tauri::command]
fn get_temp_size() -> f64 {
    dir_size(&std::env::temp_dir()) as f64 / 1024.0 / 1024.0
}

#[tauri::command]
fn clean_temp_files(app: AppHandle, state: tauri::State<'_, Mutex<AppData>>) -> TempCleanupResult {
    let temp = std::env::temp_dir();
    let before = dir_size(&temp) as f64 / 1024.0 / 1024.0;

    if let Ok(entries) = fs::read_dir(&temp) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let _ = fs::remove_dir_all(&path);
            } else {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let after = dir_size(&temp) as f64 / 1024.0 / 1024.0;
    let freed_mb = (before - after).max(0.0);

    let mut data = state.lock().unwrap();
    log_action(&app, &mut data, "Nettoyage disque", &format!("{:.0} Mo libérés (fichiers temporaires)", freed_mb));

    TempCleanupResult { freed_mb, before_mb: before, after_mb: after }
}

#[tauri::command]
fn get_startup_apps(state: tauri::State<'_, Mutex<AppData>>) -> Vec<StartupApp> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut apps = Vec::new();

    if let Ok(run_key) = hkcu.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run") {
        for name in run_key.enum_values().filter_map(|v| v.ok()).map(|(n, _)| n) {
            if let Ok(value) = run_key.get_value::<String, _>(&name) {
                apps.push(StartupApp { name, command: value, enabled: true });
            }
        }
    }

    let data = state.lock().unwrap();
    for (name, command) in data.disabled_startup.iter() {
        apps.push(StartupApp { name: name.clone(), command: command.clone(), enabled: false });
    }

    apps
}

#[tauri::command]
fn toggle_startup_app(
    name: String,
    enable: bool,
    app: AppHandle,
    state: tauri::State<'_, Mutex<AppData>>,
) -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = match hkcu.open_subkey_with_flags(
        "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
        KEY_ALL_ACCESS,
    ) {
        Ok(k) => k,
        Err(_) => return false,
    };

    let mut data = state.lock().unwrap();

    if enable {
        if let Some(command) = data.disabled_startup.remove(&name) {
            let _ = run_key.set_value(&name, &command);
            save_app_data(&app, &data);
            return true;
        }
        false
    } else if let Ok(value) = run_key.get_value::<String, _>(&name) {
        data.disabled_startup.insert(name.clone(), value);
        let _ = run_key.delete_value(&name);
        save_app_data(&app, &data);
        true
    } else {
        false
    }
}

#[tauri::command]
fn get_battery_info() -> Option<BatteryInfoPayload> {
    let manager = battery::Manager::new().ok()?;
    let mut batteries = manager.batteries().ok()?;
    let bat = batteries.next()?.ok()?;

    let percent = bat.state_of_charge().value as f64 * 100.0;
    let is_charging = bat.state() == battery::State::Charging;
    let design = bat.energy_full_design().value as f64;
    let health_percent = if design > 0.0 {
        ((bat.energy_full().value as f64 / design) * 100.0).min(100.0)
    } else {
        100.0
    };
    let time_remaining_min = bat.time_to_empty().map(|t| t.value as f64 / 60.0);

    Some(BatteryInfoPayload { percent, is_charging, health_percent, time_remaining_min })
}

#[tauri::command]
fn run_diagnostic() -> DiagnosticReport {
    let mut sys = System::new_all();
    sys.refresh_cpu_usage();
    thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let cpu_usage = sys.global_cpu_usage();
    let ram_percent = (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0;

    let disks = Disks::new_with_refreshed_list();
    let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |acc, d| {
        (acc.0 + (d.total_space() - d.available_space()), acc.1 + d.total_space())
    });
    let disk_percent = if disk_total > 0 {
        (disk_used as f64 / disk_total as f64) * 100.0
    } else {
        0.0
    };

    let temp_mb = dir_size(&std::env::temp_dir()) as f64 / 1024.0 / 1024.0;

    let ancestors = get_ancestor_pids(&sys);
    let heavy_apps: Vec<String> = sys
        .processes()
        .values()
        .filter(|p| !ancestors.contains(&p.pid().as_u32()) && !is_protected(&p.name().to_string_lossy()))
        .filter(|p| p.memory() as f64 / 1024.0 / 1024.0 > 150.0)
        .map(|p| p.name().to_string_lossy().to_string())
        .collect();

    let mut issues = Vec::new();

    if cpu_usage > 80.0 {
        issues.push(DiagnosticIssue {
            title: "Processeur très sollicité".into(),
            detail: format!("Utilisation CPU à {:.0}%.", cpu_usage),
            severity: "warning".into(),
        });
    }
    if ram_percent > 80.0 {
        issues.push(DiagnosticIssue {
            title: "Mémoire vive saturée".into(),
            detail: format!("RAM utilisée à {:.0}%.", ram_percent),
            severity: "warning".into(),
        });
    }
    if disk_percent > 85.0 {
        issues.push(DiagnosticIssue {
            title: "Disque presque plein".into(),
            detail: format!("Disque utilisé à {:.0}%.", disk_percent),
            severity: "critical".into(),
        });
    }
    if temp_mb > 500.0 {
        issues.push(DiagnosticIssue {
            title: "Beaucoup de fichiers temporaires".into(),
            detail: format!("{:.0} Mo de fichiers temporaires accumulés.", temp_mb),
            severity: "info".into(),
        });
    }
    if !heavy_apps.is_empty() {
        issues.push(DiagnosticIssue {
            title: "Applications gourmandes en mémoire".into(),
            detail: format!("{} application(s) utilisent plus de 150 Mo : {}", heavy_apps.len(), heavy_apps.join(", ")),
            severity: "info".into(),
        });
    }

    if issues.is_empty() {
        issues.push(DiagnosticIssue {
            title: "Tout va bien".into(),
            detail: "Aucun problème détecté sur votre PC pour le moment.".into(),
            severity: "ok".into(),
        });
    }

    DiagnosticReport { cpu_usage, ram_percent, disk_percent, temp_mb, issues }
}

#[tauri::command]
fn run_full_fix(app: AppHandle, state: tauri::State<'_, Mutex<AppData>>) -> FullFixResult {
    let ram_result = run_focus_mode(app.clone(), state.clone());
    let disk_result = clean_temp_files(app.clone(), state.clone());

    let mut data = state.lock().unwrap();
    log_action(
        &app,
        &mut data,
        "Réparation complète",
        &format!(
            "{} application(s) fermée(s) ({:.0} Mo de RAM), {:.0} Mo de disque libérés.",
            ram_result.closed.len(),
            ram_result.freed_mb,
            disk_result.freed_mb
        ),
    );

    FullFixResult {
        closed_apps: ram_result.closed,
        freed_ram_mb: ram_result.freed_mb,
        freed_disk_mb: disk_result.freed_mb,
    }
}

#[tauri::command]
fn get_scan_targets() -> Vec<ScanTarget> {
    let mut targets = Vec::new();
    if let Some(p) = dirs::download_dir() {
        targets.push(ScanTarget { label: "Téléchargements".into(), path: p.to_string_lossy().to_string() });
    }
    if let Some(p) = dirs::document_dir() {
        targets.push(ScanTarget { label: "Documents".into(), path: p.to_string_lossy().to_string() });
    }
    if let Some(p) = dirs::picture_dir() {
        targets.push(ScanTarget { label: "Images".into(), path: p.to_string_lossy().to_string() });
    }
    if let Some(p) = dirs::video_dir() {
        targets.push(ScanTarget { label: "Vidéos".into(), path: p.to_string_lossy().to_string() });
    }
    if let Some(p) = dirs::audio_dir() {
        targets.push(ScanTarget { label: "Musique".into(), path: p.to_string_lossy().to_string() });
    }
    if let Some(p) = dirs::desktop_dir() {
        targets.push(ScanTarget { label: "Bureau".into(), path: p.to_string_lossy().to_string() });
    }
    targets
}

#[tauri::command]
fn get_disk_partitions() -> Vec<DiskPartition> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .iter()
        .map(|d| {
            let total = d.total_space() as f64 / 1_073_741_824.0;
            let free = d.available_space() as f64 / 1_073_741_824.0;
            DiskPartition {
                name: d.name().to_string_lossy().to_string(),
                mount_point: d.mount_point().to_string_lossy().to_string(),
                total_gb: total,
                used_gb: (total - free).max(0.0),
                free_gb: free,
            }
        })
        .collect()
}

#[tauri::command]
async fn scan_old_large_files(
    app: AppHandle,
    paths: Vec<String>,
    min_size_mb: f64,
    min_days: u64,
) -> Vec<FileEntry> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut all_files = Vec::new();
        for p in &paths {
            walk_files(Path::new(p), &mut all_files, 30_000);
        }

        let total = all_files.len();
        let now = std::time::SystemTime::now();
        let min_bytes = (min_size_mb * 1024.0 * 1024.0) as u64;
        let min_secs = min_days * 24 * 3600;

        let mut results = Vec::new();

        for (i, path) in all_files.into_iter().enumerate() {
            if i % 300 == 0 {
                let _ = app.emit("old-scan-progress", ScanProgress {
                    phase: "Analyse en cours".into(),
                    current: i,
                    total,
                });
            }

            let meta = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.len() < min_bytes {
                continue;
            }
            let modified = match meta.modified() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let elapsed = match now.duration_since(modified) {
                Ok(e) => e,
                Err(_) => continue,
            };
            if elapsed.as_secs() < min_secs {
                continue;
            }

            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            let file_type = classify_extension(ext).to_string();
            let last_modified = chrono::DateTime::<chrono::Local>::from(modified).format("%d/%m/%Y").to_string();

            results.push(FileEntry {
                path: path.to_string_lossy().to_string(),
                name: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                size_mb: meta.len() as f64 / 1024.0 / 1024.0,
                last_modified,
                file_type,
            });
        }

        results.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap());
        results.truncate(200);

        let _ = app.emit("old-scan-progress", ScanProgress { phase: "Terminé".into(), current: total, total });
        results
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
async fn scan_duplicates(app: AppHandle, paths: Vec<String>) -> Vec<DuplicateGroup> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut all_files = Vec::new();
        for p in &paths {
            walk_files(Path::new(p), &mut all_files, 30_000);
        }

        let _ = app.emit("duplicate-scan-progress", ScanProgress {
            phase: "Regroupement par taille".into(),
            current: 0,
            total: all_files.len(),
        });

        let mut by_size: HashMap<u64, Vec<PathBuf>> = HashMap::new();
        for path in all_files {
            if let Ok(meta) = fs::metadata(&path) {
                if meta.len() > 0 {
                    by_size.entry(meta.len()).or_default().push(path);
                }
            }
        }

        let candidates: Vec<(u64, Vec<PathBuf>)> = by_size.into_iter().filter(|(_, v)| v.len() >= 2).collect();
        let total_candidates: usize = candidates.iter().map(|(_, v)| v.len()).sum();
        let mut processed = 0usize;

        let mut groups = Vec::new();

        for (size, files) in candidates {
            let mut by_quick: HashMap<String, Vec<PathBuf>> = HashMap::new();
            for f in files {
                processed += 1;
                if processed % 30 == 0 {
                    let _ = app.emit("duplicate-scan-progress", ScanProgress {
                        phase: "Vérification rapide".into(),
                        current: processed,
                        total: total_candidates,
                    });
                }
                if let Some(qh) = quick_hash(&f) {
                    by_quick.entry(qh).or_default().push(f);
                }
            }

            for (_, quick_group) in by_quick {
                if quick_group.len() < 2 {
                    continue;
                }
                let mut by_hash: HashMap<String, Vec<PathBuf>> = HashMap::new();
                for f in quick_group {
                    if let Some(hash) = hash_file(&f) {
                        by_hash.entry(hash).or_default().push(f);
                    }
                }
                for (_, group_files) in by_hash {
                    if group_files.len() < 2 {
                        continue;
                    }
                    let entries: Vec<FileEntry> = group_files
                        .iter()
                        .map(|p| {
                            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
                            FileEntry {
                                path: p.to_string_lossy().to_string(),
                                name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                                size_mb: size as f64 / 1024.0 / 1024.0,
                                last_modified: String::new(),
                                file_type: classify_extension(ext).to_string(),
                            }
                        })
                        .collect();
                    groups.push(DuplicateGroup {
                        size_mb: size as f64 / 1024.0 / 1024.0,
                        file_type: entries[0].file_type.clone(),
                        files: entries,
                    });
                }
            }
        }

        groups.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap());
        groups.truncate(100);

        let _ = app.emit("duplicate-scan-progress", ScanProgress {
            phase: "Terminé".into(),
            current: total_candidates,
            total: total_candidates,
        });

        groups
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
fn delete_files(paths: Vec<String>, app: AppHandle, state: tauri::State<'_, Mutex<AppData>>) -> DeleteFilesResult {
    let mut deleted = 0usize;
    let mut freed_bytes = 0u64;
    let mut errors = 0usize;

    for p in &paths {
        let path = Path::new(p);
        if let Ok(meta) = fs::metadata(path) {
            let size = meta.len();
            if fs::remove_file(path).is_ok() {
                deleted += 1;
                freed_bytes += size;
            } else {
                errors += 1;
            }
        } else {
            errors += 1;
        }
    }

    let freed_mb = freed_bytes as f64 / 1024.0 / 1024.0;
    if deleted > 0 {
        let mut data = state.lock().unwrap();
        log_action(&app, &mut data, "Suppression de fichiers", &format!("{} fichier(s) supprimé(s), {:.0} Mo libérés.", deleted, freed_mb));
    }

    DeleteFilesResult { deleted, freed_mb, errors }
}

#[tauri::command]
fn get_driver_report(threshold_years: f64) -> Result<Vec<DriverInfo>, String> {
    let wmi_con = WMIConnection::new().map_err(|e| e.to_string())?;

    let raw: Vec<Win32PnPSignedDriverRaw> = wmi_con
        .raw_query("SELECT DeviceName, Manufacturer, DriverVersion, DriverDate FROM Win32_PnPSignedDriver")
        .map_err(|e| e.to_string())?;

    let today = chrono::Local::now().naive_local().date();
    let mut results = Vec::new();

    for d in raw {
        let name = match d.device_name {
            Some(n) if !n.trim().is_empty() => n,
            _ => continue,
        };
        let date_str = match d.driver_date {
            Some(s) if s.len() >= 8 => s,
            _ => continue,
        };

        let year: i32 = date_str[0..4].parse().unwrap_or(0);
        let month: u32 = date_str[4..6].parse().unwrap_or(1);
        let day: u32 = date_str[6..8].parse().unwrap_or(1);

        let driver_date = match chrono::NaiveDate::from_ymd_opt(year, month, day) {
            Some(d) => d,
            None => continue,
        };

        let age_days = (today - driver_date).num_days();
        let age_years = age_days as f64 / 365.25;

        results.push(DriverInfo {
            device_name: name,
            manufacturer: d.manufacturer.unwrap_or_else(|| "Fabricant inconnu".to_string()),
            version: d.driver_version.unwrap_or_else(|| "—".to_string()),
            date: driver_date.format("%d/%m/%Y").to_string(),
            age_years,
            is_old: age_years >= threshold_years,
        });
    }

    results.sort_by(|a, b| b.age_years.partial_cmp(&a.age_years).unwrap());
    Ok(results)
}

#[tauri::command]
async fn get_windows_update_report(
    state: tauri::State<'_, Mutex<AppData>>,
) -> Result<WindowsUpdateReport, String> {
    let output = tauri::async_runtime::spawn_blocking(|| {
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", WU_SCRIPT])
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parsed: WuRawOutput = serde_json::from_str(&text).unwrap_or_default();
    let raw_updates = normalize_updates(parsed.updates);

    let pending: Vec<PendingUpdate> = raw_updates
        .into_iter()
        .filter_map(|u| {
            let title = u.title?;
            let size_bytes = u.size_bytes.unwrap_or(0).max(0) as f64;
            Some(PendingUpdate { title, size_mb: size_bytes / 1024.0 / 1024.0 })
        })
        .collect();

    let total_size_gb: f64 = pending.iter().map(|p| p.size_mb).sum::<f64>() / 1024.0;

    let download_mbps = {
        let data = state.lock().unwrap();
        data.speed_test_history
            .last()
            .map(|s| s.download_mbps)
            .unwrap_or(20.0)
            .max(1.0)
    };

    let total_mb = total_size_gb * 1024.0;
    let estimated_download_minutes = (total_mb * 8.0) / download_mbps / 60.0;
    let estimated_install_minutes = pending.len() as f64 * 4.0;

    let last_install_date = parsed.last_install_date.unwrap_or_default();
    let days_since_last_update = if !last_install_date.is_empty() {
        chrono::NaiveDate::parse_from_str(&last_install_date, "%Y-%m-%d")
            .map(|d| (chrono::Local::now().naive_local().date() - d).num_days())
            .unwrap_or(-1)
    } else {
        -1
    };

    Ok(WindowsUpdateReport {
        pending,
        total_size_gb,
        estimated_download_minutes,
        estimated_install_minutes,
        last_install_date,
        days_since_last_update,
    })
}

#[tauri::command]
fn get_active_wu_processes() -> Vec<String> {
    let mut sys = System::new_all();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    sys.processes()
        .values()
        .filter(|p| {
            let n = p.name().to_string_lossy().to_lowercase();
            WU_PROCESS_NAMES.contains(&n.as_str())
        })
        .map(|p| p.name().to_string_lossy().to_string())
        .collect::<HashSet<String>>()
        .into_iter()
        .collect()
}

#[tauri::command]
async fn install_windows_updates(
    app: AppHandle,
    state: tauri::State<'_, Mutex<AppData>>,
) -> Result<InstallUpdatesResult, String> {
    let output = tauri::async_runtime::spawn_blocking(|| {
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", WU_INSTALL_SCRIPT])
            .output()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let parsed: InstallRawOutput = serde_json::from_str(&text)
        .map_err(|_| "Réponse de Windows Update illisible.".to_string())?;

    let status = parsed.status.unwrap_or_default();

    let result = match status.as_str() {
        "NoUpdates" => InstallUpdatesResult {
            success: true,
            installed_count: 0,
            reboot_required: false,
            message: "Aucune mise à jour en attente — le système est déjà à jour.".into(),
        },
        "Done" => InstallUpdatesResult {
            success: true,
            installed_count: parsed.installed.unwrap_or(0),
            reboot_required: parsed.reboot_required.unwrap_or(false),
            message: "Installation terminée.".into(),
        },
        _ => InstallUpdatesResult {
            success: false,
            installed_count: 0,
            reboot_required: false,
            message: parsed
                .message
                .unwrap_or_else(|| "Échec de l'installation — droits administrateur requis.".into()),
        },
    };

    if result.success && result.installed_count > 0 {
        let mut data = state.lock().unwrap();
        log_action(
            &app,
            &mut data,
            "Mise à jour Windows",
            &format!(
                "{} mise(s) à jour installée(s){}.",
                result.installed_count,
                if result.reboot_required { " (redémarrage requis)" } else { "" }
            ),
        );
    }

    Ok(result)
}

#[tauri::command]
fn pause_windows_updates(hours: u32) -> Result<String, String> {
    use std::process::Command;

    let disable = Command::new("sc")
        .args(["config", "wuauserv", "start=disabled"])
        .output()
        .map_err(|e| e.to_string())?;
    if !disable.status.success() {
        return Err("Action refusée — relance l'application en tant qu'administrateur.".to_string());
    }
    let _ = Command::new("sc").args(["stop", "wuauserv"]).output();

    let script = format!(
        r#"
$resumeTime = (Get-Date).AddHours({hours})
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -Command "sc.exe config wuauserv start=demand; sc.exe start wuauserv"'
$trigger = New-ScheduledTaskTrigger -Once -At $resumeTime
Unregister-ScheduledTask -TaskName 'SupervisionPC_ResumeWU' -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName 'SupervisionPC_ResumeWU' -Action $action -Trigger $trigger -Force | Out-Null
"#,
        hours = hours
    );
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output();

    Ok(format!(
        "Mises à jour Windows mises en pause pour {} h — réactivation automatique programmée.",
        hours
    ))
}

#[tauri::command]
fn resume_windows_updates() -> Result<String, String> {
    use std::process::Command;

    let enable = Command::new("sc")
        .args(["config", "wuauserv", "start=demand"])
        .output()
        .map_err(|e| e.to_string())?;
    if !enable.status.success() {
        return Err("Action refusée — relance l'application en tant qu'administrateur.".to_string());
    }
    let _ = Command::new("sc").args(["start", "wuauserv"]).output();
    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Unregister-ScheduledTask -TaskName 'SupervisionPC_ResumeWU' -Confirm:$false -ErrorAction SilentlyContinue",
        ])
        .output();

    Ok("Mises à jour Windows réactivées.".to_string())
}

#[tauri::command]
fn get_wu_service_status() -> String {
    use std::process::Command;
    if let Ok(o) = Command::new("sc").args(["qc", "wuauserv"]).output() {
        let text = String::from_utf8_lossy(&o.stdout).to_uppercase();
        if text.contains("DISABLED") {
            return "paused".to_string();
        }
    }
    "active".to_string()
}

#[tauri::command]
async fn run_speed_test(
    app: AppHandle,
    state: tauri::State<'_, Mutex<AppData>>,
) -> Result<SpeedTestResult, String> {
    let client = reqwest::Client::builder().build().map_err(|e| e.to_string())?;

    let ping_start = Instant::now();
    let _ = client.head("https://speed.cloudflare.com/__down?bytes=0").send().await;
    let ping_ms = ping_start.elapsed().as_secs_f64() * 1000.0;
    let _ = app.emit("speed-test-progress", SpeedProgress { phase: "ping".into(), mbps: 0.0 });

    let url = "https://speed.cloudflare.com/__down?bytes=25000000";
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    let mut stream = resp.bytes_stream();
    let mut total: u64 = 0;
    let start = Instant::now();
    let mut last_emit = Instant::now();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        total += chunk.len() as u64;
        if last_emit.elapsed().as_millis() > 200 {
            let secs = start.elapsed().as_secs_f64().max(0.01);
            let mbps = (total as f64 * 8.0) / secs / 1_000_000.0;
            let _ = app.emit("speed-test-progress", SpeedProgress { phase: "download".into(), mbps });
            last_emit = Instant::now();
        }
    }

    let dl_secs = start.elapsed().as_secs_f64().max(0.01);
    let download_mbps = (total as f64 * 8.0) / dl_secs / 1_000_000.0;
    let _ = app.emit("speed-test-progress", SpeedProgress { phase: "download".into(), mbps: download_mbps });

    let ul_size: usize = 10_000_000;
    let payload = vec![0u8; ul_size];
    let ul_start = Instant::now();
    let _ = app.emit("speed-test-progress", SpeedProgress { phase: "upload".into(), mbps: 0.0 });

    client
        .post("https://speed.cloudflare.com/__up")
        .body(payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let ul_secs = ul_start.elapsed().as_secs_f64().max(0.01);
    let upload_mbps = (ul_size as f64 * 8.0) / ul_secs / 1_000_000.0;
    let _ = app.emit("speed-test-progress", SpeedProgress { phase: "upload".into(), mbps: upload_mbps });

    let result = SpeedTestResult { download_mbps, upload_mbps, ping_ms };

    {
        let mut data = state.lock().unwrap();
        data.speed_test_history.push(SpeedTestEntry {
            date: chrono::Local::now().to_rfc3339(),
            download_mbps,
            upload_mbps,
            ping_ms,
        });
        if data.speed_test_history.len() > 20 {
            let excess = data.speed_test_history.len() - 20;
            data.speed_test_history.drain(0..excess);
        }
        save_app_data(&app, &data);
    }

    Ok(result)
}

const NOTIF_COOLDOWN: Duration = Duration::from_secs(120);

fn should_notify(last_sent: &mut HashMap<String, Instant>, key: &str) -> bool {
    let now = Instant::now();
    match last_sent.get(key) {
        Some(last) if now.duration_since(*last) < NOTIF_COOLDOWN => false,
        _ => {
            last_sent.insert(key.to_string(), now);
            true
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_active_connections,
            kill_process,
            get_app_data,
            set_data_limit,
            get_wifi_credentials,
            run_speed_test,
            get_top_processes,
            get_top_ram_processes,
            close_processes,
            run_focus_mode,
            get_temp_size,
            clean_temp_files,
            get_startup_apps,
            toggle_startup_app,
            get_battery_info,
            run_diagnostic,
            run_full_fix,
            get_scan_targets,
            get_disk_partitions,
            scan_old_large_files,
            scan_duplicates,
            delete_files,
            get_driver_report,
            get_windows_update_report,
            get_active_wu_processes,
            install_windows_updates,
            pause_windows_updates,
            resume_windows_updates,
            get_wu_service_status
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let initial_data = load_app_data(&handle);
            app.manage(Mutex::new(initial_data));

            let show_item = MenuItem::with_id(app, "show", "Ouvrir l'application", true, None::<&str>)?;
            let focus_item = MenuItem::with_id(app, "focus", "Libérer la RAM (Mode Focus)", true, None::<&str>)?;
            let clean_item = MenuItem::with_id(app, "clean", "Nettoyer le disque", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &sep, &focus_item, &clean_item, &sep, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Supervision PC")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "focus" => {
                        let state = app.state::<Mutex<AppData>>();
                        let result = run_focus_mode(app.clone(), state);
                        let _ = app.notification().builder()
                            .title("Mode Focus")
                            .body(if result.closed.is_empty() {
                                "Aucune application gourmande à fermer.".to_string()
                            } else {
                                format!("{:.0} Mo libérés en fermant {} application(s).", result.freed_mb, result.closed.len())
                            })
                            .show();
                    }
                    "clean" => {
                        let state = app.state::<Mutex<AppData>>();
                        let result = clean_temp_files(app.clone(), state);
                        let _ = app.notification().builder()
                            .title("Nettoyage disque")
                            .body(format!("{:.0} Mo libérés.", result.freed_mb))
                            .show();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            let bg_handle = handle.clone();
            thread::spawn(move || {
                let mut sys = System::new_all();
                let mut networks = Networks::new_with_refreshed_list();
                let mut download_history: VecDeque<f64> = VecDeque::with_capacity(10);
                let mut last_notif: HashMap<String, Instant> = HashMap::new();
                let mut tick: u64 = 0;

                sys.refresh_cpu_usage();
                thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);

                loop {
                    sys.refresh_cpu_usage();
                    sys.refresh_memory();
                    sys.refresh_processes_specifics(
                        ProcessesToUpdate::All,
                        true,
                        ProcessRefreshKind::everything(),
                    );

                    let ancestors = get_ancestor_pids(&sys);

                    let (mut total_read, mut total_write) = (0u64, 0u64);
                    let mut top: Option<TopWriter> = None;

                    for p in sys.processes().values() {
                        let usage = p.disk_usage();
                        total_read += usage.read_bytes;
                        total_write += usage.written_bytes;

                        let pid = p.pid().as_u32();
                        let name = p.name().to_string_lossy().to_string();
                        if ancestors.contains(&pid) || is_protected(&name) {
                            continue;
                        }
                        let write_kbps = usage.written_bytes as f64 / 1000.0;
                        if top.as_ref().map(|t| write_kbps > t.write_kbps).unwrap_or(write_kbps > 200.0) {
                            top = Some(TopWriter { pid, name, write_kbps });
                        }
                    }

                    let read_kbps = total_read as f64 / 1000.0;
                    let write_kbps = total_write as f64 / 1000.0;
                    let is_heavy = write_kbps > 20_000.0 || read_kbps > 20_000.0;

                    let disk_io = DiskIoMetrics { read_kbps, write_kbps, top_writer: top, is_heavy };
                    let _ = bg_handle.emit("disk-io", disk_io);

                    let disks = Disks::new_with_refreshed_list();
                    let (disk_used, disk_total) = disks.iter().fold((0u64, 0u64), |acc, d| {
                        (acc.0 + (d.total_space() - d.available_space()), acc.1 + d.total_space())
                    });

                    let cpu_usage = sys.global_cpu_usage();
                    let ram_percent = (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0;
                    let disk_percent = (disk_used as f64 / disk_total as f64) * 100.0;

                    let metrics = SystemMetrics {
                        cpu_usage,
                        ram_used: sys.used_memory(),
                        ram_total: sys.total_memory(),
                        disk_used,
                        disk_total,
                    };
                    let _ = bg_handle.emit("system-metrics", metrics);

                    if cpu_usage > 90.0 && should_notify(&mut last_notif, "cpu") {
                        let _ = bg_handle.notification().builder()
                            .title("Processeur surchargé")
                            .body(format!("Utilisation CPU à {:.0}%.", cpu_usage))
                            .show();
                    }
                    if ram_percent > 90.0 && should_notify(&mut last_notif, "ram") {
                        let _ = bg_handle.notification().builder()
                            .title("Mémoire presque saturée")
                            .body(format!("RAM utilisée à {:.0}%.", ram_percent))
                            .show();
                    }
                    if disk_percent > 90.0 && should_notify(&mut last_notif, "disk") {
                        let _ = bg_handle.notification().builder()
                            .title("Disque presque plein")
                            .body(format!("Espace disque utilisé à {:.0}%.", disk_percent))
                            .show();
                    }

                    networks.refresh(true);
                    let (received, transmitted) = networks.iter().fold((0u64, 0u64), |acc, (_, data)| {
                        (acc.0 + data.received(), acc.1 + data.transmitted())
                    });

                    let download_kbps = (received as f64 * 8.0) / 1000.0;
                    let upload_kbps = (transmitted as f64 * 8.0) / 1000.0;

                    let avg: f64 = if download_history.is_empty() {
                        download_kbps
                    } else {
                        download_history.iter().sum::<f64>() / download_history.len() as f64
                    };
                    let is_peak = download_kbps > (avg * 2.5) && download_kbps > 500.0;

                    if is_peak && should_notify(&mut last_notif, "network") {
                        let wu_processes = get_active_wu_processes();
                        if !wu_processes.is_empty() {
                            let _ = bg_handle.notification().builder()
                                .title("Mise à jour Windows en arrière-plan")
                                .body("Windows Update télécharge actuellement des mises à jour, ce qui explique le pic de trafic réseau.")
                                .show();
                            let _ = bg_handle.emit("wu-background-activity", wu_processes);
                        } else {
                            let _ = bg_handle.notification().builder()
                                .title("Pic de trafic réseau détecté")
                                .body("Une activité réseau inhabituelle a été observée.")
                                .show();
                        }
                    }

                    if download_history.len() == 10 {
                        download_history.pop_front();
                    }
                    download_history.push_back(download_kbps);

                    let net_metrics = NetworkMetrics { download_kbps, upload_kbps, is_peak };
                    let _ = bg_handle.emit("network-metrics", net_metrics);

                    {
                        let state = bg_handle.state::<Mutex<AppData>>();
                        let mut data = state.lock().unwrap();
                        let month_key = chrono::Local::now().format("%Y-%m").to_string();
                        let day_key = chrono::Local::now().format("%Y-%m-%d").to_string();
                        *data.monthly_usage.entry(month_key).or_insert(0) += received;
                        *data.daily_usage.entry(day_key).or_insert(0) += received;
                    }

                    if tick % 5 == 0 {
                        let conns = fetch_connections();
                        let names: HashSet<String> = conns.iter()
                            .map(|c| c.process_name.clone())
                            .filter(|n| n != "Inconnu")
                            .collect();

                        let state = bg_handle.state::<Mutex<AppData>>();
                        let mut data = state.lock().unwrap();

                        if data.known_apps.is_empty() {
                            data.known_apps = names.into_iter().collect();
                            save_app_data(&bg_handle, &data);
                        } else {
                            let known: HashSet<String> = data.known_apps.iter().cloned().collect();
                            let new_ones: Vec<String> = names.iter().filter(|n| !known.contains(*n)).cloned().collect();
                            if !new_ones.is_empty() {
                                for name in &new_ones {
                                    data.known_apps.push(name.clone());
                                    let _ = bg_handle.emit("suspicious-app", name.clone());
                                    let _ = bg_handle.notification().builder()
                                        .title("Nouvelle application détectée")
                                        .body(format!("{} utilise le réseau pour la première fois.", name))
                                        .show();
                                }
                                save_app_data(&bg_handle, &data);
                            }
                        }
                    }

                    if tick % 15 == 0 {
                        let state = bg_handle.state::<Mutex<AppData>>();
                        let data = state.lock().unwrap();
                        let month_key = chrono::Local::now().format("%Y-%m").to_string();
                        let monthly_bytes = *data.monthly_usage.get(&month_key).unwrap_or(&0);
                        let limit_gb = data.data_limit_gb;
                        let percent = if limit_gb > 0.0 {
                            (monthly_bytes as f64 / (limit_gb * 1_073_741_824.0)) * 100.0
                        } else {
                            0.0
                        };

                        let mut daily: Vec<(String, u64)> = data.daily_usage.iter()
                            .filter(|(k, _)| k.starts_with(&month_key))
                            .map(|(k, v)| (k.clone(), *v))
                            .collect();
                        daily.sort_by(|a, b| a.0.cmp(&b.0));

                        let payload = DataUsagePayload { monthly_bytes, limit_gb, percent, daily };
                        let _ = bg_handle.emit("data-usage", payload);

                        if limit_gb > 0.0 {
                            if percent >= 100.0 && should_notify(&mut last_notif, "data_limit_exceeded") {
                                let _ = bg_handle.notification().builder()
                                    .title("Limite de données dépassée")
                                    .body(format!(
                                        "Vous avez dépassé votre forfait mensuel de {:.1} Go (utilisé : {:.1} Go).",
                                        limit_gb,
                                        monthly_bytes as f64 / 1_073_741_824.0
                                    ))
                                    .show();
                            } else if percent >= 90.0 && should_notify(&mut last_notif, "data_limit_warning") {
                                let _ = bg_handle.notification().builder()
                                    .title("Limite de données presque atteinte")
                                    .body(format!("{:.0}% du forfait mensuel utilisé.", percent))
                                    .show();
                            }
                        }

                        save_app_data(&bg_handle, &data);
                    }

                    if tick % 60 == 0 {
                        if let Some(bat) = get_battery_info() {
                            if bat.percent <= 15.0 && !bat.is_charging && should_notify(&mut last_notif, "battery_low") {
                                let _ = bg_handle.notification().builder()
                                    .title("Batterie faible")
                                    .body(format!("Il reste {:.0}% de batterie. Pensez à brancher votre PC.", bat.percent))
                                    .show();
                            }
                        }
                    }

                    tick += 1;
                    thread::sleep(Duration::from_secs(1));
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application");
}