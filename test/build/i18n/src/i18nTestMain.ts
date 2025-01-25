import * as assert from 'assert';
import { Schemas, URI } from 'src/base/common/files/uri';
import { FileService } from 'src/platform/files/common/fileService';
import { DiskFileSystemProvider } from 'src/platform/files/node/diskFileSystemProvider';
import { I18nService } from 'src/platform/i18n/browser/i18nService';
import { LanguageType } from 'src/platform/i18n/common/i18n';
import { file1 } from 'test/build/i18n/src/file1';
import { file2 } from 'test/build/i18n/src/file2';
import { file3 } from 'test/build/i18n/src/file3';
import { nullObject } from 'test/utils/helpers';
import { NullLogger } from 'test/utils/testService';

class TestI18nService extends I18nService {
    public override localize(key: string, defaultMessage: string, interpolation?: Record<string, string>): string {
        assert.ok(typeof key === 'number', 'expecting key as number type during runtime');
        assert.ok(this._table?.[key] === defaultMessage, 'expecting the in-memory value equals to the defaultMessage');
        return super.localize(key, defaultMessage, interpolation);
    }
}

(async function main() {
    const logService = new NullLogger();
    const fileService = new FileService(logService);
    fileService.registerProvider(Schemas.FILE, new DiskFileSystemProvider(logService));

    const i18n = new TestI18nService(
        { osLocale: LanguageType.en, resolvedLanguage: LanguageType.en, userLocale: LanguageType.en }, 
        URI.join(URI.fromFile(process.cwd()), './test/build/i18n/dist/locale/'), 
        logService, fileService, nullObject(), nullObject(), nullObject(),
    );
    await i18n.init().unwrap();

    i18n.localize('key1', 'value1');
    i18n.localize('key2', 'value2');
    i18n.localize('key3', 'value3');

    file1(i18n);
    file2(i18n);
    file3(i18n);
})();