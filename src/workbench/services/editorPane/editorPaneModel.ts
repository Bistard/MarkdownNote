import type { EditorPaneDescriptor, IEditorPaneRegistrant } from "src/workbench/services/editorPane/editorPaneRegistrant";
import type { IEditorPaneView } from "src/workbench/services/editorPane/editorPaneView";
import type { AtLeastOneArray } from "src/base/common/utilities/type";
import { URI } from "src/base/common/files/uri";

/**
 * {@link EditorPaneModel}s are lightweight object that store the state and data 
 * for an editor. 
 * 
 * @override Subclasses may extends this base class to override certain behaviors.
 * @see {@link IEditorPaneRegistrant}
 */
export abstract class EditorPaneModel {

    /**
	 * Unique type identifier for this editor model. All the same models shares 
     * the same type id. This string is NOT unique.
	 */
    public abstract readonly type: string;

    /**
     * This resource should be unique across all the other editor models.
     * @note Use this if you want an identity check.
     */
    public abstract readonly resource: URI | undefined;

    /**
	 * @description If an {@link EditorPaneModel} was registered onto multiple 
     * {@link IEditorPaneView}, this method will be asked to return the preferred 
     * one to use.
	 *
	 * @param panels a list of {@link IEditorPaneView} that are candidates for the 
     * editor model to be linked.
     * 
     * @override Subclasses may overrides this method to customize behaviors.
	 */
    public prefersWhich(panels: Readonly<AtLeastOneArray<EditorPaneDescriptor>>): EditorPaneDescriptor {
        return panels[0];
    }

    /**
     * @description Determines two model are the same.
     * @override Subclasses may overrides this method to customize behaviors.
     */
    public equals(other: EditorPaneModel): boolean {
        return this === other;
    }

    public getInfoString(): string {
        return `EditorPaneModel "${this.type}" "${this.resource && URI.toString(this.resource)}"`;
    }
}

/**
 * @description A shared {@link EditorPaneModel} that can be used for any 
 * editors that can open with plain text file.
 */
export class TextEditorPaneModel extends EditorPaneModel {

    public readonly type = 'TextEditorPaneModel';
    public readonly resource: URI;

    constructor(resource: URI) {
        super();
        this.resource = resource;
    }

    public override equals(other: EditorPaneModel): boolean {
        if (!other.resource) {
            return false;
        }
        return URI.equals(this.resource, other.resource);
    }
}