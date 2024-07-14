function scope(identifier: any) {
    if (identifier instanceof Window) {
        return window.__window;
    } else if (identifier instanceof Location) {
        return window.__location;
    }

    return identifier;
}

// shorthand because this can get out of hand reall quickly
window.__s = scope;