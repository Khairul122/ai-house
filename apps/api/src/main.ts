import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import { sqliteClient } from "./db/index.js";
import { migrateDb } from "./db/migrate.js";

async function bootstrap() {
  await migrateDb();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  app.enableCors({ origin: true });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`AI House API server running on http://127.0.0.1:${port}`);
}

bootstrap();
