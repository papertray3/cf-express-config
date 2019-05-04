import nconf from 'nconf';
import { config } from 'dotenv';
import { resolve, normalize } from 'path';
import yargs from 'yargs';

export type Config = typeof nconf;

const cfenv = require('cfenv');

// Add an optional env string to Yargs Options
// this allows a cli (e.g. --someOption) but also
// specify an env variable as a backup
export interface CliOption extends yargs.Options {
    env?: string | Array<string>,
    confDefault?: any
}

export interface CliOptions {
    [option: string]: CliOption
}

export interface ConfigOptions {
    version?: string,
    envPath?: string, // path to the .env file for dotenv, otherwise './.env'
    vcapPath?: string, // local definition of vcap services, default of './vcap-local.js'
    usage?: string,
    cliOptions?: CliOptions,
    overrides?: ConfigOverrides
}

export enum CommonConfigNames {
    ENV = 'env',
    PORT = 'port',
    BIND = 'bind',
    LOG_LEVEL = 'logLevel',
    IS_LOCAL = 'isLocal'
}

export const commonOptions: CliOptions = {};
commonOptions[CommonConfigNames.ENV] = {
    describe: 'Operational mode',
    choices: ['development', 'test', 'production'],
    type: 'string',
    env: 'NODE_ENV',
    confDefault: 'production'
};

commonOptions[CommonConfigNames.PORT] = {
    describe: 'Port to bind to',
    type: 'number',
    env: 'PORT'
};

commonOptions[CommonConfigNames.BIND] = {
    describe: 'Host to bind to',
    type: 'string',
    env: 'BIND'
};

type ConfigOverrides = {
    [key: string]: any
}

type NconfObject = {
    key: string,
    value: string
}

type BasicTransform = (obj: NconfObject) => NconfObject | boolean;

// basic transform
let bt = (newKey: string): BasicTransform => {
    return (obj: NconfObject): NconfObject => {
        return {
            key: newKey,
            value: obj.value
        };
    }
}

type Transforms = {
    [key: string]: BasicTransform
}

export function configure(options: ConfigOptions): Config {

    let dotEnvPath = options.envPath;
    if (dotEnvPath) {
        config({ path: resolve(normalize(dotEnvPath)) });
    } else {
        config();
    }

    let vcapLocal: any;
    let vcapPath: string = options.vcapPath ? options.vcapPath : './vcap-local.js';
    try {
        vcapLocal = require(vcapPath);
    } catch (e) { }
    let appEnvOpts: any = vcapLocal ? { vcap: vcapLocal } : {};
    let appEnv = cfenv.getAppEnv(appEnvOpts);

    if (options.usage) yargs.usage(options.usage);
    if (options.version) yargs.version(options.version);
    let opts: CliOptions = options.cliOptions || commonOptions;
    let whitelist: Array<string> = [];
    let transforms: Transforms = {};
    let defaults: ConfigOverrides = {};

    Object.keys(opts).forEach((key: string) => {
        let opt = opts[key];
        if (opt.env) {
            opt.describe += ' (';
            let envs = Array.isArray(opt.env) ? opt.env : [opt.env];
            whitelist.push(key);
            envs.forEach((env: string, idx: number) => {
                transforms[env] = bt(key);
                if (idx > 0) {
                    opt.describe += ', ';
                }
                opt.describe += `env:${env}`;
            });

            opt.describe += ')';
        }

        if (opt.confDefault) {
            defaults[key] = opt.confDefault;
        }
    });

    yargs.options(opts);
    nconf
        .argv(yargs)
        .env({
            parseValues: true,
            whitelist: whitelist,
            transform: (obj: NconfObject): NconfObject | boolean => {
                if (transforms[obj.key]) {
                    return transforms[obj.key](obj);
                }

                return obj;
            }
        });

    nconf.defaults(defaults);

    let overrides = options.overrides || {};
    if (!overrides.isLocal) {
        overrides.isLocal = appEnv.isLocal;
    }

    nconf.overrides(overrides);

    if (appEnv.isLocal && !process.env.PORT) {
        if (nconf.get('port')) {
            process.env.PORT = nconf.get('port');
        }
    }

    nconf.add('cfenv', { type: 'literal', store: appEnv });
    return nconf;
}