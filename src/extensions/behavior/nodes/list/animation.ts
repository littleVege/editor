import { Node, Animation } from 'babylonjs';
import { LiteGraph } from 'litegraph.js';

import { registerNode, GraphNode } from '../graph-node';

/**
 * Registers all the available animation nodes.
 * @param object the object reference being customized using the graph editor.
 */
export function registerAllAnimationNodes (object?: any): void {
    registerNode({ name: 'Play Animations', description: 'Plays the animations of the current node.', path: 'animation/play', ctor: Node, functionRef: (node, target: Node, scene) => {
        scene.beginAnimation(
            target,
            node.properties['From'],
            node.properties['To'],
            node.properties['Loop'],
            node.properties['Speed'],
            () => node.triggerSlot(0),
            null, null, null,
            () => node.triggerSlot(1)
        );
    }, inputs: [
        { name: 'Execute', type: LiteGraph.EVENT }
    ], properties: [
        { name: 'From', type: 'number', defaultValue: 0 },
        { name: 'To', type: 'number', defaultValue: 60 },
        { name: 'Speed', type: 'number', defaultValue: 1 },
        { name: 'Loop', type: 'boolean', defaultValue: false }
    ], outputs: [
        { name: 'On End', type: LiteGraph.EVENT },
        { name: 'On Loop', type: LiteGraph.EVENT }
    ] }, object);

    registerNode({ name: 'Stop Animations', description: 'Stops the currently playing animations of the current node.', path: 'animation/stop', ctor: Node, functionRef: (node, target: Node, scene) => {
        scene.stopAnimation(target);
    }, inputs: [
        { name: 'Execute', type: LiteGraph.EVENT }
    ] }, object);

    registerNode({ name: 'Interpolate Value', description: 'Interpolates the ', path: 'animation/interpolatevalue', ctor: Node, functionRef: (node, target: Node, scene) => {
        if (node.store.playing) return;
        node.store.playing = true;

        const targetValue = GraphNode.nodeToOutput(node.getInputData(1));
        if (targetValue === undefined) return;

        const propertyPath = node.properties['Property Path'];
        const property = GraphNode.GetProperty<any>(target, propertyPath);
        const ctor1 = GraphNode.GetConstructorName(property).toLowerCase();
        const ctor2 = GraphNode.GetConstructorName(targetValue).toLowerCase();
        if (ctor1 !== ctor2) {
            console.warn(`Cannot interpolate values of two different types. property: "${ctor1}", target value: "${ctor2}"`);
            return;
        }

        const animation = new Animation(propertyPath, propertyPath, 60, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT, false);
        animation.setKeys([
            { frame: 0, value: property.clone ? property.clone() : property },
            { frame: 60 * node.properties['Duration (seconds)'], value: targetValue }
        ]);
        scene.stopAnimation(target);
        scene.beginDirectAnimation(target, [animation], 0, 60, false, node.properties['Speed'], () => node.store.playing = false);
    }, inputs: [
        { name: 'Execute', type: LiteGraph.EVENT },
        { name: 'Target Value', type: 'number,vec2,vec3,vec4,col3,col4' }
    ], properties: [
        { name: 'Property Path', type: 'string', defaultValue: 'name' },
        { name: 'Speed', type: 'number', defaultValue: 1 },
        { name: 'Duration (seconds)', type: 'number', defaultValue: 1 }
    ], outputs: [
        { name: 'Current Value', type: 'number,vec2,vec3,vec4,col3,col4' }
    ] }, object);
}
