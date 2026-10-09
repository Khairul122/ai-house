import "./env.js";
import "reflect-metadata";

import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { migrateDb } from "./db/migrate.js";
import { purgeDemoData } from "./db/purge-demo.js";

// Hasil build dashboard (pnpm build). Bila ada, API ikut menyajikannya: satu proses untuk produksi.
const webDist = [
  path.resolve("apps/web/dist"),
  path.resolve("../web/dist"),
].find((d) => fs.existsSync(path.join(d, "index.html")));

async function bootstrap() {
  await migrateDb();
  const purged = await purgeDemoData();
  if (purged) console.log(`${purged} proyek demo lama dihapus.`);

  const adapter = new FastifyAdapter({
    logger: false,
    bodyLimit: 40 * 1024 * 1024, // formulir proyek bisa membawa berkas perencanaan hingga 25 MB
    // Rute dashboard (/projects/123, dst.) dijawab index.html agar router React yang mengambil alih.
    rewriteUrl: (req: IncomingMessage) => {
      const url = req.url ?? "/";
      const pathname = url.split("?")[0];
      if (
        webDist &&
        req.method === "GET" &&
        !pathname.startsWith("/api") &&
        !path.extname(pathname)
      )
        return "/";
      return url;
    },
  });

  // Penangkal CSRF: permintaan pengubah data wajib membawa header X-House. Situs lain tidak bisa
  // menambahkannya tanpa izin CORS, dan CORS memang tidak diaktifkan.
  adapter.getInstance().addHook("onRequest", async (req, reply) => {
    const safe =
      req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
    if (!safe && req.url.startsWith("/api") && req.headers["x-house"] !== "1") {
      return reply.code(403).send({
        statusCode: 403,
        message: "Permintaan ditolak: header X-House tidak ada.",
      });
    }
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );
  if (webDist)
    await app.register(fastifyStatic as never, { root: webDist, prefix: "/" });

  const port = Number(process.env.PORT) || 3000;
  // Bawaan hanya bisa diakses dari laptop ini. Set HOST=0.0.0.0 hanya bila ada login di depannya.
  const host = process.env.HOST || "127.0.0.1";
  await app.listen(port, host);
  console.log(
    `AI House berjalan di http://${host}:${port}${webDist ? " (dashboard ikut disajikan)" : ""}`,
  );
}

bootstrap();
