---
title: Data and charts
---

# Data and charts

A report with charts, without Excel and without images: mermaid draws
everything straight from text, and the PDF gets vectors — charts stay sharp
at any zoom. The numbers below are made up.

## Revenue and trend

```mermaid
xychart
    title "Monthly revenue, $M"
    x-axis ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    y-axis "$M" 0 --> 120
    bar [42, 48, 55, 51, 63, 70, 74, 79, 88, 94, 103, 117]
    line [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95]
```

| Quarter  | Revenue, $M | Year-over-year growth | Plan met |
| :------- | ----------: | --------------------: | :------: |
| Q1       |       145.0 |               +18.2 % |    ✅    |
| Q2       |       184.0 |               +22.7 % |    ✅    |
| Q3       |       241.0 |               +31.4 % |    ✅    |
| Q4       |       314.0 |               +40.1 % |    🚀    |
| **Year** |   **884.0** |           **+29.6 %** |          |

## Where the money goes

A Sankey diagram shows the flow of money. Note that its parser in mermaid 12
understands only Latin labels:

```mermaid
sankey

Revenue,Salaries,410
Revenue,Infrastructure,160
Revenue,Marketing,120
Revenue,Profit,194
Infrastructure,Cloud,110
Infrastructure,Licenses,50
Marketing,Ads,80
Marketing,Conferences,40
```

```mermaid
pie showData title Expense breakdown
    "Salaries" : 410
    "Infrastructure" : 160
    "Marketing" : 120
```

## Products: where we are and where we are going

```mermaid
quadrantChart
    title Product portfolio
    x-axis Low market share --> High market share
    y-axis Slow growth --> Fast growth
    quadrant-1 Stars
    quadrant-2 Question marks
    quadrant-3 Dogs
    quadrant-4 Cash cows
    md2pdfX: [0.78, 0.86]
    Obsidian plugin: [0.32, 0.74]
    CLI: [0.62, 0.41]
    Old converter: [0.18, 0.15]
```

```mermaid
radar-beta
    title Converter comparison
    axis math["Math"], diag["Diagrams"], obs["Obsidian"], fonts["Fonts"], speed["Speed"], setup["Setup"]
    curve a["md2pdfX"]{5, 5, 5, 5, 4, 5}
    curve b["Pandoc"]{5, 2, 1, 4, 3, 2}
    curve c["Browser"]{2, 1, 1, 3, 5, 5}
    max 5
```

```mermaid
treemap-beta
"Users"
    "VS Code"
        "Windows": 48
        "Linux": 31
        "macOS": 22
    "CLI"
        "CI/CD": 27
        "Scripts": 14
    "Binary": 19
```

## Project history

```mermaid
timeline
    title The md2pdfX journey
    2026-08 : First PDF from Markdown
            : KaTeX math
    2026-09 : mermaid 12 diagrams
            : Obsidian syntax
            : VS Code extension
    1.4     : Export as a book
            : GOST theme
            : Watermark
```

```mermaid
journey
    title User journey: from note to PDF
    section Writes
      Opened a note: 5: Author
      Added formulas and diagrams: 4: Author
    section Exports
      Clicked “Export to PDF”: 5: Author
      Picked the GOST theme: 5: Author
    section Sends
      Sent it to the supervisor: 3: Author
      Got “accepted”: 5: Author, Supervisor
```

```mermaid
venn-beta
    title What md2pdfX can do
    set A["GitHub"]:20
    set B["Obsidian"]:20
    set C["LaTeX"]:20
    union A,B:2.5
    union B,C:2.5
    union A,C:2.5
    union A,B,C["md2pdfX"]:1.2
```
