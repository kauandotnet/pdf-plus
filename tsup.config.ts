import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/workers/image-decoder.worker.ts",
    "src/workers/jp2-converter.worker.ts",
  ],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: process.env.NODE_ENV === "production",
  target: "es2022",
  outDir: "dist",
  treeshake: true,
  external: [
    "node-poppler",
    "pdf-lib",
    "pdf-parse",
    "pdfjs-dist",
    "pngjs",
    "file-type",
    "utif",
    "imagemin",
    "imagemin-gifsicle",
    "imagemin-mozjpeg",
    "imagemin-pngquant",
    "imagemin-svgo",
    "sharp",
    "canvas",
  ],
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
