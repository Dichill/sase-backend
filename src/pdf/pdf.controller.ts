/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
  Res,
  Header,
  Inject,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PdfPuppeteerService } from './pdf-puppeteer.service';
import { PdfService } from './pdf.service';
import { PdfGenerationDto } from './pdf.types';
import { AuthGuard } from '../guard/AuthGuard';
import { GetUser } from '../guard/user.decorator';
import { User } from '@supabase/supabase-js';

@Controller('pdf')
@UseGuards(AuthGuard)
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(
    @Inject('PdfService')
    private readonly pdfPuppeteerService: PdfPuppeteerService,
    private readonly pdfService: PdfService,
  ) {}

  @Post('generate')
  @Header('Content-Type', 'application/pdf')
  async generatePdf(
    @Body() pdfData: PdfGenerationDto,
    @GetUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    this.validateRequiredFields(pdfData);

    try {
      this.logger.log(
        `PDF generation requested by user ${user.id} for listing ${pdfData.listing_id}`,
      );

      const pdfBuffer = await this.pdfPuppeteerService.generatePdf(pdfData);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `document-${pdfData.listing_id}-${timestamp}.pdf`;

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.send(pdfBuffer);

      this.logger.log(
        `PDF generation completed successfully for user ${user.id}, listing ${pdfData.listing_id}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `PDF generation failed for user ${user.id}: ${errorMessage}`,
        errorStack,
      );

      if (!res.headersSent) {
        throw new HttpException(
          `Failed to generate PDF: ${errorMessage}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Post('merge')
  @Header('Content-Type', 'application/pdf')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'basePdf', maxCount: 1 },
        { name: 'additionalPdfs', maxCount: 10 },
      ],
      {
        limits: {
          fileSize: 50 * 1024 * 1024, // 50MB per file
          files: 11,
        },
      },
    ),
  )
  async mergePdfs(
    @UploadedFiles()
    files: {
      basePdf?: Express.Multer.File[];
      additionalPdfs?: Express.Multer.File[];
    },
    @GetUser() user: User,
    @Res() res: Response,
  ): Promise<void> {
    try {
      if (!files.basePdf || files.basePdf.length === 0) {
        throw new BadRequestException('Base PDF file is required');
      }

      if (!files.additionalPdfs || files.additionalPdfs.length === 0) {
        throw new BadRequestException(
          'At least one additional PDF file is required',
        );
      }

      if ((files.basePdf[0] as any).mimetype !== 'application/pdf') {
        throw new BadRequestException(
          `Base PDF file must be PDF format. Received: ${(files.basePdf[0] as any).mimetype}`,
        );
      }

      for (const file of files.additionalPdfs) {
        if (file.mimetype !== 'application/pdf') {
          throw new BadRequestException(
            `All files must be PDF format. Invalid file: ${file.originalname} (${file.mimetype})`,
          );
        }
      }

      this.logger.log(
        `PDF merge requested by user ${user.id}. Base PDF: ${(files.basePdf[0] as any).originalname}, Additional PDFs: ${files.additionalPdfs.length}`,
      );

      const basePdfBuffer: Buffer = (files.basePdf[0] as any).buffer;
      const additionalPdfBuffers: Buffer[] = files.additionalPdfs.map(
        (file) => (file as any).buffer,
      ) as Buffer[];

      const mergedPdfBuffer = await this.pdfService.mergePdfs(
        basePdfBuffer,
        additionalPdfBuffers,
      );

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `merged-pdf-${timestamp}.pdf`;

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', mergedPdfBuffer.length.toString());
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.send(mergedPdfBuffer);

      this.logger.log(
        `PDF merge completed successfully for user ${user.id}. Merged ${files.additionalPdfs.length + 1} files into ${filename}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `PDF merge failed for user ${user.id}: ${errorMessage}`,
        errorStack,
      );

      if (!res.headersSent) {
        if (error instanceof BadRequestException) {
          throw error;
        }

        throw new HttpException(
          `Failed to merge PDFs: ${errorMessage}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  private validateRequiredFields(pdfData: PdfGenerationDto): void {
    const requiredFields: (keyof PdfGenerationDto)[] = [
      'full_name',
      'email',
      'listing_id',
      'listing_address',
    ];

    const missingFields = requiredFields.filter(
      (field) => !pdfData[field] || pdfData[field].trim() === '',
    );

    if (missingFields.length > 0) {
      const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
      this.logger.warn(`PDF generation validation failed: ${errorMessage}`);

      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
