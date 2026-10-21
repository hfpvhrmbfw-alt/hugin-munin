import AppKit
import Foundation

/// Antwort von GET /api/hm/server-status (nur über 127.0.0.1).
struct ServerStatus: Decodable {
  struct Tailscale: Decodable {
    var hostname: String
    var state: String  // Off, Starting, NeedsLogin, NeedsMachineAuth, Running, Stopped
    var url: String?
    var problem: String?
    var authURL: String?
    var tailnet: String?
  }
  var version: String
  var tailscale: Tailscale
}

/// Startet hm-server aus dem App-Paket, startet ihn nach einem Absturz neu
/// und fragt alle paar Sekunden seinen Zustand ab.
@MainActor
final class Server: ObservableObject {
  static let port = 8090
  static let local = URL(string: "http://127.0.0.1:\(port)")!

  @Published private(set) var running = false
  @Published private(set) var status: ServerStatus?
  @Published private(set) var lastExit: String?

  @Published var hostname: String {
    didSet { UserDefaults.standard.set(hostname, forKey: "tsHostname") }
  }
  @Published var tailscaleOn: Bool {
    didSet { UserDefaults.standard.set(tailscaleOn, forKey: "tailscaleOn") }
  }

  private var process: Process?
  private var wantRunning = false
  private var poller: Timer?
  private var awake: NSObjectProtocol?

  init() {
    let d = UserDefaults.standard
    hostname = d.string(forKey: "tsHostname") ?? "hugin-munin"
    tailscaleOn = d.object(forKey: "tailscaleOn") as? Bool ?? true
  }

  // MARK: Ordner

  static let support: URL = {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    return base.appendingPathComponent("Hugin & Munin", isDirectory: true)
  }()

  /// Bestehende Daten aus der Terminal-Einrichtung (docs/MAC-MINI.md) weiterverwenden.
  static let dataDir: URL = {
    let old = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("hugin-munin-server/pb_data", isDirectory: true)
    if FileManager.default.fileExists(atPath: old.path) { return old }
    return support.appendingPathComponent("pb_data", isDirectory: true)
  }()

  static var backupsDir: URL { dataDir.appendingPathComponent("backups", isDirectory: true) }

  static let logFile: URL = {
    let logs = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Logs/Hugin & Munin", isDirectory: true)
    try? FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
    return logs.appendingPathComponent("server.log")
  }()

  private static var resources: URL {
    Bundle.main.resourceURL!.appendingPathComponent("server", isDirectory: true)
  }

  // MARK: Start und Stopp

  func start() {
    wantRunning = true
    launch()
    poller?.invalidate()
    poller = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
      Task { @MainActor in await self?.poll() }
    }
    // Der Mac soll nicht schlafen, solange der Server läuft; der Bildschirm darf aus.
    if awake == nil {
      awake = ProcessInfo.processInfo.beginActivity(
        options: [.idleSystemSleepDisabled], reason: "Hugin & Munin Server")
    }
  }

  func stop() {
    wantRunning = false
    process?.terminate()
    poller?.invalidate()
    poller = nil
    if let a = awake { ProcessInfo.processInfo.endActivity(a) }
    awake = nil
    status = nil
  }

  /// Neu starten, z. B. nach geändertem Gerätenamen.
  func restart() {
    wantRunning = false
    process?.terminate()
    process?.waitUntilExit()
    process = nil
    running = false
    start()
  }

  func latestBackup() -> Date? {
    let files = (try? FileManager.default.contentsOfDirectory(
      at: Self.backupsDir, includingPropertiesForKeys: [.contentModificationDateKey])) ?? []
    return files
      .compactMap { try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate }
      .max()
  }

  private func launch() {
    guard process == nil else { return }
    let r = Self.resources
    var args = [
      "serve",
      "--http=127.0.0.1:\(Self.port)",
      "--dir=\(Self.dataDir.path)",
      "--hooksDir=\(r.appendingPathComponent("pb_hooks").path)",
      "--migrationsDir=\(r.appendingPathComponent("pb_migrations").path)",
      "--publicDir=\(r.appendingPathComponent("pb_public").path)",
    ]
    if tailscaleOn && !hostname.isEmpty {
      args += ["--tsHostname=\(hostname)", "--tsDir=\(Self.support.appendingPathComponent("tailscale").path)"]
    }

    try? FileManager.default.createDirectory(at: Self.dataDir, withIntermediateDirectories: true)
    if !FileManager.default.fileExists(atPath: Self.logFile.path) {
      FileManager.default.createFile(atPath: Self.logFile.path, contents: nil)
    }
    let log = try? FileHandle(forWritingTo: Self.logFile)
    log?.seekToEndOfFile()

    let p = Process()
    p.executableURL = r.appendingPathComponent("hm-server")
    p.arguments = args
    p.standardOutput = log
    p.standardError = log
    let id = ObjectIdentifier(p)
    p.terminationHandler = { [weak self] proc in
      let code = proc.terminationStatus
      Task { @MainActor in self?.exited(id, code) }
    }
    do {
      try p.run()
      process = p
      running = true
      lastExit = nil
    } catch {
      lastExit = error.localizedDescription
    }
  }

  private func exited(_ id: ObjectIdentifier, _ code: Int32) {
    guard let p = process, ObjectIdentifier(p) == id else { return }  // schon ersetzt
    process = nil
    running = false
    status = nil
    if wantRunning {
      lastExit = "Server beendet (Code \(code)), starte neu …"
      DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
        guard let self, self.wantRunning else { return }
        self.launch()
      }
    }
  }

  private func poll() async {
    guard running else { return }
    let url = Self.local.appendingPathComponent("api/hm/server-status")
    var req = URLRequest(url: url)
    req.timeoutInterval = 4
    if let (data, _) = try? await URLSession.shared.data(for: req),
      let s = try? JSONDecoder().decode(ServerStatus.self, from: data)
    {
      status = s
    }
  }
}
