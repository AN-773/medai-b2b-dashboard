import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button, Dialog, Field, InlineAlert } from '@/components/ui';

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

  const isAtDefault = zoom === 1 && crop.x === 0 && crop.y === 0;

  return (
    <Dialog
      open={Boolean(imageSrc)}
      onClose={handleCancel}
      dismissible={!isRendering}
      width="max-w-lg"
      title="Position the photo"
      description="Drag to move. Scroll or use the slider to zoom."
      footer={
        <>
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={reset}
            disabled={isRendering || isAtDefault}
            className="mr-auto -ml-2"
          >
            Reset
          </Button>
          <Button variant="ghost" onClick={handleCancel} disabled={isRendering}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={!croppedArea}
            loading={isRendering}
          >
            Use photo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative h-80 overflow-hidden rounded-lg bg-stone-900">
          {imageSrc && (
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
          )}
        </div>

        <Field
          label="Zoom"
          description={`Saved as a ${OUTPUT_SIZE}×${OUTPUT_SIZE} square — the circle shows what's visible on the card.`}
        >
          {(id) => (
            <div className="flex items-center gap-3">
              <ZoomOut size={15} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
              <input
                id={id}
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="h-1 flex-1 cursor-pointer accent-stone-900"
              />
              <ZoomIn size={15} className="flex-shrink-0 text-stone-400" aria-hidden="true" />
            </div>
          )}
        </Field>

        {error && <InlineAlert onDismiss={() => setError('')}>{error}</InlineAlert>}
      </div>
    </Dialog>
  );
};

export default PhotoCropModal;
