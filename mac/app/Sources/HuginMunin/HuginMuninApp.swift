import AppKit
import ServiceManagement
import SwiftUI

@main
struct HuginMuninApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) var delegate

  var body: some Scene {
    MenuBarExtra {
      StatusView(server: delegate.server)
    } label: {
      MenuIcon(server: delegate.server)
    }
    .menuBarExtraStyle(.window)
  }
}

struct MenuIcon: View {
  @ObservedObject var server: Server
  var body: some View { Image(systemName: server.running ? "bird.fill" : "bird") }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  let server = Server()

  func applicationDidFinishLaunching(_ notification: Notification) {
    server.start()
  }

  func applicationWillTerminate(_ notification: Notification) {
    server.stop()
  }
}

/// „Beim Anmelden starten“ über SMAppService (macOS 13+).
enum LoginItem {
  static var enabled: Bool { SMAppService.mainApp.status == .enabled }

  static func set(_ on: Bool) {
    do {
      if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
    } catch {
      NSLog("Hugin & Munin: Anmeldeobjekt: \(error.localizedDescription)")
    }
  }
}
