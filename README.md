check back in 3 months when scramjet supports 23% of what UV supports

TODO
- Finish HTML rewriting
    - \<meta> tag rewriting: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta
    - Build script imports for scramjet scripts in DomHandler AST

    - example stringified output:
    ```html
    <!-- Append to <head> element -->
    <script src="./scramjet.codecs.js"></script>
    <script src="./scramjet.config.js"></script>
    <script src="./scramjet.bundle.js"></script>  
    ```
    - `<script type="importmap"></script>` rewriting
        - Make an array of all possible import values and pass the array onto the JS rewriter, then rewrite all the URLs inside of it
- Fix URL rewriting
    - Pass the full the full url object arround instead of just the origin and if the url is relative append it to the url path before adding it to the origin
- Finish JS rewriting 
    - Only thing rewritten currently are imports and exports
    - Check imports/exports for values contained in the `importmap` array, don't rewrite the node value if present
- Fix CSS rewriting
    - CSS rewriting only rewrites the `url()` function, but `@import` rules can import urls using just a string: https://developer.mozilla.org/en-US/docs/Web/CSS/@import
- Rewrite `Link` header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link
- Write client APIs
    - `__scope$()` function for JS rewriting
    - Location object
    - Window object
    - LocalStorage, SessionStorage, IDB objects
    - Cookies
    - HTMLElement overrides
    - WebSocket
    - SW emulation
    - Blah blah blah nerdy apis just do it