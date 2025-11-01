import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ProgressiveTextureResult {
  texture: THREE.Texture | null;
  status: 'loading-preview' | 'loading-full' | 'ready' | 'error';
  error: Error | null;
  isHighQuality: boolean;
}

interface UseProgressiveTextureOptions {
  previewUrl: string;
  fullUrl: string;
  timeout?: number; // milliseconds
  maxRetries?: number;
}

export function useProgressiveTexture({
  previewUrl,
  fullUrl,
  timeout = 10000,
  maxRetries = 2
}: UseProgressiveTextureOptions): ProgressiveTextureResult {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [status, setStatus] = useState<ProgressiveTextureResult['status']>('loading-preview');
  const [error, setError] = useState<Error | null>(null);
  const [isHighQuality, setIsHighQuality] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let previewTexture: THREE.Texture | null = null;
    let fullTexture: THREE.Texture | null = null;

    const loadTexture = async (
      url: string,
      isPreview: boolean
    ): Promise<THREE.Texture> => {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Fetch with timeout
      const fetchPromise = fetch(url, { signal });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Texture load timeout')), timeout)
      );

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`Failed to load texture: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Load image
      const img = new Image();
      const imageLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to decode image'));
        img.src = objectUrl;
      });

      await img.decode();
      const loadedImg = await imageLoadPromise;

      // Create canvas texture
      const canvas = document.createElement('canvas');
      canvas.width = loadedImg.width;
      canvas.height = loadedImg.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(loadedImg, 0, 0);

      // Create THREE.Texture
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 16;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;

      // Cleanup
      URL.revokeObjectURL(objectUrl);

      return tex;
    };

    const loadWithRetry = async (
      url: string,
      isPreview: boolean
    ): Promise<THREE.Texture> => {
      try {
        return await loadTexture(url, isPreview);
      } catch (err) {
        if (retryCountRef.current < maxRetries && mounted) {
          retryCountRef.current++;
          console.warn(`Retrying texture load (${retryCountRef.current}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
          return loadWithRetry(url, isPreview);
        }
        throw err;
      }
    };

    const loadTextures = async () => {
      try {
        // Load preview first
        if (!mounted) return;
        setStatus('loading-preview');

        previewTexture = await loadWithRetry(previewUrl, true);

        if (!mounted) {
          previewTexture?.dispose();
          return;
        }

        setTexture(previewTexture);
        setIsHighQuality(false);
        setStatus('loading-full');

        // Load full quality in background
        retryCountRef.current = 0; // Reset retry counter for full texture
        fullTexture = await loadWithRetry(fullUrl, false);

        if (!mounted) {
          fullTexture?.dispose();
          return;
        }

        // Swap to high quality
        setTexture(fullTexture);
        setIsHighQuality(true);
        setStatus('ready');

        // Dispose preview texture
        if (previewTexture) {
          previewTexture.dispose();
        }

      } catch (err) {
        if (!mounted) return;

        const error = err instanceof Error ? err : new Error('Unknown error');
        console.error('Texture loading failed:', error);
        setError(error);
        setStatus('error');
      }
    };

    loadTextures();

    return () => {
      mounted = false;
      abortControllerRef.current?.abort();

      // Cleanup textures
      if (previewTexture) {
        previewTexture.dispose();
      }
      if (fullTexture && fullTexture !== previewTexture) {
        fullTexture.dispose();
      }
    };
  }, [previewUrl, fullUrl, timeout, maxRetries]);

  return { texture, status, error, isHighQuality };
}
