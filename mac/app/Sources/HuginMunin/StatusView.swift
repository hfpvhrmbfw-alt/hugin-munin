import AppKit
import CoreImage.CIFilterBuiltins
import SwiftUI

/// Fenster unter dem Raben in der Menüleiste. Stil Blei: ruhig, Kleinschreibung,
/// Petrol nur für das, was gerade zu tun ist.
struct StatusView: View {
  @ObservedObject var server: Server
  @State private var loginItem = LoginItem.enabled
  @State private var editingName = false

  private let petrol = Color(nsColor: NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
      ? NSColor(srgbRed: 0x3E / 255, green: 0xC2 / 255, blue: 0xB8 / 255, alpha: 1)
      : NSColor(srgbRed: 0x0B / 255, green: 0x7A / 255, blue: 0x74 / 255, alpha: 1)
  })

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("hugin & munin").font(.system(size: 17, weight: .semibold))

      row("server", server.running ? "läuft" : "gestoppt", ok: server.running)
      if let e = server.lastExit {
        Text(e).font(.caption).foregroundStyle(.secondary)
      }

      Divider()
      tailscaleSection

      Divider()
      backupSection

      Divider()
      VStack(alignment: .leading, spacing: 6) {
        Toggle("beim anmelden starten", isOn: $loginItem)
          .onChange(of: loginItem) { LoginItem.set($0) }
        Toggle("über tailscale erreichbar", isOn: $server.tailscaleOn)
          .onChange(of: server.tailscaleOn) { _ in server.restart() }
        if server.tailscaleOn {
          HStack {
            Text("gerätename").foregroundStyle(.secondary)
            TextField("hugin-munin", text: $server.hostname)
              .textFieldStyle(.roundedBorder)
              .onSubmit { server.restart() }
          }
        }
      }

      Divider()
      HStack {
        Button("verwaltung") { NSWorkspace.shared.open(Server.local.appendingPathComponent("_/")) }
        Button("protokoll") { NSWorkspace.shared.open(Server.logFile) }
        Spacer()
        Button("beenden") { NSApp.terminate(nil) }
      }
    }
    .padding(16)
    .frame(width: 320)
    .tint(petrol)
  }

  // MARK: Tailscale

  @ViewBuilder private var tailscaleSection: some View {
    let ts = server.status?.tailscale
    switch ts?.state {
    case nil, "Off":
      row("tailscale", server.tailscaleOn ? "startet …" : "aus", ok: false)
      if !server.tailscaleOn {
        Text("nur auf diesem mac unter 127.0.0.1:\(Server.port) erreichbar.")
          .font(.caption).foregroundStyle(.secondary)
      }
    case "NeedsLogin":
      row("tailscale", "anmeldung nötig", ok: false)
      if let link = ts?.authURL, let url = URL(string: link), !link.isEmpty {
        Button("bei tailscale anmelden") { NSWorkspace.shared.open(url) }
          .buttonStyle(.borderedProminent)
      } else {
        Text("verbinde mit tailscale …").font(.caption).foregroundStyle(.secondary)
      }
    case "NeedsMachineAuth":
      row("tailscale", "gerät freigeben", ok: false)
      Text("in der tailscale-verwaltung unter machines freigeben.")
        .font(.caption).foregroundStyle(.secondary)
    case "Running":
      if let link = ts?.url, !link.isEmpty, let url = URL(string: link) {
        row("tailscale", "verbunden", ok: true)
        Text("adresse für die handys").font(.caption).foregroundStyle(.secondary)
        HStack {
          Text(link).font(.system(.body, design: .monospaced)).textSelection(.enabled).lineLimit(1)
          Spacer()
          Button {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(link, forType: .string)
          } label: { Image(systemName: "doc.on.doc") }
            .buttonStyle(.borderless).help("kopieren")
        }
        if let qr = qrImage(link) {
          Image(nsImage: qr).interpolation(.none).resizable().frame(width: 140, height: 140)
            .frame(maxWidth: .infinity)
        }
        Text("mit der kamera scannen, in safari öffnen, dann „zum home-bildschirm“. die handys brauchen die tailscale-app.")
          .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        Button("im browser öffnen") { NSWorkspace.shared.open(url) }
      } else {
        row("tailscale", "verbunden, https fehlt", ok: false)
        Text("in der tailscale-verwaltung unter dns „magicdns“ und „https certificates“ einschalten.")
          .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        Button("dns-einstellungen öffnen") {
          NSWorkspace.shared.open(URL(string: "https://login.tailscale.com/admin/dns")!)
        }
      }
    default:
      row("tailscale", (ts?.state ?? "").lowercased(), ok: false)
    }
    if let p = ts?.problem, !p.isEmpty, ts?.state != "Running" {
      Text(p).font(.caption2).foregroundStyle(.secondary).lineLimit(3)
    }
  }

  // MARK: Sicherung

  @ViewBuilder private var backupSection: some View {
    if let date = server.latestBackup() {
      row("letzte sicherung", date.formatted(date: .abbreviated, time: .shortened), ok: true)
    } else {
      row("letzte sicherung", "keine", ok: false)
      Text("in der verwaltung unter settings → backups die tägliche sicherung einschalten.")
        .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
    }
    Button("sicherungen im finder") {
      try? FileManager.default.createDirectory(at: Server.backupsDir, withIntermediateDirectories: true)
      NSWorkspace.shared.open(Server.backupsDir)
    }
  }

  // MARK: Bausteine

  private func row(_ label: String, _ value: String, ok: Bool) -> some View {
    HStack {
      Text(label).foregroundStyle(.secondary)
      Spacer()
      Text(value).font(.system(.body, design: .monospaced)).foregroundStyle(ok ? .primary : petrol)
    }
  }

  private func qrImage(_ text: String) -> NSImage? {
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(text.utf8)
    filter.correctionLevel = "M"
    guard let out = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 6, y: 6)),
      let cg = CIContext().createCGImage(out, from: out.extent)
    else { return nil }
    return NSImage(cgImage: cg, size: NSSize(width: out.extent.width, height: out.extent.height))
  }
}
