import { type DocumentInlineLink, SiteInsightsLinkPosition } from '@gitbook/api';

import { getSpaceLanguage, tString } from '@/intl/server';
import { languages } from '@/intl/translations';
import type { GitBookAnyContext } from '@/lib/context';
import { type ResolvedContentRef, resolveContentRef } from '@/lib/references';
import { Icon } from '@gitbook/icons';
import { StyledLink } from '../../primitives';
import type { InlineProps } from '../Inline';
import { Inlines } from '../Inlines';
import { InlineLinkTooltip } from './InlineLinkTooltip';

export async function InlineLink(props: InlineProps<DocumentInlineLink>) {
    const { inline, document, context, ancestorInlines } = props;

    const resolved = context.contentContext
        ? await resolveContentRef(inline.data.ref, context.contentContext, {
              // We don't want to resolve the anchor text here, as it can be very expensive and will block rendering if there is a lot of anchors link.
              resolveAnchorText: false,
          })
        : null;

    if (!context.contentContext || !resolved) {
        return (
            <span title="Broken link" className="underline">
                <Inlines
                    context={context}
                    document={document}
                    nodes={inline.nodes}
                    ancestorInlines={[...ancestorInlines, inline]}
                />
            </span>
        );
    }
    const isExternal = inline.data.ref.kind === 'url';
    const content = (
        <StyledLink
            href={resolved.href}
            insights={{
                type: 'link_click',
                link: {
                    target: inline.data.ref,
                    position: SiteInsightsLinkPosition.Content,
                },
            }}
        >
            <Inlines
                context={context}
                document={document}
                nodes={inline.nodes}
                ancestorInlines={[...ancestorInlines, inline]}
            />
            {isExternal ? (
                <Icon
                    icon="arrow-up-right"
                    className="ml-0.5 inline size-3 links-accent:text-tint-subtle"
                />
            ) : null}
        </StyledLink>
    );

    if (context.shouldRenderLinkPreviews) {
        return (
            <InlineLinkTooltipWrapper
                inline={inline}
                context={context.contentContext}
                resolved={resolved}
            >
                {content}
            </InlineLinkTooltipWrapper>
        );
    }

    return content;
}

/**
 * An SSR component that renders a link with a tooltip.
 * Essentially it pulls the minimum amount of props from the context to render the tooltip.
 */
function InlineLinkTooltipWrapper(props: {
    inline: DocumentInlineLink;
    context: GitBookAnyContext;
    children: React.ReactNode;
    resolved: ResolvedContentRef;
}) {
    const { inline, context, resolved, children } = props;

    let breadcrumbs = resolved.ancestors ?? [];
    const language =
        'customization' in context ? getSpaceLanguage(context.customization) : languages.en;
    const isExternal = inline.data.ref.kind === 'url';
    const isSamePage = inline.data.ref.kind === 'anchor' && inline.data.ref.page === undefined;
    if (isExternal) {
        breadcrumbs = [
            {
                label: tString(language, 'link_tooltip_external_link'),
            },
        ];
    }
    if (isSamePage) {
        breadcrumbs = [
            {
                label: tString(language, 'link_tooltip_page_anchor'),
                icon: <Icon icon="arrow-down-short-wide" className="size-3" />,
            },
        ];
        resolved.subText = undefined;
    }

    return (
        <InlineLinkTooltip
            breadcrumbs={breadcrumbs}
            isExternal={isExternal}
            isSamePage={isSamePage}
            openInNewTabLabel={tString(language, 'open_in_new_tab')}
            target={{
                href: resolved.href,
                text: resolved.text,
                subText: resolved.subText,
                icon: resolved.icon,
            }}
        >
            {children}
        </InlineLinkTooltip>
    );
}
