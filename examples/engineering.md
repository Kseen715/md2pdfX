---
title: Engineering documentation
---

# Engineering documentation

Architecture, protocols, processes and plans — in one `.md` that lives in the
repository next to the code and builds into a PDF with one command.

## Architecture

```mermaid
architecture-beta
    group cloud(cloud)[Cloud]
    service lb(internet)[nginx] in cloud
    service api(server)[API] in cloud
    service db(database)[PostgreSQL] in cloud
    service s3(disk)[Storage] in cloud
    lb:R --> L:api
    api:R --> L:db
    api:B --> T:s3
```

```mermaid
C4Context
    title Export system context
    Person(user, "Author", "Writes notes in VS Code or Obsidian")
    System(md2pdf, "md2pdfX", "Markdown → PDF")
    System_Ext(chrome, "Chrome", "Renders pages and prints the PDF")
    Rel(user, md2pdf, "Export to PDF")
    Rel(md2pdf, chrome, "HTML", "CDP")
```

```mermaid
block
    columns 3
    md["Markdown"] space html["HTML + CSS"]
    md --> html
    space:3
    pdf["PDF"] space chrome["Chrome"]
    html --> chrome
    chrome --> pdf
```

## Protocol

A packet format, laid out down to the bit:

```mermaid
packet
    title UDP header
    0-15: "Source port"
    16-31: "Destination port"
    32-47: "Length"
    48-63: "Checksum"
    64-95: "Data (variable length)"
```

```http
POST /api/export HTTP/1.1
Host: example.org
Content-Type: application/json

{"source": "notes/report.md", "theme": "gost", "watermark": "DRAFT"}
```

## Development

```mermaid
gitGraph
    commit id: "init"
    commit id: "parser"
    branch feature/book
    checkout feature/book
    commit id: "cross-file links"
    commit id: "chapters"
    checkout main
    commit id: "fix: fonts"
    merge feature/book tag: "v1.4.0"
    commit id: "GOST theme" tag: "v1.4.4"
```

```mermaid
kanban
    todo[To do]
        t1[Presentation theme]
    doing[In progress]
        t2[PDF table of contents]@{ assigned: 'dev', priority: 'High' }
    done[Done]
        t3[Export as a book]
        t4[Watermark]
```

```mermaid
requirementDiagram
    requirement pdf_look {
        id: 1
        text: "The PDF looks the same on any machine"
        risk: high
        verifymethod: test
    }
    element fonts {
        type: "embedded fonts"
    }
    fonts - satisfies -> pdf_look
```

## Incident analysis

```mermaid
ishikawa
    Diagram cut off in the PDF
    People
        Long labels
        No br line breaks
    Tool
        Page width
        ELK layout
    Data
        30 nodes in a row
```

> [!success] How md2pdfX solves it
> A diagram that does not fit moves to a landscape page on its own, then
> gets redrawn in another direction, and only as a last resort is cut into
> pieces. See [big-diagrams.md](big-diagrams.md).

## Code

```rust
use std::collections::HashMap;

fn word_count(text: &str) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}
```

```go
func handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/pdf")
	if err := render(r.Context(), w); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
```

```sql
SELECT author, count(*) AS pages
FROM documents
WHERE exported_at > now() - interval '7 days'
GROUP BY author
ORDER BY pages DESC
LIMIT 10;
```

```yaml
# .github/workflows/docs.yml — documentation PDF in every release
- run: npx md2pdf docs/ -o dist/ --theme gost --watermark "v${{ github.ref_name }}"
```
