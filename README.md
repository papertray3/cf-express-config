# CF Express Config
A simple package that combines several features for easy configuration of an Express server with support for Cloud Foundry (VCAP) Services.

This package combines several useful packages that allow you to easily provide different ways to configure your express server (or any other Node.js application) via environment files, command line options or environment variables.

## Installation
```(shell) 
npm i --save @papertray3/cf-express-config
```

## Feautures
Uses the following packages to provide a configuration context:
* [nconf](https://www.npmjs.com/package/nconf): Hierarchical node.js configuration with files, environment variables, command-line arguments, and atomic object merging.
* [dotenv](https://www.npmjs.com/package/dotenv): Dotenv is a zero-dependency module that loads environment variables from a .env file into `process.env`.
* [yargs](https://www.npmjs.com/package/yargs): Yargs helps you build interactive command line tools, by parsing arguments and generating an elegant user interface.
* [cfenv](https://www.npmjs.com/package/cfenv): The cfenv package provides functions to parse Cloud Foundry-provided environment variables. 

## API

The module exports one function: `configure` which takes a `ConfigOptions` object and returns a configured nconf object:

```(ts)
export interface ConfigOptions {
    version?: string,
    envPath?: string, // path to the .env file for dotenv, otherwise './.env'
    vcapPath?: string, // local definition of vcap services, default of './vcap-local.js'
    usage?: string,
    cliOptions?: CliOptions,
    overrides?: ConfigOverrides
}
```

`CliOptions` contain any command line arguments and are `yargs` options with the additon of an `env` key which can be either a string or an array of strings which are specific environment variable names that will fill in the option if it exists.

`ConfigOverrides` is an object that contains key/value pairs that set values to _always_ be the given value.