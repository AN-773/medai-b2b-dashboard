import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  Upload, 
  Image as ImageIcon,
  Link as LinkIcon,
  Video,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { testsService } from '../services/testsService';
import { OpenIImage } from '../types/TestsServiceTypes';

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

const ImageSelectionModal: React.FC<ImageSelectionModalProps> = ({ isOpen, onClose, onImageSelected }) => {
  const [activeTab, setActiveTab] = useState<MultimediaType>('image');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<OpenIImage[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [hyperlinkUrl, setHyperlinkUrl] = useState('');
  const [uploadingImageIdx, setUploadingImageIdx] = useState<number | null>(null);
  
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
      setUploadingImageIdx(null);
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    
    try {
      const response = await testsService.searchOpenIImages(searchQuery.trim());
      if (response && response.list) {
        setSearchResults(response.list);
      }
    } catch (error) {
      console.error("Failed to search OpenI images:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Please select an image file.");
      return;
    }

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
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleOpenIImageSelect = async (imageUrl: string, idx: number) => {
    setUploadingImageIdx(idx);
    try {
      const uploadedFile = await testsService.downloadOpenIImage(imageUrl);
      onImageSelected({ url: uploadedFile.url, fileId: uploadedFile.id, type: 'image' });
      onClose();
    } catch (error) {
      console.error('Failed to download OpenI image:', error);
    } finally {
      setUploadingImageIdx(null);
    }
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
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragActive) {
      setIsDragActive(true);
    }
  }, [isDragActive]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  if (!isOpen) return null;

  const tabs: { key: MultimediaType; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: 'image', label: 'Image', icon: <ImageIcon size={16} /> },
    { key: 'hyperlink', label: 'Hyperlink', icon: <LinkIcon size={16} /> },
    { key: 'video', label: 'Video', icon: <Video size={16} />, disabled: true },
  ];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header & Controls */}
        <div className="flex-shrink-0 px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F3F6F3] rounded-lg text-[#1BD183]">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add Media</h2>
              <p className="text-sm text-slate-500">Add an image, link, or upload a file</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="absolute top-5 right-6 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Tabs */}
        <div className="flex-shrink-0 px-6 py-3 bg-white border-b border-slate-100 flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => !tab.disabled && setActiveTab(tab.key)}
              disabled={tab.disabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-[#1BD183] text-white shadow-sm'
                  : tab.disabled
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.disabled && <span className="text-[10px] uppercase tracking-wider opacity-70">Soon</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'image' && (
          <>
            {/* Toolbar */}
            <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-3 z-10">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setHasSearched(false);
                    setSearchQuery(e.target.value)
                  }}
                  placeholder="Search concepts on NLM OpenI (e.g., 'chest xray')..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1BD183]/20 focus:border-[#1BD183] transition-all shadow-sm"
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                >
                  Search
                </button>
              </form>

              <div className="hidden sm:block w-px bg-slate-200" />

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={onFileInputChange} 
                accept="image/*" 
                className="hidden" 
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-[#1BD183] hover:bg-[#F3F6F3] text-slate-700 hover:text-[#1BD183] rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Upload File
              </button>
            </div>

            {/* Grid & Dropzone Area */}
            <div 
              className="flex-1 overflow-y-auto relative bg-white"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Drag Overlay */}
              {isDragActive && (
                <div className="absolute inset-0 z-20 bg-[#1BD183]/10 backdrop-blur-[2px] border-2 border-[#1BD183] border-dashed m-4 rounded-xl flex flex-col items-center justify-center">
                  <div className="p-4 bg-white rounded-full shadow-lg text-[#1BD183] mb-4 animate-bounce">
                    <Upload size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-[#1BD183] drop-shadow-sm">Drop image to upload</h3>
                  <p className="text-[#1BD183] font-medium opacity-80">It will be automatically attached</p>
                </div>
              )}

              <div className="p-6">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                    <Loader2 size={32} className="animate-spin mb-4 text-[#1BD183]" />
                    <p>Searching National Library of Medicine...</p>
                  </div>
                ) : hasSearched && searchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500 text-center max-w-md mx-auto">
                    <Search size={48} className="text-slate-200 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-1">No images found</h3>
                    <p className="text-sm">We couldn't find any images matching "{searchQuery}". Try different keywords or upload your own.</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {searchResults.map((img, i) => {
                      const imageUrl = img.imgLarge ? `https://openi.nlm.nih.gov${img.imgLarge}` : `https://openi.nlm.nih.gov${img.imageqsurl}`;
                      const isThisUploading = uploadingImageIdx === i;
                      return (
                        <div 
                          key={img.uid + i} 
                          onClick={() => !isThisUploading && uploadingImageIdx === null && handleOpenIImageSelect(imageUrl, i)}
                          className={`group relative aspect-square bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col transition-all ${
                            uploadingImageIdx !== null && !isThisUploading
                              ? 'opacity-40 cursor-not-allowed'
                              : 'cursor-pointer hover:border-[#1BD183] hover:shadow-md'
                          }`}
                        >
                          <div className="flex-1 overflow-hidden relative bg-black/5 flex items-center justify-center">
                            <img 
                              src={imageUrl} 
                              alt={img.title || 'OpenI Abstract'} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            {isThisUploading && (
                              <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-10">
                                <Loader2 size={28} className="animate-spin text-[#1BD183] mb-2" />
                                <span className="text-xs font-medium text-slate-600">Uploading...</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                          </div>
                          <div className="p-3 bg-white border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-700 line-clamp-2" title={img.title}>
                              {img.title || "Untitled"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 mx-auto max-w-2xl">
                    <div className="p-4 bg-white rounded-full shadow-sm text-slate-300 mb-4">
                      <ImageIcon size={40} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 mb-2">Select an Image</h3>
                    <p className="text-sm text-center max-w-sm mb-6">
                      Search the OpenI database using the bar above, click upload, or simply <strong>drag and drop an image anywhere</strong> in this window.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'hyperlink' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-lg space-y-6">
              <div className="text-center mb-4">
                <div className="inline-flex p-3 bg-[#F3F6F3] rounded-full text-[#1BD183] mb-3">
                  <LinkIcon size={28} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Add a Hyperlink</h3>
                <p className="text-sm text-slate-500 mt-1">Paste a URL to link to an external resource</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">URL</label>
                <input
                  type="url"
                  value={hyperlinkUrl}
                  onChange={(e) => setHyperlinkUrl(e.target.value)}
                  placeholder="https://example.com/resource..."
                  className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${
                    hyperlinkUrl.trim() && !isValidUrl(hyperlinkUrl)
                      ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-400'
                      : 'border-slate-200 focus:ring-[#1BD183]/20 focus:border-[#1BD183]'
                  }`}
                  onKeyDown={(e) => e.key === 'Enter' && handleHyperlinkSubmit()}
                  autoFocus
                />
                {hyperlinkUrl.trim() && !isValidUrl(hyperlinkUrl) && (
                  <p className="text-xs text-rose-500 mt-1">Please enter a valid URL (e.g., https://example.com)</p>
                )}
              </div>

              <button
                onClick={handleHyperlinkSubmit}
                disabled={!isValidUrl(hyperlinkUrl)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1BD183] text-white rounded-lg text-sm font-medium hover:bg-[#16b872] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExternalLink size={16} />
                Add Link
              </button>
            </div>
          </div>
        )}

        {activeTab === 'video' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
            <Video size={48} className="mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Video Support Coming Soon</h3>
            <p className="text-sm">This feature is under development.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default ImageSelectionModal;
