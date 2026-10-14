/**
 * QR Code & Asset Export Helper Module
 * Provides PNG, SVG, Text, and ZIP generation and download helpers
 */

export const QrHelper = {
  /**
   * Render a QR code into a DOM element container
   * Returns a promise resolving with { pngDataUrl, svgString }
   */
  async renderQr(containerEl, text, size = 180) {
    if (typeof containerEl === "string") {
      containerEl = document.querySelector(containerEl);
    }
    if (!containerEl) return null;

    containerEl.innerHTML = "";

    // If QRCode library is available
    if (window.QRCode) {
      return new Promise((resolve) => {
        new window.QRCode(containerEl, {
          text: text,
          width: size,
          height: size,
          colorDark: "#000000",
          colorLight: "#FFFFFF",
          correctLevel: window.QRCode.CorrectLevel.M
        });

        // Give QRCode.js a moment to paint to canvas
        setTimeout(() => {
          const canvas = containerEl.querySelector("canvas");
          const img = containerEl.querySelector("img");
          let pngDataUrl = "";

          if (canvas) {
            pngDataUrl = canvas.toDataURL("image/png");
          } else if (img && img.src) {
            pngDataUrl = img.src;
          }

          // Build a basic SVG representation
          const svgString = QrHelper.buildSvgFromCanvas(canvas, size, text);

          resolve({ pngDataUrl, svgString });
        }, 80);
      });
    } else {
      // Fallback: simple QR image via backend or placeholder
      const backendQrUrl = `http://localhost:8080/api/shops/1/qr/login?format=png`;
      const img = document.createElement("img");
      img.src = backendQrUrl;
      img.className = "w-full h-full object-contain";
      containerEl.appendChild(img);
      return { pngDataUrl: backendQrUrl, svgString: "" };
    }
  },

  buildSvgFromCanvas(canvas, size, text) {
    if (!canvas) {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><text x="10" y="20">${text}</text></svg>`;
    }
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height).data;

    let paths = "";
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const isDark = (r + g + b) / 3 < 128;
        if (isDark) {
          paths += `M${x} ${y}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${width} ${height}"><path fill="#FFFFFF" d="M0 0h${width}v${height}H0z"/><path fill="#000000" d="${paths}"/></svg>`;
  },

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  },

  downloadPng(dataUrlOrBlob, filename = "qr-code.png") {
    if (typeof dataUrlOrBlob === "string") {
      const a = document.createElement("a");
      a.href = dataUrlOrBlob;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      QrHelper.downloadBlob(dataUrlOrBlob, filename);
    }
  },

  downloadSvg(svgString, filename = "qr-code.svg") {
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    QrHelper.downloadBlob(blob, filename);
  },

  downloadText(text, filename = "links.txt") {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    QrHelper.downloadBlob(blob, filename);
  },

  async downloadZip({ filename = "salon-qr-codes.zip", shopName, slug, loginUrl, bookingUrl, loginPng, bookingPng, loginSvg, bookingSvg, shopId }) {
    if (window.JSZip) {
      try {
        const zip = new window.JSZip();

        // 1. Login QR PNG
        if (loginPng && loginPng.startsWith("data:image/png;base64,")) {
          const b64Data = loginPng.replace(/^data:image\/png;base64,/, "");
          zip.file(`${slug}-login-qr.png`, b64Data, { base64: true });
        }

        // 2. Booking QR PNG
        if (bookingPng && bookingPng.startsWith("data:image/png;base64,")) {
          const b64Data = bookingPng.replace(/^data:image\/png;base64,/, "");
          zip.file(`${slug}-booking-qr.png`, b64Data, { base64: true });
        }

        // 3. Login QR SVG
        if (loginSvg) {
          zip.file(`${slug}-login-qr.svg`, loginSvg);
        }

        // 4. Booking QR SVG
        if (bookingSvg) {
          zip.file(`${slug}-booking-qr.svg`, bookingSvg);
        }

        // 5. Links text file
        const linksTxt = `=====================================================
Salon Name: ${shopName || "Barber Shop"}
Salon Slug: ${slug}
Generated At: ${new Date().toISOString()}
=====================================================

1. PRIVATE SALON LOGIN & DASHBOARD LINK:
${loginUrl}

2. PUBLIC CUSTOMER BOOKING LINK:
${bookingUrl}

Barber SaaS Platform • Saudi Arabia & GCC
`;
        zip.file(`${slug}-links.txt`, linksTxt);

        const content = await zip.generateAsync({ type: "blob" });
        QrHelper.downloadBlob(content, filename);
        return;
      } catch (err) {
        console.warn("JSZip failed, falling back to backend ZIP endpoint", err);
      }
    }

    // Backend fallback
    if (shopId) {
      window.location.href = `http://localhost:8080/api/shops/${shopId}/qr/zip`;
    }
  },

  async copyText(text, buttonElement) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (buttonElement) {
        const originalText = buttonElement.innerHTML;
        buttonElement.innerHTML = `<span>✓ Copied!</span>`;
        buttonElement.classList.add("bg-emerald-600", "text-white");
        setTimeout(() => {
          buttonElement.innerHTML = originalText;
          buttonElement.classList.remove("bg-emerald-600", "text-white");
        }, 2000);
      }
      return true;
    } catch (err) {
      console.error("Copy failed:", err);
      return false;
    }
  }
};
