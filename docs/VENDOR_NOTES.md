# Vendor notes

Third-party visual components and their dependencies. Vendor source in `src/components/vendor/reactbits/` is copied **unedited**; any patch is recorded below with the file, the change and the reason.

## Status

| Component | Source received | Integrated | Patches |
|---|---|---|---|
| PillNav | **No.** The change request said the source was pasted at the end of the message, but it wasn't included | No | — |
| FlexCarousel | **No** (same) | No | — |
| AeroShards | **No** (same) | No | — |

Integration starts once the three source files (each with its CSS) are supplied. Everything that doesn't depend on them has been built: hero fit, mobile work, scroll-spy, sticky bar, the BrandMark placeholder, TBA speaker images, and the HTML fallback row.

## Licences

### React Bits: MIT + Commons Clause License Condition v1.0
Checked 23 Oct 2026 at github.com/DavidHDev/react-bits (LICENSE.md).
- Grants use "as part of an application, website, or product", including commercial and paid projects.
- Restricts selling, sublicensing or redistributing "the components themselves", or offering them (or a substantially similar copy) as a hosted service.
- **Result: permitted** for this commercial client website. We use the components inside the site; we don't sell or redistribute them on their own. Keep the licence text alongside the vendor folder (`src/components/vendor/reactbits/LICENSE.md`) when the source is added.
- Provided "as is", without warranty.

## Packages (exact pins; no ^ or ~)

| Package | Used by | Version to pin | Licence | Maintainer / repo | Maintenance status (23 Oct 2026) |
|---|---|---|---|---|---|
| `ogl` | FlexCarousel (WebGL) | `1.0.11` | Unlicense (public domain) | oframe/ogl (Nathan Gordon) | Mature and stable; last release Jan 2025. Small, dependency-free WebGL library in wide use. Low risk. |
| `vgpu` | AeroShards (WebGPU) | `0.6.0` | MIT | vercel-labs/vgpu | **Pre-1.0 and very new**: 0.6.0 was published 12 Oct 2026 (an `0.6.0-rc.2` also exists). Expect API changes between minors. Pin exactly, don't auto-update, and keep the still-image fallback, which we require anyway. |

Neither package has been installed yet. They're added at integration time, together with a bundle-analyser check that they stay out of the initial JavaScript.

## Patches

None.
