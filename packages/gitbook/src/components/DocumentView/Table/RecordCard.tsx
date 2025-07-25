import {
    type ContentRef,
    type DocumentTableViewCards,
    SiteInsightsLinkPosition,
} from '@gitbook/api';

import { LinkBox, LinkOverlay } from '@/components/primitives';
import { Image } from '@/components/utils';
import { resolveContentRef } from '@/lib/references';
import { tcls } from '@/lib/tailwind';

import { RecordColumnValue } from './RecordColumnValue';
import type { TableRecordKV, TableViewProps } from './Table';
import { RecordCardStyles } from './styles';
import { getRecordValue } from './utils';

export async function RecordCard(
    props: TableViewProps<DocumentTableViewCards> & {
        record: TableRecordKV;
    }
) {
    const { view, record, context, block, isOffscreen } = props;

    const coverFile = view.coverDefinition
        ? getRecordValue<string[]>(record[1], view.coverDefinition)?.[0]
        : null;
    const targetRef = view.targetDefinition
        ? (record[1].values[view.targetDefinition] as ContentRef)
        : null;

    const [cover, target] = await Promise.all([
        coverFile && context.contentContext
            ? resolveContentRef({ kind: 'file', file: coverFile }, context.contentContext)
            : null,
        targetRef && context.contentContext
            ? resolveContentRef(targetRef, context.contentContext)
            : null,
    ]);

    const coverIsSquareOrPortrait =
        cover?.file?.dimensions &&
        cover.file?.dimensions?.width / cover.file?.dimensions?.height <= 1;

    const body = (
        <div
            className={tcls(
                'grid-area-1-1',
                'relative',
                'grid',
                'bg-tint-base',
                'w-[calc(100%+2px)]',
                'h-[calc(100%+2px)]',
                'inset-[-1px]',
                'rounded',
                'straight-corners:rounded-none',
                'circular-corners:rounded-xl',
                'overflow-hidden',
                '[&_.heading>div:first-child]:hidden',
                '[&_.heading>div]:text-[.8em]',
                'md:[&_.heading>div]:text-[1em]',
                '[&_.blocks:first-child_.heading]:pt-0', // Remove padding-top on first heading in card

                // On mobile, check if we can display the cover responsively or not:
                // - If the file has a landscape aspect ratio, we display it normally
                // - If the file is square or portrait, we display it left with 40% of the card width
                coverIsSquareOrPortrait
                    ? [
                          'grid-cols-[40%,_1fr]',
                          'min-[432px]:grid-cols-none',
                          'min-[432px]:grid-rows-[auto,1fr]',
                      ]
                    : 'grid-rows-[auto,1fr]'
            )}
        >
            {cover ? (
                <Image
                    alt="Cover"
                    sources={{
                        light: {
                            src: cover.href,
                            size: cover.file?.dimensions,
                        },
                    }}
                    sizes={[
                        {
                            width: view.cardSize === 'medium' ? 245 : 376,
                        },
                    ]}
                    resize={context.contentContext?.imageResizer}
                    className={tcls(
                        'min-w-0',
                        'w-full',
                        'h-full',
                        'object-cover',
                        coverIsSquareOrPortrait
                            ? ['min-[432px]:h-auto', 'min-[432px]:aspect-video']
                            : ['h-auto', 'aspect-video']
                    )}
                    priority={isOffscreen ? 'lazy' : 'high'}
                    preload
                />
            ) : null}
            <div
                className={tcls(
                    'min-w-0',
                    'w-full',
                    'flex',
                    'flex-col',
                    'place-self-start',
                    'gap-3',
                    'p-4',
                    'text-sm',
                    target
                        ? ['transition-colors', 'text-tint', 'group-hover:text-tint-strong']
                        : ['text-tint-strong']
                )}
            >
                {view.columns.map((column) => {
                    const definition = block.data.definition[column];

                    if (!definition) {
                        return null;
                    }

                    if (!view.hideColumnTitle && definition.title) {
                        const ariaLabelledBy = `${block.key}-${column}-title`;
                        return (
                            <div key={column} className="flex flex-col gap-1">
                                <div id={ariaLabelledBy} className="text-sm text-tint">
                                    {definition.title}
                                </div>
                                <RecordColumnValue
                                    {...props}
                                    column={column}
                                    ariaLabelledBy={ariaLabelledBy}
                                />
                            </div>
                        );
                    }

                    return <RecordColumnValue key={column} {...props} column={column} />;
                })}
            </div>
        </div>
    );

    if (target && targetRef) {
        return (
            // We don't use `Link` directly here because we could end up in a situation where
            // a link is rendered inside a link, which is not allowed in HTML.
            // It causes an hydration error in React.
            <LinkBox href={target.href} classNames={['RecordCardStyles']}>
                <LinkOverlay
                    href={target.href}
                    insights={{
                        type: 'link_click',
                        link: {
                            target: targetRef,
                            position: SiteInsightsLinkPosition.Content,
                        },
                    }}
                />
                {body}
            </LinkBox>
        );
    }

    return <div className={tcls(RecordCardStyles)}>{body}</div>;
}
