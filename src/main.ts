import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const maxSize = process.env.MAX_FILE_SIZE || '52428800';
  const maxSizeString = `${Math.floor(parseInt(maxSize) / (1024 * 1024))}mb`;

  app.use(json({ limit: maxSizeString }));
  app.use(urlencoded({ limit: maxSizeString, extended: true }));

  app.enableCors();

  app.setGlobalPrefix('api/sase');
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
