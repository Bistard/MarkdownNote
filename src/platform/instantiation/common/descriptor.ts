import { Constructor } from "src/base/common/util/type";
import { NonServiceParameters } from "src/platform/instantiation/common/instantiation";

export class ServiceDescriptor<T extends Constructor> {

	constructor(
        public readonly ctor: T, 
        public readonly args: NonServiceParameters<ConstructorParameters<T>>, 
        public readonly supportsDelayedInstantiation: boolean = false
    ) {
        this.ctor = ctor;
        this.supportsDelayedInstantiation = supportsDelayedInstantiation;
    }
}
