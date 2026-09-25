// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// Runtime plane namespace.
//
// Resources here target `{tenant}.zarel.ai/v1` with `runtimeToken`
// (JWT class 'tenant'). Composed from the Resource classes under
// ../resources/*; the namespaces here only shape how a caller reaches
// them, not what goes on the wire.
//
// Plane token guard: the FetchClient bound to this namespace has
// `requireTokenCode: 'runtime_token_missing'`, so every call throws
// ZarelAuthError before network I/O when runtimeToken is absent.

import type { FetchClient } from '../_internal/fetch-client';
import { ConversationResource } from '../resources/conversation';
import { ConversationSessionsResource } from '../resources/conversation-sessions';
import { ChannelsResource } from '../resources/channels';
import { ToolsResource } from '../resources/tools';
import { RecordsResource } from '../resources/records';
import { StateMachineResource } from '../resources/state-machine';
import { RoleAssignmentsResource } from '../resources/role-assignments';
import { RuntimeEntitiesResource } from '../resources/runtime-entities';
import { EventsResource } from '../resources/events';
import { ImportsResource } from '../resources/imports';
import { FlowsResource } from '../resources/flows';
import { LlmServicesResource } from '../resources/llm-services';
import { LlmCredentialsResource } from '../resources/llm-credentials';
import { EmbeddingCredentialsResource } from '../resources/embedding-credentials';
import { ActionsResource } from '../resources/actions';
import { TracesResource } from '../resources/traces';
import { AuditResource } from '../resources/audit';
import { ReceiptsResource } from '../resources/receipts';
import { SystemResource } from '../resources/system';
import { AuthorizationsResource } from '../resources/authorizations';
import { McpResource } from '../resources/mcp';

// ── Composite sub-namespaces (idiomatic taxonomy) ──────────────────────

class RuntimeConversationSessions {
    readonly actions: { list: ConversationResource['actions'] };
    constructor(private readonly _conversation: ConversationResource, private readonly _sessions: ConversationSessionsResource) {
        this.actions = {
            list: _conversation.actions.bind(_conversation),
        };
    }
    list = (...args: Parameters<ConversationResource['sessions']>): ReturnType<ConversationResource['sessions']> =>
        this._conversation.sessions(...args);
    get = (sessionKey: string, opts?: Parameters<ConversationResource['session']>[1]): ReturnType<ConversationResource['session']> => this._conversation.session(sessionKey, opts);
    create = (input: Parameters<ConversationSessionsResource['create']>[0]): ReturnType<ConversationSessionsResource['create']> => this._sessions.create(input);
    delete = (sessionKey: string): Promise<void> => this._conversation.deleteSession(sessionKey);
}

class RuntimeConversation {
    readonly sessions: RuntimeConversationSessions;
    private readonly _conversation: ConversationResource;
    constructor(client: FetchClient) {
        this._conversation = new ConversationResource(client);
        const sessions = new ConversationSessionsResource(client);
        this.sessions = new RuntimeConversationSessions(this._conversation, sessions);
    }
    send = (...args: Parameters<ConversationResource['send']>): ReturnType<ConversationResource['send']> =>
        this._conversation.send(...args);
}

class RuntimeFlows {
    readonly instances: {
        list: FlowsResource['listInstances'];
        get: FlowsResource['getInstance'];
    };
    // The appended lifecycle log (`/runtime/flows/events`) — where per-step
    // history lives. Mirrors the shape of `stateMachine.events`.
    readonly events: {
        list: FlowsResource['listEvents'];
        get: FlowsResource['getEvent'];
    };
    // `list` / `get` return the callbacks a caller needs in order to KNOW which
    // callback to `resolve`.
    readonly callbacks: {
        list: FlowsResource['listCallbacks'];
        get: FlowsResource['getCallback'];
        resolve: FlowsResource['resolveCallback'];
    };
    constructor(client: FetchClient) {
        const f = new FlowsResource(client);
        this.instances = {
            list: f.listInstances.bind(f),
            get: f.getInstance.bind(f),
        };
        this.events = {
            list: f.listEvents.bind(f),
            get: f.getEvent.bind(f),
        };
        this.callbacks = {
            list: f.listCallbacks.bind(f),
            get: f.getCallback.bind(f),
            resolve: f.resolveCallback.bind(f),
        };
    }
}

