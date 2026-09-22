# Диаграммы Mermaid

Блок ` ```mermaid ` превращается в SVG. Длинные подписи разбивайте через
`<br/>`, иначе схема ужмётся под ширину страницы.

## Блок-схема и последовательность

```mermaid
flowchart TD
    A([Начало]) --> B{Есть .md?}
    B -->|да| C[markdown-it]
    B -->|нет| X([Ошибка])
    subgraph Браузер
        C --> D[mermaid.js]
        D --> E[печать PDF]
    end
    E --> F([Готово])
```

```mermaid
sequenceDiagram
    autonumber
    participant U as Пользователь
    participant M as md2pdf
    participant C as Chrome
    U->>M: md2pdf doc.md
    M->>C: HTML
    C-->>M: PDF
    Note right of C: номера страниц<br/>в колонтитуле
    M-->>U: doc.pdf
```

## Классы, состояния, ER

```mermaid
classDiagram
    class Document {
        +String title
        +render() Html
    }
    class Pdf {
        +int pages
    }
    Document --> Pdf : печатается в
```

```mermaid
stateDiagram-v2
    [*] --> Черновик
    Черновик --> Ревью: отправить
    Ревью --> Черновик: правки
    Ревью --> Опубликован: одобрить
    Опубликован --> [*]
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

## Графики и планы

```mermaid
pie title Lorem ipsum
    "Lorem" : 45
    "Ipsum" : 30
    "Dolor" : 25
```

```mermaid
gantt
    title План
    dateFormat YYYY-MM-DD
    section Разработка
    Парсер      :done, a1, 2026-09-01, 7d
    Печать      :active, a2, after a1, 5d
    section Выпуск
    Бинарник    :a3, after a2, 3d
```

```mermaid
mindmap
  root((md2pdf))
    Markdown
      GitHub
      Obsidian
    Графика
      Mermaid
      KaTeX
```
