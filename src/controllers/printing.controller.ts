import { Request, Response } from 'express';
import billingService from '../services/billing.service';
import printingService from '../services/printing.service';

/**
 * Generate PDF for a bill
 * GET /api/v1/printing/bills/:id/pdf?size=58mm
 */
export const printBill = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const size = (req.query.size as string) === '58mm' ? '58mm' : '80mm';

        // Get Bill with Store details (updated service to include store)
        const bill = await billingService.getBillById(req.storeId, String(id));

        if (!bill) {
            res.status(404).json({ success: false, message: 'Bill not found' });
            return;
        }

        if (!bill.store) {
            res.status(500).json({ success: false, message: 'Store details missing for this bill' });
            return;
        }

        try {
            const pdfBuffer = await printingService.generateBillPdf(bill as any, size);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="bill-${bill.billNumber}.pdf"`);
            res.send(pdfBuffer);
        } catch (pdfError) {
            console.error('Puppeteer PDF generation failed, falling back to HTML:', pdfError);
            // Fallback: Return HTML for printing
            const html = generateBillHtml(bill as any, size);
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        }

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate PDF';
        console.error('Print bill error:', error);
        res.status(500).json({ success: false, message });
    }
};

/**
 * Get bill as HTML (for print preview)
 * GET /api/v1/printing/bills/:id/html?size=58mm
 */
export const printBillHtml = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.storeId) {
            res.status(401).json({ success: false, message: 'Auth required' });
            return;
        }

        const { id } = req.params;
        const size = (req.query.size as string) === '58mm' ? '58mm' : '80mm';

        const bill = await billingService.getBillById(req.storeId, String(id));

        if (!bill) {
            res.status(404).json({ success: false, message: 'Bill not found' });
            return;
        }

        if (!bill.store) {
            res.status(500).json({ success: false, message: 'Store details missing for this bill' });
            return;
        }

        const html = generateBillHtml(bill as any, size);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate HTML';
        console.error('Print bill HTML error:', error);
        res.status(500).json({ success: false, message });
    }
};

// Helper function to generate HTML (duplicated here for fallback)
const generateBillHtml = (bill: any, size: '58mm' | '80mm'): string => {
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
    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      margin: 0;
      padding: 10px;
      width: ${width};
      max-width: ${width};
      font-size: ${fontSize};
      line-height: 1.3;
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
      padding-bottom: 8px;
    }
    .store-name { font-size: 1.3em; font-weight: bold; margin-bottom: 5px; }
    .meta { font-size: 0.9em; margin-bottom: 8px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { border-bottom: 1px dashed #000; text-align: left; padding: 3px 0; font-weight: bold; }
    td { padding: 3px 0; vertical-align: top; }
    
    .totals {
      margin-top: 8px;
      border-top: 1px dashed #000;
      padding-top: 8px;
    }
    .grand-total {
      font-size: 1.2em;
      font-weight: bold;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 8px 0;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
    }
    .footer {
      margin-top: 15px;
      text-align: center;
      font-size: 0.85em;
      border-top: 1px dashed #000;
      padding-top: 10px;
    }
    .print-btn {
      display: block;
      margin: 20px auto;
      padding: 10px 30px;
      font-size: 16px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 5px;
      cursor: pointer;
    }
    .print-btn:hover { background: #1d4ed8; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align: center; margin-bottom: 20px;">
    <button class="print-btn" onclick="window.print()">🖨️ Print Bill</button>
  </div>

  <div class="header text-center">
    <div class="store-name">${bill.store.name}</div>
    <div>${bill.store.address || ''}</div>
    <div>${bill.store.city || ''}${bill.store.postalCode ? ', ' + bill.store.postalCode : ''}</div>
    <div>${bill.store.phone || ''}</div>
    ${bill.store.gstNumber ? `<div>GST: ${bill.store.gstNumber}</div>` : ''}
  </div>

  <div class="meta">
    <div><strong>Bill No:</strong> ${bill.billNumber}</div>
    <div><strong>Date:</strong> ${new Date(bill.billedAt).toLocaleString('en-IN')}</div>
    ${bill.customer ? `<div><strong>Customer:</strong> ${bill.customer.firstName} ${bill.customer.lastName || ''}</div>` : '<div>Customer: Walk-in</div>'}
    ${bill.customer?.phone ? `<div><strong>Phone:</strong> ${bill.customer.phone}</div>` : ''}
    ${bill.doctorName ? `<div><strong>Doctor:</strong> ${bill.doctorName}</div>` : ''}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 45%">Item</th>
        <th style="width: 15%">Qty</th>
        <th style="width: 20%">Rate</th>
        <th style="width: 20%" class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${bill.billItems.map((item: any) => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>₹${Number(item.unitPrice).toFixed(2)}</td>
          <td class="text-right">₹${Number(item.totalAmount).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals text-right">
    <div>Subtotal: ₹${Number(bill.subtotal).toFixed(2)}</div>
    ${Number(bill.discountAmount) > 0 ? `<div>Discount: -₹${Number(bill.discountAmount).toFixed(2)}</div>` : ''}
    ${Number(bill.taxAmount) > 0 ? `<div>Tax: ₹${Number(bill.taxAmount).toFixed(2)}</div>` : ''}
    ${Number(bill.doctorFees) > 0 ? `<div>Doctor Fees: ₹${Number(bill.doctorFees).toFixed(2)}</div>` : ''}
    ${Number(bill.otherCharges) > 0 ? `<div>Other Charges: ₹${Number(bill.otherCharges).toFixed(2)}</div>` : ''}
    
    <div class="grand-total">
      <span>TOTAL:</span>
      <span>₹${Number(bill.totalAmount).toFixed(2)}</span>
    </div>
    
    <div style="margin-top: 5px;">Paid: ₹${Number(bill.paidAmount).toFixed(2)}</div>
    ${Number(bill.changeAmount) > 0 ? `<div>Change: ₹${Number(bill.changeAmount).toFixed(2)}</div>` : ''}
  </div>

  <div class="footer">
    <div>Payment: ${bill.paymentMethod}</div>
    <div style="margin-top: 10px; font-weight: bold;">Thank you for your visit!</div>
    <div style="font-size: 0.75em; margin-top: 8px; color: #666;">Powered by MediX POS</div>
  </div>

  <script>
    // Auto-print after short delay (optional)
    // setTimeout(() => window.print(), 500);
  </script>
</body>
</html>
  `;
};

export default {
    printBill,
    printBillHtml,
};
