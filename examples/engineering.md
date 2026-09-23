---
title: Инженерная документация
---

# Инженерная документация

Архитектура, протоколы, процессы и планы — в одном `.md`, который живёт в
репозитории рядом с кодом и собирается в PDF одной командой.

## Архитектура

```mermaid
architecture-beta
    group cloud(cloud)[Облако]
    service lb(internet)[nginx] in cloud
    service api(server)[API] in cloud
    service db(database)[PostgreSQL] in cloud
    service s3(disk)[Хранилище] in cloud
    lb:R --> L:api
    api:R --> L:db
    api:B --> T:s3
```

```mermaid
C4Context
    title Контекст системы экспорта
    Person(user, "Автор", "Пишет заметки в VS Code или Obsidian")
    System(md2pdf, "md2pdfX", "Markdown → PDF")
    System_Ext(chrome, "Chrome", "Рисует страницы и печатает PDF")
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

## Протокол

Формат пакета — наглядно, до бита:

```mermaid
packet
    title Заголовок UDP
    0-15: "Порт отправителя"
    16-31: "Порт получателя"
    32-47: "Длина"
    48-63: "Контрольная сумма"
    64-95: "Данные (переменной длины)"
```

```http
POST /api/export HTTP/1.1
Host: example.org
Content-Type: application/json

{"source": "notes/отчёт.md", "theme": "gost", "watermark": "ЧЕРНОВИК"}
```

## Разработка

```mermaid
gitGraph
    commit id: "init"
    commit id: "парсер"
    branch feature/book
    checkout feature/book
    commit id: "ссылки между файлами"
    commit id: "главы"
    checkout main
    commit id: "fix: шрифты"
    merge feature/book tag: "v1.4.0"
    commit id: "тема ГОСТ" tag: "v1.4.4"
```

```mermaid
kanban
    todo[Сделать]
        t1[Тема для презентаций]
    doing[В работе]
        t2[Оглавление в PDF]@{ assigned: 'dev', priority: 'High' }
    done[Готово]
        t3[Экспорт книгой]
        t4[Водяной знак]
```

```mermaid
requirementDiagram
    requirement pdf_look {
        id: 1
        text: "PDF выглядит одинаково на любой машине"
        risk: high
        verifymethod: test
    }
    element fonts {
        type: "встроенные шрифты"
    }
    fonts - satisfies -> pdf_look
```

## Разбор инцидента

```mermaid
ishikawa
    Диаграмма обрезана в PDF
    Люди
        Длинные подписи
        Нет переносов br
    Инструмент
        Ширина листа
        Раскладка ELK
    Данные
        30 узлов в ряд
```

> [!success] Как md2pdfX это решает
> Диаграмма, которая не влезает, сама уходит на альбомный лист, потом
> перерисовывается в другом направлении, и только в крайнем случае режется
> на куски. См. [big-diagrams.md](big-diagrams.md).

## Код

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
# .github/workflows/docs.yml — PDF документации в каждом релизе
- run: npx md2pdf docs/ -o dist/ --theme gost --watermark "v${{ github.ref_name }}"
```
