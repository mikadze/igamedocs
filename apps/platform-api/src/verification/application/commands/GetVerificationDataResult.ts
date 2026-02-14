export type VerificationData =
  | {
      roundId: string;
      status: string;
      crashPoint: string | null;
      serverSeed: string;
      serverSeedHash: string;
      clientSeed: string | null;
      combinedHash: string | null;
      derivedCrashPoint: string | null;
      verified: true;
    }
  | {
      roundId: string;
      status: string;
      serverSeedHash: string;
      verified: false;
    };

export type GetVerificationDataResult =
  | { success: true; data: VerificationData }
  | { success: false; error: 'ROUND_NOT_FOUND' | 'NO_SEED_DATA' };
