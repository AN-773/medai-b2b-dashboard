import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, Loader2, X } from 'lucide-react';
import { PromoCode, getPromoStatus, promoRedeemUrl } from '../../services/promoCodeService';

interface PromoCodeQrModalProps {
  promo: PromoCode | null;
  onClose: () => void;
}

/**
 * Error correction level "H" tolerates ~30% damage. These codes get printed on
 * flyers, posters and conference handouts that scuff, so the extra redundancy is
 * worth the denser pattern.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  color: { dark: '#0F172A', light: '#FFFFFF' },
};

/** Big enough that a 300 DPI print of a ~3.4cm code stays sharp. */
const PRINT_QR_WIDTH = 1024;

/**
 * Why each dead state is worth blocking on before printing: a code that cannot
 * redeem produces a QR that fails silently in the scanner's hand, and reprinting
 * a flyer run is expensive.
 */
const DEAD_STATE_WARNINGS: Record<string, string> = {
  Inactive: 'This code is deactivated — scanning it will fail until you reactivate it.',
  Expired: 'This code has passed its expiry date — scanning it will fail.',
  Exhausted: 'This code has hit its redemption limit — scanning it will fail until you raise the cap.',
};

const PromoCodeQrModal: React.FC<PromoCodeQrModalProps> = ({ promo, onClose }) => {
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [copied, setCopied] = useState(false);

  const redeemUrl = promo ? promoRedeemUrl(promo.code) : '';

  useEffect(() => {
    if (!promo) {
      setPreviewDataUrl('');
      setRenderError('');
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setRenderError('');

    QRCode.toDataURL(redeemUrl, { ...QR_OPTIONS, width: 512 })
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
  }, [promo, redeemUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!promo) return null;

  const status = getPromoStatus(promo);
  const deadStateWarning = DEAD_STATE_WARNINGS[status];
  const remainingUses =
    promo.maxRedemptions > 0 ? promo.maxRedemptions - promo.redemptionCount : null;
  const fileStem = promo.code.toLowerCase();

  const triggerDownload = (href: string, filename: string) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(redeemUrl, { ...QR_OPTIONS, width: PRINT_QR_WIDTH });
      triggerDownload(dataUrl, `${fileStem}-promo-qr.png`);
    } catch (error) {
      console.error('Failed to export QR PNG:', error);
      setRenderError('Unable to export the PNG.');
    }
  };

  const handleDownloadSvg = async () => {
    try {
      // Vector is what a print shop actually wants — it scales to any poster size.
      const svg = await QRCode.toString(redeemUrl, { ...QR_OPTIONS, type: 'svg' });
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      triggerDownload(blobUrl, `${fileStem}-promo-qr.svg`);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to export QR SVG:', error);
      setRenderError('Unable to export the SVG.');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(redeemUrl);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy redeem URL:', error);
      setRenderError('Unable to copy the link.');
    }
  };

  const ghostButton =
    'inline-flex items-center justify-center gap-2 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden font-['Inter']"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-sm font-mono font-bold text-slate-900 truncate">{promo.code}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan to redeem {promo.freeDays} free day{promo.freeDays === 1 ? '' : 's'} of Pro
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 min-h-[236px]">
            {isRendering ? (
              <Loader2 size={24} className="animate-spin text-slate-300" />
            ) : previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt={`QR code to redeem promo code ${promo.code}`}
                className="w-48 h-48"
              />
            ) : (
              <p className="text-sm text-slate-500">{renderError || 'No QR code available.'}</p>
            )}
          </div>

          {deadStateWarning && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {deadStateWarning}
            </p>
          )}

          {/* A printed code is public and copyable forever, so an uncapped one is
              worth flagging before it goes out the door. */}
          {promo.maxRedemptions === 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This code has no redemption limit. Anyone who photographs the printed code can share
              it — set a max redemption count before distributing it.
            </p>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-1.5 py-1.5">
            <code className="flex-1 min-w-0 text-xs text-slate-600 truncate">{redeemUrl}</code>
            <button
              type="button"
              onClick={handleCopyUrl}
              title="Copy link"
              aria-label="Copy link"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
            <a
              href={redeemUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open redeem page"
              aria-label="Open redeem page"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          <p className="text-xs text-slate-500">
            {remainingUses === null
              ? `${promo.redemptionCount} redeemed so far`
              : `${remainingUses} of ${promo.maxRedemptions} redemptions left`}
          </p>

          {renderError && <p className="text-xs text-rose-600">{renderError}</p>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={!previewDataUrl}
              className={ghostButton}
            >
              <Download size={15} />
              SVG
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!previewDataUrl}
              className={ghostButton}
            >
              <Download size={15} />
              PNG
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            SVG is vector — use it for print. PNG is {PRINT_QR_WIDTH}px, fine for slides and
            handouts.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PromoCodeQrModal;
