# Emerald Hue Variable Scanner

A Figma plugin to scan selected frames for design system variable usage. This plugin helps designers and developers identify where design system variables are being used and where they might be missing.

## Features

- Scans selected frames for variable usage
- Identifies color variables in fills and strokes
- Detects text variables (font size, line height)
- Checks responsive variables (width, height, padding)
- Shows both used and missing variables
- Supports both local and library variables

## Installation

1. Clone this repository

```bash
git clone [your-repository-url]
cd emerald-hue-variable
```

2. Install dependencies

```bash
npm install
```

3. Build the plugin

```bash
npm run build
```

4. Import the plugin into Figma

- Open Figma
- Go to Plugins > Development > Import plugin from manifest
- Select the manifest.json file from this project

## Usage

1. Select one or more frames in your Figma document
2. Run the plugin
3. Choose which types of variables to scan for (colors, text, responsive)
4. View the results showing where variables are used and where they might be missing

## Development

- Main plugin code: `code.ts`
- UI code: `ui.html`
- Build configuration: `webpack.config.js`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details

Below are the steps to get your plugin running. You can also find instructions at:

https://www.figma.com/plugin-docs/plugin-quickstart-guide/

This plugin template uses Typescript and NPM, two standard tools in creating JavaScript applications.

First, download Node.js which comes with NPM. This will allow you to install TypeScript and other
libraries. You can find the download link here:

https://nodejs.org/en/download/

Next, install TypeScript using the command:

npm install -g typescript

Finally, in the directory of your plugin, get the latest type definitions for the plugin API by running:

npm install --save-dev @figma/plugin-typings

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code
is already valid Typescript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code
to provide information about the Figma API while you are writing code, as well as help catch bugs
you previously didn't notice.

For more information, visit https://www.typescriptlang.org/

Using TypeScript requires a compiler to convert TypeScript (code.ts) into JavaScript (code.js)
for the browser to run.

We recommend writing TypeScript code using Visual Studio code:

1. Download Visual Studio Code if you haven't already: https://code.visualstudio.com/.
2. Open this directory in Visual Studio Code.
3. Compile TypeScript to JavaScript: Run the "Terminal > Run Build Task..." menu item,
   then select "npm: watch". You will have to do this again every time
   you reopen Visual Studio Code.

That's it! Visual Studio Code will regenerate the JavaScript file every time you save.
