/**
 * Utility for downloading images to the user's device local storage.
 * Handles both direct Blob downloads, Canvas-based conversions for CORS safety,
 * and standard anchor-driven download triggers.
 */

export interface DownloadResult {
  success: boolean;
  message: string;
  filename: string;
}

/**
 * Downloads an image file directly to the user's device.
 * @param url The image URL (HTTP/HTTPS, Data URI, or Blob URI)
 * @param preferredFilename The desired filename for saving
 */
export async function downloadImageToDevice(
  url: string,
  preferredFilename: string = 'rush-running-image.png',
  displayTitle?: string
): Promise<DownloadResult> {
  // Ensure appropriate extension
  let filename = preferredFilename.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!filename.match(/\.(png|jpg|jpeg|webp|svg)$/i)) {
    filename += '.png';
  }

  // Helper to trigger browser download anchor
  const triggerAnchorDownload = (href: string, downloadName: string) => {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = downloadName;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  // Attempt 1: Fetch as Blob (preserves original bytes and clean filename)
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      triggerAnchorDownload(blobUrl, filename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      
      notifyDownloadEvent(filename, true);
      return {
        success: true,
        message: `Imagem salva com sucesso como "${filename}"!`,
        filename,
      };
    }
  } catch (fetchErr) {
    console.warn('Direct fetch failed, falling back to Canvas rendering:', fetchErr);
  }

  // Attempt 2: Load into Image element and render to off-screen Canvas
  try {
    const result = await new Promise<DownloadResult>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 800;
          canvas.height = img.naturalHeight || img.height || 600;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            triggerAnchorDownload(url, filename);
            notifyDownloadEvent(filename, true);
            resolve({
              success: true,
              message: `Download iniciado para "${filename}"`,
              filename,
            });
            return;
          }

          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const blobUrl = URL.createObjectURL(blob);
                triggerAnchorDownload(blobUrl, filename);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
                notifyDownloadEvent(filename, true);
                resolve({
                  success: true,
                  message: `Imagem salva no armazenamento local como "${filename}"!`,
                  filename,
                });
              } else {
                triggerAnchorDownload(url, filename);
                notifyDownloadEvent(filename, true);
                resolve({
                  success: true,
                  message: `Download iniciado para "${filename}"`,
                  filename,
                });
              }
            },
            'image/png',
            1.0
          );
        } catch (canvasErr) {
          console.warn('Canvas export failed, falling back to direct link:', canvasErr);
          triggerAnchorDownload(url, filename);
          notifyDownloadEvent(filename, true);
          resolve({
            success: true,
            message: `Download iniciado para "${filename}"`,
            filename,
          });
        }
      };

      img.onerror = () => {
        // Fallback: direct anchor
        triggerAnchorDownload(url, filename);
        notifyDownloadEvent(filename, true);
        resolve({
          success: true,
          message: `Download solicitado para "${filename}"`,
          filename,
        });
      };

      img.src = url;
    });

    return result;
  } catch (err) {
    console.error('Download error:', err);
    triggerAnchorDownload(url, filename);
    notifyDownloadEvent(filename, true);
    return {
      success: true,
      message: `Download iniciado para "${filename}"`,
      filename,
    };
  }
}

// Global CustomEvent notification helper
function notifyDownloadEvent(filename: string, success: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('rush-image-downloaded', {
        detail: { filename, success, timestamp: Date.now() },
      })
    );
  }
}
