export type HomeownerEnvironment =
  | "development"
  | "preview"
  | "production"
  | "test";

export type HomeownerServerEnvironment = {
  supabaseUrl: URL;
  supabaseSecretKey: string;
  expectedProjectRef: string;
  environment: HomeownerEnvironment;
  allowedOrigins: ReadonlySet<string>;
};

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;
