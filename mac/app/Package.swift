// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "HuginMunin",
  platforms: [.macOS(.v13)],
  targets: [
    .executableTarget(name: "HuginMunin", path: "Sources/HuginMunin")
  ]
)
