# babel-plugin-customize-imports

Add function support for 【skipDefaultConversion】 parameter, the parameters are the same as 【transform】

Transforms member style imports:

```javascript
import { Fun1, UnRenamedFun as ReNamedFun } from 'your-utils';
import { merge } from 'lodash';
```

...into default style imports:

```javascript
import Fun1 from 'your-utils/lib/Fun1';
import ReNamedFun from 'your-utils/lib/UnRenamedFun';
import merge from 'lodash/merge';
```

*Note: this plugin is not restricted to the your-utils and lodash
libraries.  You may use it with any library.*

## Why?

When Babel encounters a member style import such as:

```javascript
import { UnRenamedFun, Fun1, Fun2 } from 'your-utils';
```

it will generate something similarish to:

```javascript
var yourUtils = require('your-utils');
var UnRenamedFun = yourUtils.UnRenamedFun;
var Fun1 = yourUtils.Fun1;
var Fun2 = yourUtils.Fun2;
```

Which causes the entire library to be loaded, even though only some components
are needed.  Some libraries are rather large and pulling in the entire module
would cause unnecessary bloat to your client optimized (webpack etc.) bundle.
The only way around this is to use default style imports:

```javascript
import UnRenamedFun from 'your-utils/lib/UnRenamedFun';
import Fun1 from 'your-utils/lib/Fun1';
import Fun2 from 'your-utils/lib/Fun2';
```

But, the more pieces we need, the more this sucks.  This plugin will allow you
to pull in just the pieces you need, without a separate import for each item.
Additionally, it can be configured to throw when somebody accidentally writes
an import which would cause the entire module to resolve, such as:

```javascript
import Bootstrap, { UnRenamedFun } from 'your-utils';
// -- or --
import * as Bootstrap from 'your-utils';
```

## Installation

```
npm install --save-dev babel-plugin-customize-imports
```

## Usage

`.babelrc`:

```json
{
  "plugins": [
    ["transform-imports", {
      "your-utils": {
        "transform": "your-utils/lib/${member}",
        "preventFullImport": true
      },
      "lodash": {
        "transform": "lodash/${member}",
        "preventFullImport": true
      }
    }]
  ]
}
```

## Advanced Transformations

### Using regular expressions

Sometimes, you may wish to use regular expressions in your transformation (for
example, to enforce the same convention in all folder levels on the structure
of your library).

`.babelrc`:

```json
{
  "plugins": [
    ["transform-imports", {
      "my-library\/?(((\\w*)?\/?)*)": {
        "transform": "my-library/${1}/${member}",
        "preventFullImport": true
      }
    }]
  ]
}
```

Causes this code:

```javascript
import { MyModule } from 'my-library';
import { App } from 'my-library/components';
import { Header, Footer } from 'my-library/components/App';
```

to become:

```javascript
import MyModule from 'my-library/MyModule';
import App from 'my-library/components/App';
import Header from 'my-library/components/App/Header';
import Footer from 'my-library/components/App/Footer';
```

### Using a function as the transformer

If you need more advanced or more specific transformation logic, and are using
Babel 7+ with a `babel.config.js` file, you may provide a function instead of a
string for the `transform` option:

`babel.config.js`:

```javascript
module.exports = {
  presets: ['@babel/env'],
  plugins: [
    ['transform-imports', {
      'my-library': {
        transform: (importName, matches) => `my-library/etc/${importName.toUpperCase()}`,
        preventFullImport: true,
      },
      'date-fns': {
        transform: importName => `date-fns/${camelCase(importName)}`,
        preventFullImport: true,
      },
    }]
  ]
};
```

You may combine a regular expression in the library name with a function
transform, and any captures of the regex will be passed as a second argument.

## Webpack

This can be used as a plugin with babel-loader.

webpack.config.js:
```javascript
module: {
  rules: [{
    test: /\.js$/,
    exclude: /(node_modules|bower_components)/,
    use: {
      loader: 'babel-loader',
      query: {
        plugins: [
          [require('babel-plugin-customize-imports'), {
            'my-library': {
              transform: function(importName, matches) {
                return 'my-library/etc/' + importName.toUpperCase();
              },
              preventFullImport: true
            }
          }]
        ]
      }
    }
  }]
}
```

## Version 2.0 Breaking Changes

Version 2.0 of this plugin targets Babel 7. Since Babel 7 allows for JS inside
the config via `.babelrc.js` or `babel.config.js`, the specialized transforms
`camelCase`, `kebabCase`, and `snakeCase` have been dropped. If you still need
this functionality, you can import `lodash` directly in your config file and
use those functions as part of a return value passed to the `transform` function
(see *Using a function as the transformer* above).

If you are on Babel 6, this plugin should still work, but if you need the prior
specialized functionality, please use the ^1.0.0 version of this library and
see the documentation located [here](https://bitbucket.org/amctheatres/babel-transform-imports/src/babel6/README.md).

## Options

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `transform` | `string or function` | yes | `undefined` | The library name to use instead of the one specified in the import statement.  ${member} will be replaced with the import name, aka UnRenamedFun/Fun1/Fun2/etc., and ${1-n} will be replaced by any matched regular expression groups. If using a JS Babel config file, a function may be passed directly. (see Advanced Transformations) |
| `preventFullImport` | `boolean` | no | `false` | Whether or not to throw when an import is encountered which would cause the entire module to be imported. |
| `skipDefaultConversion` | `boolean` | no | `false` | When set to true, will preserve `import { X }` syntax instead of converting to `import X`. And it also supports function calls, the parameters are the same as `transform`
|
