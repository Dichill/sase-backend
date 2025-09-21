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
} from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { PdfGenerationDto } from './pdf.types';
import { AuthGuard } from '../guard/AuthGuard';
import { GetUser } from '../guard/user.decorator';
import { User } from '@supabase/supabase-js';

@Controller('pdf')
@UseGuards(AuthGuard)
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

  constructor(private readonly pdfService: PdfService) {}

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

      const pdfBuffer = await this.pdfService.generatePdf(pdfData);

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
