# Luminode Studio app host research

Status: architecture recommendation, October 2026.

## Decision

Build the reusable host as a separate Electron 40+ application and use
[`@napolab/texture-bridge-renderer`](https://github.com/naporin0624/electron-texture-bridge)
for GPU-resident output:

- macOS: Chromium IOSurface → Syphon Metal;
- Windows: Chromium DXGI shared texture → D3D11 / Spout.

Version 0.15.0 is MIT, published to npm, provides prebuilt Apple Silicon,
Intel macOS, and Windows x64 binaries, and has native build and packaging
smoke jobs for macOS and Windows. Its high-level `createTextureBridge()` API
owns the offscreen window, paint lifecycle, exact pixel sizing, FPS reporting,
optional alpha, and preview. This is a much smaller maintenance surface than
owning a CEF fork.

The host should live in its own repository. LENTE remains a browser app and
implements the shared Luminode operator/output contract described below.

## What the three reference projects establish

### SyphonWeb

[`doawoo/SyphonWeb`](https://github.com/doawoo/SyphonWeb) is a useful,
small MIT proof that a web app can be published to Syphon. It uses a
`WKWebView`, calls `layer.render(in:)` into a CPU `CGContext`, uploads those
bytes into a Metal texture with `texture.replace`, and publishes that texture
through `SyphonMetalServer`.

Do not use this as the production frame path:

- it performs a full CPU-to-GPU upload every frame;
- its README notes that separately composited video layers do not appear;
- the output is currently fixed at 1280×720;
- the app bundle does not contain camera permission declarations.

Its Swift app bundling and Syphon framework packaging are still useful
references.

### SpoutBrowser

[`bntre/SpoutBrowser`](https://github.com/bntre/SpoutBrowser) is the correct
Windows technical reference. It enables CEF off-screen accelerated paint,
opens Chromium's D3D11 shared texture, renders it into a swap-chain back
buffer, and calls Spout's `SendBackBuffer()`. Pixels stay on the GPU.

It also demonstrates the cost of using it directly: it is a fork of the CEF
sample tree, so adopting it makes Chromium/CEF upgrades part of Luminode
Studio maintenance. Camera access is disabled by default in the inherited
sample handler and would need a product-specific permission policy.

Current CEF also exposes an IOSurface through `OnAcceleratedPaint` on macOS,
which proves a native cross-platform CEF host is possible. It is no longer
necessary for this project because Electron's shared-texture API and
`electron-texture-bridge` already package that work.

### Hedron

[`nudibranchrecords/hedron`](https://github.com/nudibranchrecords/hedron)
is an operator/output UX reference, not a Syphon/Spout implementation. Its
Electron app opens a fullscreen output window on a selected display. When
operator preview and program differ, it renders the two views and copies the
renderer canvas into 2D preview/output canvases.

Keep its useful product pattern—preview can differ from program—but avoid its
pixel-copy path.

## Host architecture

The professional shape is one host with two web surfaces:

1. **Operator surface** — a visible BrowserWindow with projects, controls,
   source previews, history, and device selection.
2. **Output surface** — an offscreen BrowserWindow at exact output pixel
   dimensions. It owns camera streams and the render loop. This is the only
   surface sent to Syphon/Spout.

The surfaces exchange small, versioned messages; they never exchange the
program pixels:

- full project snapshots on open/new;
- parameter patches while editing;
- camera/device status;
- output dimensions, FPS, alpha, sender state, and errors;
- small, throttled source/program thumbnails for the operator UI.

Use a typed preload bridge in production. A same-partition
`BroadcastChannel` is adequate for the first spike.

Each Studio app should provide a manifest similar to:

```json
{
  "format": "luminode-app",
  "version": 1,
  "id": "studio.luminode.lente",
  "name": "LENTE",
  "operator": "/index.html?surface=operator",
  "output": "/index.html?surface=output",
  "defaults": {
    "width": 1280,
    "height": 720,
    "frameRate": 60,
    "alpha": false
  },
  "permissions": ["camera"]
}
```

The host owns:

- app discovery and manifest validation;
- BrowserWindow lifecycle and crash recovery;
- exact output sizing and display scale factor;
- Syphon/Spout sender naming, start/stop, FPS, alpha, and resize;
- camera permission policy and macOS entitlements;
- native dependency packaging;
- signing, notarization/installers, updates, and diagnostics.

The app owns:

- rendering and project schema;
- the operator-to-output state model;
- source/effect controls and undo history;
- output-safe behavior when no host bridge is present.

## Why the app must split

Electron's shared-texture sender captures a composited BrowserWindow, not one
DOM element. Capturing LENTE's current page would include its controls.
Reading the WebGL canvas back in JavaScript would throw away the zero-copy
benefit.

Therefore the output canvas must run in a dedicated output surface. LENTE's
current engine and UI share one module, so the first host integration is an
engine/controller split:

- output runtime owns `createRenderer`, video inputs, modulation, and rAF;
- operator runtime owns menus, controls, files, history, and mixer UI;
- a shared protocol applies serialized state and incremental patches;
- camera previews return as low-rate thumbnails/status, not duplicated
  camera streams.

This split is the reusable Luminode Studio contract. Validate it with LENTE
before adapting GLOW or MUSGO.

## Delivery sequence

1. **Host spike.** Package a local animated WebGL test page with
   `createTextureBridge()`. Verify macOS Syphon and Windows Spout at 720p60
   and 1080p60, resize, alpha, restart, receiver disconnect, and GPU/device
   loss.
2. **Contract spike.** Add a visible operator window, offscreen output window,
   manifest loader, typed state messages, status/FPS, and deterministic
   cleanup (`texture.release()` on every paint).
3. **LENTE integration.** Split operator and output runtimes. Output owns
   cameras. Preserve standalone-browser mode.
4. **Productization.** Add app discovery, signed/notarized macOS bundle,
   signed Windows installer, updates, logs, and crash recovery.
5. **Suite rollout.** Integrate GLOW and MUSGO through manifests instead of
   adding project-specific code to the host.

## Acceptance gates for the spike

- no `readPixels`, `toDataURL`, `captureStream`, raw RGBA IPC, or per-frame
  CPU buffer in the production path;
- 1280×720 at 60 fps and 1920×1080 at 60 fps for ten minutes;
- sender visible and correctly named in Resolume plus one native monitor;
- resize without stale dimensions or a black stream;
- camera video and WebGL canvas both present;
- alpha test pattern correct when enabled;
- texture handles released in all success/error/quit paths;
- app continues to work in a normal browser without the host.

## Licensing

- `electron-texture-bridge`: MIT;
- Spout2: BSD 2-Clause;
- Syphon Framework: BSD-style license;
- Electron/Chromium: their respective open-source notices.

The host needs a generated third-party notices bundle. LENTE's shader and font
restrictions remain separate app-content concerns.
