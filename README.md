# Assets Metadata Stamper
This is a plugin for WoodWing Assets that allows the user to select files and stamp them with preset metadata.

## Installation
1. Run `npm install`.
2. Copy the `config.js.dist` file to `config.js` and edit the `CLIENT_URL_WHITELIST` property to match your setup.
3. Build the plugin with `npm run build`.

The `dist` folder will now contain the compiled plugin which can be hosted statically.

Note that this distributed version may be hosted in one place and reused by multiple assets installations. There's no need to host a separate version per installation.
