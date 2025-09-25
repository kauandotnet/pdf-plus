import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === "production",
  target: "es2022",
  outDir: "dist",
  treeshake: true,
  external: ["node-poppler", "pdf-lib", "pdf-parse", "pdfjs-dist", "pngjs"],
  esbuildOptions(options) {
    options.banner = {
      js: '"use strict";',
    };
    options.legalComments = "none";
    options.drop =
      process.env.NODE_ENV === "production" ? ["console", "debugger"] : [];
  },
  onSuccess: async () => {
    console.log("✅ Build completed successfully");
  },
});
