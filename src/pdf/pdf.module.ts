import { Module } from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { PdfPuppeteerService } from './pdf-puppeteer.service';
import { SupabaseModule } from 'nestjs-supabase-js';

@Module({
  imports: [SupabaseModule.injectClient()],
  controllers: [PdfController],
  providers: [
    PdfService,
    PdfPuppeteerService,
    {
      provide: 'PdfService',
      useClass: PdfPuppeteerService,
    },
  ],
  exports: [PdfService, PdfPuppeteerService],
})
export class PdfModule {}
