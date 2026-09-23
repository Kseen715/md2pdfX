# GitHub Flavored Markdown

A tour of the main GFM features. Lorem ipsum dolor sit amet, consectetur
adipiscing elit.

## Text and links

**Bold**, *italic*, ***both***, ~~strikethrough~~, `code`, <kbd>Ctrl</kbd>+<kbd>C</kbd>,
H<sub>2</sub>O, x<sup>2</sup>, emoji :rocket: :white_check_mark: :warning:.

- Plain link: [markdown-it](https://github.com/markdown-it/markdown-it)
- Autolink: https://github.com and <https://example.org>
- Anchor to a heading: [Tables and code](#tables-and-code)
- Anchor to a repeated heading: [the second “Repeat”](#repeat-1)
- Image by relative path:

![Pipeline diagram](attachments/diagram.svg)

### Repeat

Lorem ipsum.

### Repeat

Identical headings get the anchors `repeat` and `repeat-1`, as on GitHub.

## Lists and tasks

1. First item
2. Second item
   - nested bullet
   - another one
     1. and a numbered one deeper
3. Third item

- [x] Done task
- [ ] Open task
  - [x] nested task

> A plain quote. Sed ut perspiciatis unde omnis iste natus error sit
> voluptatem accusantium doloremque laudantium.

## Tables and code

| Left  |  Center   |  Right |
| :---- | :-------: | -----: |
| lorem |   ipsum   |   1.00 |
| dolor |    sit    |  10.50 |
| amet  |  `code`   | 100.25 |

```js
// Syntax highlighting — highlight.js
export function slugify(text) {
  return text.trim().toLowerCase().replace(/ /g, '-');
}
```

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
```

```diff
- removed line
+ added line
```

## Alerts

> [!NOTE]
> Useful information that users should know, even when skimming content.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information users need to know to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate user attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

## Footnotes and more

A statement with a footnote[^1] and another one[^note].

[^1]: Text of the first footnote.
[^note]: Footnotes are collected at the end of the document.

<details>
<summary>Collapsible block</summary>

Printed expanded in the PDF. Lorem ipsum dolor sit amet.

</details>

---

The horizontal rule above is visible: only the lines around `##` are hidden.
