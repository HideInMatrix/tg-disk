import { defineConfig } from "unocss";
import presetRemToPx from "@unocss/preset-rem-to-px";
import presetAnimations from "unocss-preset-animations";
import { presetShadcn } from "unocss-preset-shadcn";
import presetWind from "@unocss/preset-wind4";

export default defineConfig({
  presets: [
    presetRemToPx({
      baseFontSize: 16,
    }),
    presetWind(),
    presetAnimations(),
    presetShadcn(
      {
        color: "green",
      },
      {
        // If you are using reka ui.
        componentLibrary: "reka",
      }
    ),
  ],
  // By default, `.ts` and `.js` files are NOT extracted.
  // If you want to extract them, use the following configuration.
  // It's necessary to add the following configuration if you use shadcn-vue or shadcn-svelte.
  content: {
    pipeline: {
      include: [
        // the default
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        // include js/ts files
        "(components|src)/**/*.{js,ts}",
      ],
    },
  },
});
