import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import { Bill, BillItem, Customer, Store, User } from '@prisma/client';

interface BillData extends Bill {
  billItems: BillItem[];
  customer: Customer | null;
  store: Store;
  biller?: User | null;
}

type PrintSize = '58mm' | '80mm'; // 90mm usually refers to 80mm standard or similar. I'll support 80mm/90mm via wide layout.

const generateBillHtml = (bill: BillData, size: PrintSize): string => {
  const width = size === '58mm' ? '58mm' : '80mm';
  const fontSize = size === '58mm' ? '12px' : '14px';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bill #${bill.billNumber}</title>
  <style>
    @page {
      margin: 0;
      size: ${width} auto; 
    }
    body {
      font-family: 'Courier New', Courier, monospace; /* Monospace for alignment in thermal printers */
      margin: 0;
      padding: 5px;
      width: ${width};
      font-size: ${fontSize};
      line-height: 1.2;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    
    .header {
      margin-bottom: 10px;
      border-bottom: 1px dashed #000;
      padding-bottom: 5px;
    }
    .store-name { font-size: 1.2em; font-weight: bold; }
    .meta { font-size: 0.9em; margin-bottom: 5px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
    th { border-bottom: 1px dashed #000; text-align: left; padding: 2px 0; }
    td { padding: 2px 0; vertical-align: top; }
    
    .totals {
      margin-top: 5px;
      border-top: 1px dashed #000;
      padding-top: 5px;
    }
    .grand-total {
      font-size: 1.1em;
      font-weight: bold;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 5px 0;
      margin-top: 5px;
    }
    .footer {
      margin-top: 10px;
      text-align: center;
      font-size: 0.8em;
    }
  </style>
</head>
<body>
  <div class="header text-center">
    <div class="store-name">${bill.store.name}</div>
    <div>${bill.store.address || ''}</div>
    <div>${bill.store.city || ''}</div>
    <div>${bill.store.phone || ''}</div>
  </div>

  <div class="meta">
    <div>Bill No: ${bill.billNumber}</div>
    <div>Date: ${new Date(bill.billedAt).toLocaleString()}</div>
    ${bill.customer ? `<div>Cust: ${bill.customer.firstName} ${bill.customer.lastName || ''}</div>` : ''}
    ${bill.customer?.phone ? `<div>Ph: ${bill.customer.phone}</div>` : ''}
    ${bill.doctorName ? `<div>Dr: ${bill.doctorName}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th width="45%">Item</th>
        <th width="15%">Qty</th>
        <th width="20%">Price</th>
        <th width="20%" class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${bill.billItems.map(item => `
        <tr>
          <td>
            ${item.productName}
          </td>
          <td>${item.quantity}</td>
          <td>${Number(item.unitPrice).toFixed(2)}</td>
          <td class="text-right">${Number(item.totalAmount).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals text-right">
    <div>Subtotal: ${Number(bill.subtotal).toFixed(2)}</div>
    ${Number(bill.discountAmount) > 0 ? `<div>Discount: -${Number(bill.discountAmount).toFixed(2)}</div>` : ''}
    ${Number(bill.taxAmount) > 0 ? `<div>Tax: ${Number(bill.taxAmount).toFixed(2)}</div>` : ''}
    ${Number(bill.doctorFees) > 0 ? `<div>Dr. Fees: ${Number(bill.doctorFees).toFixed(2)}</div>` : ''}
    ${Number(bill.otherCharges) > 0 ? `<div>Other: ${Number(bill.otherCharges).toFixed(2)}</div>` : ''}
    
    <div class="grand-total flex justify-between">
      <span>Total:</span>
      <span>${Number(bill.totalAmount).toFixed(2)}</span>
    </div>
    
    <div style="margin-top:2px;">Paid: ${Number(bill.paidAmount).toFixed(2)}</div>
    ${Number(bill.changeAmount) > 0 ? `<div>Change: ${Number(bill.changeAmount).toFixed(2)}</div>` : ''}
  </div>

  <div class="footer">
    <div>Method: ${bill.paymentMethod}</div>
    <div>Thank you for your visit!</div>
    <div style="font-size:0.7em; margin-top:5px;">System by Pharmacy POS</div>
  </div>
</body>
</html>
  `;
};

/**
 * Generate PDF buffer for bill
 */
export const generateBillPdf = async (billData: BillData, size: PrintSize): Promise<Buffer> => {
  const html = generateBillHtml(billData, size);
  let browser;

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    // Production (Vercel/AWS Lambda)
    const chromiumAny = chromium as any;
    browser = await puppeteerCore.launch({
      args: chromiumAny.args,
      defaultViewport: chromiumAny.defaultViewport,
      executablePath: await chromiumAny.executablePath(),
      headless: chromiumAny.headless === 'new' ? true : chromiumAny.headless,
      ignoreHTTPSErrors: true,
    } as any);
  } else {
    // Local Development
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      width: size === '58mm' ? '58mm' : '80mm',
      printBackground: true,
      height: 'auto',
      margin: {
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default {
  generateBillPdf,
};
