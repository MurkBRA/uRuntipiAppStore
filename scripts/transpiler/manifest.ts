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
    if (
      /\b(vpn|wireguard|tailscale|firewall|auth|password|security|dns|proxy)\b/.test(text) &&
      !base.includes("security")
    ) {
      base.push("security");
    }
  }

  return base;
}

export function replaceUmbrelProse(text: string): string {
  if (!text) return text;
  const protectedPattern = /(https?:\/\/[^\s)\]]+|```[\s\S]*?```|`[^`]+`)/g;
  return text
    .split(protectedPattern)
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part
        .replace(/\b(?:umbrelOS|umbrel\s*os)\b/gi, "Runtipi")
        .replace(/\bumbrel('s)?\b/gi, (_match, suffix) => (suffix ? "Runtipi's" : "Runtipi"));
    })
    .join("");
}

export function sanitizeUmbrelDescriptionText(text: string, manifestPort: number, allocatedPort: number): string {
  if (!text) return text;
  let out = text;

  // Replace umbrel.local:<port> (when not part of an email address like umbrel@umbrel.local)
  // Also translates manifestPort -> allocatedPort if the port was reallocated for Runtipi
  out = out.replace(/(?<!@)\bumbrel\.local:(\d+)/gi, (_match, portStr) => {
    const portNum = Number.parseInt(portStr, 10);
    const finalPort = portNum === manifestPort ? allocatedPort : portNum;
    return `<IP-DO-SERVIDOR>:${finalPort}`;
  });

  // Replace remaining standalone umbrel.local hostnames (not preceded by @)
  out = out.replace(/(?<!@)\bumbrel\.local\b/gi, "<IP-DO-SERVIDOR>");

  // Replace umbrelOS and Umbrel in prose text with Runtipi
  out = replaceUmbrelProse(out);

  return out;
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
  const manifestPort = Number(umbrelManifest.port) || allocatedPort;
  const tagline = sanitizeUmbrelDescriptionText(
    String(umbrelManifest.tagline ?? name).trim(),
    manifestPort,
    allocatedPort,
  );
  const fullDescription = sanitizeUmbrelDescriptionText(
    String(umbrelManifest.description ?? tagline).trim(),
    manifestPort,
    allocatedPort,
  );
  const firstParagraph =
    fullDescription
      .split(/\r?\n\r?\n/)[0]
      ?.replace(/\r?\n/g, " ")
      .trim() || tagline;

  const rawManifestVersion = String(umbrelManifest.version ?? "1.0.0").trim();
  // Ensure version matches dockerCompose.services[app.id].image tag rule in apps.test.ts
  const resolvedVersion =
    rawManifestVersion && mainImageTag && mainImageTag.includes(rawManifestVersion)
      ? rawManifestVersion
      : mainImageTag || rawManifestVersion;

  const author = String(umbrelManifest.developer || umbrelManifest.submitter || "Community").trim();
  const website = String(umbrelManifest.website || umbrelManifest.repo || "https://umbrel.com").trim();
  const source = String(
    umbrelManifest.repo || umbrelManifest.website || "https://github.com/getumbrel/umbrel-apps",
  ).trim();
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
    $schema: "../app-info-schema.json",
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
  const adminEmailField = formFields.find((f) =>
    ["ADMIN_EMAIL", "APP_ADMIN_EMAIL", "SUPER_ADMINS", "DJANGO_SUPERUSER_EMAIL", "PB_ADMIN_EMAIL"].includes(
      f.env_variable,
    ),
  );
  const hasGeneratedAppPassword = formFields.some((f) => f.env_variable === "APP_PASSWORD");

  if (umbrelManifest.id === "frigate") {
    const credLines: string[] = [
      "## Default Credentials",
      "- **Username**: `admin`",
      "- **Password**: Generated automatically in the container console/logs on first launch. View your container logs (`docker logs frigate` or check the Runtipi logs viewer) to retrieve your initial password.",
      "- **Password Reset**: If you need to reset the admin password later, set `auth.reset_admin_password: true` in your Frigate configuration and restart the container.",
      "- **RTSP Stream Password**: Configured via the `APP_RTSP_PASSWORD` field in your Runtipi app configuration.",
    ];
    mdSections.push(credLines.join("\n"));
  } else if (defaultUser || defaultPass || (detPass && hasGeneratedAppPassword) || adminEmailField) {
    const credLines: string[] = ["## Default Credentials"];
    if (adminEmailField) {
      credLines.push(
        `- **Username / Email**: Configured via \`${adminEmailField.env_variable}\` in your Runtipi app settings (default: \`${adminEmailField.default || "admin@tipi.local"}\`)`,
      );
      if (hasGeneratedAppPassword) {
        credLines.push(
          "- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.",
        );
      } else if (defaultPass) {
        credLines.push(`- **Password**: \`${defaultPass}\``);
      }
    } else {
      if (defaultUser) {
        const normalizedUser = /^(?:umbrel|admin)@umbrel\.local$/i.test(defaultUser) ? "admin@tipi.local" : defaultUser;
        credLines.push(`- **Username**: \`${normalizedUser}\``);
      }
      if (defaultPass) {
        credLines.push(`- **Password**: \`${defaultPass}\``);
      } else if (hasGeneratedAppPassword) {
        credLines.push(
          "- **Password**: Generated automatically via the `APP_PASSWORD` field in your Runtipi app configuration.",
        );
      }
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
