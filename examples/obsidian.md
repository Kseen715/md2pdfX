---
title: Obsidian syntax example
tags: [example, obsidian]
---

# Obsidian

Properties (frontmatter) are not printed in the PDF, but their `title`
becomes the header caption. Line breaks work as on GitHub: a single newline
does not break a paragraph.

## Links, tags, highlights

- Wiki link to another note: [[Embedded note]]
- With an alias: [[Embedded note|another note]]
- To a heading in this document: [[#Callouts]], with an alias: [[#Embeds|to embeds]]
- To a heading in another note: [[Embedded note#Section A]]
- A missing note is highlighted when embedded: ![[No such note]]

Tags: #example #obsidian/pdf #lorem_ipsum. These are not tags: C#, #1, `#code`.

Highlight: Lorem ipsum ==dolor sit amet==, consectetur adipiscing elit.

Comments do not end up in the PDF: visible%% — and this is hidden %% only this.

%%
A multi-line comment.

Lorem ipsum dolor sit amet — hidden too.
%%

## Callouts

> [!note]
> A callout without a title gets the type name. Lorem ipsum dolor sit amet.

> [!tip] Custom title with **markup**
> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

> [!warning]- Foldable (printed expanded in the PDF)
> Duis aute irure dolor in reprehenderit in voluptate velit esse.

> [!danger] Title only

> [!example] Nesting and content
> - a list inside a callout
> - `code` and $E = mc^2$
>
> > [!quote] Nested callout
> > Excepteur sint occaecat cupidatat non proident.

Other types:

> [!info] info
> [!abstract], [!todo], [!success], [!question], [!failure], [!bug], [!quote] — each has its own color.

> [!success] success

> [!question] question

> [!bug] bug

## Embeds

An image from the vault (looked up by name across the whole vault) and the
same one 120px wide:

![[diagram.svg]]
![[diagram.svg|120]]

A whole note:

![[Embedded note]]

Only a section of a note:

![[Embedded note#Section B]]

A forced page break, as in Obsidian's export:

<div style="page-break-after: always;"></div>

Lorem ipsum dolor sit amet — this paragraph starts on a new page.
