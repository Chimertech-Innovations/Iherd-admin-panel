/**
 * Image Processing & Validation Utilities for iHerd Admin
 * - 1:1 Square Crop & Dynamic Compression for Marketplace Products & Combos (1st <= 20KB, others <= 1MB)
 * - 485x210 Dimension Verification & Auto-Fit for App Banners
 */

export interface ProcessedImageResult {
  file: File;
  base64: string;
  width: number;
  height: number;
  sizeKB: number;
  aspectRatio: string;
  originalSizeKB: number;
}

export interface BannerProcessedResult {
  file: File;
  base64: string;
  width: number;
  height: number;
  isExact: boolean;
  sizeKB: number;
}

/**
 * Validates that a file is a supported image format (PNG, JPEG, WebP)
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: "No file selected." };
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  const isTypeValid = validTypes.includes(file.type.toLowerCase()) || file.type.startsWith("image/");
  if (!isTypeValid) {
    return {
      valid: false,
      error: `Unsupported file format (${file.type || file.name.split(".").pop() || "unknown"}). Please upload only image files (PNG, JPEG, WebP).`,
    };
  }
  return { valid: true };
}

/**
 * Center-crops an image into a 1:1 square canvas and compresses it to meet target KB limit.
 * - Primary thumbnail: target <= 20 KB (auto-compressed to ~20 KB for blazing fast mobile app performance)
 * - Additional images: target <= 80 KB
 */
export async function processSquareImage(
  file: File,
  isPrimaryThumbnail: boolean = false,
  overrideMaxKB?: number
): Promise<ProcessedImageResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const originalSizeKB = Math.round(file.size / 1024);
  const targetMaxKB = overrideMaxKB ?? (isPrimaryThumbnail ? 20 : 80);
  const targetDim = isPrimaryThumbnail ? 400 : 600; // 400x400 for <=20KB, 600x600 for additional images

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // Center-crop to 1:1 square
        const cropSize = Math.min(srcW, srcH);
        const startX = (srcW - cropSize) / 2;
        const startY = (srcH - cropSize) / 2;

        let canvas = document.createElement("canvas");
        canvas.width = targetDim;
        canvas.height = targetDim;
        let ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Unable to create canvas rendering context");
        }

        // High quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, startX, startY, cropSize, cropSize, 0, 0, targetDim, targetDim);

        // Iterative compression to satisfy targetMaxKB
        let quality = 0.82;
        let mime = "image/webp";
        let dataUrl = canvas.toDataURL(mime, quality);

        // Fallback to jpeg if browser doesn't support webp encoding
        if (!dataUrl.startsWith("data:image/webp")) {
          mime = "image/jpeg";
          dataUrl = canvas.toDataURL(mime, quality);
        }

        let base64Bytes = Math.round((dataUrl.length * 3) / 4);
        let currentKB = Math.round(base64Bytes / 1024);

        // Reduce quality iteratively until within target limit
        let attempts = 0;
        while (currentKB > targetMaxKB && quality > 0.15 && attempts < 10) {
          attempts++;
          quality -= 0.08;
          dataUrl = canvas.toDataURL(mime, Math.max(0.12, quality));
          base64Bytes = Math.round((dataUrl.length * 3) / 4);
          currentKB = Math.round(base64Bytes / 1024);
        }

        // If still over 20KB for primary image, scale canvas resolution down to 320x320 and 280x280
        if (isPrimaryThumbnail && currentKB > targetMaxKB) {
          const smallCanvas = document.createElement("canvas");
          smallCanvas.width = 300;
          smallCanvas.height = 300;
          const sCtx = smallCanvas.getContext("2d");
          if (sCtx) {
            sCtx.imageSmoothingEnabled = true;
            sCtx.imageSmoothingQuality = "high";
            sCtx.drawImage(canvas, 0, 0, 300, 300);
            dataUrl = smallCanvas.toDataURL(mime, 0.60);
            base64Bytes = Math.round((dataUrl.length * 3) / 4);
            currentKB = Math.round(base64Bytes / 1024);
            canvas = smallCanvas;
          }
        }

        // Final safety pass for 20KB limit
        if (isPrimaryThumbnail && currentKB > targetMaxKB) {
          dataUrl = canvas.toDataURL(mime, 0.40);
          base64Bytes = Math.round((dataUrl.length * 3) / 4);
          currentKB = Math.round(base64Bytes / 1024);
        }

        // Convert base64 back to a File object
        const arr = dataUrl.split(",");
        const mimeMatch = arr[0].match(/:(.*?);/);
        const finalMime = mimeMatch ? mimeMatch[1] : mime;
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }

        const ext = finalMime.includes("webp") ? "webp" : "jpg";
        const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || "product-image";
        const processedFile = new File([u8arr], `${baseName}_1x1.${ext}`, { type: finalMime });

        resolve({
          file: processedFile,
          base64: dataUrl,
          width: targetDim,
          height: targetDim,
          sizeKB: currentKB,
          aspectRatio: "1:1",
          originalSizeKB,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image file. Please check file integrity."));
    };

    img.src = objectUrl;
  });
}

/**
 * Validates and auto-fits Banner image to 485 × 210 px
 */
export async function processBannerImage(
  file: File,
  autoFitToExactDimensions: boolean = false
): Promise<BannerProcessedResult> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      const isExact = naturalW === 485 && naturalH === 210;

      if (!autoFitToExactDimensions && isExact) {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            file,
            base64: reader.result as string,
            width: naturalW,
            height: naturalH,
            isExact: true,
            sizeKB: Math.round(file.size / 1024),
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // Auto-fit to 485 × 210 canvas
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 485;
        canvas.height = 210;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Unable to create banner canvas context");
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Fit cover mode into 485x210
        const targetAspect = 485 / 210;
        const srcAspect = naturalW / naturalH;

        let renderW = 485;
        let renderH = 210;
        let offsetX = 0;
        let offsetY = 0;

        if (srcAspect > targetAspect) {
          // Source is wider than banner
          renderH = 210;
          renderW = Math.round(210 * srcAspect);
          offsetX = Math.round((485 - renderW) / 2);
        } else {
          // Source is taller than banner
          renderW = 485;
          renderH = Math.round(485 / srcAspect);
          offsetY = Math.round((210 - renderH) / 2);
        }

        ctx.drawImage(img, offsetX, offsetY, renderW, renderH);

        const dataUrl = canvas.toDataURL("image/webp", 0.9);
        const arr = dataUrl.split(",");
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }

        const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || "banner";
        const processedFile = new File([u8arr], `${baseName}_485x210.webp`, { type: "image/webp" });

        resolve({
          file: processedFile,
          base64: dataUrl,
          width: 485,
          height: 210,
          isExact: true,
          sizeKB: Math.round((dataUrl.length * 3) / 4 / 1024),
        });
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode banner image."));
    };

    img.src = objectUrl;
  });
}
