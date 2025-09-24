/* eslint-disable no-console */

const fs = require('fs');
const _ = require('lodash');
const dashdash = require('dashdash');

const packageJson = require('./package.json');

const options = [
  {
    names: ['endpoint'],
    type: 'string',
    help: 'set endpoint for code signing',
    default: '',
  },
  {
    names: ['publisherName'],
    type: 'string',
    help: 'set publisherName(usually common name) for code signing',
    default: '',
  },
  {
    names: ['certificateProfileName'],
    type: 'string',
    help: 'set certificateProfileName for code signing',
    default: '',
  },
  {
    names: ['codeSigningAccountName'],
    type: 'string',
    help: 'set codeSigningAccountName for code signing',
    default: '',
  },
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.',
  },
];

const parser = dashdash.createParser({ options });
const cliOptions = parser.parse(process.argv);

if (cliOptions.help) {
  const help = parser.help().trimEnd();
  // tslint:disable-next-line:no-console
  console.log(help);
  process.exit(0);
}

console.log('prepare_windows_build: updating package.json:', cliOptions);

// -------
const BUILD_WIN_PUB_NAME = 'build.win.azureSignOptions.publisherName';
const BUILD_WIN_END_POINT = 'build.win.azureSignOptions.endpoint';
const BUILD_WIN_PROFILE_NAME =
  'build.win.azureSignOptions.certificateProfileName';
const BUILD_WIN_ACCOUNT_NAME =
  'build.win.azureSignOptions.codeSigningAccountName';

// -------

function checkValue(object, objectPath, expected) {
  const actual = _.get(object, objectPath);
  if (actual !== expected) {
    throw new Error(`${objectPath} was ${actual}; expected ${expected}`);
  }
}

function setPackageJsonValue(path, value) {
  return _.set(packageJson, path, value);
}

function unsetPackageJsonValue(path) {
  return _.unset(packageJson, path);
}

function preparePackageJson() {
  // setup options for code signing
  unsetPackageJsonValue(BUILD_WIN_END_POINT);
  unsetPackageJsonValue(BUILD_WIN_PUB_NAME);
  unsetPackageJsonValue(BUILD_WIN_PROFILE_NAME);
  unsetPackageJsonValue(BUILD_WIN_ACCOUNT_NAME);

  const {
    endpoint,
    publisherName,
    certificateProfileName,
    codeSigningAccountName,
  } = cliOptions;
  if (endpoint) {
    setPackageJsonValue(BUILD_WIN_END_POINT, endpoint);
  }

  if (publisherName) {
    setPackageJsonValue(BUILD_WIN_PUB_NAME, publisherName);
  }

  if (certificateProfileName) {
    setPackageJsonValue(BUILD_WIN_PROFILE_NAME, certificateProfileName);
  }

  if (codeSigningAccountName) {
    setPackageJsonValue(BUILD_WIN_ACCOUNT_NAME, codeSigningAccountName);
  }

  fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, '  '));
}

// prepare package.json file for windows building
preparePackageJson();
