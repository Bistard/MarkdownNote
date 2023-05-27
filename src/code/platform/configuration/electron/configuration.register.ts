import { Dictionary } from "src/base/common/util/type";
import { BuiltInConfigScope, IConfigRegistrant } from "src/code/platform/configuration/common/configRegistrant";
import { DefaultConfigStorage } from "src/code/platform/configuration/common/configStorage";
import { REGISTRANTS } from "src/code/platform/registrant/common/registrant";

class DefaultApplicationConfiguration extends DefaultConfigStorage {
    protected override createDefaultModel(): Dictionary<PropertyKey, any> {
        return {
            
        };
    }
}

(function registerMainDefaultConfiguration() {
    const Registrant = REGISTRANTS.get(IConfigRegistrant);
    Registrant.registerDefaultBuiltIn(BuiltInConfigScope.Application, new DefaultApplicationConfiguration());
})();