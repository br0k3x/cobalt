import "dotenv/config";
import adapterStatic from "@sveltejs/adapter-static";
import adapterNode from "@sveltejs/adapter-node";

import { mdsvex } from "mdsvex";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sveltePreprocess } from "svelte-preprocess";

const useNodeAdapter = process.env.WEB_ADAPTER === "node";

const staticAdapter = adapterStatic({
    pages: 'build',
    assets: 'build',
    fallback: '404.html',
    precompress: false,
    strict: true
});

const nodeAdapter = adapterNode({
    out: 'build'
});

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://kit.svelte.dev/docs/integrations#preprocessors
    // for more information about preprocessors
    extensions: [".svelte", ".md"],
    preprocess: [
        {
            name: "strip-announcer",
            markup: ({ content: code }) => {
                code = code.replace(
                    /<div id="svelte-announcer" [\s\S]*?<\/div>/,
                    '{null}'
                );

                return { code }
            }
        },
        sveltePreprocess(),
        mdsvex({
            extensions: ['.md'],
            layout: {
                about: join(
                    dirname(fileURLToPath(import.meta.url)),
                    '/src/components/misc/AboutPageWrapper.svelte'
                ),
                changelogs: join(
                    dirname(fileURLToPath(import.meta.url)),
                    '/src/components/changelog/ChangelogEntryWrapper.svelte'
                )
            }
        })
    ],
    kit: {
        adapter: useNodeAdapter ? nodeAdapter : staticAdapter,
        csp: {
            mode: "hash",
            directives: {
                "connect-src": ["*"],
                "default-src": ["none"],

                "font-src": ["self"],
                "style-src": ["self", "unsafe-inline"],
                "img-src": ["*", "data:"],
                "manifest-src": ["self"],
                "worker-src": ["self"],

                "object-src": ["none"],
                "frame-src": [
                    "self",
                    "challenges.cloudflare.com"
                ],

                "script-src": [
                    "self",
                    "wasm-unsafe-eval",
                    "challenges.cloudflare.com",

                    // eslint-disable-next-line no-undef
                    process.env.WEB_PLAUSIBLE_HOST ? process.env.WEB_PLAUSIBLE_HOST : "",

                    // hash of the theme preloader in app.html
                    "sha256-g67gIjM3G8yMbjbxyc3QUoVsKhdxgcQzCmSKXiZZo6s=",
                ],

                "script-src-attr": [
                    "unsafe-hashes",
                    // hash of inline img event call
                    // see: https://github.com/sveltejs/svelte/issues/14014
                    "sha256-7dQwUgLau1NFCCGjfn9FsYptB6ZtWxJin6VohGIu20I="
                ],

                "frame-ancestors": ["none"]
            }
        },
        env: {
            publicPrefix: 'WEB_'
        },
        version: {
            pollInterval: 60000
        },
        paths: {
            relative: false
        },
        alias: {
            $components: 'src/components',
            $i18n: 'i18n',
        }
    }
};

export default config;
