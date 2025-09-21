import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createReport } from 'docx-templates';
import * as libre from 'libreoffice-convert';
import { promisify } from 'util';
import { PdfGenerationDto, TemplateData } from './pdf.types';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly templatePath = path.join(
    process.cwd(),
    'templates',
    'document-template.docx',
  );
  private readonly outputDir = path.join(process.cwd(), 'generated-pdfs');
  private readonly libreConvert = promisify(libre.convert);

  constructor() {
    this.ensureOutputDirectory();
  }

  async generatePdf(data: PdfGenerationDto): Promise<Buffer> {
    try {
      this.logger.log('Starting PDF generation process');

      await this.validateTemplate();

      const templateData = this.transformToTemplateData(data);

      const docxBuffer = await this.generateDocxFromTemplate(templateData);

      const pdfBuffer = await this.convertDocxToPdf(docxBuffer);

      this.logger.log('PDF generation completed successfully');
      return pdfBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `PDF generation failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new HttpException(
        `Failed to generate PDF: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateAndSavePdf(data: PdfGenerationDto): Promise<string> {
    const pdfBuffer = await this.generatePdf(data);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `document-${data.listing_id}-${timestamp}.pdf`;
    const filepath = path.join(this.outputDir, filename);

    await fs.promises.writeFile(filepath, pdfBuffer);

    this.logger.log(`PDF saved to: ${filepath}`);
    return filepath;
  }

  private async validateTemplate(): Promise<void> {
    try {
      await fs.promises.access(this.templatePath, fs.constants.R_OK);
      this.logger.log(`Template found at: ${this.templatePath}`);
    } catch {
      const errorMessage = `Template file not found or not readable at: ${this.templatePath}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      this.logger.log(`Created output directory: ${this.outputDir}`);
    }
  }

  private transformToTemplateData(data: PdfGenerationDto): TemplateData {
    return {
      FULL_NAME: data.full_name || '',
      DATE_OF_BIRTH: data.date_of_birth || '',
      GENDER: data.gender || '',
      PHONE: data.phone || '',
      EMAIL: data.email || '',
      PROFILE_ADDRESS: data.profile_address || '',
      PROFILE_CREATED_AT: data.profile_created_at || '',
      PROFILE_UPDATED_AT: data.profile_updated_at || '',
      LISTING_ID: data.listing_id || '',
      LISTING_ADDRESS: data.listing_address || '',
      CONTACT_EMAIL: data.contact_email || '',
      CONTACT_PHONE: data.contact_phone || '',
      CONTACT_OTHER: data.contact_other || '',
      SOURCE_LINK: data.source_link || '',
      PRICE_RENT: data.price_rent || '',
      HOUSING_TYPE: data.housing_type || '',
      LEASE_TYPE: data.lease_type || '',
      UPFRONT_FEES: data.upfront_fees || '',
      UTILITIES: data.utilities || '',
      CREDIT_SCORE_MIN: data.credit_score_min || '',
      MINIMUM_INCOME: data.minimum_income || '',
      REFERENCES_REQUIRED: data.references_required || '',
      BEDROOMS: data.bedrooms || '',
      BATHROOMS: data.bathrooms || '',
      SQUARE_FOOTAGE: data.square_footage || '',
      LAYOUT_DESCRIPTION: data.layout_description || '',
      AMENITIES: data.amenities || '',
      PET_POLICY: data.pet_policy || '',
      FURNISHING: data.furnishing || '',
      LISTING_NOTES: data.listing_notes || '',
      LISTING_CREATED_AT: data.listing_created_at || '',
      LISTING_UPDATED_AT: data.listing_updated_at || '',
    };
  }

  private async generateDocxFromTemplate(
    templateData: TemplateData,
  ): Promise<Buffer> {
    try {
      const template = await fs.promises.readFile(this.templatePath);

      const docxBuffer = await createReport({
        template,
        data: templateData,
        cmdDelimiter: ['{', '}'],
      });

      this.logger.log('DOCX generation from template completed');
      return Buffer.from(docxBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to generate DOCX from template: ${errorMessage}`,
      );
      throw new Error(`DOCX generation failed: ${errorMessage}`);
    }
  }

  private async convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
    try {
      this.logger.log('Starting DOCX to PDF conversion');

      const pdfBuffer = Buffer.from(
        await this.libreConvert(docxBuffer, '.pdf', undefined),
      );

      this.logger.log('DOCX to PDF conversion completed');
      return pdfBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to convert DOCX to PDF: ${errorMessage}`);
      throw new Error(`PDF conversion failed: ${errorMessage}`);
    }
  }

  async getFileInfo(
    filepath: string,
  ): Promise<{ filename: string; fileSize: number }> {
    const stats = await fs.promises.stat(filepath);
    const filename = path.basename(filepath);

    return {
      filename,
      fileSize: stats.size,
    };
  }

  async cleanupOldFiles(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.outputDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filepath = path.join(this.outputDir, file);
          const stats = await fs.promises.stat(filepath);

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.promises.unlink(filepath);
            this.logger.log(`Cleaned up old file: ${file}`);
          }
        }
      }
    } catch (cleanupError) {
      this.logger.warn('Error during file cleanup:', cleanupError);
    }
  }
}
