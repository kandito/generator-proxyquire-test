const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');

const resolver = require('./helpers/resolver');
const inspector = require('./helpers/inspector');

module.exports = class extends Generator {
  prompting() {
    // Have Yeoman greet the user.
    this.log(
      yosay(
        `Welcome to the supreme ${chalk.red(
          'generator-proxyquire-test',
        )} generator!`,
      ),
    );

    const prompts = [
      {
        type: 'input',
        name: 'srcPath',
        message: 'Path File? (relative from current directory)',
        default: 'src/modules/http/index.js',
      },
      {
        type: 'input',
        name: 'srcDirectory',
        message: 'Source directory? (leave blank if current directory is base source directory)',
        default: undefined,
      },
      {
        type: 'input',
        name: 'testDirectory',
        message: 'Test directory? (leave blank is current directory is base source directory)',
        default: 'tests',
      },
      {
        type: 'input',
        name: 'testSuffix',
        message: 'Test suffix?',
        default: 'spec',
      },
      {
        type: 'input',
        name: 'excludeDependencies',
        message: 'Exclude dependencies (var names, separated by space)?',
      },
    ];

    return this.prompt(prompts).then((props) => {
      props.targetPath = resolver.generateTestFilePath(props.srcPath, props.testDirectory, props.testSuffix);
      props.targetAbsolutePath = resolver.getFullpath(props.targetPath);
      props.srcAbsolutePath = resolver.getFullpath(props.srcPath);

      props.srcPathInTest = resolver.generateSourcePathInTest(props.targetAbsolutePath, props.srcAbsolutePath);
      props.modules = inspector.getRequiredModules(props.srcAbsolutePath, props.excludeDependencies);

      this.props = props;
    });
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath('_template.spec.js'),
      this.destinationPath(this.props.targetPath),
      this.props,
    );
  }
};
