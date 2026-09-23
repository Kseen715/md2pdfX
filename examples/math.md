# LaTeX math

KaTeX renders formulas at build time, the browser only needs the font. The
syntax is the same as on GitHub and in Obsidian.

## Inline and block

Inline formula: $E = mc^2$, a fraction $\frac{a}{b}$, a root $\sqrt[3]{x}$,
Greek letters $\alpha, \beta, \Gamma$. A dollar sign without a formula is escaped: \$5.

Block formula:

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

A ` ```math ` block is the GitHub variant:

```math
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
```

## Matrices, systems, alignment

$$
A = \begin{pmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{pmatrix},
\qquad \det A = a_{11}a_{22} - a_{12}a_{21}
$$

$$
f(x) = \begin{cases}
  x^2, & x \ge 0 \\
  -x,  & x < 0
\end{cases}
$$

$$
\begin{aligned}
  (a + b)^2 &= a^2 + 2ab + b^2 \\
  (a - b)^2 &= a^2 - 2ab + b^2
\end{aligned}
$$

A formula in a table:

| Quantity | Formula                        |
| -------- | ------------------------------ |
| Area     | $S = \pi r^2$                  |
| Entropy  | $H = -\sum_i p_i \log_2 p_i$   |

An error in a formula does not break the build, it is highlighted: $\frac{1}{$.
