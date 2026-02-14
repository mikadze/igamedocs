export interface SeedData {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string | null;
  combinedHash: string | null;
  derivedCrashPoint: string | null;
}
