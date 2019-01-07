const path = require('path');

exports.generateTestFilePath = (srcPath, testDirectory = 'tests', testSuffix = 'spec') => {
  const extension = path.extname(srcPath);
  const basename = path.basename(srcPath, extension);
  const testFilename = [
    basename,
    testSuffix,
    extension.replace('.', ''),
  ].join('.');

  const dirname = path.dirname(srcPath);

  return path.join(testDirectory, dirname, testFilename);
};

exports.getFullpath = (relativePath) => {
  if (/^\.\//.test(relativePath)) {
    return path.join(process.cwd(), relativePath);
  }

  return path.join(process.cwd(), ['.', relativePath].join('/'));
};

exports.generateSourcePathInTest = (from, to) => {
  const fromDirname = path.dirname(from);
  const toDirname = path.dirname(to);
  const relativePath = path.relative(fromDirname, toDirname);

  const extension = path.extname(to);
  const basename = path.basename(to, extension);

  return path.join(relativePath, basename);
};
