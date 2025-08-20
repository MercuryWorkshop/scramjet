(cd playwright && npm run watch) &
(cd playwright/web_builder && npx rollup -cw) &
(pnpm dev) &
(cd dreamlandjs && pnpm watch) &
(cd chobitsu && pnpm webpack --watch --mode=development) &
(cd page_inject && npx rollup -cw) &
(cd frontend && pnpm dev) &
