import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import { PdfGenerationDto, TemplateData } from './pdf.types';

@Injectable()
export class PdfPuppeteerService {
  private readonly logger = new Logger(PdfPuppeteerService.name);
  private readonly outputDir = path.join(process.cwd(), 'generated-pdfs');

  constructor() {
    this.ensureOutputDirectory();
  }

  async generatePdf(data: PdfGenerationDto): Promise<Buffer> {
    try {
      this.logger.log('Starting PDF generation process with Puppeteer');

      const templateData = this.transformToTemplateData(data);

      const htmlContent = this.generateHtmlContent(templateData);

      const pdfBuffer = await this.convertHtmlToPdf(htmlContent);

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

  private generateHtmlContent(templateData: TemplateData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rental Application Document</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 28px;
        }
        .section {
            margin-bottom: 25px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
        }
        .section h2 {
            color: #2c3e50;
            margin-top: 0;
            font-size: 18px;
            border-bottom: 1px solid #bdc3c7;
            padding-bottom: 8px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 10px;
        }
        .info-item {
            background: white;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #e9ecef;
        }
        .info-label {
            font-weight: bold;
            color: #495057;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .info-value {
            color: #212529;
            font-size: 14px;
        }
        .full-width {
            grid-column: 1 / -1;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .section { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>DICHOPHSTIN EXPORT DOCUMENT</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>Personal Information</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Full Name</div>
                <div class="info-value">${templateData.FULL_NAME}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Date of Birth</div>
                <div class="info-value">${templateData.DATE_OF_BIRTH}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Gender</div>
                <div class="info-value">${templateData.GENDER}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Phone</div>
                <div class="info-value">${templateData.PHONE}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${templateData.EMAIL}</div>
            </div>
            <div class="info-item full-width">
                <div class="info-label">Address</div>
                <div class="info-value">${templateData.PROFILE_ADDRESS}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Listing Information</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Listing ID</div>
                <div class="info-value">${templateData.LISTING_ID}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Property Address</div>
                <div class="info-value">${templateData.LISTING_ADDRESS}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Rent Price</div>
                <div class="info-value">${templateData.PRICE_RENT}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Housing Type</div>
                <div class="info-value">${templateData.HOUSING_TYPE}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Lease Type</div>
                <div class="info-value">${templateData.LEASE_TYPE}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Bedrooms</div>
                <div class="info-value">${templateData.BEDROOMS}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Bathrooms</div>
                <div class="info-value">${templateData.BATHROOMS}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Square Footage</div>
                <div class="info-value">${templateData.SQUARE_FOOTAGE}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Contact Information</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Contact Email</div>
                <div class="info-value">${templateData.CONTACT_EMAIL}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Contact Phone</div>
                <div class="info-value">${templateData.CONTACT_PHONE}</div>
            </div>
            <div class="info-item full-width">
                <div class="info-label">Other Contact Info</div>
                <div class="info-value">${templateData.CONTACT_OTHER}</div>
            </div>
            <div class="info-item full-width">
                <div class="info-label">Source Link</div>
                <div class="info-value">${templateData.SOURCE_LINK}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Financial Requirements</h2>
        <div class="info-grid">
            <div class="info-item">
                <div class="info-label">Upfront Fees</div>
                <div class="info-value">${templateData.UPFRONT_FEES}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Utilities</div>
                <div class="info-value">${templateData.UTILITIES}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Min Credit Score</div>
                <div class="info-value">${templateData.CREDIT_SCORE_MIN}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Minimum Income</div>
                <div class="info-value">${templateData.MINIMUM_INCOME}</div>
            </div>
            <div class="info-item">
                <div class="info-label">References Required</div>
                <div class="info-value">${templateData.REFERENCES_REQUIRED}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Property Details</h2>
        <div class="info-grid">
            <div class="info-item full-width">
                <div class="info-label">Layout Description</div>
                <div class="info-value">${templateData.LAYOUT_DESCRIPTION}</div>
            </div>
            <div class="info-item full-width">
                <div class="info-label">Amenities</div>
                <div class="info-value">${templateData.AMENITIES}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Pet Policy</div>
                <div class="info-value">${templateData.PET_POLICY}</div>
            </div>
            <div class="info-item">
                <div class="info-label">Furnishing</div>
                <div class="info-value">${templateData.FURNISHING}</div>
            </div>
            <div class="info-item full-width">
                <div class="info-label">Additional Notes</div>
                <div class="info-value">${templateData.LISTING_NOTES}</div>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>Document generated on ${new Date().toLocaleString()}</p>
        <p>Profile Updated: ${templateData.PROFILE_UPDATED_AT} |Listing Updated: ${templateData.LISTING_UPDATED_AT}</p>
        <p>Generated by Dichophstin</p>
    </div>
</body>
</html>`;
  }

  private async convertHtmlToPdf(htmlContent: string): Promise<Buffer> {
    let browser: Browser | undefined;
    try {
      this.logger.log('Starting HTML to PDF conversion with Puppeteer');

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page: Page = await browser.newPage();

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });

      this.logger.log('HTML to PDF conversion completed');
      return Buffer.from(pdfBuffer);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to convert HTML to PDF: ${errorMessage}`);
      throw new Error(`PDF conversion failed: ${errorMessage}`);
    } finally {
      if (browser) {
        await browser.close();
      }
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
