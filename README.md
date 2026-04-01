# piston-meta-2-mrpack

Generate [Modrinth `.mrpack`](https://docs.modrinth.com/docs/modpacks/format/) modpacks from Minecraft version metadata served by [piston-meta.mojang.com](https://piston-meta.mojang.com).

**Demo:** [pm2m.krnl64.win](https://pm2m.krnl64.win)

## Features

- Browse all Minecraft releases and snapshots from the official version manifest
- Paste a piston-meta JSON URL directly (e.g. snapshot or experiment versions)
- Configure pack name, version, summary, and mod loader (Vanilla, Fabric, Quilt, Forge, NeoForge)
- Download the generated `.mrpack` or copy a shareable direct-download link
- Runs entirely on Cloudflare Workers — no server required

## Tech Stack

- **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
- **Frontend:** [React](https://react.dev/) + [Fluent UI v9](https://react.fluentui.dev/)
- **Build:** [Vite](https://vite.dev/) + [Bun](https://bun.sh/)
- **ZIP:** [fflate](https://github.com/101arrowz/fflate)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- A [Cloudflare](https://cloudflare.com/) account (for deployment)

### Install

```sh
bun install
```

### Develop

```sh
bun run dev
```

### Build

```sh
bun run build
```

### Deploy

```sh
bun run deploy
```

## API

All API endpoints are served by the Cloudflare Worker.

### `GET /api/versions`

Proxies the Minecraft version manifest from piston-meta.mojang.com.

### `GET /api/version-detail?url=<piston-meta-url>`

Proxies individual version metadata.

### `GET|POST /api/generate`

Generates an `.mrpack` file.

**Query parameters / JSON body:**

| Parameter       | Required | Description                                        |
| --------------- | -------- | -------------------------------------------------- |
| `versionUrl`    | Yes      | piston-meta.mojang.com version JSON URL            |
| `packName`      | No       | Pack display name (defaults to `Vanilla <version>`) |
| `packVersion`   | No       | Pack version string (defaults to `1.0.0`)          |
| `loader`        | No       | Mod loader: `vanilla`, `fabric`, `quilt`, `forge`, `neoforge` |
| `loaderVersion` | No       | Mod loader version                                 |
| `summary`       | No       | Short pack description                             |

## License

[GPL-3.0](LICENSE)
