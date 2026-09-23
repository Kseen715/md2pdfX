---
title: Нумерованные формулы
---

# Нумерованные формулы и ссылки на них

Как в LaTeX: формула с `\label{ключ}` получает номер справа, а `\eqref{ключ}`
в тексте превращается в ссылку «(1)», по которой PDF переходит к формуле.
`\ref{ключ}` даёт номер без скобок. Свой номер задаётся `\tag{…}`, формулы без
`\label` не нумеруются.

```markdown
$$
E = mc^2 \label{eq:energy}
$$

Из формулы \eqref{eq:energy} следует… Или внутри $…$: $\eqref{eq:energy}$.
```

## Механика

Второй закон Ньютона:

$$
\mathbf{F} = m \mathbf{a} = m \frac{d^2 \mathbf{r}}{dt^2}
\label{eq:newton}
$$

Для пружины сила $\mathbf{F} = -k\mathbf{x}$ (закон Гука), и уравнение
\eqref{eq:newton} превращается в уравнение гармонического осциллятора:

$$
\ddot{x} + \omega^2 x = 0, \qquad \omega = \sqrt{\frac{k}{m}}
\label{eq:oscillator}
$$

Его решение:

$$
x(t) = A \cos(\omega t + \varphi_0)
\label{eq:solution}
$$

Подставив \eqref{eq:solution} в \eqref{eq:oscillator}, легко убедиться, что
это действительно решение, а частота $\omega$ зависит только от $k$ и $m$ —
но не от амплитуды $A$.

Промежуточные выкладки номер не получают:

$$
\dot{x}(t) = -A\omega \sin(\omega t + \varphi_0), \qquad
\ddot{x}(t) = -A\omega^2 \cos(\omega t + \varphi_0) = -\omega^2 x(t)
$$

## Энергия

Полная энергия осциллятора сохраняется:

$$
E = \frac{m \dot{x}^2}{2} + \frac{k x^2}{2} = \frac{k A^2}{2} = \text{const}
\label{eq:energy}
$$

Формула \eqref{eq:energy} верна для любого момента времени — проверьте,
подставив \eqref{eq:solution}.

## Свой номер

В статье, продолжающей другую, нумерацию можно подхватить — `\tag{45}`:

```math
E^2 = (pc)^2 + \left(mc^2\right)^2
\tag{45}\label{eq:relativistic}
```

Номер можно дать и словом:

$$
e^{i\pi} + 1 = 0 \tag{Эйлер}\label{eq:euler}
$$

Ссылки работают и на них: \eqref{eq:relativistic} — релятивистская связь
энергии и импульса, при $p = 0$ она даёт знаменитое $E = mc^2$; тождество
\eqref{eq:euler} связывает пять главных констант математики. А `\ref` без
скобок: «см. формулу \ref{eq:relativistic} на этой странице».

## Сводка

| Формула                 | Что описывает                  |
| :---------------------- | :----------------------------- |
| \eqref{eq:newton}       | второй закон Ньютона           |
| \eqref{eq:oscillator}   | гармонический осциллятор       |
| \eqref{eq:solution}     | его решение                    |
| \eqref{eq:energy}       | закон сохранения энергии       |
| \eqref{eq:relativistic} | энергия и импульс в СТО        |
| $\eqref{eq:euler}$      | тождество Эйлера               |

> [!note] Ссылки внутри callout'ов и сносок тоже работают
> Период колебаний из \eqref{eq:oscillator}: $T = 2\pi/\omega$[^period].

Ссылка на несуществующую формулу видна сразу, как в LaTeX: \eqref{eq:missing}.

[^period]: Для математического маятника $\omega = \sqrt{g/l}$ — это
    уравнение \eqref{eq:oscillator} при малых углах.
