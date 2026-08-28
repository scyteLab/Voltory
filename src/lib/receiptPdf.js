/**
 * receiptPdf.js  \u2014  browser-side PDF generation for receipts
 *
 * Uses html2canvas to snapshot the rendered receipt DOM as an
 * image, then jsPDF to wrap it into a downloadable A4 PDF.
 *
 * Why image-based (not native PDF text):
 *   \u00B7 WYSIWYG \u2014 the download looks EXACTLY like what the
 *     customer saw on screen. Same fonts, same colors, same layout.
 *   \u00B7 One source of truth: the receipt HTML/CSS. Change the
 *     design once, PDF updates automatically. No parallel jsPDF
 *     drawing code to keep in sync.
 *   \u00B7 Nigerian invoicing/accounting practice cares more about
 *     "looks right" than "text is selectable in a PDF reader."
 *
 * Tradeoff: text in the PDF is an image \u2014 not searchable/
 * selectable. If that becomes a real problem, Phase 2 can add
 * native PDF text with jsPDF's autoTable + text APIs.
 *
 * Multi-page handling: long receipts (many items) that exceed a
 * single A4 page get split cleanly across pages. The library
 * handles the offset math \u2014 we just pass the full canvas.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Generate + download a PDF snapshot of the given DOM element.
 *
 * @param {HTMLElement} element   the receipt node (usually
 *                                document.querySelector(".receipt"))
 * @param {string}      filename  e.g. "receipt-VLT-202607301542-TRZX"
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function downloadReceiptAsPdf(element, filename = "receipt") {
  if (!element) {
    return { ok: false, error: "No receipt element to download." };
  }

  try {
    /* Render the element to a canvas at 2x scale for crisp text.
       html2canvas walks the DOM, applies computed styles, and
       paints into an offscreen canvas. */
    const canvas = await html2canvas(element, {
      scale: 2,                    // 2x for higher resolution
      useCORS: true,               // allow cross-origin images (product photos)
      logging: false,              // suppress console noise in production
      backgroundColor: "#ffffff",  // solid white background even if page is dark
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    /* Canvas dimensions in image pixels (2x due to scale above) */
    const imgWidthPx  = canvas.width;
    const imgHeightPx = canvas.height;

    /* A4 page dimensions in mm (jsPDF default unit) */
    const pageWidthMm  = 210;
    const pageHeightMm = 297;

    /* Compute how tall the receipt would be if scaled to page width */
    const scaledHeightMm = (imgHeightPx * pageWidthMm) / imgWidthPx;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    if (scaledHeightMm <= pageHeightMm) {
      /* Fits on one page \u2014 simple case */
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, scaledHeightMm);
    } else {
      /* Multi-page \u2014 slice the image across pages by offsetting Y.
         jsPDF doesn't natively "crop", so we place the full image
         with a negative Y offset on subsequent pages so only the
         relevant slice shows. */
      let remainingHeightMm = scaledHeightMm;
      let yOffsetMm = 0;

      while (remainingHeightMm > 0) {
        pdf.addImage(
          imgData,
          "JPEG",
          0,             // x
          -yOffsetMm,    // y (negative = shifts image up so next slice shows)
          pageWidthMm,
          scaledHeightMm
        );

        remainingHeightMm -= pageHeightMm;
        yOffsetMm         += pageHeightMm;

        if (remainingHeightMm > 0) pdf.addPage();
      }
    }

    /* jsPDF ensures the filename ends in .pdf if missing */
    pdf.save(`${filename}.pdf`);

    return { ok: true };
  } catch (err) {
    console.error("[receiptPdf] failed:", err);
    return {
      ok: false,
      error: err?.message || "Couldn't generate PDF. Please try again.",
    };
  }
}