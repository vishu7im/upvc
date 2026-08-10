# V2 CONTRAST REPORT

**Run:** 2026-08-07  
**Standard:** WCAG 2.x AA  
**Source:** `web/app/v2.css`  
**Command:** `node Spec/v2/design-system/contrast-check.mjs`

The checker converts sRGB tokens to relative luminance and applies
`(lighter + 0.05) / (darker + 0.05)`. Normal text must reach 4.5:1. Focus indicators and structural
control boundaries must reach 3:1. The V2 system does not rely on a large-text exception.

| Pair | Foreground | Background | Ratio | Required | Result |
|---|---:|---:|---:|---:|---|
| Primary text / surface | `#111418` | `#FFFFFF` | 18.47:1 | 4.5:1 | Pass |
| Primary text / page | `#111418` | `#F6F7F9` | 17.23:1 | 4.5:1 | Pass |
| Secondary text / surface | `#53606D` | `#FFFFFF` | 6.44:1 | 4.5:1 | Pass |
| Secondary text / page | `#53606D` | `#F6F7F9` | 6.01:1 | 4.5:1 | Pass |
| Metadata / surface | `#66717E` | `#FFFFFF` | 4.97:1 | 4.5:1 | Pass |
| Metadata / page | `#66717E` | `#F6F7F9` | 4.63:1 | 4.5:1 | Pass |
| Table heading / subtle surface | `#3E4752` | `#ECEFF2` | 8.17:1 | 4.5:1 | Pass |
| Disabled text / subtle surface | `#53606D` | `#ECEFF2` | 5.58:1 | 4.5:1 | Pass |
| Accent text / surface | `#3155C6` | `#FFFFFF` | 6.47:1 | 4.5:1 | Pass |
| Accent text / accent soft | `#3155C6` | `#EEF2FF` | 5.79:1 | 4.5:1 | Pass |
| Primary-button text / accent | `#FFFFFF` | `#3155C6` | 6.47:1 | 4.5:1 | Pass |
| Primary-button text / accent hover | `#FFFFFF` | `#2645A8` | 8.40:1 | 4.5:1 | Pass |
| Success text / surface | `#167451` | `#FFFFFF` | 5.75:1 | 4.5:1 | Pass |
| Success text / success soft | `#167451` | `#EAF8F1` | 5.26:1 | 4.5:1 | Pass |
| Warning text / surface | `#8A4B08` | `#FFFFFF` | 6.79:1 | 4.5:1 | Pass |
| Warning text / warning soft | `#8A4B08` | `#FFF4DE` | 6.23:1 | 4.5:1 | Pass |
| Error text / surface | `#B42318` | `#FFFFFF` | 6.57:1 | 4.5:1 | Pass |
| Error text / error soft | `#B42318` | `#FFF0EE` | 5.93:1 | 4.5:1 | Pass |
| Control border / surface | `#848F9B` | `#FFFFFF` | 3.29:1 | 3.0:1 | Pass |
| Structural border / page | `#848F9B` | `#F6F7F9` | 3.07:1 | 3.0:1 | Pass |
| Focus ring / surface | `#3155C6` | `#FFFFFF` | 6.47:1 | 3.0:1 | Pass |
| Focus ring / page | `#3155C6` | `#F6F7F9` | 6.04:1 | 3.0:1 | Pass |

## Result

**22 of 22 declared pairs pass.** The tightest normal-text pair is metadata on the page at 4.63:1.
The tightest non-text pair is a structural border on the page at 3.07:1. Both remain above their AA
thresholds.

This report covers the finite screen-UI palette. Engine SVGs and engine-generated documents own
their palettes and remain isolated under U-15. Any new V2 foreground/background combination must be
added to `contrast-check.mjs` and pass before use.
