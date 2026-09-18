// @ts-nocheck
import {getProductionStage,withProductionRestPose} from './production-stage';
import {createResponsiveLayoutRuntime} from './responsive-layout';
export function renderedGeometry(targetId){const stage=getProductionStage();if(!stage?.ownerDocument?.defaultView)return null;const runtime=createResponsiveLayoutRuntime(stage.ownerDocument.defaultView),element=runtime.element(targetId);if(!element)return null;const style=stage.ownerDocument.defaultView.getComputedStyle(element);const result=Object.fromEntries(['left','top','width','height'].map(key=>[key,parseFloat(style[key])||0]));if(stage.ownerDocument.defaultView.__DCO_LAYOUT_TRANSITIONS__?.some(p=>p.targetId===targetId)){const translate=String(style.translate||'').split(' ');result.left+=parseFloat(translate[0])||0;result.top+=parseFloat(translate[1])||0;result.layoutMotion=true;}return result;}
export function captureTextAnchor(targetId,edge='end'){
 const stage=getProductionStage();if(!stage?.ownerDocument?.defaultView)throw new Error('Wait for the preview before pinning text');
 return withProductionRestPose(stage,()=>{const runtime=createResponsiveLayoutRuntime(stage.ownerDocument.defaultView),element=runtime.element(targetId),ink=element&&runtime.ink(element);if(!ink)throw new Error('Show non-empty text before pinning its visible edge');const position=(edge==='end'?ink.bottom:edge==='center'?ink.top+ink.height/2:ink.top)-stage.getBoundingClientRect().top;return {edge,position,referenceHeight:stage.getBoundingClientRect().height};});
}
