import tauriConfig from "../../src-tauri/tauri.conf.json";
import { DEFAULT_INPUT_TEMPLATE } from "../constant";

export const getBuildConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  const buildMode = process.env.BUILD_MODE ?? "standalone";
  const isApp = !!process.env.BUILD_APP;
  const version = "v" + tauriConfig.package.version;

  const commitInfo = (() => {
    try {
      // Only try to use child_process in a Node.js environment
      if (typeof window === 'undefined') {
        // Use dynamic import instead of require
        return (async () => {
          try {
            // This will only be executed in a Node.js environment
            const { execSync } = await import('child_process');
            const commitDate: string = execSync('git log -1 --format="%at000" --date=unix')
              .toString()
              .trim();
            const commitHash: string = execSync('git log --pretty=format:"%H" -n 1')
              .toString()
              .trim();

            return { commitDate, commitHash };
          } catch (e) {
            console.error("[Build Config] Error executing git commands:", e);
            return {
              commitDate: "server-error",
              commitHash: "server-error",
            };
          }
        })();
      } else {
        // In browser environment, return placeholder values
        return {
          commitDate: "browser",
          commitHash: "browser",
        };
      }
    } catch (e) {
      console.error("[Build Config] No git or not from git repo.");
      return {
        commitDate: "unknown",
        commitHash: "unknown",
      };
    }
  })();

  // Handle the case where commitInfo is a Promise
  if (commitInfo instanceof Promise) {
    return {
      version,
      commitDate: "loading",
      commitHash: "loading",
      buildMode,
      isApp,
      template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
      visionModels: process.env.VISION_MODELS || "",
    };
  }

  return {
    version,
    ...commitInfo,
    buildMode,
    isApp,
    template: process.env.DEFAULT_INPUT_TEMPLATE ?? DEFAULT_INPUT_TEMPLATE,
    visionModels: process.env.VISION_MODELS || "",
  };
};

export type BuildConfig = ReturnType<typeof getBuildConfig>;
