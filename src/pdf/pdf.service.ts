import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createReport } from 'docx-templates';
import * as libre from 'libreoffice-convert';
import { promisify } from 'util';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  PdfGenerationDto,
  TemplateData,
  PdfMergeResponseDto,
  PdfHeaderOptions,
} from './pdf.types';

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

  private async addHeaderToPdf(
    pdfBuffer: Buffer,
    headerText: string,
    options?: Partial<PdfHeaderOptions>,
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const fontSize = options?.fontSize || 12;
      const color = options?.color || '#000000';
      const position = options?.position || { x: 50, y: 0 };

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16) / 255,
              g: parseInt(result[2], 16) / 255,
              b: parseInt(result[3], 16) / 255,
            }
          : { r: 0, g: 0, b: 0 };
      };

      const rgbColor = hexToRgb(color);

      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const { height } = page.getSize();

        const yPosition = position.y === 0 ? height - 30 : position.y;

        page.drawText(headerText, {
          x: position.x,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
        });
      }

      const modifiedPdfBuffer = await pdfDoc.save();
      return Buffer.from(modifiedPdfBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add header to PDF: ${errorMessage}`);
      throw new Error(`Header addition failed: ${errorMessage}`);
    }
  }

  async mergePdfs(
    basePdfBuffer: Buffer,
    additionalPdfBuffers: Buffer[],
    headers?: string[],
  ): Promise<Buffer> {
    try {
      this.logger.log(
        `Starting PDF merge process with base PDF and ${additionalPdfBuffers.length} additional PDFs`,
      );

      const mergedPdf = await PDFDocument.create();

      const basePdf = await PDFDocument.load(basePdfBuffer);
      const basePageIndices = basePdf.getPageIndices();
      const basePages = await mergedPdf.copyPages(basePdf, basePageIndices);

      basePages.forEach((page) => mergedPdf.addPage(page));
      this.logger.log(`Added ${basePages.length} pages from base PDF`);

      for (let i = 0; i < additionalPdfBuffers.length; i++) {
        try {
          let pdfBuffer = additionalPdfBuffers[i];

          // Add header if provided for this PDF
          if (headers && headers[i] && headers[i].trim()) {
            this.logger.log(
              `Adding header "${headers[i]}" to additional PDF ${i + 1}`,
            );
            pdfBuffer = await this.addHeaderToPdf(pdfBuffer, headers[i].trim());
          }

          const additionalPdf = await PDFDocument.load(pdfBuffer);
          const additionalPageIndices = additionalPdf.getPageIndices();
          const additionalPages = await mergedPdf.copyPages(
            additionalPdf,
            additionalPageIndices,
          );

          additionalPages.forEach((page) => mergedPdf.addPage(page));
          const headerInfo =
            headers && headers[i] ? ` with header "${headers[i]}"` : '';
          this.logger.log(
            `Added ${additionalPages.length} pages from additional PDF ${
              i + 1
            }${headerInfo}`,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(
            `Failed to process additional PDF ${i + 1}: ${errorMessage}`,
          );
        }
      }

      const mergedPdfBuffer = Buffer.from(await mergedPdf.save());

      this.logger.log(
        `PDF merge completed successfully. Total pages: ${mergedPdf.getPageCount()}`,
      );

      return mergedPdfBuffer;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `PDF merge failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new HttpException(
        `Failed to merge PDFs: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async mergePdfsAndSave(
    basePdfBuffer: Buffer,
    additionalPdfBuffers: Buffer[],
    customFilename?: string,
    headers?: string[],
  ): Promise<PdfMergeResponseDto> {
    try {
      const mergedPdfBuffer = await this.mergePdfs(
        basePdfBuffer,
        additionalPdfBuffers,
        headers,
      );

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = customFilename || `merged-pdf-${timestamp}.pdf`;
      const filepath = path.join(this.outputDir, filename);

      await fs.promises.writeFile(filepath, mergedPdfBuffer);

      const mergedPdf = await PDFDocument.load(mergedPdfBuffer);
      const totalPages = mergedPdf.getPageCount();

      this.logger.log(`Merged PDF saved to: ${filepath}`);

      return {
        success: true,
        filename,
        fileSize: mergedPdfBuffer.length,
        mergedAt: new Date().toISOString(),
        totalPages,
        sourceFileCount: additionalPdfBuffers.length + 1, // +1 for base PDF
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`PDF merge and save failed: ${errorMessage}`);

      return {
        success: false,
        error: `Failed to merge and save PDFs: ${errorMessage}`,
      };
    }
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
