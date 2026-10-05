export type HomeownerEnvironment =
  | "development"
  | "preview"
  | "production"
  | "test";

export type VersionedKeyring = {
  activeVersion: number;
  keys: ReadonlyMap<number, Buffer>;
};

export type PaintGuideServerEnvironment = {
  supabaseUrl: URL;
  supabaseSecretKey: string;
  expectedProjectRef: string;
  environment: HomeownerEnvironment;
  allowedOrigins: ReadonlySet<string>;
};

export type HomeownerServerEnvironment = PaintGuideServerEnvironment & {
  tokenLookupHmacKeys: VersionedKeyring;
  tokenEncryptionKeys: VersionedKeyring;
  sessionHmacKeys: VersionedKeyring;
};

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;
