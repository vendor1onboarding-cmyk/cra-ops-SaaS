import React, { useState, useEffect } from 'react';
import { toUTCISOString } from '../utils/time';

interface SignatureImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoadSuccess?: () => void;
  onLoadError?: (error: string) => void;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  isPrint?: boolean;
}

/**
 * Signature Image Component with error handling, loading states, and fallback UI
 * Handles:
 * - Image load states with visual feedback
 * - CORS and bucket access errors with helpful messages
 * - Fallback signature line when image is unavailable
 * - Logging for debugging signature issues
 * - Print-safe rendering
 */
export const SignatureImage: React.FC<SignatureImageProps> = ({
  src,
  alt = "Signature",
  className = "",
  style = {},
  onLoadSuccess,
  onLoadError,
  showLabel = true,
  size = 'medium',
  isPrint = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(src);

  // Size mappings - Professional signature rendering
  const sizeMap = {
    small: { h: 'h-40', maxH: 'max-h-40', maxW: 'max-w-64' },      // 160px height, 256px width (mobile-optimized)
    medium: { h: 'h-56', maxH: 'max-h-56', maxW: 'max-w-2xl' },    // 224px height, 672px width (standard display)
    large: { h: 'h-72', maxH: 'max-h-72', maxW: 'max-w-4xl' },     // 288px height, 896px width (modal/premium)
  };
  
  const sizes = sizeMap[size];

  useEffect(() => {
    // Reset state when src changes
    setImageUrl(src);
    setError(null);
    setLoading(true);

    if (!src) {
      setLoading(false);
      setError('No signature URL provided');
      onLoadError?.('No signature URL');
      return;
    }

    // Validate URL format
    if (typeof src !== 'string' || src.trim() === '') {
      setLoading(false);
      setError('Invalid signature URL format');
      onLoadError?.('Invalid URL format');
      return;
    }

    // Log signature URL for debugging (without exposing full URL in console)
    try {
      const urlObj = new URL(src).pathname;
      console.log('[SignatureImage] Attempting to load signature:', {
        bucket: 'eod-signatures',
        path: urlObj,
        timestamp: toUTCISOString(),
      });
    } catch (e) {
      console.error('[SignatureImage] Invalid URL format:', src);
      setLoading(false);
      setError('Invalid URL format');
      return;
    }

    // Preload image to detect load/error state
    // Critical: Check image.complete for cached images that don't fire onLoad
    const img = new Image();
    let isHandled = false;
    
    const handleLoad = () => {
      if (isHandled) return;
      isHandled = true;
      console.log('[SignatureImage] Image preload successful, marking as loaded');
      setLoading(false);
      setError(null);
      onLoadSuccess?.();
    };

    const handleError = () => {
      if (isHandled) return;
      isHandled = true;
      const errorMsg = 'Failed to load signature image. Image URL may be invalid or bucket access denied.';
      console.error('[SignatureImage] Image preload failed:', {
        src,
        error: errorMsg,
        timestamp: toUTCISOString(),
      });
      setLoading(false);
      setError(errorMsg);
      onLoadError?.(errorMsg);
    };

    img.onload = handleLoad;
    img.onerror = handleError;
    
    // For cached images, check immediately after setting src
    img.src = src;
    
    // Handle case where image is already cached/loaded
    // Image.complete is true if the image is already in cache or has loaded
    if (img.complete) {
      console.log('[SignatureImage] Image appears to be cached, checking if it loaded successfully');
      // Small delay to ensure the onload/onerror has had time to fire
      setTimeout(() => {
        if (!isHandled) {
          // Check natural dimensions to see if image actually loaded
          if (img.naturalHeight === 0 && img.naturalWidth === 0) {
            handleError();
          } else {
            handleLoad();
          }
        }
      }, 50);
    }

    // Add timeout as final fallback (8 seconds)
    const timeout = setTimeout(() => {
      if (!isHandled) {
        console.warn('[SignatureImage] Image load timeout after 8 seconds');
        if (img.naturalHeight > 0 || img.naturalWidth > 0) {
          // Image loaded but handlers didn't fire
          handleLoad();
        } else {
          // Image failed to load
          handleError();
        }
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      isHandled = true;
    };
  }, [src, onLoadError, onLoadSuccess]);

  const handleImageLoad = () => {
    console.log('[SignatureImage] IMG tag onLoad fired (backup handler)');
    // Already handled in useEffect preload, but this is backup
    if (loading) {
      setLoading(false);
      setError(null);
    }
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('[SignatureImage] IMG tag onError fired:', {
      src: imageUrl,
      timestamp: toUTCISOString(),
    });
    // Already handled in useEffect preload, but show error if not already handled
    if (loading) {
      const errorMsg = 'Failed to load signature image. Image URL may be invalid or bucket access denied.';
      setError(errorMsg);
      onLoadError?.(errorMsg);
    }
  };

  // Don't show loading spinner in print mode
  if (isPrint && !src) {
    return (
      <div style={style} className={className}>
        <div className="mt-6 border-b w-48" />
      </div>
    );
  }

  // Signature not available
  if (!src) {
    return (
      <div className={`space-y-2 ${className}`} style={style}>
        {showLabel && <p className="text-xs font-semibold text-slate-600">Signature:</p>}
        <div className="border border-dashed border-slate-300 rounded p-4 bg-slate-50 flex items-center justify-center">
          <p className="text-xs text-slate-500">No signature available</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className={`space-y-2 ${className}`} style={style}>
        {showLabel && <p className="text-xs font-semibold text-slate-600">Signature:</p>}
        <div className="border border-red-300 rounded-lg p-4 bg-red-50">
          <p className="text-xs text-red-700 font-bold">⚠️ Unable to Load Signature</p>
          <p className="text-xs text-red-600 mt-2 leading-relaxed">{error}</p>
          <div className="mt-3 text-xs text-red-600 space-y-1 bg-white rounded p-2 border border-red-200">
            <p><strong>Troubleshooting:</strong></p>
            <ul className="list-disc list-inside space-y-1 text-red-600">
              <li>Verify the signature URL is accessible</li>
              <li>Check Supabase storage bucket is PUBLIC</li>
              <li>Verify CORS is configured in Supabase</li>
              <li>Try refreshing the page</li>
            </ul>
          </div>
          {/* Fallback signature line */}
          <div className="mt-4 flex items-end gap-2">
            <span className="text-xs text-red-600 font-medium">Signature:</span>
            <div className="border-b-2 border-red-400 flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`} style={style}>
        {showLabel && <p className="text-xs font-semibold text-slate-600">Signature:</p>}
        <div className={`border border-blue-200 rounded p-4 bg-blue-50 flex items-center justify-center ${sizes.h}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 border-2 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-2 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <p className="text-xs text-blue-700 font-medium">Loading signature...</p>
              <p className="text-xs text-blue-600 mt-1">Retrieving from storage</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state - image loaded
  return (
    <div className={`space-y-2 ${className}`} style={style}>
      {showLabel && <p className="text-xs font-semibold text-slate-600 print:text-slate-800 print:text-[10px]">Signature:</p>}
      {/* Print version: clean professional look, no colors/borders - maintains full size for professional rendering */}
      <div className="hidden print:block">
        <img
          src={imageUrl}
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`${sizes.h} ${sizes.maxH} ${sizes.maxW} object-contain`}
          style={{
            ...style,
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
      </div>
      
      {/* Screen version: colorful with validation message - larger for mobile readability */}
      <div className="print:hidden border-2 border-green-300 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
        <img
          src={imageUrl}
          alt={alt}
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`${sizes.h} ${sizes.maxH} ${sizes.maxW} object-contain mx-auto`}
          style={{
            ...style,
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
        <p className="text-xs text-green-700 text-center mt-3 font-medium">✓ Signature verified & secured</p>
      </div>
    </div>
  );
};

/**
 * Signature View Modal - displays signature in a lightbox/modal
 */
export const SignatureModal: React.FC<{
  open: boolean;
  signatureUrl?: string | null;
  signedAt?: string;
  onClose: () => void;
}> = ({ open, signatureUrl, signedAt, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden p-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full space-y-4 p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-xl">Custodian Signature</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-3xl leading-none flex-shrink-0"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            ✕
          </button>
        </div>

        {/* Signature with proper spacing and professional styling */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-6 flex items-center justify-center min-h-[400px]">
          <SignatureImage 
            src={signatureUrl} 
            size="large"
            showLabel={false}
          />
        </div>

        {signedAt && (
          <div className="text-sm text-slate-600 border-t pt-4">
            <p className="font-semibold">Signed on:</p>
            <p>{new Date(signedAt).toLocaleString("en-IN")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Utility function to preload signature image before PDF print
 * Ensures image is available when browser renders PDF
 */
export const preloadSignatureImage = (url: string | null | undefined): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      console.log('[preloadSignatureImage] Successfully preloaded signature');
      resolve(true);
    };
    img.onerror = () => {
      console.warn('[preloadSignatureImage] Failed to preload signature');
      resolve(false);
    };
    img.src = url;
  });
};

export default SignatureImage;
