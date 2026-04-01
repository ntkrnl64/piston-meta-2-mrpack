import {
  FluentProvider,
  webDarkTheme,
  Card,
  Checkbox,
  Title1,
  Title3,
  Body1,
  Input,
  Button,
  Dropdown,
  Option,
  Spinner,
  MessageBar,
  MessageBarBody,
  Field,
  Textarea,
  Divider,
  Link,
  Tab,
  TabList,
  tokens,
  makeStyles,
} from "@fluentui/react-components";
import {
  ArrowDownloadRegular,
  BoxRegular,
  CodeRegular,
  CopyRegular,
  LinkRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { useState, useEffect, useCallback, useMemo } from "react";

interface Version {
  id: string;
  type: string;
  url: string;
  releaseTime: string;
}

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: Version[];
}

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: "48px",
    paddingBottom: "48px",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  container: {
    width: "100%",
    maxWidth: "560px",
    paddingLeft: "16px",
    paddingRight: "16px",
  },
  card: {
    padding: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  row: {
    display: "flex",
    gap: "12px",
  },
  flex1: {
    flex: 1,
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
  },
  footer: {
    textAlign: "center",
    marginTop: "16px",
    color: tokens.colorNeutralForeground3,
  },
});

const LOADERS = ["vanilla", "fabric", "quilt", "forge", "neoforge"] as const;

