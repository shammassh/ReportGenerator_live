/**
 * PDF Export Service
 * Generates print-optimized PDFs from HTML reports using Puppeteer
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class PDFExportService {
    constructor(options = {}) {
        this.outputDir = options.outputDir || path.join(__dirname, '..', '..', '..', 'reports');
        this.browser = null;
    }

    /**
     * Initialize browser instance
     */
    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }

    /**
     * Close browser instance
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Generate PDF from HTML content
     * @param {string} htmlContent - HTML content to convert
     * @param {Object} options - PDF options
     * @returns {Promise<Buffer>} - PDF buffer
     */
    async generatePDF(htmlContent, options = {}) {
        const browser = await this.initBrowser();
        const page = await browser.newPage();

        try {
            // Set content with longer timeout for images
            await page.setContent(htmlContent, {
                waitUntil: ['load', 'networkidle0'],
                timeout: 60000
            });

            // Wait for any charts to render
            await page.evaluate(() => {
                return new Promise(resolve => {
                    if (typeof Chart !== 'undefined') {
                        setTimeout(resolve, 1000);
                    } else {
                        resolve();
                    }
                });
            });

            // Configure PDF options
            const pdfOptions = {
                format: 'A4',
                printBackground: true,
                margin: {
                    top: options.marginTop || '15mm',
                    bottom: options.marginBottom || '15mm',
                    left: options.marginLeft || '10mm',
                    right: options.marginRight || '10mm'
                },
                displayHeaderFooter: options.showHeaderFooter !== false,
                headerTemplate: options.headerTemplate || `
                    <div style="font-size: 9px; color: #666; width: 100%; text-align: center; padding: 5px 20px;">
                        <span>${options.documentNumber || 'Audit Report'}</span>
                    </div>
                `,
                footerTemplate: options.footerTemplate || `
                    <div style="font-size: 9px; color: #666; width: 100%; display: flex; justify-content: space-between; padding: 5px 20px;">
                        <span>Generated: ${new Date().toLocaleDateString()}</span>
                        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </div>
                `,
                preferCSSPageSize: false,
                ...options.pdfOptions
            };

            // Generate PDF
            const pdfBuffer = await page.pdf(pdfOptions);

            return pdfBuffer;
        } finally {
            await page.close();
        }
    }

    /**
     * Generate PDF from HTML file
     * @param {string} htmlFilePath - Path to HTML file
     * @param {Object} options - PDF options
     * @returns {Promise<string>} - Path to generated PDF
     */
    async generatePDFFromFile(htmlFilePath, options = {}) {
        const htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        const pdfBuffer = await this.generatePDF(htmlContent, options);

        // Determine output path
        const baseName = path.basename(htmlFilePath, '.html');
        const pdfFileName = options.outputFileName || `${baseName}.pdf`;
        const pdfPath = path.join(this.outputDir, pdfFileName);

        // Ensure output directory exists
        await fs.mkdir(this.outputDir, { recursive: true });

        // Write PDF file
        await fs.writeFile(pdfPath, pdfBuffer);

        return pdfPath;
    }

    /**
     * Generate Summary PDF (shorter version for quick printing)
     * @param {string} htmlContent - Full HTML content
     * @param {Object} options - PDF options
     * @returns {Promise<Buffer>} - PDF buffer
     */
    async generateSummaryPDF(htmlContent, options = {}) {
        const browser = await this.initBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(htmlContent, {
                waitUntil: ['load', 'networkidle0'],
                timeout: 60000
            });

            // Hide detailed sections, keep only summary
            await page.evaluate(() => {
                // Hide detailed section responses (keep only summary table)
                document.querySelectorAll('.section').forEach(el => {
                    el.style.display = 'none';
                });

                // Hide picture galleries
                document.querySelectorAll('.pictures-section').forEach(el => {
                    el.style.display = 'none';
                });

                // Hide detailed findings table (keep chart)
                document.querySelectorAll('.findings-section').forEach(el => {
                    el.style.display = 'none';
                });

                // Add summary indicator
                const container = document.querySelector('.container');
                if (container) {
                    const note = document.createElement('div');
                    note.style.cssText = 'text-align: center; padding: 20px; color: #666; font-style: italic; border-top: 1px solid #e0e0e0; margin-top: 20px;';
                    note.textContent = '📋 Summary Report - For full details, view the complete report';
                    container.appendChild(note);
                }
            });

            // Wait for charts
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

            const pdfOptions = {
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '15mm',
                    bottom: '15mm',
                    left: '10mm',
                    right: '10mm'
                },
                displayHeaderFooter: true,
                headerTemplate: `
                    <div style="font-size: 9px; color: #666; width: 100%; text-align: center; padding: 5px 20px;">
                        <span>${options.documentNumber || 'Audit Report'} - SUMMARY</span>
                    </div>
                `,
                footerTemplate: `
                    <div style="font-size: 9px; color: #666; width: 100%; display: flex; justify-content: space-between; padding: 5px 20px;">
                        <span>Summary Generated: ${new Date().toLocaleDateString()}</span>
                        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </div>
                `
            };

            return await page.pdf(pdfOptions);
        } finally {
            await page.close();
        }
    }

    /**
     * Generate PDF with custom page breaks for sections
     * @param {string} htmlContent - HTML content
     * @param {Object} options - Options
     * @returns {Promise<Buffer>} - PDF buffer
     */
    async generatePDFWithPageBreaks(htmlContent, options = {}) {
        const browser = await this.initBrowser();
        const page = await browser.newPage();

        try {
            await page.setContent(htmlContent, {
                waitUntil: ['load', 'networkidle0'],
                timeout: 60000
            });

            // Add page breaks before major sections
            await page.evaluate(() => {
                // Add page break before chart section
                const chartSection = document.querySelector('.chart-section');
                if (chartSection) {
                    chartSection.style.pageBreakBefore = 'always';
                }

                // Add page break before findings
                const findingsSection = document.querySelector('.findings-section');
                if (findingsSection) {
                    findingsSection.style.pageBreakBefore = 'always';
                }

                // Add page break before picture galleries
                document.querySelectorAll('.pictures-section').forEach((el, index) => {
                    if (index === 0) {
                        el.style.pageBreakBefore = 'always';
                    }
                });

                // Prevent sections from breaking in middle
                document.querySelectorAll('.section').forEach(el => {
                    el.style.pageBreakInside = 'avoid';
                });

                // Prevent table rows from breaking
                document.querySelectorAll('tr').forEach(el => {
                    el.style.pageBreakInside = 'avoid';
                });
            });

            // Wait for any dynamic content
            await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

            const pdfOptions = {
                format: 'A4',
                printBackground: true,
                margin: {
                    top: options.marginTop || '20mm',
                    bottom: options.marginBottom || '20mm',
                    left: options.marginLeft || '12mm',
                    right: options.marginRight || '12mm'
                },
                displayHeaderFooter: true,
                headerTemplate: `
                    <div style="font-size: 10px; color: #333; width: 100%; text-align: center; padding: 8px 20px; border-bottom: 1px solid #e0e0e0;">
                        <strong>${options.storeName || ''}</strong> - ${options.documentNumber || 'Audit Report'}
                    </div>
                `,
                footerTemplate: `
                    <div style="font-size: 9px; color: #666; width: 100%; display: flex; justify-content: space-between; padding: 8px 20px; border-top: 1px solid #e0e0e0;">
                        <span>Audit Date: ${options.auditDate || new Date().toLocaleDateString()}</span>
                        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                    </div>
                `
            };

            return await page.pdf(pdfOptions);
        } finally {
            await page.close();
        }
    }
}

module.exports = PDFExportService;
