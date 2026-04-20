import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageProps,
  ImageResizeMode,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Image as ExpoImage, ImageContentFit } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type PremiumImageVariant = 'generic' | 'product' | 'shop' | 'qr' | 'avatar' | 'document';
type PremiumImagePerformanceMode = 'default' | 'list';

const PREVIEW_FALLBACK_TIMEOUT_LIST_MS = 1200;
const PREVIEW_FALLBACK_TIMEOUT_DEFAULT_MS = 1800;

const DEFAULT_PREVIEW_WIDTH: Record<PremiumImageVariant, number> = {
  generic: 720,
  product: 520,
  shop: 720,
  qr: 512,
  avatar: 320,
  document: 1080,
};

const DEFAULT_PREVIEW_HEIGHT: Partial<Record<PremiumImageVariant, number>> = {
  qr: 512,
  avatar: 320,
};

const DEFAULT_PREVIEW_QUALITY: Record<PremiumImageVariant, number> = {
  generic: 78,
  product: 60,
  shop: 76,
  qr: 95,
  avatar: 78,
  document: 80,
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
};

const toContentFit = (resizeMode?: ImageResizeMode): ImageContentFit => {
  switch (resizeMode) {
    case 'contain':
      return 'contain';
    case 'stretch':
      return 'fill';
    case 'center':
      return 'contain';
    case 'repeat':
      return 'cover';
    case 'cover':
    default:
      return 'cover';
  }
};

const optimizeAppwriteImageUri = (
  uri: string,
  width?: number,
  height?: number,
  variant: PremiumImageVariant = 'generic',
  performanceMode: PremiumImagePerformanceMode = 'default'
): string => {
  if (!/^https?:\/\//i.test(uri)) {
    return uri;
  }

  if (!uri.includes('/storage/buckets/') || !uri.includes('/files/')) {
    return uri;
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return uri;
  }

  if (!parsed.pathname.endsWith('/view') && !parsed.pathname.endsWith('/preview')) {
    return uri;
  }

  parsed.pathname = parsed.pathname.replace(/\/(view|preview)$/i, '/preview');

  const baseQuality = DEFAULT_PREVIEW_QUALITY[variant];
  const quality = performanceMode === 'list' && variant === 'product' ? Math.min(baseQuality, 56) : baseQuality;
  parsed.searchParams.set('quality', `${quality}`);

  if (variant !== 'qr') {
    parsed.searchParams.set('output', 'webp');
  }

  const requestedWidth = width && width > 0 ? width : DEFAULT_PREVIEW_WIDTH[variant];
  const widthCap = performanceMode === 'list' && variant === 'product' ? 640 : 2048;
  parsed.searchParams.set('width', `${Math.max(64, Math.min(widthCap, requestedWidth))}`);

  if (height && height > 0) {
    const heightCap = performanceMode === 'list' && variant === 'product' ? 640 : 2048;
    parsed.searchParams.set('height', `${Math.max(64, Math.min(heightCap, height))}`);
  } else if (DEFAULT_PREVIEW_HEIGHT[variant]) {
    parsed.searchParams.set('height', `${DEFAULT_PREVIEW_HEIGHT[variant]}`);
  }

  return parsed.toString();
};

const buildTinyPreviewUri = (uri: string, variant: PremiumImageVariant): string => {
  if (!uri || !/^https?:\/\//i.test(uri)) {
    return uri;
  }

  return optimizeAppwriteImageUri(
    uri,
    variant === 'product' ? 84 : 96,
    variant === 'product' ? 84 : undefined,
    variant,
    'list'
  );
};

const VARIANT_CONFIG: Record<
  PremiumImageVariant,
  { icon: IconName; emptyLabel: string; errorLabel: string; retryLabel: string }
> = {
  generic: {
    icon: 'image-outline',
    emptyLabel: 'No image',
    errorLabel: 'Image unavailable',
    retryLabel: 'Tap to retry',
  },
  product: {
    icon: 'cube-outline',
    emptyLabel: 'No product image',
    errorLabel: 'Product image unavailable',
    retryLabel: 'Tap to retry',
  },
  shop: {
    icon: 'storefront-outline',
    emptyLabel: 'No shop photo',
    errorLabel: 'Shop photo unavailable',
    retryLabel: 'Tap to retry',
  },
  qr: {
    icon: 'qr-code-outline',
    emptyLabel: 'No QR image',
    errorLabel: 'QR image unavailable',
    retryLabel: 'Tap to reload QR',
  },
  avatar: {
    icon: 'person-outline',
    emptyLabel: 'No profile photo',
    errorLabel: 'Profile photo unavailable',
    retryLabel: 'Tap to retry',
  },
  document: {
    icon: 'document-text-outline',
    emptyLabel: 'No document preview',
    errorLabel: 'Preview unavailable',
    retryLabel: 'Tap to retry',
  },
};

interface PremiumImageProps extends Omit<ImageProps, 'source' | 'style'> {
  uri?: string | null;
  source?: ImageSourcePropType;
  style?: StyleProp<ViewStyle | ImageStyle>;
  variant?: PremiumImageVariant;
  performanceMode?: PremiumImagePerformanceMode;
  previewWidth?: number;
  previewHeight?: number;
  fallbackIcon?: IconName;
  emptyLabel?: string;
  errorLabel?: string;
  retryLabel?: string;
}

