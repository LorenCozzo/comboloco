import type { ReactNode } from "react";

// App Bridge navigation menu web component. It's provided at runtime by App
// Bridge but isn't declared by @shopify/polaris-types (which only covers
// Polaris `s-*` elements), so we register it with React's JSX here — mirroring
// the `declare module 'react'` augmentation polaris-types uses for its own tags.
//
// This file has a top-level import/export so it is treated as a module, which
// makes `declare module "react"` *augment* (merge with) the real react types
// rather than shadow them.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": { children?: ReactNode };
    }
  }
}

export {};
