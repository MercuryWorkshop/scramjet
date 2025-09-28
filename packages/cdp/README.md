# chobitsu

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Test coverage][codecov-image]][codecov-url]
[![License][license-image]][npm-url]

[npm-image]: https://img.shields.io/npm/v/chobitsu?style=flat-square 
[npm-url]: https://npmjs.org/package/chobitsu
[ci-image]: https://img.shields.io/github/actions/workflow/status/liriliri/chobitsu/main.yml?branch=master&style=flat-square 
[ci-url]: https://github.com/liriliri/chobitsu/actions/workflows/main.yml
[codecov-image]: https://img.shields.io/codecov/c/github/liriliri/chobitsu?style=flat-square
[codecov-url]: https://codecov.io/github/liriliri/chobitsu?branch=master
[license-image]: https://img.shields.io/npm/l/chobitsu?style=flat-square

[Chrome devtools protocol](https://chromedevtools.github.io/devtools-protocol/) JavaScript implementation.

## Install

You can get it on npm.

```bash
npm install chobitsu --save
```

## Usage

```javascript
const chobitsu = require('chobitsu');

chobitsu.setOnMessage(message => {
  console.log(message);
});

chobitsu.sendRawMessage(JSON.stringify({
  id: 1,  
  method: 'DOMStorage.clear',
  params: {
    storageId: {
      isLocalStorage: true,
      securityOrigin: 'http://example.com'
    }
  }
}));
```

For more detailed usage instructions, please read the documentation at [chii.liriliri.io](https://chii.liriliri.io/docs/chobitsu.html)!
