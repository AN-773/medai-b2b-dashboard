import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, Download, ExternalLink, Loader2, X } from 'lucide-react';
import { TeamMember, teamCardUrl } from '../../services/teamMemberService';

interface TeamCardQrModalProps {
  member: TeamMember | null;
  onClose: () => void;
}

/**
 * Error correction level "H" tolerates ~30% damage. These codes get printed on
 * badges and business cards that scuff, so the extra redundancy is worth the
 * denser pattern.
 */
const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const,
  margin: 2,
  color: { dark: '#0F172A', light: '#FFFFFF' },
};

/** Big enough that a 300 DPI print of a ~3.4cm code stays sharp. */
const PRINT_QR_WIDTH = 1024;

const TeamCardQrModal: React.FC<TeamCardQrModalProps> = ({ member, onClose }) => {
  const [previewDataUrl, setPreviewDataUrl] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [copied, setCopied] = useState(false);

  const cardUrl = member ? teamCardUrl(member.slug) : '';

  useEffect(() => {
    if (!member) {
      setPreviewDataUrl('');
      setRenderError('');
      return;
    }

    let cancelled = false;
    setIsRendering(true);
    setRenderError('');

    QRCode.toDataURL(cardUrl, { ...QR_OPTIONS, width: 512 })
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
  }, [member, cardUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!member) return null;

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
      const dataUrl = await QRCode.toDataURL(cardUrl, { ...QR_OPTIONS, width: PRINT_QR_WIDTH });
      triggerDownload(dataUrl, `${member.slug}-qr.png`);
    } catch (error) {
      console.error('Failed to export QR PNG:', error);
      setRenderError('Unable to export the PNG.');
    }
  };

  const handleDownloadSvg = async () => {
    try {
      // Vector is what a print shop actually wants — it scales to any card size.
      const svg = await QRCode.toString(cardUrl, { ...QR_OPTIONS, type: 'svg' });
      const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      triggerDownload(blobUrl, `${member.slug}-qr.svg`);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to export QR SVG:', error);
      setRenderError('Unable to export the SVG.');
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
    } catch (error) {
      console.error('Failed to copy card URL:', error);
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
            <p className="text-sm font-semibold text-slate-900 truncate">{member.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">Scan to open this contact card</p>
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
                alt={`QR code linking to ${member.name}'s contact card`}
                className="w-48 h-48"
              />
            ) : (
              <p className="text-sm text-slate-500">{renderError || 'No QR code available.'}</p>
            )}
          </div>

          {!member.active && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This card is deactivated — the code resolves to a &quot;not found&quot; page until you
              reactivate it.
            </p>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-1.5 py-1.5">
            <code className="flex-1 min-w-0 text-xs text-slate-600 truncate">{cardUrl}</code>
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
              href={cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open card"
              aria-label="Open card"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ExternalLink size={14} />
            </a>
          </div>

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
            SVG is vector — use it for print. PNG is {PRINT_QR_WIDTH}px, fine for slides and badges.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TeamCardQrModal;
