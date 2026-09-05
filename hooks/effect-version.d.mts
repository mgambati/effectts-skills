export const SUPPORTED_EFFECT_VERSION: "4.0.0-rc.112";
export function effectProjectStatus(cwd: string): {
  detected: boolean;
  supported: boolean;
  version?: string;
  message?: string;
};
