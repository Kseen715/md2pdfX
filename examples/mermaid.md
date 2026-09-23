# Mermaid diagrams

A ` ```mermaid ` block turns into SVG. Break long labels with `<br/>`,
otherwise the diagram shrinks to fit the page width.

## Flowchart and sequence

```mermaid
flowchart TD
    A([Start]) --> B{Is there an .md?}
    B -->|yes| C[markdown-it]
    B -->|no| X([Error])
    subgraph Browser
        C --> D[mermaid.js]
        D --> E[print PDF]
    end
    E --> F([Done])
```

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant M as md2pdf
    participant C as Chrome
    U->>M: md2pdf doc.md
    M->>C: HTML
    C-->>M: PDF
    Note right of C: page numbers<br/>in the footer
    M-->>U: doc.pdf
```

## Classes, states, ER

```mermaid
classDiagram
    class Document {
        +String title
        +render() Html
    }
    class Pdf {
        +int pages
    }
    Document --> Pdf : is printed to
```

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Review: submit
    Review --> Draft: changes
    Review --> Published: approve
    Published --> [*]
```

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : owns
    DOCUMENT {
        uuid id
        string key
        string status
    }
```

## Charts and plans

```mermaid
pie title Lorem ipsum
    "Lorem" : 45
    "Ipsum" : 30
    "Dolor" : 25
```

```mermaid
gantt
    title Plan
    dateFormat YYYY-MM-DD
    section Development
    Parser      :done, a1, 2026-09-01, 7d
    Printing    :active, a2, after a1, 5d
    section Release
    Binary      :a3, after a2, 3d
```

```mermaid
mindmap
  root((md2pdf))
    Markdown
      GitHub
      Obsidian
    Graphics
      Mermaid
      KaTeX
```
