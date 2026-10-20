import crypto from "node:crypto";

const SYSTEM_RESERVED_PORTS = new Set([22, 53, 80, 443, 2000, 3000]);

export class PortAllocator {
  private usedPorts = new Set<number>(SYSTEM_RESERVED_PORTS);
  private allocatedByApp = new Map<string, number>();

  constructor(reservedRuntipiPorts: Array<{ port: number; runtipi_id: string }>, existingAllocations?: Record<string, number>) {
    for (const entry of reservedRuntipiPorts) {
      if (Number.isInteger(entry.port) && entry.port > 0) {
        this.usedPorts.add(entry.port);
      }
    }
    if (existingAllocations) {
      for (const [appId, port] of Object.entries(existingAllocations)) {
        if (Number.isInteger(port) && port > 0 && !this.usedPorts.has(port)) {
          this.allocatedByApp.set(appId, port);
          this.usedPorts.add(port);
        }
      }
    }
  }

  public allocatePort(appId: string, preferredPort?: number): number {
    const existing = this.allocatedByApp.get(appId);
    if (existing !== undefined) {
      return existing;
    }

    if (
      preferredPort !== undefined &&
      Number.isInteger(preferredPort) &&
      preferredPort >= 1024 &&
      preferredPort <= 65535 &&
      !this.usedPorts.has(preferredPort)
    ) {
      this.usedPorts.add(preferredPort);
      this.allocatedByApp.set(appId, preferredPort);
      return preferredPort;
    }

    // Deterministic fallback in range 18100..28099 based on SHA-256 of appId
    const hash = crypto.createHash("sha256").update(appId).digest();
    const offset = hash.readUInt16BE(0) % 10000;
    let candidate = 18100 + offset;

    while (this.usedPorts.has(candidate) || (candidate >= 40000 && candidate <= 49999)) {
      candidate += 1;
      if (candidate > 65000) {
        candidate = 18100;
      }
    }

    this.usedPorts.add(candidate);
    this.allocatedByApp.set(appId, candidate);
    return candidate;
  }

  public getAllocations(): Record<string, number> {
    return Object.fromEntries([...this.allocatedByApp.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }
}
