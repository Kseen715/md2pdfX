---
title: Пример синтаксиса Obsidian
tags: [пример, obsidian]
---

# Obsidian

Свойства (frontmatter) в PDF не выводятся, но `title` из них становится
подписью в колонтитуле. Переносы строк — как на GitHub: одиночный перевод
строки абзац не разрывает.

## Ссылки, теги, подсветка

- Вики-ссылка на другую заметку: [[Встраиваемая заметка]]
- С подписью: [[Встраиваемая заметка|другая заметка]]
- На заголовок этого документа: [[#Callout'ы]], с подписью: [[#Встраивание|к встраиванию]]
- На заголовок другой заметки: [[Встраиваемая заметка#Раздел А]]
- Несуществующая заметка при встраивании подсвечивается: ![[Нет такой]]

Теги: #пример #obsidian/pdf #lorem_ipsum. А это не теги: C#, #1, `#код`.

Подсветка: Lorem ipsum ==dolor sit amet==, consectetur adipiscing elit.

Комментарии не попадают в PDF: видно%% — а этого не видно %% только это.

%%
Многострочный комментарий.

Lorem ipsum dolor sit amet — тоже скрыт.
%%

## Callout'ы

> [!note]
> Callout без заголовка получает название типа. Lorem ipsum dolor sit amet.

> [!tip] Свой заголовок с **разметкой**
> Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

> [!warning]- Сворачиваемый (в PDF печатается раскрытым)
> Duis aute irure dolor in reprehenderit in voluptate velit esse.

> [!danger] Только заголовок

> [!example] Вложенность и содержимое
> - список внутри callout'а
> - `код` и $E = mc^2$
>
> > [!quote] Вложенный callout
> > Excepteur sint occaecat cupidatat non proident.

Остальные типы: 

> [!info] info
> [!abstract], [!todo], [!success], [!question], [!failure], [!bug], [!quote] — у каждого свой цвет.

> [!success] success

> [!question] question

> [!bug] bug

## Встраивание

Картинка из хранилища (ищется по имени во всём хранилище) и она же шириной 120px:

![[diagram.svg]]
![[diagram.svg|120]]

Заметка целиком:

![[Встраиваемая заметка]]

Только раздел заметки:

![[Встраиваемая заметка#Раздел Б]]

Принудительный разрыв страницы, как в экспорте Obsidian:

<div style="page-break-after: always;"></div>

Lorem ipsum dolor sit amet — этот абзац начинается с новой страницы.
