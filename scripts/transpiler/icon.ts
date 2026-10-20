import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

function generateFallbackSvg(appName: string, appId: string): Buffer {
  const cleanName = (appName || appId).replace(/[^A-Za-z0-9 ]/g, "").trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (cleanName.slice(0, 2) || "AP").toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2563EB" />
        <stop offset="100%" stop-color="#1E1B4B" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="96" fill="url(#bg)" />
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="192" font-weight="bold">${initials}</text>
  </svg>`;
  return Buffer.from(svg, "utf8");
}

export async function generateAppLogo(
  appId: string,
  appName: string,
  galleryRoot: string,
  destLogoPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(destLogoPath), { recursive: true });

  // Skip if valid JPEG already exists at destination
  if (fs.existsSync(destLogoPath)) {
    const stat = fs.statSync(destLogoPath);
    if (stat.size > 100) {
      const header = Buffer.alloc(3);
      const fd = fs.openSync(destLogoPath, "r");
      fs.readSync(fd, header, 0, 3, 0);
      fs.closeSync(fd);
      if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        return;
      }
    }
  }

  const candidates = [
    path.join(galleryRoot, appId, "icon.svg"),
    path.join(galleryRoot, appId, "icon.png"),
    path.join(galleryRoot, appId, "icon.jpg"),
    path.join(galleryRoot, appId, "icon.webp"),
  ];

  const existingSource = candidates.find((p) => fs.existsSync(p));

  if (existingSource) {
    try {
      await sharp(existingSource, { density: 300 })
        .resize(512, 512, {
          fit: "contain",
          background: { r: 24, g: 24, b: 32, alpha: 1 },
        })
        .flatten({ background: { r: 24, g: 24, b: 32 } })
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(destLogoPath);
      return;
    } catch {
      // Fall through to generated SVG badge if upstream SVG has unsupported filters/external refs
    }
  }

  const fallbackBuffer = generateFallbackSvg(appName, appId);
  await sharp(fallbackBuffer)
    .resize(512, 512)
    .flatten({ background: { r: 30, g: 27, b: 75 } })
    .jpeg({ quality: 90 })
    .toFile(destLogoPath);
}
