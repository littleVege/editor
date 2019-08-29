import { Scene, AbstractMesh, Light, Camera, Tools } from 'babylonjs';
import { LGraph, LGraphCanvas, LiteGraph, LGraphGroup } from 'litegraph.js';

import Extensions from '../extensions';
import Extension from '../extension';

import { AssetElement } from '../typings/asset';

import { GraphNode } from './nodes/graph-node';
import { registerAllNodes } from './nodes/nodes-list';

export { LGraph, LGraphCanvas, LiteGraph, LGraphGroup, GraphNode }

// Interfaces
export interface GraphData {
    graph: any;
    name: string;
    id: string;
}

export interface NodeGraph {
    graphId: string;
    active: boolean;
}

export interface GraphNodeMetadata {
    node: string;
    nodeId: string;
    metadatas: NodeGraph[];
}

export interface BehaviorGraphMetadata {
    graphs: GraphData[];
    nodes: GraphNodeMetadata[];
}

// Code extension class
export default class GraphExtension extends Extension<BehaviorGraphMetadata> {
    // Public members
    public id: string = 'graph-editor';
    public assetsCaption: string = 'Graphs';

    /**
     * Constructor
     * @param scene: the babylonjs scene
     */
    constructor (scene: Scene) {
        super(scene);
        this.datas = null;
    }

    /**
     * On get all the assets to be drawn in the assets component
     */
    public onGetAssets (): AssetElement<any>[] {
        const data = this.onSerialize();

        const attached: AssetElement<GraphData>[] = [];
        const unAttached: AssetElement<GraphData>[] = [];

        data.graphs.forEach(s => {
            const isAttached = data.nodes.find(n => n.metadatas.find(m => m.graphId === s.id) !== undefined);
            if (isAttached)
                return attached.push({ name: s.name, data: s });
            
            unAttached.push({ name: s.name, data: s });
        });

        const result = [<AssetElement<GraphData>> { separator: 'Attached' }].concat(attached).concat([{ separator: 'Unattached' }]).concat(unAttached);

        return result;
    }

    /**
     * On the user wants to remove the asset
     * @param asset the asset to remove
     */
    public onRemoveAsset (asset: AssetElement<any>): void {
        const data = <GraphData> asset.data;

        // Remove links
        const remove = (objects: (AbstractMesh | Light | Camera | Scene)[]) => {
            objects.forEach(o => {
                if (!o.metadata || !o.metadata.behaviorGraph)
                    return;
                
                const graphs = <GraphNodeMetadata> o.metadata.behaviorGraph;
                const links = graphs.metadatas;
                for (let i  =0; i < links.length; i++) {
                    if (links[i].graphId === data.id) {
                        links.splice(i, 1);
                        i--;
                    }
                }
            });
        };

        remove([this.scene]);
        remove(this.scene.meshes);
        remove(this.scene.lights);
        remove(this.scene.cameras);

        // Remove data
        const index = this.scene.metadata.behaviorGraphs.indexOf(data);

        if (index !== -1)
            this.scene.metadata.behaviorGraphs.splice(index, 1);
    }

    /**
     * On the user adds an asset
     * @param asset the asset to add
     */
    public onAddAsset (asset: AssetElement<any>): void {
        this.scene.metadata.behaviorGraphs.push(asset.data);
    }

    /**
     * On the user drops an asset
     * @param targetMesh the target mesh under the pointer
     * @param asset the asset being dropped
     */
    public onDragAndDropAsset (targetMesh: AbstractMesh, asset: AssetElement<any>): void {
        targetMesh.metadata = targetMesh.metadata || { };

        if (!targetMesh.metadata.behaviorGraph) {
            targetMesh.metadata.behaviorGraph = {
                node: targetMesh.name,
                metadatas: []
            };
        }

        // Add asset
        targetMesh.metadata.behaviorGraph.metadatas.push({
            graphId: asset.data.id,
            active: true
        });
    }

