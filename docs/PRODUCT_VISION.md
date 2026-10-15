# Campaign Creative Editor: Master Product Vision

**Status:** Consolidated product direction, 24 September 2026  
**Purpose:** Define the creative tool we want to exist: its philosophy, experience, underlying concepts and operating model.

This document consolidates the product discussion prompted by the existing SSE DCO editor. It describes an intended product, not the current application's complete capabilities. It is not an implementation specification, migration strategy or rebuild plan. Names of controls and entities are working language; examples illustrate behaviour rather than prescribe a finished interface.

The core direction is established by the discussion. Where an interaction or policy needs further exploration, that is identified. Existing implementation documents remain descriptions of their respective features; this document does not silently change current campaign behaviour.

**Reading guide**

- Purpose and principles: [The product](#1-the-product-we-are-aiming-to-create) · [Philosophy](#2-the-philosophy)
- Creative model: [Vocabulary](#3-the-conceptual-vocabulary) · [States](#4-states-belong-to-the-campaign) · [Ownership](#5-ownership-and-sources-of-truth)
- Appearance and behaviour: [Settled animation](#6-settled-appearances-are-the-foundation-of-animation) · [Ink and measurements](#7-geometry-ink-anchors-and-recorded-presentation) · [Text fitting](#8-text-fitting-that-can-be-understood-through-use) · [Grouping and layout](#9-grouping-and-layout-without-invisible-consequences)
- Experience: [Workspace and discovery](#10-the-workspace-and-progressive-discovery) · [Everyday examples](#11-how-the-philosophy-should-appear-in-everyday-work)
- Operating model: [Humans and agents](#12-humans-and-agents-operate-on-the-same-product-model) · [Working and reviewing](#13-the-operating-model-working-saving-reviewing-and-delivering) · [Rendering and delivery](#14-rendering-validation-and-delivery) · [Underlying model and Postgres](#15-an-underlying-model-that-supports-the-product)
- Product boundaries: [Lessons and mistakes](#16-lessons-to-carry-forward-and-mistakes-to-avoid) · [Proof scenarios](#17-how-to-recognise-whether-the-product-fulfils-the-vision) · [Open decisions](#18-decisions-that-remain-open)

## 1. The product we are aiming to create

A visual authoring tool for families of related animated compositions. Designers and agents can establish how the work should look at meaningful moments, define how it responds to content and campaign choices, and share selected decisions across the family. The tool calculates the motion and layout required to realise those decisions while keeping their sources understandable.

A campaign is often the same creative idea expressed five or six times in different shapes. The compositions share enough that repeatedly maintaining each one is wasteful, but differ enough that forcing them through one universal responsive layout is restrictive. The product must support both shared intent and independent art direction.

The central creative activity is arranging the artwork and deciding how it behaves. A designer should be able to say:

> This is where the headline rests. It enters from slightly above, takes half a second, and shares that entrance with the other formats. When legal copy appears, it moves to this other arrangement. Navy ink changes its colour. It does not change its position.

The document should preserve those statements as distinct decisions. It should not dissolve them into an accumulation of coordinates, CSS overrides and copied keyframes that future users have to reverse-engineer.

SSE is a demanding example of the problem, not the definition of the product. Offer counts, roundels, white/navy ink and particular legal-copy conventions belong to that campaign. Another campaign might vary by product, language, audience, theme or message, without containing an offer at all.

The GWD origin is similarly historical. The useful quality to retain is the concreteness of an inspectable composition: objects, artwork, positions and animation. The product's scope and model should not be constrained by its original role interpreting GWD designs.

## 2. The philosophy

### 2.1 Author meaningful decisions once

When several values express the same creative decision, they should refer to that decision. The resting position of an object is one decision even if the animation reaches it, holds it, pulses around it and eventually departs from it.

Likewise, a campaign-wide logo entrance should have a real shared source. Consistency should not depend on remembering to paste motion into two dozen destinations.

### 2.2 Preserve intent as well as appearance

Two documents can look identical with one sample row and behave differently when edited. One headline may be bottom-anchored; another may merely have coordinates that happen to produce the same bottom edge. One logo may use shared motion; another may contain a stale copy.

The product must retain these distinctions. A rendered image alone is not a sufficient description of an editable design.

### 2.3 Share precisely and extensively

Sharing is a central capability, not an advanced exception to an otherwise independent-document model. It can span objects, states and compositions. Its boundaries must be exact: sharing entrance timing does not imply sharing placement, and sharing appearance does not imply sharing fitting or content.

The objective is to reduce accidental coupling while allowing deliberate relationships to be powerful.

### 2.4 Make causes discoverable

Every effective value and computed result should have an explainable origin. The user should be able to discover what supplies it, what modifies it, and what else depends on it.

This does not require every dependency to be visible continuously. A clean canvas is the default. Explanation becomes progressively available through selection, focused controls, comparison and relationship inspection.

### 2.5 Treat measured artwork as real information

Visible ink, fitted text size and resolved positions matter to the designer. They must be available as structured, inspectable results with a known source and lifetime. They cannot exist solely as incidental browser values that are lost after rendering.

Authored intent, resolved presentation and recorded appearance are related but distinct. None should silently overwrite the others.

### 2.6 Let the canvas do ordinary work

Moving artwork, resizing its available space, placing anchors and adjusting gaps should be direct visual actions. Menus and inspectors provide precision and explanation, not a compulsory route around an unresponsive canvas.

A controlled property is not an excuse for a gesture to do nothing. The interface must explain what controls it and provide an appropriate manipulation or a clear alternative.

### 2.7 Keep the rendered result trustworthy

The editor must display the production behaviour. Fitting, layout, state resolution and motion must agree with delivery. A pleasing approximation in the editor is not sufficient.

### 2.8 Make authorship accountable

An explicitly authored relationship can still be a mistake. This is particularly important when agents make edits. The product must expose actual changes and consequences, not rely on an author's explanation or the fact that an action was technically permitted.

## 3. The conceptual vocabulary

These concepts need distinct identities, even if the interface does not expose all their names at once.

| Concept | Meaning |
|---|---|
| Campaign | A family of related creative work, its content, configurable choices and shared decisions. |
| Composition | An independently art-directed canvas, usually associated with a delivery format. Multiple creative directions may use the same dimensions. |
| Object | An identifiable piece of artwork, text or a structural container. Its identity is independent of its CSS class, label or current asset. |
| Role | A correspondence such as primary logo or opening headline, used to locate related objects across compositions. Correspondence does not itself create sharing. |
| State dimension | A campaign-defined choice such as language, product, theme or offer count. |
| State selection | A particular valid combination of those choices. This is the sense of “version” used when browsing campaign variations. |
| Content row | Text, images, URLs and other values supplied for a particular example or delivered instance. A state selection may have many content rows. |
| Arrangement | A meaningful designed configuration of objects, such as the opening message or headline with legal copy. |
| Placement | An object's intended position, frame and anchors within an arrangement. It can be authored directly or resolved by a layout relationship. |
| Cue | A meaningful point in time, such as endframe begins or logo enters. |
| Sequence | The temporal organisation of arrangements, cues, transitions and effects. |
| Motion behaviour | A reusable description of a transition or effect, with explicit references for its timing, distance and anchor. |
| Shared definition | A named source for selected properties or behaviours, with explicit assignments to its users. |
| Local exception | A deliberate departure from a source for specified properties and circumstances. |
| Resolved presentation | The measured result for a particular composition, state, content and meaningful moment. |
| Revision | A recorded point in the editing history. This is distinct from a campaign state selection. |
| Release | An immutable, identifiable package of creative inputs and delivery results. |

A useful working context combines composition, state selection, content row and arrangement or playback time. These are separate axes. Moving the playhead does not change the campaign's language. Selecting navy ink does not imply a different sequence. Viewing the same composition twice does not create two independently authored copies.

## 4. States belong to the campaign

The product must allow campaign authors to define relevant dimensions, their labels, choices, defaults and valid combinations. A campaign can have many dimensions, one dimension or none.

Some choices may be derived from content. For example, the number of populated offer records could determine a state. Such derivations need visible definitions and explainable results. The system must distinguish a state directly selected by an author from a state calculated from supplied content.

State restrictions must be understandable. If an option is unavailable for a particular combination, the interface should explain why rather than silently substitute another option. A state selection is not automatically a sample-content row; changing language or theme must not destructively overwrite the content used by a different selection.

### 4.1 Variation is selective

Adding an Ink dimension should leave existing placement and timing intact. It should not generate white and navy copies of every property's ownership.

Only the aspects deliberately varied acquire a state distinction. For example:

| Condition | Intended consequence |
|---|---|
| Ink is navy | Select navy text colours and a navy logo asset. |
| Language is Gaeilge | Select the relevant copy; fit it using the chosen policies. |
| Offer count is zero | Select a materially different arrangement or sequence. |
| Format is 300×600 | Use that composition's authored frames and appropriate movement distances. |

The first condition must not accidentally select coordinates authored for another version. If navy genuinely needs a different placement, that must be a separately visible placement variation.

Replacing an asset may change its visible silhouette or intrinsic bounds. Frame alignment and any ink anchor should make the resulting behaviour explicit. A different source file should not introduce an unexplained position change.

### 4.2 Some differences are structural

Not every variation is well represented by small property exceptions. A state may need different objects, a different arrangement, a different order of messages or a different sequence.

The product should allow that difference to be authored directly while retaining the parts that remain shared. A substantially different zero-offer treatment should not require hundreds of unrelated corrective overrides. Equally, selecting a different arrangement should not automatically sever shared typography or logo timing.

An arrangement is also distinct from a state. One state can pass through several arrangements during playback. Several states can use the same arrangement.

### 4.3 Scope must be intentional

An edit needs a comprehensible scope: which objects, which compositions, which aspects and which state conditions it affects. The current preview supplies context but should not automatically turn every selected dimension into a new ownership boundary.

An ordinary edit should target the visible, applicable owner. Where creating a new exception is necessary, its scope must be visible before commitment. The exact default interaction needs exploration, but neither silently editing a campaign-wide source nor silently creating a fully state-specific exception is acceptable.

## 5. Ownership and sources of truth

Ownership describes which authored source supplies a property or behaviour. It must be independent of rendering mechanisms such as CSS specificity, selector order or incidental object nesting.

### 5.1 Independent aspects of one object

A logo can legitimately use several sources:

| Aspect | Example source |
|---|---|
| Asset and ink | Current colour state |
| Placement and frame | This composition's endframe arrangement |
| Entrance cue | Campaign-wide logo entrance |
| Fade duration and easing | Shared logo reveal behaviour |
| Exit cue | Campaign-wide ending sequence |
| Particular exception | A later entrance in one explicitly selected state |

Aspects are helpful interface groupings, not mandatory all-or-nothing bundles. It should be possible to share duration and easing without sharing distance, or typography without frame geometry.

### 5.2 Explicit assignments and deterministic resolution

For a property in a particular context, the system should be able to identify its assigned source, any applicable local exception, and the runtime behaviour that produces its rendered result.

Local exceptions deliberately replace specified authored fields. When conditional assignments overlap, any precedence must be explicit and inspectable. The system must not pick a winner because a selector is more specific, an array entry happens to come later, or a generated rule has a larger internal priority.

Named relationships between sources can be useful. For example, logo entrance may follow endframe begins by 200ms. The model should support such dependencies with clear references, cycle detection and an expandable explanation. Arbitrary inheritance chains should not emerge as a side effect of copying between instances.

### 5.3 Operations must retain distinct meanings

| Operation | Intended meaning |
|---|---|
| Copy | Apply chosen values once; create no continuing dependency. |
| Link | Assign selected aspects to an explicit shared source. |
| Edit shared source | Change the source for its linked users, subject to their declared exceptions. |
| Edit selected instances | Make a coordinated edit without automatically creating a persistent relationship. |
| Make an exception | Replace selected fields in a stated scope while keeping other links. |
| Reset to source | Remove selected exceptions and adopt the source's current values. |
| Unlink or detach | Remove the chosen relationship while preserving the applicable authored result or explicitly captured presentation. |

“Keep appearance” requires care when content or state varies. Keeping the current sample's measured coordinates is different from retaining a dynamic behaviour. A detach operation must identify which is being preserved and preview its relevant consequences; it cannot promise that freezing one measured sample preserves every possible future rendering.

### 5.4 Membership and impact are visible

A shared definition should have a readable name, a description where useful, and discoverable members. Users need to see both affected instances and exceptions that mask the shared change.

Changing a shared source should preview its reach across the campaign. If future compositions or states will be included by a membership rule, that rule must be explicit. The default must not expand a relationship merely because a new object has a similar name.

The tool should preserve the difference between objects that correspond, objects edited together once, and objects that remain linked.

## 6. Settled appearances are the foundation of animation

The main authored thing is often the desired appearance at a meaningful moment: where the headline rests, how the endframe is composed, or how the remaining objects arrange themselves after another leaves.

These destinations need their own identity. They must not exist merely as coincident values in separate keyframes.

### 6.1 One placement, several references

Consider an object that enters from 10px above, holds, then exits 10px below:

| Moment | Authored meaning |
|---|---|
| Entrance begins | Placement minus 10px vertically; transparent |
| Entrance ends | Placement; fully visible |
| Exit begins | The same placement; fully visible |
| Exit ends | Placement plus 10px vertically; transparent |

The two settled moments refer to the same placement. The other two positions are derived from it. Moving the placement 50px left moves the whole behaviour coherently. It must not create a diagonal entrance, a slow drift back to the old position, or a later snap.

A pulse during the hold changes scale around the chosen anchor. It does not create new independent resting coordinates. A designer should not need to nest the artwork inside symbols solely to achieve this basic positional consistency.

Generated keyframes may be useful to a delivery renderer. They are not necessarily the correct authoring model. Exported values can be more numerous than authored decisions.

### 6.2 Separate timing, behaviour and geometry

Motion has three independently shareable concerns:

- **Timing:** cues, start relationships, durations, holds and sequencing.
- **Behaviour:** fade, slide, scale, pulse, easing and other effects.
- **Geometry:** placement, path, movement distance and its reference frame.

A 300×600 and a 970×250 can share exact timing and easing while retaining their own placements. A shared slide can use a local distance or a distance expressed relative to a named frame, such as 15% of canvas height. Units and reference frames must be explicit and visible when editing that parameter.

A source can offer a coherent whole behaviour while still allowing selected aspects to be shared or varied. Reuse must not require either complete copying or complete coupling.

### 6.3 Transitions between designed arrangements

“Headline alone” and “Headline with legal copy” can be two meaningful arrangements. The latter might position the headline higher or maintain a gap above the measured legal text.

Both endpoints are editable designs. The transition connects their resolved placements. Updating one arrangement recalculates the journey without forcing the author to repair intermediate positional values.

An object's identity can continue across arrangements, preserving selected shared aspects. An arrangement change need not duplicate the object or sever its motion and typography sources.

Entering, exiting and temporarily transparent objects need explicit layout participation rules. Opacity alone should not unexpectedly reclaim space. The author may reserve space before an entrance or deliberately animate other objects into a new arrangement as it enters or exits.

### 6.4 Detailed motion remains possible

Not all motion is arrival, rest and departure. Some designs need meaningful paths, moving endpoints, overshoot, choreography or continuous movement with no settled hold.

Detailed path and keyframe authoring remains available. It should be a deliberate mode with a stated relationship to placements and anchors. Moving a settled destination must have defined consequences for dependent paths; fixed world-space points must be identifiable as fixed.

The ordinary timeline can expose entrance, rest, effects and exit. Expanding a segment reveals its actual parameters or detailed keyframes. It should be possible to understand and edit timing without having to manage every compiled positional sample.

Playback duration, looping, final holds and return behaviour are also authored decisions. A loop must not silently introduce a reset tween or conceal a discontinuity. Its boundary should be reviewable like any other transition.

## 7. Geometry, ink, anchors and recorded presentation

The designer often places visible artwork, not an abstract box. A headline's perceived bottom edge, a logo's visible centre and the gap between two ink clusters may be more meaningful than their element bounds.

The product needs explicit distinctions between an authored frame, content bounds, visible ink bounds, and the transformed appearance at a playback time. These measurements serve different purposes and should not be substituted invisibly.

### 7.1 Three related records

| Record | What it answers |
|---|---|
| Authored intent | Where should the object end up, what should stay anchored, and what may change? |
| Resolved presentation | Given these inputs, where did the renderer place it and what did fitting and layout determine? |
| Recorded appearance | What exact result was inspected, approved or delivered for this identified context? |

For example, the designer may author the visible bottom edge of a headline against a guide. With particular copy and font metrics, the renderer calculates a text-box position and fitted size that satisfy that anchor. The resulting ink bounds and placement are recorded as resolved presentation, and can be retained with a review or release.

The designer should also be able to adopt a measured result as a new authored placement deliberately. That operation must be distinguishable from merely observing or caching it.

### 7.2 Measurements are first-class results

Resolved presentation should be structured and inspectable by both humans and agents. It can include frame and ink bounds, fitted size, line count, anchor coordinates, layout outcomes, constraint failures and resolved motion endpoints.

Each result needs the identity of the relevant composition, state, content, arrangement or sample time, creative revision, assets and fonts, and rendering environment or version needed to assess freshness. A measurement is only authoritative for its inputs.

Ordinary live results can be replaced as their inputs change. Reviewed and released results should remain retrievable with their context. This does not require persisting every animation frame; meaningful arrangements, selected moments and motion plans provide useful records without creating a second uncontrolled document.

If a measurement cannot be obtained, the interface should say so. An unreadable image's transparency or an unavailable font should not silently produce a claimed ink measurement from an unrelated approximation.

### 7.3 Anchors express what should remain stable

Anchors may refer to the canvas, an authored guide, a container or another object's defined edge or centre. The relevant basis must be stated: frame edge, visible ink edge, baseline, or another supported metric.

A bottom-anchored text block can grow upward as content changes. An image replacement can remain aligned inside its frame. A layout can preserve a measured gap between objects. These are authored relationships, not transient corrections applied after each edit.

Creating an anchor should be possible from the visible result. A designer places the artwork correctly and chooses what should remain fixed. Ordinary snapping should not silently create a permanent dependency unless the gesture or tool explicitly indicates that it will.

## 8. Text fitting that can be understood through use

Wrap, shrink and clip should not compete as mutually exclusive high-level modes. They answer different questions and can coexist.

| Question | Independent authoring choice |
|---|---|
| May the text occupy multiple lines? | One line or multiple lines, with an optional line limit |
| What space is available? | Fixed frame or a frame whose height follows content |
| May typography adjust? | Keep the authored size or reduce to a stated minimum |
| Where does the text align? | Horizontal and vertical alignment and a visible anchor |
| What happens when constraints cannot be met? | Show overflow, hide overflow or use ellipsis where supported |
| Must other text match its fitted size? | An explicit fitting relationship |

Additional typographic adjustments, such as bounded tracking changes, may be useful. They belong in progressively disclosed controls with visible effects. A named preset may bundle these choices for convenience, but its actual settings remain inspectable.

The interface should describe familiar outcomes before exposing engine terminology. Examples include “Keep at 24px”, “Allow smaller text, down to 18px” and “Let the box grow upward”. Final labels require usability work, but independent decisions must remain independent in the model.

### 8.1 Frames and visible content

A selected text object can reveal a solid authored frame, a subtler content or ink outline, and its anchor. These overlays need only appear when relevant to the current operation.

Resizing the frame changes the available space. Moving the object changes placement. Scaling the artwork is a separate, deliberate operation that can change type size. The same handle must not silently switch between these meanings.

For a growing-height frame, its flexible edge must be recognisable when selected. Dragging that edge may offer conversion to a fixed height, but the consequence needs to be clear before the change is committed.

### 8.2 Explain the actual result

The interface should display the effective policy and rendered result, including defaults that influence it. Useful explanations include:

- “24px became 21px to fit the width.”
- “The third line exceeds this frame at the 18px minimum.”
- “This headline uses 20px because another member of Headline sizes needs it.”

The limiting member of a shared fit group should be discoverable and highlighted. A shared source for nominal font size and a relationship that equalises fitted sizes are different relationships; the interface must not conflate them.

Hidden overflow is not successful fitting. Intentional clipping may be a valid design choice, but the fitting result should remain truthful about what occurred. Contradictory constraints must produce an actionable explanation rather than an apparently successful result governed by a hidden fallback.

Layout participation must also be consistent: an object absent because of state or content differs from an object temporarily transparent during animation. Transient opacity should not unexpectedly cause the remaining text to refit or change shared size.

## 9. Grouping and layout without invisible consequences

Three relationships must remain distinct:

| Relationship | Purpose | What it does not imply |
|---|---|---|
| Selection group | Manipulate several objects together | Shared styling, shared motion or a new coordinate system |
| Layout container | Arrange participating children through stated alignment, spacing and sizing rules | A reusable component or automatic sharing across compositions |
| Component instance | Reuse a semantic design with selected shared aspects | Identical placement or complete coupling of every property |

These can coexist. Forming a selection group should not rewrite child animations. A real parent transform or nested coordinate frame is a separate structural decision and must preserve the visible result when introduced.

### 9.1 A bounded vocabulary of useful layout relationships

The product should support practical behaviours such as align to an edge, maintain a gap, distribute participating objects in an area, keep a frame fixed as items disappear, or adopt another arrangement after an exit.

It does not need to expose a general programming language or unrestricted constraint solver to make these behaviours useful. Internally it does need deterministic evaluation, dependency checks and a clear response to incompatible constraints.

The author must be able to see which objects participate, how order is determined, what the measurements refer to, and what happens when there is insufficient room. Empty content, state-hidden artwork and animation events should have explicit participation semantics.

### 9.2 Direct manipulation of relationships

When editing a layout container, the canvas can reveal its area, padding, gap handles and participating children. Dragging a child can preview a reorder, an allowed offset or another operation appropriate to the container. It should not silently become an unrelated absolute coordinate change.

Dragging an object out of a container may support a deliberate detach gesture that previews the result. Detaching should preserve the chosen placement without disturbing unrelated aspects. Removing or disabling a layout relationship should show what underlying authored arrangement will become visible.

Content-driven conditions, such as making space when legal copy is present, should identify their input and active outcome. A condition must not create a circular dependency in which it repeatedly changes the measurements that decide whether it applies.

### 9.3 Controlled does not mean mysteriously locked

If a drag affects a controlled property, the interface must reveal the relevant controller at the point of interaction. For example: “Positioned by Endframe stack”, with an appropriate way to adjust the relationship, select the container, introduce a deliberate local offset or detach.

The ordinary case should remain fluid. Valid direct edits should not require a dialogue on every gesture. The interface needs an evident editing mode and a contextual explanation when the requested action cannot have its usual meaning.

Silently ignoring the gesture, snapping back without explanation, and silently adding an exception to make it work are all failures.

## 10. The workspace and progressive discovery

The product should feel like a visual creative tool first. Its model can be rigorous without requiring users to confront the entire model before moving a headline.

### 10.1 The campaign board

A campaign board provides side-by-side access to related compositions. Users can focus one composition, keep others visible as references, and choose which formats participate in comparison or editing. Showing the campaign family should not require displaying every possible state combination at once.

Playback and scrubbing can be synchronised. Where different sequences use different timings, comparison may also align by meaningful cue or arrangement. The interface must distinguish matching elapsed time from matching creative moments; otherwise two legitimate sequences could appear incorrectly out of sync.

Selecting an object can highlight corresponding roles elsewhere. A logo in each composition may be recognisably the same campaign role while having a different placement owner. Highlights and badges must distinguish correspondence from actual shared ownership.

The same composition can be pinned in two contexts, such as white and navy ink, or English and Gaeilge. These are views into the same model. A shared change updates the relevant views together; a narrowly scoped exception changes only the contexts where it applies.

### 10.2 A deliberate disclosure sequence

| Level | What the user sees | Purpose |
|---|---|---|
| Browsing and playback | Artwork, minimal navigation and playback controls | Judge the creative result without explanatory clutter. |
| Object selection | Necessary handles and a compact indication of important sources | Establish what is selected and how ordinary edits will apply. |
| Aspect editing | Relevant frame, anchor, path, gap or source controls | Explain and manipulate the current concern. |
| Relationship inspection | Immediate inputs and dependants, with labelled connections | Answer what controls this and what it controls. |
| Comparison and change review | Differences, affected compositions and structural changes | Assess a broader edit or investigate unexpected behaviour. |

A dependency graph is a focused inspection tool. It should normally begin with the selected aspect, show immediate sources and destinations, and allow expansion. Connections need verbs and specific endpoints: shares easing, starts after, selects asset, aligns ink bottom. A generic line to an entire object obscures too much.

The graph must be accompanied by readable lists and property explanations. It cannot be the only way to understand relationships or perform essential actions.

### 10.3 Editing settled appearances

The workspace should make meaningful arrangements easy to select and edit. A designer can work on the endframe appearance directly, even if its precise timeline location changes later.

While inspecting a transition, a selected object may reveal a faint destination outline. Choosing to edit that destination should make the editing context unmistakable, for example by seeking to the arrangement or entering a clearly labelled placement view.

A canvas drag must have a known target: settled placement, selected arrangement, whole motion path or an explicitly selected keyframe. The interface must not infer a different target solely from the accidental position of the playhead.

### 10.4 Before commitment, show reach

When an edit affects linked instances, the workspace should indicate the affected set. Shared edits can preview side by side. A user may narrow the set, choose a local exception, or edit the source intentionally.

Selections and filters need distinct semantics. Hiding a destination with a filter should not silently change an already specified edit set. Copying, linking and coordinated editing should offer a visible proposal that can be applied or discarded as one meaningful action.

The interface should not require a confirmation ceremony for every harmless edit. Routine operations remain fast; edits with broader or structural consequences receive proportionate visibility.

### 10.5 Comparison as an explanation tool

“Compare these views” should distinguish differences in content, state, authored values, relationships and measured outcomes. Two views may have equal coordinates but different owners, or the same owner but different fitted results.

For example, a white/navy comparison might report a changed logo asset, unchanged placement source and unchanged motion. If placement differs, the relevant assignment should be directly inspectable. Comparing screenshots alone cannot establish why the difference exists.

## 11. How the philosophy should appear in everyday work

### 11.1 Move a settled headline

The designer selects the endframe arrangement and drags the headline 50px left. The placement changes. Its relative entrance and exit remain 10px vertical motions. Its pulse remains anchored correctly. Other arrangements and compositions change only if their placement relationships say they should.

The change history describes the placement edit and its affected contexts. It does not present several generated keyframe rewrites as separate creative decisions.

### 11.2 Change the logo entrance across the campaign

The designer selects a logo, opens its motion source and edits Logo reveal. Linked logos preview together. Their local frames stay put. Any instance with a duration exception is identified, including why it does not follow the new duration.

The operation does not require a paste into each composition. If the designer instead edits several instances once, the tool does not silently create a future link.

### 11.3 Add a navy treatment

The campaign receives an Ink dimension or a new navy option. The author varies the relevant assets and colours. Existing placements, fitting policies and timing remain shared or local exactly as before unless deliberately changed.

White and navy can be pinned beside one another. A comparison shows which aspects differ. An agent-created navy placement exception is discoverable as such, even if its first sample happens to look acceptable.

### 11.4 Make space for legal copy

The designer authors a second arrangement with legal copy below the headline. The headline can be placed directly or anchored at a chosen gap above the legal ink. The transition connects the opening and legal arrangements.

Longer legal copy re-evaluates the chosen fitting and layout relationships. If the available space cannot satisfy them, the product reports the conflict. It does not invent a new minimum font size, change an unrelated arrangement or conceal the failure through clipping.

### 11.5 Adapt a non-offer campaign

A product campaign varies by language, product image and light/dark theme. Both languages share logo timing. Each composition retains its art-directed frames. Theme varies colour and asset treatment. The translated headline uses the explicit text policy and may resolve to a smaller size.

If one language needs a genuinely different arrangement, the author can define it. No offer-count machinery, SSE object identifier or legacy class name is needed to express the campaign.

### 11.6 Understand a blocked-looking drag

The designer drags a child positioned by a stack. The stack is identified and the proposed action is previewed: reorder the child, adjust an allowed offset, move the stack, or detach deliberately.

The interaction preserves continuity between what the designer sees and what the model records. The object does not simply snap back, and the tool does not quietly add an override that another author will discover much later.

## 12. Humans and agents operate on the same product model

The product is intended for human design work assisted or performed by agents. Both must be able to discover the design's structure, make meaningful edits and understand the consequences.

### 12.1 Semantic editing operations

Agents should be able to express actions such as move this settled placement, assign this entrance behaviour, change this shared duration, add this state option, or create this arrangement. Such operations are more reviewable than undifferentiated document replacement or arbitrary style patches.

Human controls should use the same meaning. The model must not have one set of ownership rules for UI actions and a second informal set for agent-authored data.

An agent also needs access to the renderer's actual measurements and failures. It should not have to guess whether text fits, infer settled coordinates from a screenshot alone, or reconstruct ownership by searching CSS.

### 12.2 Authorship is evidence, not a guarantee

An agent can explicitly author an inappropriate dependency. Consequently, the product must record and expose actual relationship changes: a new shared source, expanded membership, a state-specific exception, a detached instance, a new anchor or a change from relative motion to an absolute path.

A useful change record might state that logo placement now varies with Ink, identify the affected compositions, and show the resulting before/after appearance. That structural change deserves to be discoverable even if the final visual difference is small.

Author identity and an optional explanation help provide context. The authoritative account of impact comes from the model change and its resolved results, not from the agent's description of its own work.

### 12.3 Proposals, application and review

Work can be prepared as a coherent proposal with a defined scope. The proposal should show changed artwork, altered relationships and affected views, and should be discardable or applicable as a meaningful unit.

This does not impose approval before every agent action. Authority depends on the task and working context: an agent may be asked to propose, to edit within a defined scope, or to complete a broader piece of work. Regardless of that authority, the result must remain inspectable and recoverable.

Broad shared-source changes and new structural relationships should receive more prominent review than routine local adjustments. The review can combine selected before/after arrangements, synchronised motion and a concise explanation of the actual relationship changes.

### 12.4 Future authors must be able to resume intelligently

A future human or agent should be able to answer: what is canonical here, what has been intentionally varied, what is measured, what is unresolved and what has been reviewed?

This context must not depend on retaining the original conversation. Useful names, source relationships, revision history and recorded results belong to the product's durable information. Naming should help orientation without becoming the mechanism that determines behaviour.

## 13. The operating model: working, saving, reviewing and delivering

The product must distinguish several kinds of state that are easy to blur in a creative editor:

| Working state | Meaning |
|---|---|
| Temporary preview | Test content, a provisional placement or another exploration that is not committed artwork. |
| Working edit | A real document change that may not yet have been saved. |
| Saved revision | Persisted creative work with a known identity. |
| Reviewed appearance | A specific result examined with known content, state and renderer inputs. |
| Released work | A fixed set of inputs and delivered artifacts associated with a release identity. |

Changing selection or hiding a panel should not silently apply or discard a provisional design operation. Its status must remain recoverable. Temporary test copy must be distinguishable from saved content and must never be unknowingly captured as the delivery copy.

### 13.1 Meaningful transactions and undo

A drag, a completed field edit, a link operation or an applied layout proposal should form a coherent edit. Undo should reverse that operation as a whole, including its relationship changes, rather than leave half of a shared edit applied.

Text-input undo remains useful while typing; document undo applies to committed editing actions. The product should not confuse the two or add every transient preview sample to campaign history.

### 13.2 Concurrent work and revision identity

Multiple views, agents or users must not silently overwrite one another. Writes need a known starting revision and a defined response when relevant work has changed. The product may resolve independent edits or ask for a focused reconciliation, but it cannot merely let the last whole-document save win.

Real-time co-editing is not assumed as an initial product requirement. Reliable revision-aware editing is required even when collaboration happens sequentially or through agents.

Reading, opening, saving and validating should not quietly migrate ownership, seed new exceptions or remove creative data. Structural conversions are identifiable operations with reviewable consequences.

### 13.3 Review and approval retain their scope

A visual approval applies to identified inputs and contexts. It is neither a universal guarantee for every possible feed value nor a permanent restriction against future creative changes.

The product should preserve the difference between engine validity, visual correctness for a sample, and human approval. A design may be valid but unattractive, or attractive for one row but unable to accommodate a longer one. Those outcomes need different explanations.

## 14. Rendering, validation and delivery

The existing commitment to production-backed editing is fundamental. The editor, QA surface and delivery renderer must share the interpretation of the design. Selection chrome and authoring overlays remain outside the delivered artwork.

### 14.1 One rendering contract

Given the same creative revision, composition, state, content, assets, rendering environment and time, the product should produce the same relevant geometry, text treatment, visibility and motion across its editing and delivery surfaces.

Readiness is part of that contract. An older frame, a pending font or an unfinished fitting pass must not be treated as the current measured result. If the canvas temporarily displays an earlier render, its stale status must not permit edits or captures that claim to use the newer inputs.

### 14.2 Dynamic and fixed-copy delivery

Dynamic delivery retains the conditions, content bindings and runtime behaviours needed to resolve new rows. It must not depend on the editor or its database being available during playback.

Fixed-copy delivery binds the chosen content and captures the relevant resolved presentation. Outline delivery must use current measurements from the actual rendering process. It must not silently substitute approximate typography when required measurements are missing.

Different delivery representations may have genuine rendering differences. The product should preview the representation being delivered and communicate its actual limits, rather than claim identity that has not been established.

### 14.3 Delivery profiles and identifiable releases

Users should choose recognisable delivery purposes through named profiles. Technical packaging requirements, asset strategies and platform-specific adapters can sit behind those profiles without dictating the authoring model.

A release should identify the creative revision, content selection or feed configuration, assets and fonts, renderer version, delivery profile and resulting artifacts. The goal is to explain and reproduce what was delivered, including any relevant environmental limits.

Validation should cover the distinct concerns of model consistency, fitting and layout success, motion behaviour, packaged-output parity and visual review. It should inspect meaningful arrangements and transitions as well as representative valid state/content combinations. A successful short sample does not prove that arbitrary future copy fits.

## 15. An underlying model that supports the product

The data model should preserve the distinctions visible in the experience. It should not be a historical record of whichever rendering workaround was introduced first.

Objects, compositions, sources, memberships, conditions, placements and cues need stable identities. Display names and CSS identifiers can change without changing those relationships. Nested editable content should be represented structurally rather than discovered through campaign-specific naming conventions.

The model should separate authored values and relationships from generated rules, resolved measurements, temporary UI state and packaged artifacts. It also needs a typed, versioned schema with explicit validation and identifiable transformations between schema versions.

The compiler or resolver is responsible for translating authored intent into a renderable description while retaining enough provenance to explain the result. Generated CSS and keyframes serve rendering; they should not become a competing source of creative ownership.

### 15.1 How SQL/Postgres fits this vision

Postgres is a suitable possible persistence model because the product contains identifiable entities and explicit relationships. The design should remain intelligible independently of the database choice.

Relational records can express campaigns, compositions, objects, state definitions, shared sources and memberships, placements, motion relationships, assets, revisions and releases. Flexible creative parameters can remain in validated JSON payloads where that is the clearest representation.

The aim is neither one campaign-sized opaque JSON value nor a separate database row for every colour channel and keyframe coordinate. Boundaries should follow independent identity, editing, querying and lifecycle needs. A relational membership should point to an actual object identity rather than require interpretation of an embedded CSS selector.

Content rows should be distinguishable from artwork. Resolved measurements should be identifiable records with their input context. Immutable release snapshots can legitimately contain a complete assembled document, even when editable records are stored separately.

This would make useful questions natural: which compositions use this motion, which states override this placement, which source changed since this review, and which measurement belongs to this release? The database structure should help answer those questions, while the application remains responsible for creative semantics such as condition overlap and valid layout dependencies.

Changing storage alone does not repair ownership. Explicit, understandable relationships are the prerequisite. The exact table boundaries, indexing, caching and physical schema remain implementation choices outside this document.

## 16. Lessons to carry forward and mistakes to avoid

### 16.1 Capabilities worth preserving

- Production-backed creative rendering, with editing controls separated from delivered artwork.
- Real browser measurement for text, ink, layout and outline capture.
- Deliberate per-format art direction alongside reusable campaign decisions.
- Shared fit relationships and practical content-aware layout behaviours.
- Named timing cues, reusable motion and explicit units.
- Copy, linking and local exceptions as distinct authoring operations.
- Visual comparison using real content and independently packaged output.
- Separate engine validation, approved-art review and delivery verification.
- Pure validation and protection against stale previews or measurements.

Some of these capabilities are inherently difficult. Their complexity is justified when it produces reliable behaviour and an understandable experience.

### 16.2 Failure patterns to prevent

| Failure pattern | Required product response |
|---|---|
| One apparent value has several competing historical sources | A deterministic source and an inspectable account of any exceptions and computed effects. |
| CSS specificity determines creative ownership | Ownership resolved through the authored model; CSS is generated output. |
| New sharing tools are layered over old ambiguity indefinitely | A coherent native concept of ownership, with compatibility contained at explicit boundaries. |
| A colour state unexpectedly changes placement | Selective state variations and direct comparison of affected aspects. |
| Consistency requires repeated Paste Motion | Real shared timing and behaviour sources across compositions. |
| Moving a settled object breaks its entrance, hold or pulse | Canonical placements with dependent motion. |
| Every substantial version is represented by small overrides | First-class alternate arrangements and sequences. |
| SSE conventions become generic engine rules | Campaign-defined dimensions, roles and bindings. |
| Selection grouping changes layout or animation implicitly | Separate grouping, containment and component semantics. |
| Fitting modes hide contradictory settings | Independent decisions, effective values and measured explanations. |
| Dragging appears locked, jumps back or creates hidden overrides | Visible editing context, controller disclosure and deliberate alternatives. |
| Measurements disappear into the DOM or outlive their inputs | Structured results with freshness and retained review context. |
| Every relationship is always drawn on the canvas | Progressive disclosure and focused relationship inspection. |
| Explicit agent authorship is treated as sufficient protection | Actual change records, impact previews and recoverability. |
| Saving or loading changes the design's meaning | Pure validation and explicit structural transformations. |
| Preview and delivery use different interpretations | A common rendering contract and verification of actual packaged results. |
| A database migration is mistaken for conceptual simplification | Product ownership semantics established independently of storage. |

### 16.3 Avoid overcorrection

Simplicity must not remove legitimate art direction, powerful shared sources, selective exceptions or detailed motion. Nor should the product require every composition to be derived from one responsive master.

Conversely, the product should not become a general visual programming environment simply because its implementation contains a dependency graph. Bounded, recognisable creative relationships can cover substantial ground without requiring users to program a solver.

Infrastructure complexity should follow actual operating needs. Microservices, elaborate event-sourcing machinery, universal scripting and exhaustive property normalisation are not implied by this vision.

## 17. How to recognise whether the product fulfils the vision

The following are product-level proof scenarios, not a development sequence or implementation checklist:

1. **A settled move remains coherent.** Move a headline 50px left. Its relative entrance, hold, pulse and exit still behave as intended without repairing keyframes.
2. **A shared edit is genuinely shared.** Change the campaign's logo fade once and see linked instances update across compositions while local placement stays intact.
3. **A state change has precise reach.** Switching white to navy changes the assigned appearance and exposes any deliberate placement variation; it does not produce an unexplained jump.
4. **A materially different treatment is readable.** A special state can use its own arrangement and sequence without obscuring which sources it still shares.
5. **The model works without offers.** A language/product/theme campaign is natural to author and does not require SSE concepts or identifiers.
6. **The source of a surprise is discoverable.** A designer can begin at a visible object and find its relevant controller, limiting fit member or state exception without studying the full campaign graph.
7. **The workspace stays calm.** The same relationship-rich campaign can be viewed as clean artwork; its detail appears when selected or requested.
8. **An ordinary gesture has an understandable effect.** Dragging or resizing either performs the evident edit or reveals the controlling relationship and an appropriate next action.
9. **Agent work can be assessed without trusting its summary.** A reviewer can see what changed visually and structurally, identify the affected contexts and reverse a coherent operation.
10. **Recorded appearance is meaningful.** A reviewed result has retrievable measurements and known inputs; changed content invalidates its claim to represent the current result.
11. **Delivery is the work that was reviewed.** The chosen rendition and package can be traced to the creative, content and rendering inputs used to produce it.

These scenarios should guide evaluation of future design proposals. A feature that adds controls but makes these tasks harder is moving away from the intended product.

## 18. Decisions that remain open

The product direction is clearer than the final interaction design. The following need exploration without weakening the principles above:

- The most intuitive vocabulary for placements, arrangements, sequences and shared behaviours, and which terms users need to see at all.
- The default edit scope when a property has both broad sharing and meaningful state-specific alternatives.
- The exact canvas gestures for anchors, frame growth, constrained movement and detachment, including accessible keyboard equivalents.
- How component structure and property sharing are presented together without implying that either couples every aspect.
- How to express and review deliberately overlapping conditional assignments without recreating an opaque cascade.
- How much relationship information belongs beside the selection versus in a focused inspector or graph.
- How synchronised views should align sequences with materially different durations or cue structures.
- How detailed paths compose with placements and relative effects when a design genuinely needs both.
- Which measured results are retained automatically, which belong to explicit reviews, and how long ordinary working measurements remain available.
- How shared libraries might extend beyond a campaign, if that becomes a real need, without introducing unreviewed propagation into existing work.
- The level of simultaneous human/agent collaboration needed, beyond reliable revision-aware editing.

These are product design questions, not reasons to defer the central commitments. The intended tool lets authors establish meaningful appearances, share precise decisions across a family of compositions, and manipulate the work directly. Its calculations support those decisions, its interface reveals their causes progressively, and its records make the result understandable to the next person or agent who opens it.

## Appendix: Context and reading

This vision comes from the September 2026 product discussion about the SSE DCO editor. The examples describe desired behaviour and lessons from that working experience; they are not a comprehensive assessment of other animation products.

The following repository documents provide context about the existing application. They are useful references, not definitions of the future product:

- [Current architecture](ARCHITECTURE.md)
- [Current workflow](WORKFLOW.md)
- [Production rendering and explicit ownership requirements](EDITOR_REBUILD.md)
- [Campaign versions and property relationships](CAMPAIGN_VERSIONS.md)
- [Reusable creative components](COMPONENTS.md)
- [Current text fitting](TEXT_FITTING.md)
- [Campaign states and responsive layout](RESPONSIVE_LAYOUT.md)

This document should evolve through explicit product decisions. New examples should clarify the general model rather than quietly turn one campaign's requirements into universal rules.
