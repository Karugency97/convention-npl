import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface LettreMissionTemplateData {
  cabinetAddress: string;
  cabinetPhone: string;
  cabinetEmail: string;
  cabinetSiret: string;
  dossierReference: string;
  currentDate: string;
  clientFullName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone?: string;
  missionDescription: string;
  totalAmountFormatted: string;
  honorairesDetails?: string;
  generatedAt: string;
  // User template specific fields
  _date: Date;
  'nom complet': string;
  email: string;
  Objet: string;
  'Honoraires temps': string;
  'Honoraires forfait': string;
  'Honoraire de résultat': boolean;
}

@Injectable()
export class PdfGeneratorService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private browser: puppeteer.Browser | null = null;
  private template: Handlebars.TemplateDelegate | null = null;

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async getBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  private getTemplate(): Handlebars.TemplateDelegate {
    if (!this.template) {
      const templatePath = path.join(__dirname, 'templates', 'convention.html');
      const templateContent = fs.readFileSync(templatePath, 'utf-8');

      Handlebars.registerHelper(
        'if',
        function (
          this: unknown,
          conditional: unknown,
          options: Handlebars.HelperOptions,
        ) {
          if (conditional) {
            return options.fn(this);
          }
          return options.inverse(this);
        },
      );

      Handlebars.registerHelper('format_date', function (date, options) {
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleDateString('fr-FR');
      });

      Handlebars.registerHelper('length', function (val) {
        if (!val) return 0;
        if (typeof val === 'string') return val.trim().length;
        if (Array.isArray(val)) return val.length;
        return 0;
      });

      // firma.dev signature placeholders
      Handlebars.registerHelper('eDateSigned', function () {
        return '[Date de signature]';
      });

      Handlebars.registerHelper('eSign', function () {
        return '[Signature électronique]';
      });

      this.template = Handlebars.compile(templateContent);
    }
    return this.template;
  }

  async generateLettreMissionPdf(
    templateData: LettreMissionTemplateData,
  ): Promise<Buffer> {
    this.logger.log(
      `Generating PDF for dossier: ${templateData.dossierReference}`,
    );

    const template = this.getTemplate();
    const htmlContent = template(templateData);

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: false,
      });

      this.logger.log(
        `PDF generated successfully for dossier: ${templateData.dossierReference}`,
      );

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  formatAmount(amount: number | string): string {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numAmount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }
}
