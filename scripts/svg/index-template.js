const path = require('path');

function indexTemplate(filePaths) {
  const exportEntries = filePaths.map(filePath => {
    // filePath 可能是一个对象，需要获取正确的路径
    const actualPath =
      typeof filePath === 'string' ? filePath : filePath.path || filePath.name;
    const basename = path.basename(actualPath, path.extname(actualPath));
    const exportName = `Icon${basename}`;
    return `export { default as ${exportName} } from './${basename}';`;
  });
  return exportEntries.join('\n');
}

module.exports = indexTemplate;
