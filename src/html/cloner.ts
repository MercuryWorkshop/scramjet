export default class Clone {
    el: HTMLElement;
    copy: HTMLElement

    constructor(element: HTMLElement) {
        this.el = element;
        this.copy = document.createElement(element.tagName);

        for (const attr of element.getAttributeNames()) {
            this.copy.setAttribute(attr, element.getAttribute(attr));
        }

        if (element.innerHTML) {
            this.copy.innerHTML = element.innerHTML;
        }
    }

    insertCopy() {
        this.el.insertAdjacentElement("afterend", this.copy);
    }

    removeElement() {
        this.el.remove();
    }
}