    /**
     * On apply the extension
     */
    public onApply (data: BehaviorGraphMetadata): void {
        this.datas = data;

        // Register
        GraphExtension.RegisterNodes();

        // For each node
        this.datas.nodes.forEach(d => {
            const node = d.node === 'Scene'
                ? this.scene
                : (this.scene.getNodeByID(d.nodeId) || this.scene.getNodeByName(d.node));
            
            if (!node)
                return;

            // For each graph
            d.metadatas.forEach(m => {
                if (!m.active)
                    return;

                const graph = new LGraph();
                graph.scriptObject = node;
                graph.scriptScene = this.scene;

                GraphNode.Loaded = false;
                graph.configure(this.datas.graphs.find(s => s.id === m.graphId).graph);
                GraphNode.Loaded = true;

                // On ready
                this.scene.onReadyObservable.addOnce(() => {
                    graph.start();
                });
                
                // Render loop
                // TODO:
                // const nodes = <GraphNode[]> graph._nodes;
                // nodes.forEach(n => {
                //     if (n instanceof RenderLoop) {
                //         this.scene.onAfterRenderObservable.add(() => n.onExecute());
                //     }
                //     else if (n instanceof RenderStart) {
                //         this.scene.onAfterRenderObservable.addOnce(() => n.onExecute());
                //     }
                // });
            });
        });
    }

    /**
     * Called by the editor when serializing the scene
     */
    public onSerialize (): BehaviorGraphMetadata {
        const result = <BehaviorGraphMetadata> {
            graphs: this.scene.metadata ? (this.scene.metadata.behaviorGraphs || []) : [],
            nodes: []
        };

        const add = (objects: (AbstractMesh | Light | Camera | Scene)[]) => {
            objects.forEach(o => {
                if (o.metadata && o.metadata.behaviorGraph) {
                    const behavior = <GraphNodeMetadata> o.metadata.behaviorGraph;
                    behavior.node = o instanceof Scene ? 'Scene' :
                                    o instanceof Node ? o.name :
                                    o.id;
                    behavior.nodeId = o instanceof Scene ? 'Scene' : o.id;

                    result.nodes.push(behavior);
                }
            });
        };

        add([this.scene]);
        add(this.scene.meshes);
        add(this.scene.lights);
        add(this.scene.cameras);

        return result;
    }

    /**
     * On load the extension (called by the editor when
     * loading a scene)
     */
    public onLoad (data: BehaviorGraphMetadata): void {
        // Process old projects?
        if (!data.graphs) {
            const oldData = <any> data;

            data = {
                graphs: [],
                nodes: []
            };

            oldData.forEach(od => {
                const node = { node: od.node, nodeId: od.node, metadatas: [] };

                od.metadatas.forEach(m => {
                    // Add graph
                    const id = Tools.RandomId();
                    
                    // Add graph asset
                    data.graphs.push({ name: m.name, id: id, graph: m.graph });   
                    
                    // Add node metadata
                    node.metadatas.push({
                        graphId: id,
                        active: m.active
                    });
                });

                data.nodes.push(node);
            });
        }

        // Save
        this.datas = data;
        
        // Scene
        this.scene.metadata = this.scene.metadata || { };
        this.scene.metadata.behaviorGraphs = this.datas.graphs;

        // For each node
        this.datas.nodes.forEach(d => {
            const node = 
                d.node === 'Scene' ? this.scene :
                (this.scene.getNodeByID(d.nodeId) || this.scene.getNodeByName(d.node));
            
            if (!node)
                return;

            node.metadata = node.metadata || { };
            node.metadata.behaviorGraph = d;
        });
    }

    /**
     * Clears all the additional nodes available for Babylon.js
     */
    public static ClearNodes (): void {
        // Clear default nodes
        LiteGraph.registered_node_types = { };
    }

    /**
     * Registers all the additional nodes available for Babylon.js
     * @param object the object which is attached
     */
    public static RegisterNodes (object?: any): void {
        // Clear default nodes
        LiteGraph.registered_node_types = { };

        // Register all nodes!
        registerAllNodes(object);
    }
}

// Register
Extensions.Register('BehaviorGraphExtension', GraphExtension);
