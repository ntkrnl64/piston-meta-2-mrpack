import { zipSync, strToU8 } from "fflate";

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: { id: string; type: string; url: string; releaseTime: string }[];
}

interface VersionDetail {
  id: string;
  type: string;
  downloads: {
    client: { sha1: string; size: number; url: string };
    server: { sha1: string; size: number; url: string };
  };
  libraries: {
    name: string;
    downloads: {
      artifact?: { path: string; sha1: string; size: number; url: string };
    };
    rules?: { action: string; os?: { name: string } }[];
  }[];
}

interface GenerateParams {
  versionUrl: string;
  packName: string;
  packVersion: string;
  loader: string;
  loaderVersion: string;
  summary: string;
}

function parseGenerateQuery(url: URL): GenerateParams | null {
  const versionUrl = url.searchParams.get("versionUrl");
  if (!versionUrl?.startsWith("https://piston-meta.mojang.com/")) return null;
  return {
    versionUrl,
    packName: url.searchParams.get("packName") || "",
    packVersion: url.searchParams.get("packVersion") || "1.0.0",
    loader: url.searchParams.get("loader") || "vanilla",
    loaderVersion: url.searchParams.get("loaderVersion") || "",
    summary: url.searchParams.get("summary") || "",
  };
}

async function generateMrpack(params: GenerateParams): Promise<Response> {
  const { versionUrl, packName, packVersion, loader, loaderVersion, summary } =
    params;

  const versionRes = await fetch(versionUrl);
  const versionData = (await versionRes.json()) as VersionDetail;

  const dependencies: Record<string, string> = {
    minecraft: versionData.id,
  };
  if (loader !== "vanilla" && loaderVersion) {
    dependencies[loader] = loaderVersion;
  }

  const files: {
    path: string;
    hashes: { sha1: string };
    env: { client: string; server: string } | null;
    downloads: string[];
    fileSize: number;
  }[] = [];

  if (versionData.downloads?.client) {
    const client = versionData.downloads.client;
    files.push({
      path: `client-${versionData.id}.jar`,
      hashes: { sha1: client.sha1 },
      env: { client: "required", server: "unsupported" },
      downloads: [client.url],
      fileSize: client.size,
    });
  }

  if (versionData.downloads?.server) {
    const server = versionData.downloads.server;
    files.push({
      path: `server-${versionData.id}.jar`,
      hashes: { sha1: server.sha1 },
      env: { client: "unsupported", server: "required" },
      downloads: [server.url],
      fileSize: server.size,
    });
  }

  for (const lib of versionData.libraries ?? []) {
    if (lib.downloads?.artifact) {
      if (lib.rules) {
        const dominated = lib.rules.some(
          (r) => r.action === "disallow" || r.os,
        );
        if (dominated) continue;
      }

      const artifact = lib.downloads.artifact;
      files.push({
        path: `libraries/${artifact.path}`,
        hashes: { sha1: artifact.sha1 },
        env: null,
        downloads: [artifact.url],
        fileSize: artifact.size,
      });
    }
  }

  const modrinthIndex = {
    formatVersion: 1,
    game: "minecraft",
    versionId: packVersion || "1.0.0",
    name: packName || `Vanilla ${versionData.id}`,
    summary: summary || `Minecraft ${versionData.id} pack`,
    dependencies,
    files: files.map((f) => ({
      path: f.path,
      hashes: { sha1: f.hashes.sha1 },
      ...(f.env ? { env: f.env } : {}),
      downloads: f.downloads,
      fileSize: f.fileSize,
    })),
  };

  const zipData = zipSync({
    "modrinth.index.json": strToU8(JSON.stringify(modrinthIndex, null, 2)),
  });

  const filename = `${(packName || "pack").replace(/[^a-zA-Z0-9_-]/g, "_")}-${versionData.id}.mrpack`;

  return new Response(zipData, {
    headers: {
      "Content-Type": "application/x-modrinth-modpack+zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/versions") {
      const res = await fetch(
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      );
      const data = (await res.json()) as VersionManifest;
      return Response.json(data, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }

    if (url.pathname === "/api/version-detail") {
      const versionUrl = url.searchParams.get("url");
      if (
        !versionUrl ||
        !versionUrl.startsWith("https://piston-meta.mojang.com/")
      ) {
        return Response.json({ error: "Invalid version URL" }, { status: 400 });
      }
      const res = await fetch(versionUrl);
      const data = await res.json();
      return Response.json(data, {
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    }

    if (url.pathname === "/api/generate") {
      if (request.method === "GET") {
        const params = parseGenerateQuery(url);
        if (!params) {
          return Response.json(
            { error: "Invalid or missing versionUrl parameter" },
            { status: 400 },
          );
        }
        return generateMrpack(params);
      }

      if (request.method === "POST") {
        const body = (await request.json()) as GenerateParams;
        if (!body.versionUrl?.startsWith("https://piston-meta.mojang.com/")) {
          return Response.json(
            { error: "Invalid version URL" },
            { status: 400 },
          );
        }
        return generateMrpack(body);
      }
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
