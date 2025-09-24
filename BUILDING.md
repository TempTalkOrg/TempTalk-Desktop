# TempTalk Desktop - Building Guide

First, you'll need [Node.js](https://nodejs.org/) which matches our current version.  
You can check the `.nvmrc` file in the current branch to see what the current version is. If you have [nvm](https://github.com/creationix/nvm) you can just run `nvm use` in the project directory and it will switch to the project's desired Node.js version. [nvm for windows](https://github.com/coreybutler/nvm-windows) is still useful, but it doesn't support `.nvmrc` files.

Then you need [`git`](https://git-scm.com/), if you don't have it installed yet.

---

## Platform Dependencies

### macOS
Install the [Xcode Command-Line Tools](http://osxdaily.com/2014/02/12/install-command-line-tools-mac-os-x/).

### Windows
1. Download _Build Tools for Visual Studio 2022 Community Edition_ from [Microsoft's website](https://visualstudio.microsoft.com/vs/community/) and install it, including the "Desktop development with C++" option.
2. Download and install the latest Python 3 release from https://www.python.org/downloads/windows/ (3.6 or later required).

### Linux
1. Pick your favorite package manager.
2. Install `python` (Python 3.6+)
3. Install `gcc`
4. Install `g++`
5. Install `make`

---

## Prerequisites Check

Before starting the build, make sure you have the required tools installed.

### Platform Build Tools
- **Windows**: Visual Studio Build Tools, Python
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential, python3, make, g++

### Check Required Tools
```bash
nvm --version
node --version
python3 --version
yarn --version
```

---

## Quick Start

### Universal Build Steps
```bash
# 1. Clone the repository
git clone https://github.com/TempTalkOrg/TempTalk-Desktop.git
cd TempTalk-Desktop

# 2. Check Node version
node --version

# 3. Build the project (install dependencies, generate assets, build release)
yarn && yarn generate && yarn build-release
```

---

## Build Process

### 1. Install Dependencies
```bash
yarn install
```

### 2. Generate Assets
```bash
yarn generate
```

### 3. Build Release
```bash
yarn build-release
```

---

## Development Commands

### macOS
- Developer
  ```bash
  yarn install
  yarn generate
  yarn start
  ```

- Build Release
  ```bash
  yarn install
  yarn generate
  yarn build-release
  ```

### Linux
- Developer
  ```bash
  yarn install
  yarn prepare-linux-build
  yarn generate
  yarn start
  ```

### Windows
- Developer
  ```bash
  yarn install
  yarn prepare-windows-build
  yarn generate
  yarn start
  ```

---

## Getting Help

If you encounter issues not covered here:

1. Check `README.md` for detailed documentation
2. Review the development setup section above
3. Check `CHANGELOG.md` for known issues and recent changes
4. Search existing GitHub Issues: https://github.com/TempTalkOrg/TempTalk-Desktop/issues
5. Create a new issue with detailed information about your problem