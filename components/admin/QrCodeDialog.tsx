import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { Button, Dialog, IconButton, InlineAlert, Spinner } from '@/components/ui';

/**
 * Error correction level "H" tolerates ~30% damage. These codes get printed on
 * flyers, badges and business cards that scuff, so the extra redundancy is
 * worth the denser pattern. `dark` is the print ink, not a UI colour.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  color: { dark: '#0F172A', light: '#FFFFFF' },
};

/** Big enough that a 300 DPI print of a ~3.4cm code stays sharp. */
export const PRINT_QR_WIDTH = 1024;

interface QrCodeDialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description: React.ReactNode;
  /** What the code encodes. */
  url: string;
  /** Alt text for the preview image. */
  alt: string;
  /** Download file name without extension, e.g. "welcome-30-promo-qr". */
  fileStem: string;
  /** Accessible name for the "open link" button, e.g. "Open redeem page". */
  openLabel: string;
  /** Amber warnings shown under the preview (why the code may not work yet). */
  warnings?: React.ReactNode[];
  /** One muted line under the link, e.g. remaining redemptions. */
  meta?: React.ReactNode;
  /** Where the PNG is good enough, e.g. "slides and handouts". */
  pngUse: string;
}

const triggerDownload = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** Preview, copy and download a printable QR code for a public link. */
export const QrCodeDialog: React.FC<QrCodeDialogProps> = ({
  open,
  onClose,
  title,
  description,
  url,
  alt,
  fileStem,
  openLabel,
  warnings = [],
  meta,
  pngUse,
}) => {
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !url) {
      setPreviewDataUrl('');
      setRenderError('');
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setRenderError('');

    QRCode.toDataURL(url, { ...QR_OPTIONS, width: 512 })
      .then((dataUrl) => {
        if (!cancelled) setPreviewDataUrl(dataUrl);
      })
      .catch((error) => {
        console.error('Failed to render QR code:', error);
        if (!cancelled) setRenderError('Unable to render the QR code.');
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleDownloadPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, { ...QR_OPTIONS, width: PRINT_QR_WIDTH });
      triggerDownload(dataUrl, `${fileStem}.png`);
    } catch (error) {
      console.error('Failed to export QR PNG:', error);
      setRenderError('Unable to export the PNG.');
    }
  };

  const handleDownloadSvg = async () => {
    try {
      // Vector is what a print shop actually wants — it scales to any size.
      const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' });
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      triggerDownload(blobUrl, `${fileStem}.svg`);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to export QR SVG:', error);
      setRenderError('Unable to export the SVG.');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy link:', error);
      setRenderError('Unable to copy the link.');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button icon={Download} onClick={() => void handleDownloadPng()} disabled={!previewDataUrl}>
            Download PNG
          </Button>
          <Button
            variant="primary"
            icon={Download}
            onClick={() => void handleDownloadSvg()}
            disabled={!previewDataUrl}
          >
            Download SVG
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex min-h-[232px] items-center justify-center rounded-xl border border-stone-200 bg-white p-4">
          {isRendering ? (
            <Spinner label="Rendering…" />
          ) : previewDataUrl ? (
            <img src={previewDataUrl} alt={alt} className="h-52 w-52" />
          ) : (
            <p className="text-sm text-stone-500">No QR code available.</p>
          )}
        </div>

        {warnings.map((warning, index) => (
          <InlineAlert key={index} tone="warning" className="text-[13px] leading-5">
            {warning}
          </InlineAlert>
        ))}

        <div>
          <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 py-1 pl-3 pr-1">
            <code className="min-w-0 flex-1 truncate text-xs text-stone-600" title={url}>
              {url}
            </code>
            <IconButton
              icon={copied ? Check : Copy}
              label={copied ? 'Link copied' : 'Copy link'}
              size="sm"
              onClick={() => void handleCopyUrl()}
              className={copied ? 'text-brand-700 hover:text-brand-700' : undefined}
            />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={openLabel}
              title={openLabel}
              className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          {meta && <p className="mt-1.5 text-xs text-stone-500">{meta}</p>}
        </div>

        {renderError && <InlineAlert>{renderError}</InlineAlert>}

        <p className="text-xs leading-5 text-stone-500">
          SVG is vector — use it for print. PNG is {PRINT_QR_WIDTH}px, fine for {pngUse}.
        </p>
      </div>
    </Dialog>
  );
};