function App() {
  const styles = useStyles();
  const [manifest, setManifest] = useState<VersionManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [mode, setMode] = useState<"picker" | "json">("picker");
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [jsonUrl, setJsonUrl] = useState("");
  const [packName, setPackName] = useState("");
  const [packVersion, setPackVersion] = useState("1.0.0");
  const [loader, setLoader] = useState<string>("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/versions")
      .then((res) => res.json() as Promise<VersionManifest>)
      .then((data) => {
        setManifest(data);
        setSelectedVersion(data.latest.release);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load version manifest");
        setLoading(false);
      });
  }, []);

  const filteredVersions =
    manifest?.versions.filter((v) => showSnapshots || v.type === "release") ??
    [];

  const resolvedVersionUrl = useMemo(() => {
    if (mode === "json") {
      if (jsonUrl && jsonUrl.startsWith("https://piston-meta.mojang.com/"))
        return jsonUrl;
      return null;
    }
    if (!selectedVersion || !manifest) return null;
    const version = manifest.versions.find((v) => v.id === selectedVersion);
    return version?.url ?? null;
  }, [mode, jsonUrl, selectedVersion, manifest]);

  const buildGenerateUrl = useMemo(() => {
    if (!resolvedVersionUrl) return null;
    const label =
      mode === "json"
        ? packName || "Custom JSON"
        : packName || `Vanilla ${selectedVersion}`;
    const params = new URLSearchParams({
      versionUrl: resolvedVersionUrl,
      packName: label,
      packVersion: packVersion || "1.0.0",
      loader,
      ...(loader !== "vanilla" && loaderVersion ? { loaderVersion } : {}),
      ...(summary ? { summary } : {}),
    });
    return `${window.location.origin}/api/generate?${params.toString()}`;
  }, [
    resolvedVersionUrl,
    mode,
    selectedVersion,
    packName,
    packVersion,
    loader,
    loaderVersion,
    summary,
  ]);

  const handleCopyLink = useCallback(async () => {
    if (!buildGenerateUrl) return;
    await navigator.clipboard.writeText(buildGenerateUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [buildGenerateUrl]);

  const handleGenerate = useCallback(async () => {
    if (!resolvedVersionUrl) return;

    setGenerating(true);
    setError(null);
    setSuccess(null);

    const label =
      mode === "json"
        ? packName || "Custom JSON"
        : packName || `Vanilla ${selectedVersion}`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionUrl: resolvedVersionUrl,
          packName: label,
          packVersion,
          loader,
          loaderVersion,
          summary,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error || "Generation failed");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `${selectedVersion}.mrpack`;

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);

      setSuccess(`Downloaded ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [
    resolvedVersionUrl,
    mode,
    selectedVersion,
    packName,
    packVersion,
    loader,
    loaderVersion,
    summary,
  ]);

  if (loading) {
    return (
      <FluentProvider theme={webDarkTheme}>
        <div className={styles.root}>
          <Spinner size="large" label="Loading versions..." />
        </div>
      </FluentProvider>
    );
  }

  return (
    <FluentProvider theme={webDarkTheme}>
      <div className={styles.root}>
        <div className={styles.container}>
          <Card className={styles.card}>
            <div className={styles.header}>
              <BoxRegular fontSize={28} />
              <div>
                <Title1>mrpack Generator</Title1>
                <br />
                <Body1>
                  Generate Modrinth modpacks from Minecraft versions
                </Body1>
              </div>
            </div>

            <Divider />

            <div className={styles.form}>
              <Title3>
                <SettingsRegular /> Pack Settings
              </Title3>

              <Field label="Pack Name">
                <Input
                  placeholder={`Vanilla ${selectedVersion || "1.21"}`}
                  value={packName}
                  onChange={(_, d) => setPackName(d.value)}
                />
              </Field>

              <div className={styles.row}>
                <Field label="Pack Version" className={styles.flex1}>
                  <Input
                    value={packVersion}
                    onChange={(_, d) => setPackVersion(d.value)}
                  />
                </Field>
                <Field label="Mod Loader" className={styles.flex1}>
                  <Dropdown
                    value={loader.charAt(0).toUpperCase() + loader.slice(1)}
                    selectedOptions={[loader]}
                    onOptionSelect={(_, d) =>
                      setLoader(d.optionValue ?? "vanilla")
                    }
                  >
                    {LOADERS.map((l) => (
                      <Option
                        key={l}
                        value={l}
                        text={l.charAt(0).toUpperCase() + l.slice(1)}
                      >
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                      </Option>
                    ))}
                  </Dropdown>
                </Field>
              </div>

              {loader !== "vanilla" && (
                <Field label="Loader Version">
                  <Input
                    placeholder="e.g. 0.16.0"
                    value={loaderVersion}
                    onChange={(_, d) => setLoaderVersion(d.value)}
                  />
                </Field>
              )}

              <Field label="Summary">
                <Textarea
                  placeholder="A short description of your pack"
                  value={summary}
                  onChange={(_, d) => setSummary(d.value)}
                />
              </Field>

              <Divider />

              <Title3>
                <BoxRegular /> Minecraft Version
              </Title3>

              <TabList
                selectedValue={mode}
                onTabSelect={(_, d) => setMode(d.value as "picker" | "json")}
              >
                <Tab value="picker" icon={<BoxRegular />}>
                  Version Picker
                </Tab>
                <Tab value="json" icon={<LinkRegular />}>
                  From JSON URL
                </Tab>
              </TabList>

              {mode === "picker" && (
                <>
                  <Field label="Version">
                    <Dropdown
                      value={selectedVersion}
                      selectedOptions={[selectedVersion]}
                      onOptionSelect={(_, d) =>
                        setSelectedVersion(d.optionValue ?? "")
                      }
                    >
                      {filteredVersions.map((v) => (
                        <Option key={v.id} value={v.id} text={v.id}>
                          {v.id} {v.type !== "release" ? `(${v.type})` : ""}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>

                  <Checkbox
                    checked={showSnapshots}
                    onChange={(_, d) => setShowSnapshots(!!d.checked)}
                    label="Show snapshots & old versions"
                  />
                </>
              )}

              {mode === "json" && (
                <Field
                  label="Piston-Meta JSON URL"
                  validationMessage={
                    jsonUrl &&
                    !jsonUrl.startsWith("https://piston-meta.mojang.com/")
                      ? "URL must start with https://piston-meta.mojang.com/"
                      : undefined
                  }
                  validationState={
                    jsonUrl &&
                    !jsonUrl.startsWith("https://piston-meta.mojang.com/")
                      ? "error"
                      : "none"
                  }
                >
                  <Input
                    placeholder="https://piston-meta.mojang.com/v1/packages/.../26w14a.json"
                    value={jsonUrl}
                    onChange={(_, d) => setJsonUrl(d.value)}
                    contentBefore={<CodeRegular />}
                  />
                </Field>
              )}

              {error && (
                <MessageBar intent="error">
                  <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
              )}

              {success && (
                <MessageBar intent="success">
                  <MessageBarBody>{success}</MessageBarBody>
                </MessageBar>
              )}

              <div className={styles.buttonRow}>
                <Button
                  appearance="primary"
                  size="large"
                  icon={
                    generating ? (
                      <Spinner size="tiny" />
                    ) : (
                      <ArrowDownloadRegular />
                    )
                  }
                  onClick={handleGenerate}
                  disabled={generating || !resolvedVersionUrl}
                  style={{ flex: 1 }}
                >
                  {generating ? "Generating..." : "Generate .mrpack"}
                </Button>
                <Button
                  appearance="subtle"
                  size="large"
                  icon={<CopyRegular />}
                  onClick={handleCopyLink}
                  disabled={!resolvedVersionUrl}
                >
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              </div>
            </div>
          </Card>

          <div className={styles.footer}>
            <Body1>
              Powered by piston-meta.mojang.com &middot; Cloudflare Workers
              <br />
              <Link
                href="https://github.com/ntkrnl64/piston-meta-2-mrpack"
                target="_blank"
              >
                GitHub
              </Link>
            </Body1>
          </div>
        </div>
      </div>
    </FluentProvider>
  );
}

export default App;
