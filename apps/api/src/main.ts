import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

const LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3006",
  "http://localhost:3010",
  "http://localhost:5173",
  "http://localhost:8081",
];

function corsOrigins(): string[] {
  const extra = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set([...LOCAL_ORIGINS, ...extra])];
}

/** Cloud Run exposes the same service on multiple hostnames; allow all Kaana app hosts. */
function isAllowedCloudRunOrigin(origin: string): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === "https:" &&
      hostname.startsWith("kaana-") &&
      (hostname.endsWith(".run.app") || hostname.endsWith(".a.run.app"))
    );
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = corsOrigins();
      if (allowed.includes(origin) || isAllowedCloudRunOrigin(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");

  const config = new DocumentBuilder()
    .setTitle("Kaana Kitchens API")
    .setDescription("Restaurant Management Platform API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT || process.env.API_PORT || 4000);
  await app.listen(port, "0.0.0.0");
  console.log(`Kaana Kitchens API running on http://0.0.0.0:${port}`);
  console.log(`Swagger docs: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();
