// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Contract plane namespace.
//
// Resources here target `{tenant}.admin.zarel.ai/v1` with `contractToken`
// (JWT class 'contract'). Composed as wrappers over the Resource classes
// under ../resources/*; the wrappers change how a call is reached, not what
// it sends.
//
// Plane token guard: the FetchClient bound to this namespace has
// `requireTokenCode: 'contract_token_missing'`, so every call throws
// ZarelAuthError before network I/O when contractToken is absent.

import type { FetchClient } from '../_internal/fetch-client';
import { SpecResource } from '../resources/contracts';
import { EntitiesResource } from '../resources/entities';
import { RolesResource } from '../resources/roles';
import { AuthorizationResource } from '../resources/authorization';
import { AuthorizationCeilingResource } from '../resources/authorization-ceiling';
import { CapabilitiesResource } from './capabilities';
import { ConstraintsResource } from './constraints';
import { SchemasResource } from './schemas';
import { MetadataResource } from './metadata';
import { ContractEventsResource } from './events';
import { ProcessModelResource } from './process-model';
import { ContractAgentRoots } from './roots';
import { BatchResource } from './batch';
import { SkillsResource } from './skills';
import { ContractActionsResource } from './actions';
import { ContractFlowsResource } from './flows';
import { AssistantResource } from './assistant';

// ── Composite sub-namespaces (idiomatic taxonomy) ──────────────────────

class ContractSpecDryRun {
    constructor(private readonly _c: SpecResource) {}
    submit = (...args: Parameters<SpecResource['dryRun']>): ReturnType<SpecResource['dryRun']> =>
        this._c.dryRun(...args);
    get = (...args: Parameters<SpecResource['dryRunReport']>): ReturnType<SpecResource['dryRunReport']> =>
        this._c.dryRunReport(...args);
    cancel = (...args: Parameters<SpecResource['dryRunCancel']>): ReturnType<SpecResource['dryRunCancel']> =>
        this._c.dryRunCancel(...args);
}

class ContractSpecSnapshot {
    constructor(private readonly _c: SpecResource) {}
    get = (...args: Parameters<SpecResource['snapshot']>): ReturnType<SpecResource['snapshot']> =>
        this._c.snapshot(...args);
    localeCoverage = (...args: Parameters<SpecResource['snapshotLocaleCoverage']>): ReturnType<SpecResource['snapshotLocaleCoverage']> =>
        this._c.snapshotLocaleCoverage(...args);
    semanticDiff = (...args: Parameters<SpecResource['snapshotSemanticDiff']>): ReturnType<SpecResource['snapshotSemanticDiff']> =>
        this._c.snapshotSemanticDiff(...args);
}

class ContractSpec {
    readonly dryRun: ContractSpecDryRun;
    readonly snapshot: ContractSpecSnapshot;
    private readonly _c: SpecResource;
    constructor(client: FetchClient) {
        this._c = new SpecResource(client);
        this.dryRun = new ContractSpecDryRun(this._c);
        this.snapshot = new ContractSpecSnapshot(this._c);
    }
    publish = (...args: Parameters<SpecResource['publish']>): ReturnType<SpecResource['publish']> => this._c.publish(...args);
    diff = (...args: Parameters<SpecResource['diff']>): ReturnType<SpecResource['diff']> => this._c.diff(...args);
    apply = (...args: Parameters<SpecResource['apply']>): ReturnType<SpecResource['apply']> => this._c.apply(...args);
}

class ContractFieldTransitions {
    constructor(
        private readonly _e: EntitiesResource,
        private readonly _entityName: string,
        private readonly _fieldName: string,
    ) {}
    list = (options?: Parameters<EntitiesResource['listFieldTransitions']>[2]) =>
        this._e.listFieldTransitions(this._entityName, this._fieldName, options);
    get = (from: string, to: string, options?: Parameters<EntitiesResource['getFieldTransition']>[4]) =>
        this._e.getFieldTransition(this._entityName, this._fieldName, from, to, options);
    create = (input: Parameters<EntitiesResource['createFieldTransition']>[2]) =>
        this._e.createFieldTransition(this._entityName, this._fieldName, input);
    put = (from: string, to: string, input: Parameters<EntitiesResource['replaceFieldTransition']>[4]) =>
        this._e.replaceFieldTransition(this._entityName, this._fieldName, from, to, input);
    patch = (from: string, to: string, patch: Parameters<EntitiesResource['patchFieldTransition']>[4]) =>
        this._e.patchFieldTransition(this._entityName, this._fieldName, from, to, patch);
    delete = (from: string, to: string) =>
        this._e.deleteFieldTransition(this._entityName, this._fieldName, from, to);
}

