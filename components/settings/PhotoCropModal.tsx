import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { Area } from 'react-easy-crop';
import { Loader2, Maximize2, RotateCcw, X, ZoomIn } from 'lucide-react';

interface PhotoCropModalProps {
  /** Data URI of the source image, or null when the modal is closed. */
  imageSrc: string | null;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}

/**
 * Avatars render at 96px on the public card and 48px in this dashboard, so 512
 * covers a 3x retina screen with headroom and still encodes to well under the
 * backend's 512KB ceiling.
 */
const OUTPUT_SIZE = 512;

const JPEG_QUALITY = 0.85;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Could not read that image.')));
    image.src = src;
  });

/**
 * Bakes the selected region into a square JPEG. The crop is burned into the
 * stored bytes rather than applied as CSS object-position, because the same
 * image is embedded in the downloadable vCard — a styling-only fix would leave
 * the contact saved on someone's phone cropped wrong.
 */
const renderCrop = async (imageSrc: string, area: Area): Promise<string> => {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the image.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  // JPEG has no alpha channel, so a transparent PNG would otherwise composite
  // onto black. Paint white first.
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

const PhotoCropModal: React.FC<PhotoCropModalProps> = ({ imageSrc, onCancel, onCropped }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState('');

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const reset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedArea) return;

    setIsRendering(true);
    setError('');

    try {
      onCropped(await renderCrop(imageSrc, croppedArea));
      reset();
    } catch (cropError: any) {
      console.error('Failed to crop photo:', cropError);
      setError(cropError?.message || 'Could not crop that image.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleCancel = () => {
    reset();
    setError('');
    onCancel();
  };

  if (!imageSrc) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-['Inter']">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-900">Position the photo</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag to move, scroll or use the slider to zoom.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative h-72 bg-slate-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            restrictPosition
            minZoom={1}
            maxZoom={4}
            zoomSpeed={0.2}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <ZoomIn size={15} className="text-slate-400 shrink-0" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label="Zoom"
              className="flex-1 h-1 accent-slate-900 cursor-pointer"
            />
            <button
              type="button"
              onClick={reset}
              title="Reset"
              aria-label="Reset"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 shrink-0"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Maximize2 size={12} className="shrink-0" />
            Saved as a {OUTPUT_SIZE}×{OUTPUT_SIZE} square — the circle shows the visible area.
          </p>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isRendering || !croppedArea}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isRendering && <Loader2 size={15} className="animate-spin" />}
              Use photo
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PhotoCropModal;
