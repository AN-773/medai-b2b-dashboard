import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Check,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Search,
  Upload,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { testsService } from '../services/testsService';
import { OpenIImage } from '../types/TestsServiceTypes';
import {
  Button,
  Dialog,
  EmptyState,
  Field,
  InlineAlert,
  Input,
  SearchInput,
  SegmentedControl,
  cn,
} from '@/components/ui';

export type MultimediaType = 'image' | 'hyperlink' | 'video';

export interface MultimediaSelection {
  url: string;
  fileId?: string;
  type: MultimediaType;
}

interface ImageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (data: MultimediaSelection) => void;
}

/** Video is not supported yet, so only images and links are offered. */
type MediaTab = Exclude<MultimediaType, 'video'>;

const openIUrl = (img: OpenIImage) =>
  img.imgLarge
    ? `https://openi.nlm.nih.gov${img.imgLarge}`
    : `https://openi.nlm.nih.gov${img.imageqsurl}`;

const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({ isOpen, onClose, onImageSelected }) => {
  const [activeTab, setActiveTab] = useState<MediaTab>('image');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OpenIImage[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [hyperlinkUrl, setHyperlinkUrl] = useState('');
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('image');
      setSearchQuery('');
      setSearchResults([]);
      setHasSearched(false);
      setIsUploading(false);
      setIsDragActive(false);
      setHyperlinkUrl('');
      setSelectedImageIdx(null);
      setUploadingImageIdx(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    setSelectedImageIdx(null);
    setError(null);

    try {
      const response = await testsService.searchOpenIImages(searchQuery.trim());
      if (response && response.list) {
        setSearchResults(response.list);
      }
    } catch (error) {
      console.error("Failed to search OpenI images:", error);
      setError("Couldn't search the image library. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (PNG, JPG, GIF…).');
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);

      const uploadedFile = await testsService.uploadFile(compressedFile);
      onImageSelected({ url: uploadedFile.url, fileId: uploadedFile.id, type: 'image' });
      onClose();
    } catch (error) {
      console.error("Failed to upload image:", error);
      setError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleOpenIImageSelect = async (imageUrl: string, idx: number) => {
    setUploadingImageIdx(idx);
    setError(null);
    try {
      const uploadedFile = await testsService.downloadOpenIImage(imageUrl);
      onImageSelected({ url: uploadedFile.url, fileId: uploadedFile.id, type: 'image' });
      onClose();
    } catch (error) {
      console.error('Failed to download OpenI image:', error);
      setError("Couldn't add that image. Try another one.");
    } finally {
      setUploadingImageIdx(null);
    }
  };

  const confirmSelectedImage = () => {
    if (selectedImageIdx === null || uploadingImageIdx !== null) return;
    const image = searchResults[selectedImageIdx];
    if (image) void handleOpenIImageSelect(openIUrl(image), selectedImageIdx);
  };

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  };

  const handleHyperlinkSubmit = () => {
    if (!isValidUrl(hyperlinkUrl)) return;
    onImageSelected({ url: hyperlinkUrl.trim(), type: 'hyperlink' });
    onClose();
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore leaving into a child element of the drop zone.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  }, [isDragActive]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const isBusy = isUploading || uploadingImageIdx !== null;
  const urlInvalid = Boolean(hyperlinkUrl.trim()) && !isValidUrl(hyperlinkUrl);

  let results: React.ReactNode;
  if (isSearching) {
    results = (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-stone-500">
        <Loader2 size={16} className="animate-spin text-brand-600" aria-hidden="true" />
        Searching the National Library of Medicine…
      </div>
    );
  } else if (hasSearched && searchResults.length === 0) {
    results = (
      <EmptyState
        compact
        icon={Search}
        title="No images found"
        description={`Nothing matched “${searchQuery}”. Try different keywords, or upload your own image.`}
        className="h-64"
      />
    );
  } else if (searchResults.length > 0) {
    results = (
      <ul
        aria-label="Search results"
        className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-3 md:grid-cols-4"
      >
        {searchResults.map((img, i) => {
          const selected = selectedImageIdx === i;
          const isThisUploading = uploadingImageIdx === i;
          return (
            <li key={img.uid + i}>
              <button
                type="button"
                aria-pressed={selected}
                disabled={isBusy && !isThisUploading}
                onClick={() => setSelectedImageIdx(i)}
                onDoubleClick={() => {
                  if (!isBusy) void handleOpenIImageSelect(openIUrl(img), i);
                }}
                className={cn(
                  'group flex w-full flex-col overflow-hidden rounded-lg border bg-white text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-40',
                  selected
                    ? 'border-brand-500 ring-2 ring-brand-500 ring-offset-2'
                    : 'border-stone-200 hover:border-stone-300 hover:shadow-card',
                )}
              >
                <span className="relative block aspect-square overflow-hidden bg-stone-100">
                  <img
                    src={openIUrl(img)}
                    alt={img.title || 'Open-i image'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {selected && !isThisUploading && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-card">
                      <Check size={14} strokeWidth={3} aria-hidden="true" />
                    </span>
                  )}
                  {isThisUploading && (
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/75">
                      <Loader2 size={20} className="animate-spin text-brand-600" aria-hidden="true" />
                      <span className="text-xs font-medium text-stone-700">Adding…</span>
                    </span>
                  )}
                </span>
                <span className="block border-t border-stone-100 px-2.5 py-2">
                  <span className="line-clamp-2 text-xs text-stone-700" title={img.title}>
                    {img.title || 'Untitled'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  } else {
    results = (
      <EmptyState
        compact
        icon={ImageIcon}
        title="Find a medical image"
        description="Search the NLM Open-i library above, upload a file, or drop an image anywhere here."
        className="h-64"
      />
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      dismissible={!isBusy}
      width="max-w-3xl"
      title="Add media"
      description="Attach an image or link it to an external resource."
      footer={
        activeTab === 'image' ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmSelectedImage}
              disabled={selectedImageIdx === null || isUploading}
              loading={uploadingImageIdx !== null}
            >
              Use image
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon={LinkIcon} onClick={handleHyperlinkSubmit} disabled={!isValidUrl(hyperlinkUrl)}>
              Add link
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl<MediaTab>
            label="Media type"
            value={activeTab}
            onChange={(tab) => {
              setActiveTab(tab);
              setError(null);
            }}
            options={[
              { value: 'image', label: 'Image' },
              { value: 'hyperlink', label: 'Link' },
            ]}
          />
          <span className="text-xs text-stone-400">Video support is coming soon.</span>
        </div>

        {error && (
          <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>
        )}

        {activeTab === 'image' && (
          <>
            <div className="flex flex-wrap gap-2">
              <form onSubmit={handleSearch} role="search" className="flex min-w-[16rem] flex-1 gap-2">
                <SearchInput
                  value={searchQuery}
                  onChange={(value) => {
                    setHasSearched(false);
                    setSearchQuery(value);
                  }}
                  placeholder="Search Open-i, e.g. chest x-ray"
                  aria-label="Search medical images"
                  className="min-w-0 flex-1"
                />
                <Button type="submit" variant="secondary" disabled={isSearching || !searchQuery.trim()}>
                  Search
                </Button>
              </form>
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileInputChange}
                accept="image/*"
                aria-label="Upload an image"
                className="hidden"
              />
              <Button
                variant="secondary"
                icon={Upload}
                onClick={() => fileInputRef.current?.click()}
                loading={isUploading}
                disabled={uploadingImageIdx !== null}
              >
                {isUploading ? 'Uploading…' : 'Upload'}
              </Button>
            </div>

            {/* Results & drop zone */}
            <div
              className="custom-scrollbar relative -mx-1 max-h-[min(52vh,520px)] overflow-y-auto rounded-lg"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragActive && (
                <div className="pointer-events-none absolute inset-1 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-500 bg-brand-50/90">
                  <Upload size={22} className="text-brand-700" aria-hidden="true" />
                  <p className="text-sm font-medium text-brand-800">Drop the image to upload it</p>
                  <p className="text-[13px] text-brand-800/80">It's attached straight away.</p>
                </div>
              )}
              {results}
            </div>
            {searchResults.length > 0 && (
              <p className="text-xs text-stone-500">
                Select an image, then choose <span className="font-medium text-stone-700">Use image</span>. Double-click to add it straight away.
              </p>
            )}
          </>
        )}

        {activeTab === 'hyperlink' && (
          <Field
            label="URL"
            error={urlInvalid ? 'Enter a valid URL, e.g. https://example.com' : null}
            description="Learners open the link in a new tab."
          >
            {(id) => (
              <Input
                id={id}
                type="url"
                value={hyperlinkUrl}
                onChange={(e) => setHyperlinkUrl(e.target.value)}
                placeholder="https://example.com/resource"
                aria-invalid={urlInvalid || undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleHyperlinkSubmit();
                  }
                }}
                autoFocus
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  );
};

export default ImageSelectionModal;
