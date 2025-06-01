import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import icon from "astro-icon";

export default defineConfig({
    site: "https://astro-nano-demo.vercel.app",
    integrations: [mdx(), sitemap(), tailwind(), icon()],
    markdown: {
        remarkPlugins: [
            remarkMath,
        ],
        rehypePlugins: [rehypeKatex]
    }
});
