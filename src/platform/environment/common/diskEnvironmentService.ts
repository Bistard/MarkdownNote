import { getCurrTimeStamp } from "src/base/common/date";
import { join, resolve } from "src/base/common/file/path";
import { URI } from "src/base/common/file/uri";
import { ILogService, LogLevel, parseToLogLevel } from "src/base/common/logger";
import { memoize } from "src/base/common/memoization";
import { MapTypes, isString } from "src/base/common/util/type";
import { NOTA_DIR_NAME } from "src/platform/configuration/common/configuration";
import { ICLIArguments } from "src/platform/environment/common/argument";
import { ApplicationMode, getAllEnvironments, IDiskEnvironmentService, IEnvironmentOpts } from "src/platform/environment/common/environment";

export class DiskEnvironmentService implements IDiskEnvironmentService {

    declare _serviceMarker: undefined;

    // [fields]

    private readonly opts: MapTypes<IEnvironmentOpts, { from: string | URI, to: string; }>;

    // [constructor]

    constructor(
        private readonly CLIArgv: ICLIArguments,
        opts: IEnvironmentOpts,
        @ILogService private readonly logService?: ILogService,
    ) {
        this.opts = {
            isPackaged: opts.isPackaged,
            appRootPath: isString(opts.appRootPath) ? opts.appRootPath : URI.toFsPath(opts.appRootPath),
            userDataPath: isString(opts.userDataPath) ? opts.userDataPath : URI.toFsPath(opts.userDataPath),
            userHomePath: isString(opts.userHomePath) ? opts.userHomePath : URI.toFsPath(opts.userHomePath),
            tmpDirPath: isString(opts.tmpDirPath) ? opts.tmpDirPath : URI.toFsPath(opts.tmpDirPath),
        };
    }

    // [public methods]

    get CLIArguments(): ICLIArguments { return this.CLIArgv; }

    get isPackaged(): boolean { return this.opts.isPackaged; }

    get mode(): ApplicationMode { return this.opts.isPackaged ? ApplicationMode.RELEASE : ApplicationMode.DEVELOP; }

    @memoize
    get logLevel(): LogLevel { return parseToLogLevel(this.CLIArgv['log']); }

    @memoize
    get userHomePath(): URI { return URI.fromFile(this.opts.userHomePath); }

    @memoize
    get tmpDirPath(): URI { return URI.fromFile(this.opts.tmpDirPath); }

    @memoize
    get appRootPath(): URI { return URI.fromFile(this.opts.appRootPath); }

    @memoize
    get logPath(): URI {
        const date = getCurrTimeStamp().split(' ')[0]!;
        return URI.fromFile(join(this.opts.appRootPath, NOTA_DIR_NAME, 'log', date));
    }

    @memoize
    get appConfigurationPath(): URI { return URI.fromFile(join(this.opts.appRootPath, NOTA_DIR_NAME)); }

    @memoize
    get userDataPath(): URI { return URI.fromFile(this.opts.userDataPath); }

    @memoize
    get productProfilePath(): URI { return URI.fromFile(resolve(this.opts.appRootPath, 'product.json')); }

    // [private helper methods]

    protected inspect(): void {
        const environments = JSON.stringify(getAllEnvironments(this), null, 4);
        this.logService?.trace(`[DiskEnvironmentService] loaded:\n${environments}`);
    }
}