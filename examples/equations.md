---
title: Numbered equations
---

# Numbered equations and references to them

As in LaTeX: an equation with `\label{key}` gets a number on the right, and
`\eqref{key}` in the text becomes a link “(1)” that jumps to the equation in
the PDF. `\ref{key}` gives the number without parentheses. A custom number is
set with `\tag{…}`; equations without `\label` are not numbered.

```markdown
$$
E = mc^2 \label{eq:energy}
$$

It follows from equation \eqref{eq:energy}… Or inside $…$: $\eqref{eq:energy}$.
```

## Mechanics

Newton's second law:

$$
\mathbf{F} = m \mathbf{a} = m \frac{d^2 \mathbf{r}}{dt^2}
\label{eq:newton}
$$

For a spring the force is $\mathbf{F} = -k\mathbf{x}$ (Hooke's law), and
equation \eqref{eq:newton} becomes the harmonic oscillator equation:

$$
\ddot{x} + \omega^2 x = 0, \qquad \omega = \sqrt{\frac{k}{m}}
\label{eq:oscillator}
$$

Its solution:

$$
x(t) = A \cos(\omega t + \varphi_0)
\label{eq:solution}
$$

Substituting \eqref{eq:solution} into \eqref{eq:oscillator}, it is easy to
check that this is indeed a solution, and the frequency $\omega$ depends only
on $k$ and $m$ — not on the amplitude $A$.

Intermediate steps get no number:

$$
\dot{x}(t) = -A\omega \sin(\omega t + \varphi_0), \qquad
\ddot{x}(t) = -A\omega^2 \cos(\omega t + \varphi_0) = -\omega^2 x(t)
$$

## Energy

The total energy of the oscillator is conserved:

$$
E = \frac{m \dot{x}^2}{2} + \frac{k x^2}{2} = \frac{k A^2}{2} = \text{const}
\label{eq:energy}
$$

Equation \eqref{eq:energy} holds at any moment in time — check it by
substituting \eqref{eq:solution}.

## Custom numbers

A paper that continues another one can pick up its numbering — `\tag{45}`:

```math
E^2 = (pc)^2 + \left(mc^2\right)^2
\tag{45}\label{eq:relativistic}
```

A number can also be a word:

$$
e^{i\pi} + 1 = 0 \tag{Euler}\label{eq:euler}
$$

References work for them too: \eqref{eq:relativistic} is the relativistic
energy–momentum relation, which at $p = 0$ gives the famous $E = mc^2$; the
identity \eqref{eq:euler} links the five most important constants of
mathematics. And `\ref` without parentheses: “see equation
\ref{eq:relativistic} on this page”.

## Summary

| Equation                | What it describes              |
| :---------------------- | :----------------------------- |
| \eqref{eq:newton}       | Newton's second law            |
| \eqref{eq:oscillator}   | harmonic oscillator            |
| \eqref{eq:solution}     | its solution                   |
| \eqref{eq:energy}       | conservation of energy         |
| \eqref{eq:relativistic} | energy and momentum in SR      |
| $\eqref{eq:euler}$      | Euler's identity               |

> [!note] References inside callouts and footnotes work too
> The period of oscillation from \eqref{eq:oscillator}: $T = 2\pi/\omega$[^period].

A reference to a missing equation is visible right away, as in LaTeX: \eqref{eq:missing}.

[^period]: For a simple pendulum $\omega = \sqrt{g/l}$ — this is
    equation \eqref{eq:oscillator} for small angles.