class RuntimeStateMachine {
    readonly instances: {
        list: StateMachineResource['listInstances'];
        get: StateMachineResource['getInstance'];
    };
    readonly events: {
        list: StateMachineResource['listEvents'];
        get: StateMachineResource['getEvent'];
    };
    readonly transitions: {
        list: StateMachineResource['listTransitionRequests'];
        listPending: StateMachineResource['listPendingTransitions'];
        get: StateMachineResource['getTransitionRequest'];
        create: StateMachineResource['createTransitionRequest'];
        resolve: StateMachineResource['resolveTransitionRequest'];
    };
    readonly replay: StateMachineResource['replay'];
    constructor(client: FetchClient) {
        const sm = new StateMachineResource(client);
        this.instances = {
            list: sm.listInstances.bind(sm),
            get: sm.getInstance.bind(sm),
        };
        this.events = {
            list: sm.listEvents.bind(sm),
            get: sm.getEvent.bind(sm),
        };
        this.transitions = {
            list: sm.listTransitionRequests.bind(sm),
            listPending: sm.listPendingTransitions.bind(sm),
            get: sm.getTransitionRequest.bind(sm),
            create: sm.createTransitionRequest.bind(sm),
            resolve: sm.resolveTransitionRequest.bind(sm),
        };
        this.replay = sm.replay.bind(sm);
    }
}

class RuntimeEvents {
    readonly subscriptions: {
        list: EventsResource['listSubscriptions'];
        create: EventsResource['subscribe'];
        delete: EventsResource['deleteSubscription'];
    };
    readonly deliveries: {
        list: EventsResource['listDeliveries'];
    };
    // Typed SSE stream over GET /runtime/events/stream.
    readonly stream: EventsResource['stream'];
    // Async-iterable (pull) view over the same stream.
    readonly iterate: EventsResource['iterate'];
    constructor(client: FetchClient) {
        const e = new EventsResource(client);
        this.subscriptions = {
            list: e.listSubscriptions.bind(e),
            create: e.subscribe.bind(e),
            delete: e.deleteSubscription.bind(e),
        };
        this.deliveries = {
            list: e.listDeliveries.bind(e),
        };
        this.stream = e.stream.bind(e);
        this.iterate = e.iterate.bind(e);
    }
}

class RuntimeRoles {
    readonly assignments: RoleAssignmentsResource;
    constructor(client: FetchClient) {
        this.assignments = new RoleAssignmentsResource(client);
    }
}

class RuntimeLlm {
    readonly services: LlmServicesResource;
    readonly credentials: LlmCredentialsResource;
    constructor(client: FetchClient) {
        this.services = new LlmServicesResource(client);
        this.credentials = new LlmCredentialsResource(client);
    }
}

class RuntimeEmbeddings {
    readonly credentials: EmbeddingCredentialsResource;
    constructor(client: FetchClient) {
        this.credentials = new EmbeddingCredentialsResource(client);
    }
}

class RuntimeImports {
    private readonly _imp: ImportsResource;
    constructor(client: FetchClient) {
        this._imp = new ImportsResource(client);
    }
    snapshot = (...args: Parameters<ImportsResource['snapshot']>): ReturnType<ImportsResource['snapshot']> =>
        this._imp.snapshot(...args);
}

// ── Top-level RuntimeNamespace ─────────────────────────────────────────

export class RuntimeNamespace {
    readonly records: RecordsResource;
    readonly conversation: RuntimeConversation;
    readonly tools: ToolsResource;
    readonly flows: RuntimeFlows;
    readonly stateMachine: RuntimeStateMachine;
    readonly events: RuntimeEvents;
    readonly roles: RuntimeRoles;
    // Recompute rewrites records, so its verb is here; entity
    // AUTHORING stays on `contract.entities`.
    readonly entities: RuntimeEntitiesResource;
    readonly llm: RuntimeLlm;
    readonly embeddings: RuntimeEmbeddings;
    readonly traces: TracesResource;
    // Audit tamper-evidence bundle download (binary .tar.gz).
    readonly audit: AuditResource;
    // The caller's own governance receipts (self-scoped, no view_traces).
    readonly receipts: ReceiptsResource;
    readonly actions: ActionsResource;
    readonly imports: RuntimeImports;
    readonly system: SystemResource;
    // Effective-authorizations introspection.
    readonly authorizations: AuthorizationsResource;
    // Typed path for the raw MCP stream POST.
    readonly mcp: McpResource;
    // The four channel ops (channel-class credential only). The closed SDK duplex
    // surface a channel gateway uses.
    readonly channels: ChannelsResource;

    constructor(client: FetchClient) {
        this.records = new RecordsResource(client);
        this.conversation = new RuntimeConversation(client);
        this.tools = new ToolsResource(client);
        this.flows = new RuntimeFlows(client);
        this.stateMachine = new RuntimeStateMachine(client);
        this.events = new RuntimeEvents(client);
        this.roles = new RuntimeRoles(client);
        this.entities = new RuntimeEntitiesResource(client);
        this.llm = new RuntimeLlm(client);
        this.embeddings = new RuntimeEmbeddings(client);
        this.traces = new TracesResource(client);
        this.audit = new AuditResource(client);
        this.receipts = new ReceiptsResource(client);
        this.actions = new ActionsResource(client);
        this.imports = new RuntimeImports(client);
        this.system = new SystemResource(client);
        this.authorizations = new AuthorizationsResource(client);
        this.mcp = new McpResource(client);
        this.channels = new ChannelsResource(client);
    }
}