class ContractEntityFields {
    constructor(private readonly _e: EntitiesResource, private readonly _entityName: string) {}
    list = (options?: Parameters<EntitiesResource['listFields']>[1]) => this._e.listFields(this._entityName, options);
    get = (fieldName: string, options?: Parameters<EntitiesResource['getField']>[2]) =>
        this._e.getField(this._entityName, fieldName, options);
    create = (field: Parameters<EntitiesResource['addField']>[1]) => this._e.addField(this._entityName, field);
    put = (fieldName: string, field: Parameters<EntitiesResource['replaceField']>[2]) =>
        this._e.replaceField(this._entityName, fieldName, field);
    patch = (fieldName: string, update: Parameters<EntitiesResource['updateField']>[2]) =>
        this._e.updateField(this._entityName, fieldName, update);
    delete = (fieldName: string) => this._e.deleteField(this._entityName, fieldName);
    // Sub-resource for a field's state transitions, addressed by (from, to).
    transitions = (fieldName: string): ContractFieldTransitions =>
        new ContractFieldTransitions(this._e, this._entityName, fieldName);
}

class ContractEntities {
    private readonly _e: EntitiesResource;
    constructor(client: FetchClient) {
        this._e = new EntitiesResource(client);
    }
    list = (...args: Parameters<EntitiesResource['list']>) => this._e.list(...args);
    get = (...args: Parameters<EntitiesResource['get']>) => this._e.get(...args);
    create = (...args: Parameters<EntitiesResource['create']>) => this._e.create(...args);
    put = (...args: Parameters<EntitiesResource['replace']>) => this._e.replace(...args);
    patch = (...args: Parameters<EntitiesResource['update']>) => this._e.update(...args);
    delete = (...args: Parameters<EntitiesResource['delete']>) => this._e.delete(...args);
    // Sub-resource for fields-of-an-entity. Built per-call so consumers
    // can write `client.contract.entities.fields('orders').create({...})`.
    fields = (entityName: string): ContractEntityFields => new ContractEntityFields(this._e, entityName);
}

/**
 * `client.contract.authorization.*` — one resource for the whole surface.
 *
 * The HTTP surface is not partitioned by plane and family, so neither is the SDK:
 * grants are addressed by `(role, on-path)` regardless of family.
 */
class ContractAuthorization extends AuthorizationResource {
    /** Read-only owner/ceiling envelope introspection. */
    readonly ceiling: AuthorizationCeilingResource;
    constructor(client: FetchClient) {
        super(client);
        this.ceiling = new AuthorizationCeilingResource(client);
    }
}

// ── Top-level ContractNamespace ────────────────────────────────────────

export class ContractNamespace {
    readonly spec: ContractSpec;
    readonly entities: ContractEntities;
    readonly roles: RolesResource;
    readonly authorization: ContractAuthorization;
    readonly metadata: MetadataResource;
    readonly capabilities: CapabilitiesResource;
    readonly schemas: SchemasResource;
    readonly constraints: ConstraintsResource;
    readonly events: ContractEventsResource;
    readonly processModel: ProcessModelResource;
    // The contract roots, hoisted onto the contract namespace itself. There is no
    // `client.contract.runtime`: there is no `runtime:` section for it to mirror.
    readonly llm: ContractAgentRoots['llm'];
    readonly treatment: ContractAgentRoots['treatment'];
    readonly channels: ContractAgentRoots['channels'];
    readonly mcpServers: ContractAgentRoots['mcpServers'];
    readonly timezone: ContractAgentRoots['timezone'];
    readonly batch: BatchResource;
    readonly skills: SkillsResource;
    readonly actions: ContractActionsResource;
    readonly flows: ContractFlowsResource;
    /** Conversational contract authoring (conversation + staged changesets). */
    readonly assistant: AssistantResource;

    constructor(client: FetchClient) {
        this.spec = new ContractSpec(client);
        this.entities = new ContractEntities(client);
        this.roles = new RolesResource(client);
        this.authorization = new ContractAuthorization(client);
        this.metadata = new MetadataResource(client);
        this.capabilities = new CapabilitiesResource(client);
        this.schemas = new SchemasResource(client);
        this.constraints = new ConstraintsResource(client);
        this.events = new ContractEventsResource(client);
        this.processModel = new ProcessModelResource(client);
        const roots = new ContractAgentRoots(client);
        this.llm = roots.llm;
        this.treatment = roots.treatment;
        this.channels = roots.channels;
        this.mcpServers = roots.mcpServers;
        this.timezone = roots.timezone;
        this.batch = new BatchResource(client);
        this.skills = new SkillsResource(client);
        this.actions = new ContractActionsResource(client);
        this.flows = new ContractFlowsResource(client);
        this.assistant = new AssistantResource(client);
    }
}