export const PremiumImage: React.FC<PremiumImageProps> = ({
  uri,
  source,
  style,
  variant = 'generic',
  performanceMode = 'default',
  previewWidth,
  previewHeight,
  resizeMode = 'cover',
  fallbackIcon,
  emptyLabel,
  errorLabel,
  retryLabel,
  onLoadStart,
  onLoad,
  onLoadEnd,
  onError,
  ...rest
}) => {
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const borderRadius = typeof flattenedStyle.borderRadius === 'number' ? flattenedStyle.borderRadius : 0;
  const styleWidth = toNumber((flattenedStyle as any).width);
  const styleHeight = toNumber((flattenedStyle as any).height);
  const resolvedPreviewWidth = toNumber(previewWidth) || styleWidth;
  const resolvedPreviewHeight = toNumber(previewHeight) || styleHeight;
  const isListMode = performanceMode === 'list';

  const variantConfig = VARIANT_CONFIG[variant] || VARIANT_CONFIG.generic;
  const resolvedFallbackIcon = fallbackIcon || variantConfig.icon;
  const resolvedEmptyLabel = emptyLabel || variantConfig.emptyLabel;
  const resolvedErrorLabel = errorLabel || variantConfig.errorLabel;
  const resolvedRetryLabel = retryLabel || variantConfig.retryLabel;

  const normalizedUri = typeof uri === 'string' ? uri.trim() : '';
  const optimizedUri = useMemo(
    () =>
      optimizeAppwriteImageUri(
        normalizedUri,
        resolvedPreviewWidth,
        resolvedPreviewHeight,
        variant,
        performanceMode
      ),
    [normalizedUri, performanceMode, resolvedPreviewHeight, resolvedPreviewWidth, variant]
  );

  const canFallbackToOriginal = !!normalizedUri && !!optimizedUri && optimizedUri !== normalizedUri;
  const [preferOriginalUri, setPreferOriginalUri] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeUri = preferOriginalUri ? normalizedUri : optimizedUri;
  const tinyPlaceholderUri = useMemo(() => buildTinyPreviewUri(activeUri || normalizedUri, variant), [
    activeUri,
    normalizedUri,
    variant,
  ]);

  const resolvedSource = useMemo<ImageSourcePropType | undefined>(() => {
    if (source) {
      return source;
    }

    if (activeUri) {
      return { uri: activeUri } as any;
    }

    return undefined;
  }, [activeUri, source]);

  const placeholderSource = useMemo<ImageSourcePropType | undefined>(() => {
    if (!tinyPlaceholderUri || tinyPlaceholderUri === activeUri) {
      return undefined;
    }

    return { uri: tinyPlaceholderUri } as any;
  }, [activeUri, tinyPlaceholderUri]);

  const hasSource = !!resolvedSource;
  const showFallback = !hasSource || hasError;

  const clearFallbackTimer = () => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearFallbackTimer();
  }, []);

  useEffect(() => {
    clearFallbackTimer();
  }, [activeUri]);

  const retryLoad = () => {
    if (!hasSource) {
      return;
    }

    clearFallbackTimer();
    setHasError(false);
    setPreferOriginalUri(false);
    setIsLoading(false);
    setReloadNonce((value) => value + 1);
  };

  return (
    <View style={[styles.container, style]}>
      {hasSource && !hasError && (
        <ExpoImage
          key={`${activeUri}-${reloadNonce}`}
          {...(rest as any)}
          source={resolvedSource as any}
          placeholder={placeholderSource as any}
          style={[StyleSheet.absoluteFillObject, { borderRadius }]}
          contentFit={toContentFit(resizeMode)}
          placeholderContentFit={toContentFit(resizeMode)}
          cachePolicy={isListMode ? 'memory-disk' : 'disk'}
          priority={isListMode ? 'high' : 'normal'}
          transition={isListMode ? 0 : 90}
          allowDownscaling
          onLoadStart={() => {
            if (!isListMode) {
              setIsLoading(true);
            }

            if (!preferOriginalUri && canFallbackToOriginal) {
              clearFallbackTimer();
              fallbackTimerRef.current = setTimeout(() => {
                setPreferOriginalUri(true);
                setHasError(false);
                setIsLoading(false);
              }, isListMode ? PREVIEW_FALLBACK_TIMEOUT_LIST_MS : PREVIEW_FALLBACK_TIMEOUT_DEFAULT_MS);
            }

            onLoadStart?.();
          }}
          onLoad={(event: any) => {
            clearFallbackTimer();
            setHasError(false);
            onLoad?.(event);
          }}
          onLoadEnd={() => {
            clearFallbackTimer();
            setIsLoading(false);
            onLoadEnd?.();
          }}
          onError={(event: any) => {
            clearFallbackTimer();
            if (!preferOriginalUri && canFallbackToOriginal) {
              setPreferOriginalUri(true);
              setHasError(false);
              setIsLoading(false);
              return;
            }

            setHasError(true);
            setIsLoading(false);
            onError?.(event);
          }}
        />
      )}

      {hasSource && isLoading && !isListMode && !hasError && (
        <View pointerEvents="none" style={[styles.loaderMask, { borderRadius }]}> 
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}

      {showFallback && (
        <TouchableOpacity
          style={[styles.fallback, { borderRadius }]}
          activeOpacity={hasSource ? 0.8 : 1}
          onPress={hasSource ? retryLoad : undefined}
          disabled={!hasSource}
        >
          <Ionicons name={resolvedFallbackIcon} size={22} color={COLORS.textTertiary} />
          <Text style={styles.fallbackTitle}>{hasError ? resolvedErrorLabel : resolvedEmptyLabel}</Text>
          {hasSource && <Text style={styles.retryLabel}>{resolvedRetryLabel}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderMask: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 245, 244, 0.62)',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 10,
    gap: 4,
  },
  fallbackTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});
