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
    overrides?: ConfigOverrides
}

export class CommonConfigNames {
    static readonly PORT: string = 'port';
    static readonly BIND: string = 'bind';
    static readonly IS_LOCAL: string = 'isLocal';
    static readonly SERVICES: string = 'services';
}

export const commonOptions: CliOptions = {};
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

let _configure = (options?: CliOptions): Config => {
    throw new Error('Application not bootstrapped...');
}

export function configure(options? : CliOptions) : Config {
    return _configure(options);
}

export function bootstrap(configOptions: ConfigOptions): void {

    let dotEnvPath = configOptions.envPath;
    if (dotEnvPath) {
        config({ path: resolve(normalize(dotEnvPath)) });
    } else {
        config();
    }

    let vcapLocal: any;
    let vcapPath: string = configOptions.vcapPath ? configOptions.vcapPath : resolve(process.cwd(), 'vcap-local.json');
    try {
        vcapLocal = require(vcapPath);
    } catch (e) { }
    let appEnvOpts: any = vcapLocal ? { vcap: vcapLocal } : {};
    let appEnv = cfenv.getAppEnv(appEnvOpts);

    if (vcapLocal) {
        if (!process.env.VCAP_SERVICES && vcapLocal.services) {
            process.env.VCAP_SERVICES = JSON.stringify(vcapLocal.services);
        }

        if (!process.env.VCAP_APPLICATION && vcapLocal.app) {
            process.env.VCAP_APPLICATION = JSON.stringify(vcapLocal.app);
        }
    }

    _configure = (options?: CliOptions): Config => {

        if (configOptions.usage) yargs.usage(configOptions.usage);
        if (configOptions.version) yargs.version(configOptions.version);
        let opts: CliOptions = options || commonOptions;
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

        let overrides = configOptions.overrides || {};
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

    };
}