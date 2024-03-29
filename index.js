var types = require('@babel/types');
var isValidPath = require('is-valid-path');
var pathLib = require('path');

function findOptionFromSource(source, state) {
  var opts = state.opts;
  if (opts[source]) return source;

  var opt = Object.keys(opts).find(function (key) {
    return !isValidPath(key) && new RegExp(key).test(source);
  });
  if (opt) return opt;

  var isRelativePath = source.match(/^\.{0,2}\//);
  // This block handles relative paths, such as ./components, ../../components, etc.
  if (isRelativePath) {
    var dirname = source[0] === '/' ? '' : state.file.opts.filename ? pathLib.dirname(state.file.opts.filename) : '.'
    var _source = pathLib.resolve(pathLib.join(dirname, source));

    if (opts[_source]) {
      return _source;
    }
  }
}

function getMatchesFromSource(opt, source) {
  var regex = new RegExp(opt, 'g');
  var matches = [];
  var m;
  while ((m = regex.exec(source)) !== null) {
    if (m.index === regex.lastIndex) regex.lastIndex++;
    m.forEach(function (match) {
      matches.push(match);
    });
  }
  return matches;
}

function barf(msg) {
  throw new Error('babel-plugin-customize-imports: ' + msg);
}

function transform(transformOption, importName, matches) {
  if (typeof transformOption === 'function') {
    return transformOption(importName, matches);
  }

  return transformOption.replace(/\$\{\s?([\w\d]*)\s?\}/ig, function (str, g1) {
    if (g1 === 'member') return importName;
    return matches[g1];
  });
}

module.exports = function () {
  return {
    visitor: {
      ImportDeclaration: function (path, state) {
        // https://github.com/babel/babel/tree/master/packages/babel-types#timportdeclarationspecifiers-source

        // path.node has properties 'source' and 'specifiers' attached.
        // path.node.source is the library/module name, aka 'your-utils'.
        // path.node.specifiers is an array of ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier

        var source = path.node.source.value;

        var opt = findOptionFromSource(source, state);
        var isRegexp = opt && !isValidPath(opt);
        var opts = state.opts[opt];
        var hasOpts = !!opts;

        if (hasOpts) {
          if (!opts.transform) {
            barf('transform option is required for module ' + source);
          }

          var transforms = [];

          var fullImports = path.node.specifiers.filter(function (specifier) { return specifier.type !== 'ImportSpecifier' });
          var memberImports = path.node.specifiers.filter(function (specifier) { return specifier.type === 'ImportSpecifier' });

          if (fullImports.length > 0) {
            // Examples of "full" imports:
            //      import * as name from 'module'; (ImportNamespaceSpecifier)
            //      import name from 'module'; (ImportDefaultSpecifier)

            if (opts.preventFullImport) {
              barf('import of entire module ' + source + ' not allowed due to preventFullImport setting');
            }

            if (memberImports.length > 0) {
              // Swap out the import with one that doesn't include member imports.  Member imports should each get their own import line
              // transform this:
              //      import Bootstrap, { Fun1 } from 'your-utils';
              // into this:
              //      import Bootstrap from 'your-utils';
              transforms.push(types.importDeclaration(fullImports, types.stringLiteral(source)));
            }
          }

          var matches = isRegexp ? getMatchesFromSource(opt, source) : [];

          memberImports.forEach(function (memberImport) {
            // Examples of member imports:
            //      import { member } from 'module'; (ImportSpecifier)
            //      import { member as alias } from 'module' (ImportSpecifier)

            // transform this:
            //      import { Fun1 as fun1 } from 'your-utils';
            // into this:
            //      import fun1 from 'your-utils/lib/Fun1';
            // or this, if skipDefaultConversion = true:
            //      import { Fun1 as fun1 } from 'your-utils/lib/Fun1';

            var importName = memberImport.imported.name;

            var replace = transform(opts.transform, importName, matches);

            var shouldSkip = typeof opts.skipDefaultConversion === 'function' ? opts.skipDefaultConversion(importName, matches) : opts.skipDefaultConversion

            var newImportSpecifier = shouldSkip
              ? memberImport
              : types.importDefaultSpecifier(types.identifier(memberImport.local.name));

            transforms.push(types.importDeclaration(
              [newImportSpecifier],
              types.stringLiteral(replace)
            ));
          });

          if (transforms.length > 0) {
            path.replaceWithMultiple(transforms);
          }
        }
      }
    }
  }
}
