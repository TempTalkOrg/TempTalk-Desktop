import path from 'path';
import { flipFuses, FuseVersion, FuseV1Options } from '@electron/fuses';
import { AfterPackContext, Arch } from 'electron-builder';

export async function afterPack({
  appOutDir,
  packager,
  electronPlatformName,
  arch,
}: AfterPackContext): Promise<void> {
  const { productFilename } = packager.appInfo;

  const ext = {
    darwin: '.app',
    win32: '.exe',
    linux: [''],
  }[electronPlatformName];

  if (ext === undefined) {
    throw new Error(`Unsupported platform for fusing: ${electronPlatformName}`);
  }

  const electronBinaryPath = path.join(appOutDir, `${productFilename}${ext}`);

  console.log('Flipping fuses for: ', electronBinaryPath);

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,
    // necessary for building on Apple Silicon
    resetAdHocDarwinSignature:
      electronPlatformName === 'darwin' && arch === Arch.arm64,
    // Default: Enabled, Disables ELECTRON_RUN_AS_NODE
    [FuseV1Options.RunAsNode]: false,
    // Default: Enabled, Disables the NODE_OPTIONS environment variable
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    // Default: Enabled, Disables the --inspect and --inspect-brk family of CLI options
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    // Default: Disabled, Enables validation of the app.asar archive on macOS
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    // Default: Disabled
    // Enforces that Electron will only load your app from "app.asar" instead of
    // its normal search paths
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
}
