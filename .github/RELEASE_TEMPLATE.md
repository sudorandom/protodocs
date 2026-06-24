## Installation

Choose the download that matches how you want to use ProtoDocs:

| Artifact | Platform | Description |
|---|---|---|
| `protodocs-desktop-darwin-universal.dmg` | macOS (Intel + Apple Silicon) | Desktop app — drag to Applications |
| `protodocs-desktop-windows-amd64.zip` | Windows x64 | Desktop app — extract and run `ProtoDocs.exe` |
| `protodocs-desktop-linux-amd64.tar.gz` | Linux x64 | Desktop app — extract and run `ProtoDocs` |
| `protodocs-cli-darwin-arm64.tar.gz` | macOS Apple Silicon | CLI binary |
| `protodocs-cli-darwin-amd64.tar.gz` | macOS Intel | CLI binary |
| `protodocs-cli-linux-arm64.tar.gz` | Linux ARM64 | CLI binary |
| `protodocs-cli-linux-amd64.tar.gz` | Linux x64 | CLI binary |
| `protodocs-cli-windows-amd64.zip` | Windows x64 | CLI binary |
| `protodocs-static.tar.gz` | Any web host | Static HTML/JS bundle for self-hosting |

---

## Desktop App

The desktop app is the easiest way to browse `.proto` schemas locally — no server required.

### Quick Start

1. **Download** the `.dmg` (macOS), `.zip` (Windows), or `.tar.gz` (Linux) from the assets below.
2. **Install / extract** the app.
3. **Launch** ProtoDocs.
4. At the schema loader, either:
   - **Drag & drop** a compiled descriptor file (`.binpb` or `.pb`) onto the window.
   - Click **Open File** and select your descriptor file.
   - Enter a **reflection URL** to connect to a live gRPC / Connect server with reflection enabled.
   - Click **Load Demo** to explore the built-in Eliza sample schema.

> **Generating a descriptor file** from your `.proto` sources:
> ```sh
> # Using buf:
> buf build -o my-api.binpb
>
> # Using protoc:
> protoc --descriptor_set_out=my-api.binpb --include_imports your_file.proto
> ```

### ⚠️ macOS: "App is damaged" / Gatekeeper warning

The desktop builds are **not code-signed or notarized**. Code signing requires an Apple Developer account ($99/year), which this project doesn't have. macOS Gatekeeper will therefore block the app on first launch with a message like *"ProtoDocs is damaged and can't be opened"* or *"ProtoDocs cannot be opened because the developer cannot be verified."*

**To open the app anyway:**

**Option A — Right-click method (recommended, one-time):**
1. In Finder, right-click (or Control-click) `ProtoDocs.app`.
2. Choose **Open** from the context menu.
3. Click **Open** in the confirmation dialog.

After doing this once, macOS remembers the exception and the app opens normally in the future.

**Option B — Remove the quarantine attribute via Terminal:**
```sh
xattr -dr com.apple.quarantine /Applications/ProtoDocs.app
```
This strips the quarantine flag entirely. Run it once after moving the app to `/Applications`.

---

## CLI

```sh
# Run directly (no install needed):
go run github.com/sudorandom/protodocs/cmd/protodocs@latest [descriptor-files...]

# Or install permanently:
go install github.com/sudorandom/protodocs/cmd/protodocs@latest

# Serve a local descriptor file with proxy enabled:
protodocs --proxy my-api.binpb

# Connect to a live reflection server:
protodocs --reflection-url https://my-service.example.com

# Specify listen address:
protodocs --addr 127.0.0.1:9090 my-api.binpb
```

---

## Self-Hosted Static Site

Extract `protodocs-static.tar.gz` to any static web host (Nginx, S3, GitHub Pages, Netlify, …):

```sh
tar -xzf protodocs-static.tar.gz -C /var/www/html/protodocs
```

Add a `config.yaml` in the web root to point at your descriptor files:

```yaml
title: "My API Docs"
descriptor_files:
  - "/my-api.binpb"
```

---

## Docker

```sh
docker run -d -p 8080:80 sudorandom/protodocs:latest
# Then open http://localhost:8080
```

---

## Changelog

