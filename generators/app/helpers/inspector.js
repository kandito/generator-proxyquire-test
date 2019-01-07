const _ = require('lodash');
const fs = require('fs');

const MODULE_REQUIRE_REGEX = /[ .](.*?) = require\(['"](.*?)['"]\)\;/g;

exports.getRequiredModules = (absolutePath, excludeDependencies = '') => {
  const excludededDependeciesList = excludeDependencies.split(' ');

  const moduleContent = fs.readFileSync(absolutePath, 'utf-8');
  const moduleDeclarationStrings = moduleContent
    .match(MODULE_REQUIRE_REGEX)
    .map(line => line
      .replace('require(\'', '')
      .replace('\');', ''));

  return _.reduce(moduleDeclarationStrings, (result, value) => {
    const arr = value.split('=');

    const name = _.chain(arr)
      .head()
      .trim()
      .value();

    if (/[()]/.test(name) || excludededDependeciesList.includes(name)) {
      // Object destructuring, for now we can't handle it.
      return result;
    }

    const module = _.chain(arr)
      .tail()
      .trim()
      .value();

    const usedFunctionLines = moduleContent
      .match(new RegExp(`(${name})\\.([A-Za-z0-9_]*?)\\(`, 'g'));

    let usedFunctions = [];

    if (_.isArray(usedFunctionLines)) {
      usedFunctions = _.chain(usedFunctionLines)
        .uniqBy()
        .map(line => _.chain(line)
          .split('(')
          .first()
          .split('.')
          .drop()
          .first()
          .value())
        .value();
    }

    if (_.isEmpty(usedFunctions)) {
      // No detected function, handle it manually
      return result;
    }

    result.push({
      module,
      usedFunctions,
      name: `${name}Stub`,
    });

    return result;
  }, []);
};
