import type { AppCategory, FormField } from "@runtipi/common/schemas";

const CATEGORY_MAP: Record<string, AppCategory[]> = {
  ai: ["ai"],
  automation: ["automation"],
  bitcoin: ["finance"],
  crypto: ["finance"],
  developer: ["development"],
  files: ["utilities", "data"],
  finance: ["finance"],
  media: ["media"],
  networking: ["network"],
  social: ["social"],
};

export function mapUmbrelCategory(category: string, tagline = "", description = ""): AppCategory[] {
  const base = CATEGORY_MAP[category?.toLowerCase()] ? [...CATEGORY_MAP[category.toLowerCase()]] : ["utilities"];
  const text = `${tagline} ${description}`.toLowerCase();

  if (category === "files") {
    if (/\b(book|ebook|epub|manga|comic|library)\b/.test(text) && !base.includes("books")) {
      base.unshift("books");
    } else if (/\b(photo|image|gallery|picture)\b/.test(text) && !base.includes("photography")) {
      base.unshift("photography");
    }
  } else if (category === "media") {
    if (/\b(music|audio|podcast|spotify|subsonic)\b/.test(text) && !base.includes("music")) {
      base.push("music");
    }
  } else if (category === "networking") {
    if (/\b(vpn|wireguard|tailscale|firewall|auth|password|security|dns|proxy)\b/.test(text) && !base.includes("security")) {
      base.push("security");
    }
  }

  return base;
}

export function buildRuntipiConfigAndDescription(params: {
  appId: string;
  umbrelManifest: Record<string, any>;
  allocatedPort: number;
  mainImageTag: string;
  formFields: FormField[];
  tipiVersion: number;
  createdAt: number;
  updatedAt: number;
  uid?: number;
  gid?: number;
}): { config: Record<string, any>; descriptionMd: string } {
  const {
    appId,
    umbrelManifest,
    allocatedPort,
    mainImageTag,
    formFields,
    tipiVersion,
    createdAt,
    updatedAt,
    uid,
    gid,
  } = params;

  const name = String(umbrelManifest.name ?? appId).trim();
  const tagline = String(umbrelManifest.tagline ?? name).trim();
  const fullDescription = String(umbrelManifest.description ?? tagline).trim();
  const firstParagraph = fullDescription.split(/\r?\n\r?\n/)[0]?.replace(/\r?\n/g, " ").trim() || tagline;

  const rawManifestVersion = String(umbrelManifest.version ?? "1.0.0").trim();
  // Ensure version matches dockerCompose.services[app.id].image tag rule in apps.test.ts
  const resolvedVersion =
    rawManifestVersion && mainImageTag.includes(rawManifestVersion) ? rawManifestVersion : mainImageTag;

  const author = String(umbrelManifest.developer || umbrelManifest.submitter || "Community").trim();
  const website = String(umbrelManifest.website || umbrelManifest.repo || "https://umbrel.com").trim();
  const source = String(umbrelManifest.repo || umbrelManifest.website || "https://github.com/getumbrel/umbrel-apps").trim();
  const categories = mapUmbrelCategory(String(umbrelManifest.category || "files"), tagline, fullDescription);

  const config: Record<string, any> = {
    name,
    available: true,
    port: allocatedPort,
    exposable: true,
    dynamic_config: true,
    id: appId,
    description: firstParagraph,
    tipi_version: tipiVersion,
    version: resolvedVersion,
    categories,
    short_desc: tagline,
    author,
    source,
    website,
    ...(umbrelManifest.path && String(umbrelManifest.path).trim()
      ? { url_suffix: String(umbrelManifest.path).trim().replace(/^\/+/, "") }
      : {}),
    ...(umbrelManifest.requiresHttps === true ? { https: true } : {}),
    ...(uid !== undefined ? { uid } : {}),
    ...(gid !== undefined ? { gid } : {}),
    ...(formFields.length > 0 ? { form_fields: formFields } : {}),
    supported_architectures: ["arm64", "amd64"],
    created_at: createdAt,
    updated_at: updatedAt,
    "$schema": "../app-info-schema.json",
    min_tipi_version: "4.7.0",
  };

  // Build rich Markdown description
  const mdSections: string[] = [];
  mdSections.push(`# ${name}`);
  if (tagline) {
    mdSections.push(`> ${tagline}`);
  }
  mdSections.push(fullDescription);

  // Credentials note if present
  const defaultUser = String(umbrelManifest.defaultUsername ?? "").trim();
  const defaultPass = String(umbrelManifest.defaultPassword ?? "").trim();
  const detPass = Boolean(umbrelManifest.deterministicPassword);

  if (defaultUser || defaultPass || detPass) {
    const credLines: string[] = ["## Default Credentials"];
    if (defaultUser) credLines.push(`- **Username**: \`${defaultUser}\``);
    if (defaultPass) credLines.push(`- **Password**: \`${defaultPass}\``);
    if (detPass && !defaultPass) {
      credLines.push(
        "- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.",
      );
    }
    mdSections.push(credLines.join("\n"));
  }

  // Dependencies note if present
  const deps = Array.isArray(umbrelManifest.dependencies) ? umbrelManifest.dependencies : [];
  if (deps.length > 0) {
    mdSections.push(
      [
        "## Inter-App Connections",
        `This package integrates with **${deps.join(", ")}** on the Runtipi shared network (\`tipi_main_network\`). You can customize the target hostnames, ports, and RPC credentials in the install form fields.`,
      ].join("\n\n"),
    );
  }

  mdSections.push(
    [
      "## Links",
      `- **Upstream Version**: \`${rawManifestVersion}\``,
      `- **Website**: ${website}`,
      `- **Source Repository**: ${source}`,
      ...(umbrelManifest.support ? [`- **Support**: ${String(umbrelManifest.support).trim()}`] : []),
    ].join("\n"),
  );

  return {
    config,
    descriptionMd: `${mdSections.join("\n\n")}\n`,
  };
}
