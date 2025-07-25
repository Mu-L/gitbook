/* eslint-disable @next/next/no-img-element */
import type { ImageResizer } from '@/lib/images';
import ReactDOM from 'react-dom';

import { type ClassValue, tcls } from '@/lib/tailwind';

import { checkIsHttpURL } from '@/lib/urls';
import { ZoomImage } from './ZoomImage';
import type { PolymorphicComponentProp } from './types';

export type ImageSize = { width: number; height: number };

type ImageSource = {
    src: string;
    size?: ImageSize;
    aspectRatio?: string;
};

export type ImageSourceSized = {
    src: string;
    size: ImageSize | null;
    aspectRatio?: string;
};

export type ImageResponsiveSize = {
    /** Media query to apply this width for */
    media?: string;

    /** Width of the image for this media */
    width: number;
};

const MAX_DPR = 4;

interface ImageCommonProps {
    /**
     * Response sizes.
     */
    sizes: ImageResponsiveSize[];

    /**
     * The `alt` attribute is required for accessibility.
     */
    alt: string;

    /**
     * Quality of the optimized image.
     * @default 100
     */
    quality?: number;

    /**
     * Whether to resize the image.
     */
    resize: ImageResizer | false | undefined;

    /**
     * Whether to allow the user to zoom on the image.
     * @default false
     */
    zoom?: boolean;

    /**
     * Priority of the image.
     * - `lazy` will load the image only when it's visible in the viewport.
     * - `eager` will load the image as soon as possible, even if it's not visible; but will not preload.
     * - `high` will preload.
     *
     * @default normal
     */
    priority?: 'lazy' | 'normal' | 'high';

    /**
     * Force preloading the image.
     * Even if the priority is set to `lazy`, the image will be preloaded.
     *
     * Useful for images that are not visible in the viewport, but that we want to preload.
     */
    preload?: boolean;

    /**
     * Render image as inline.
     */
    inline?: boolean;

    /**
     * The `style` attribute is used to apply custom styles.
     */
    style?: ClassValue;

    /**
     * The `style` attribute is used to apply custom styles.
     */
    inlineStyle?: React.CSSProperties;
}

interface ImgDOMPropsWithSrc extends React.ComponentPropsWithoutRef<'img'> {
    src: string;
}

/**
 * Render an image that will be swapped depending on the theme.
 * We don't use the `next/image` component because we need to load images from external sources,
 * and we want to avoid client components.
 */
export function Image(
    props: PolymorphicComponentProp<
        'img',
        {
            /**
             * Sources for the image.
             */
            sources: {
                light: ImageSource;
                dark?: ImageSource | null;
            };
        } & ImageCommonProps
    >
) {
    const { sources, style, inline = false, ...rest } = props;

    return (
        <>
            <ImagePicture
                {...rest}
                inline={inline}
                source={sources.light}
                className={tcls(
                    rest.className,
                    inline ? 'inline' : 'block',
                    sources.dark ? 'dark:hidden' : null,
                    style
                )}
            />
            {sources.dark ? (
                <ImagePicture
                    source={sources.dark}
                    {...rest}
                    inline={inline}
                    // We don't want to preload the dark image, because it's not visible
                    // TODO: adapt based on the default theme
                    priority="lazy"
                    className={tcls(
                        rest.className,
                        'hidden',
                        inline ? 'dark:inline' : 'dark:block',
                        style
                    )}
                />
            ) : null}
        </>
    );
}

function ImagePicture(
    props: PolymorphicComponentProp<
        'img',
        {
            source: ImageSource;
        } & ImageCommonProps
    >
) {
    const { source, ...rest } = props;
    const { size } = source;

    return size ? (
        <ImagePictureSized {...rest} source={{ ...source, size }} />
    ) : (
        <ImagePictureUnsized {...rest} source={source} />
    );
}

async function ImagePictureUnsized(
    props: PolymorphicComponentProp<
        'img',
        {
            source: ImageSource;
        } & ImageCommonProps
    >
) {
    const { source, resize, ...rest } = props;

    const size = resize ? await resize.getImageSize(source.src, { dpr: 2 }) : null;
    return <ImagePictureSized {...rest} resize={resize} source={{ ...source, size }} />;
}

async function ImagePictureSized(
    props: PolymorphicComponentProp<
        'img',
        {
            source: ImageSourceSized;
        } & ImageCommonProps
    >
) {
    const {
        source,
        sizes,
        style: _style,
        alt,
        quality = 100,
        priority = 'normal',
        inline = false,
        zoom = false,
        resize = false,
        preload = false,
        inlineStyle,
        ...rest
    } = props;

    if (process.env.NODE_ENV === 'development' && sizes.length === 0) {
        throw new Error('You must provide at least one size for the image.');
    }

    const attrs = await getImageAttributes({ sizes, source, quality, resize });
    const canBeFetched = checkIsHttpURL(attrs.src);
    const fetchPriority = canBeFetched ? getFetchPriority(priority) : undefined;
    const loading = priority === 'lazy' ? 'lazy' : undefined;
    const aspectRatioStyle = source.aspectRatio ? { aspectRatio: source.aspectRatio } : {};
    const style = { ...aspectRatioStyle, ...inlineStyle };

    // Preload the image if needed.
    if (fetchPriority === 'high' || preload) {
        ReactDOM.preload(attrs.src, {
            as: 'image',
            imageSrcSet: attrs.srcSet,
            imageSizes: attrs.sizes,
            fetchPriority,
        });
    }

    const imgProps: ImgDOMPropsWithSrc = {
        alt,
        style,
        loading,
        fetchPriority,
        ...rest,
        ...attrs,
    };

    return zoom ? <ZoomImage {...imgProps} /> : <img {...imgProps} alt={imgProps.alt ?? ''} />;
}

/**
 * Get the attributes for an image.
 * src, srcSet, sizes, width, height, etc.
 */
export async function getImageAttributes(params: {
    sizes: ImageResponsiveSize[];
    source: ImageSourceSized;
    quality: number;
    resize: ImageResizer | false;
}): Promise<{
    src: string;
    srcSet?: string;
    sizes?: string;
    width?: number;
    height?: number;
}> {
    const { sizes, source, quality, resize } = params;
    let src = source.src;

    const getURL = resize ? resize.getResizedImageURL(source.src) : null;

    if (!getURL) {
        return {
            src: source.src,
            ...source.size,
        };
    }

    const sources: string[] = [];
    const sourceSizes: string[] = [];
    let defaultSize: ImageResponsiveSize | undefined;

    for (const size of sizes) {
        for (let dpr = 1; dpr <= MAX_DPR; dpr++) {
            const resizedURL = await getURL({
                width: size.width,
                quality,
                dpr,
            });

            if (!size.media) {
                // Use the resize URL as the default source.
                src = resizedURL;
                defaultSize = size;
            }

            sources.push(`${resizedURL} ${size.width * dpr}w`);
        }

        if (size.media) {
            sourceSizes.push(`${size.media} ${size.width}px`);
        }
    }

    // Push the default size at the end.
    if (defaultSize) {
        sourceSizes.push(`${defaultSize.width}px`);
    }

    if (!source.size) {
        return { src };
    }

    return {
        src,
        srcSet: sources.join(', '),
        sizes: sourceSizes.join(', '),
        ...source.size,
    };
}

function getFetchPriority(priority: ImageCommonProps['priority']) {
    switch (priority) {
        case 'lazy':
            return 'low';
        case 'high':
            return 'high';
        default:
            return undefined;
    }
}
