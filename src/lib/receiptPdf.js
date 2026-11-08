/**
 * receiptPdf.js  —  browser-side A4 PDF of the rendered receipt
 *
 * html2canvas snapshots the receipt DOM (the same ReceiptTemplate the
 * customer sees), jsPDF wraps it into A4 pages. WYSIWYG: one layout to
 * maintain. Text in the PDF is an image (not selectable).
 *
 * Sharpness: rendered at 3× (≈290 dpi across A4); the logo and QR code
 * are inline SVG, so they are drawn at that resolution, not upscaled.
 *
 * Pagination: pages break only BETWEEN items-table rows or between
 * whole blocks marked data-pdf-block (header, details, totals, footer),
 * never through a line of text. When a page breaks inside the items
 * table, the table header is repeated at the top of the next page.
 */

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const MARGIN_MM = 10;      // top/bottom margin on every page
const SIDE_MM = 8;         // left/right margin
const SCALE = 3;
const A4_PX = 794;         // 210mm at 96dpi — the receipt's design width

/** Element box relative to the receipt, in canvas pixels. */
function boxOf(el, origin) {
  const r = el.getBoundingClientRect();
  return { top: (r.top - origin.top) * SCALE, bottom: (r.bottom - origin.top) * SCALE };
}

/**
 * Generate + download a PDF of the given receipt element.
 * @returns {Promise<{ok: boolean, pages?: number, error?: string}>}
 */
export async function downloadReceiptAsPdf(element, filename = "receipt") {
  if (!element) return { ok: false, error: "No receipt element to download." };

  try {
    // Lay the copy out at A4 width (even on a phone), then measure where
    // pages may end (canvas px) and whether that point is between two
    // items-table rows (→ repeat the header on the next page).
    let breaks = [];
    let theadBox = null;
    const canvas = await html2canvas(element, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: A4_PX + 40,
      onclone: (_doc, el) => {
        Object.assign(el.style, {
          width: `${A4_PX}px`, maxWidth: `${A4_PX}px`, margin: "0", boxShadow: "none", borderRadius: "0",
        });
        const origin = el.getBoundingClientRect();
        const rows = [...el.querySelectorAll(".receipt__items tbody tr")];
        breaks = [
          ...[...el.querySelectorAll("[data-pdf-block]")].map((b) => ({ y: boxOf(b, origin).top, inTable: false })),
          ...rows.slice(0, -1).map((tr) => ({ y: boxOf(tr, origin).bottom, inTable: true })),
        ].sort((a, b) => a.y - b.y);
        const thead = el.querySelector(".receipt__items thead");
        theadBox = thead ? boxOf(thead, origin) : null;
      },
    });

    const contentWmm = PAGE_W_MM - 2 * SIDE_MM;
    const pxPerMm = canvas.width / contentWmm;
    const pageContentPx = (PAGE_H_MM - 2 * MARGIN_MM) * pxPerMm;
    const theadPx = theadBox ? theadBox.bottom - theadBox.top : 0;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    let y = 0;
    let repeatHeader = false;
    let pages = 0;

    while (y < canvas.height - 1) {
      const room = pageContentPx - (repeatHeader ? theadPx : 0);
      let end;
      let nextRepeat = false;
      if (canvas.height - y <= room) {
        end = canvas.height;
      } else {
        // Last allowed break that fits, but not one that leaves the page
        // almost empty (then cut at the limit instead).
        const fit = breaks.filter((b) => b.y > y + room * 0.25 && b.y <= y + room).pop();
        end = fit ? fit.y : y + room;
        nextRepeat = fit ? fit.inTable : false;
      }

      // Compose this page: optional repeated table header, then the slice.
      const sliceH = Math.ceil(end - y);
      const page = document.createElement("canvas");
      page.width = canvas.width;
      page.height = Math.ceil(sliceH + (repeatHeader ? theadPx : 0));
      const ctx = page.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, page.width, page.height);
      let dy = 0;
      if (repeatHeader && theadBox) {
        ctx.drawImage(canvas, 0, theadBox.top, canvas.width, theadPx, 0, 0, canvas.width, theadPx);
        dy = theadPx;
      }
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, dy, canvas.width, sliceH);

      if (pages > 0) pdf.addPage();
      pdf.addImage(page.toDataURL("image/jpeg", 0.92), "JPEG", SIDE_MM, MARGIN_MM, contentWmm, page.height / pxPerMm);
      pages += 1;

      y = end;
      repeatHeader = nextRepeat;
    }

    pdf.save(`${filename}.pdf`);
    return { ok: true, pages };
  } catch (err) {
    console.error("[receiptPdf] failed:", err);
    return { ok: false, error: err?.message || "Couldn't generate PDF. Please try again." };
  }
}
