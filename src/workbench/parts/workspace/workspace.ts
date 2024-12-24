import 'src/workbench/parts/workspace/workspace.scss';
import { Component, IAssembleComponentOpts, IComponent } from "src/workbench/services/component/component";
import { ITabBarService, TabBarView } from "src/workbench/parts/workspace/tabBar/tabBar";
import { IService, createService } from "src/platform/instantiation/common/decorator";
import { IInstantiationService } from "src/platform/instantiation/common/instantiation";
import { IEditorService } from "src/workbench/parts/workspace/editor/editorService";
import { Orientation } from 'src/base/browser/basic/dom';

export const IWorkspaceService = createService<IWorkspaceService>('workspace-service');

/**
 * An interface only for {@link WorkspaceView}.
 */
export interface IWorkspaceService extends IComponent, IService {

}

export class WorkspaceView extends Component implements IWorkspaceService {

    declare _serviceMarker: undefined;

    // [constructor]

    constructor(
        @IInstantiationService instantiationService: IInstantiationService,
        @ITabBarService private readonly tabBarService: ITabBarService,
        @IEditorService private readonly editorService: IEditorService,
    ) {
        super('workspace', null, instantiationService);
    }

    // [protected override methods]

    protected override _createContent(): void {
        this.__assembleParts();
    }

    protected override _registerListeners(): void { 
        /** noop */ 
    }
    
    // [private helper methods]

    private __assembleParts(): void {
        const layout: IAssembleComponentOpts[] = [];
        layout.push({
            component: this.tabBarService,
            fixed: true,
            fixedSize: TabBarView.TAB_BAR_HEIGHT,
        });
        layout.push({
            component: this.editorService,
            initSize: null,
            maximumSize: null,
            minimumSize: null,
        });

        this.assembleComponents(Orientation.Vertical, layout);
    }
}