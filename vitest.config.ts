import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Workspace proyek berisi hasil kerja agen (termasuk tes milik produk itu), bukan tes House.
    exclude: [...configDefaults.exclude, "**/workspaces/**", "**/_backup-ui-lama/**"]
  }
});
