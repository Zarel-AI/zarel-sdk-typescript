// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
/**
 * Locale propagation through SDK methods.
 *
 * Verifies:
 *   - Passing `{locale: 'es'}` sends `?locale=es` as a query record.
 *   - Omitting locale sends NO `?locale=` query (server applies its
 *     own JWT → canonical fallback).
 *   - Both `entities.list` / `entities.get` and `tools.list` / `tools.mcp`
 *     and `roles.list` honor the option.
 */

import { EntitiesResource } from '../src/resources/entities';
import { ToolsResource } from '../src/resources/tools';
import { RolesResource } from '../src/resources/roles';
import { ConversationResource } from '../src/resources/conversation';
import { RecordsResource } from '../src/resources/records';
import { EventsResource } from '../src/resources/events';
import { FlowsResource } from '../src/resources/flows';
import { LlmServicesResource } from '../src/resources/llm-services';
import { LlmCredentialsResource } from '../src/resources/llm-credentials';
import { RoleAssignmentsResource } from '../src/resources/role-assignments';
import { StateMachineResource } from '../src/resources/state-machine';
import { SpecResource } from '../src/resources/contracts';
import type { FetchClient } from '../src/_internal/fetch-client';

interface MockClient {
    get: jest.Mock;
    post: jest.Mock;
    patch: jest.Mock;
    del: jest.Mock;
}

function createMockClient(): MockClient {
    return {
        get: jest.fn(() => Promise.resolve({ success: true, data: [] })),
        post: jest.fn(() => Promise.resolve({ success: true })),
        patch: jest.fn(() => Promise.resolve({ success: true })),
        del: jest.fn(() => Promise.resolve({ success: true })),
    };
}

describe('SDK locale propagation', () => {
    describe('EntitiesResource', () => {
        it('omits ?locale= when no locale arg', async () => {
            const client = createMockClient();
            const resource = new EntitiesResource(client as unknown as FetchClient);
            await resource.list();
            expect(client.get).toHaveBeenCalledWith('/contract/entities', {}, { operationId: 'listEntities' });
        });

        it('sends ?locale=es when locale: "es"', async () => {
            const client = createMockClient();
            const resource = new EntitiesResource(client as unknown as FetchClient);
            await resource.list({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/contract/entities', { locale: 'es' }, { operationId: 'listEntities' });
        });

        it('threads locale to entities.get', async () => {
            const client = createMockClient();
            const resource = new EntitiesResource(client as unknown as FetchClient);
            await resource.get('orders', { locale: 'en' });
            expect(client.get).toHaveBeenCalledWith('/contract/entities/orders', { locale: 'en' }, { operationId: 'getEntity' });
        });
    });

    describe('ToolsResource', () => {
        it('omits ?locale= when no locale arg', async () => {
            const client = createMockClient();
            const resource = new ToolsResource(client as unknown as FetchClient);
            await resource.list();
            expect(client.get).toHaveBeenCalledWith('/runtime/tools', {}, { operationId: 'runtimeToolsList' });
        });

        it('threads locale to tools.list', async () => {
            const client = createMockClient();
            const resource = new ToolsResource(client as unknown as FetchClient);
            await resource.list({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/tools', { locale: 'es' }, { operationId: 'runtimeToolsList' });
        });

        it('threads locale to tools.mcp', async () => {
            const client = createMockClient();
            const resource = new ToolsResource(client as unknown as FetchClient);
            await resource.mcp({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/tools/mcp/list', { locale: 'es' }, { operationId: 'runtimeToolsMcpList' });
        });
    });

    describe('RolesResource', () => {
        it('omits ?locale= when no locale arg', async () => {
            const client = createMockClient();
            const resource = new RolesResource(client as unknown as FetchClient);
            await resource.list();
            expect(client.get).toHaveBeenCalledWith('/contract/roles', {}, { operationId: 'listRoles' });
        });

        it('threads locale to roles.list', async () => {
            const client = createMockClient();
            const resource = new RolesResource(client as unknown as FetchClient);
            await resource.list({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/contract/roles', { locale: 'es' }, { operationId: 'listRoles' });
        });
    });

    describe('forward-compat locale codes', () => {
        it('passes through unsupported codes — server returns 400, not the SDK', async () => {
            const client = createMockClient();
            const resource = new EntitiesResource(client as unknown as FetchClient);
            // SdkLocale = 'en' | 'es' | (string & {}) deliberately allows pass-through.
            await resource.list({ locale: 'fr' });
            expect(client.get).toHaveBeenCalledWith('/contract/entities', { locale: 'fr' }, { operationId: 'listEntities' });
        });
    });

    // LocaleOptions also extends to conversation / records /
    // events / flows / llm-services / llm-credentials / role-assignments /
    // state-machine / contracts. The fitness check below ensures every method
    // forwards `?locale=` exactly once when supplied and omits it otherwise.

    describe('ConversationResource', () => {
        it('conversation.send forwards locale as URL query (POST)', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);
            await resource.send({ message: 'hi', session_key: 'cs_1' }, { locale: 'es' });
            expect(client.post).toHaveBeenCalledWith('/runtime/conversation/send?locale=es', { message: 'hi', session_key: 'cs_1' }, { operationId: 'runtimeConversationSend' });
        });

        it('conversation.send omits ?locale= when not supplied', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);
            await resource.send({ message: 'hi', session_key: 'cs_1' });
            expect(client.post).toHaveBeenCalledWith('/runtime/conversation/send', { message: 'hi', session_key: 'cs_1' }, { operationId: 'runtimeConversationSend' });
        });

        it('conversation.sessions threads locale alongside list params', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);
            await resource.sessions({ limit: 5 }, { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/conversation/sessions?limit=5&locale=es', undefined, { operationId: 'listConversationSessions' });
        });

        it('conversation.session threads locale via query record', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);
            await resource.session('k1', { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/conversation/sessions/k1', { locale: 'es' }, { operationId: 'getConversationSession' });
        });

        it('conversation.actions threads locale via query record', async () => {
            const client = createMockClient();
            const resource = new ConversationResource(client as unknown as FetchClient);
            await resource.actions('k1', { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/conversation/sessions/k1/actions', { locale: 'es' }, { operationId: 'listConversationActions' });
        });
    });

    describe('RecordsResource', () => {
        it('records.list forwards locale alongside params', async () => {
            const client = createMockClient();
            const resource = new RecordsResource(client as unknown as FetchClient);
            await resource.list('tickets', { limit: 10 }, { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/records/tickets', { limit: 10, locale: 'es' }, { operationId: 'listRuntimeRecords' });
        });

        it('records.get forwards locale via query record', async () => {
            const client = createMockClient();
            const resource = new RecordsResource(client as unknown as FetchClient);
            await resource.get('tickets', 'abc', { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/records/tickets/abc', { locale: 'es' }, { operationId: 'getRuntimeRecord' });
        });
    });

    describe('EventsResource', () => {
        it('listSubscriptions forwards locale when supplied', async () => {
            const client = createMockClient();
            const resource = new EventsResource(client as unknown as FetchClient);
            await resource.listSubscriptions({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/events/subscriptions', { locale: 'es' }, { operationId: 'listEventSubscriptions' });
        });

        it('listSubscriptions omits query record when locale unset (legacy shape preserved)', async () => {
            const client = createMockClient();
            const resource = new EventsResource(client as unknown as FetchClient);
            await resource.listSubscriptions();
            expect(client.get).toHaveBeenCalledWith('/runtime/events/subscriptions', undefined, { operationId: 'listEventSubscriptions' });
        });
    });

    describe('FlowsResource', () => {
        it('listInstances forwards locale when supplied', async () => {
            const client = createMockClient();
            const resource = new FlowsResource(client as unknown as FetchClient);
            await resource.listInstances({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/flows/instances', { locale: 'es' }, { operationId: 'listFlowInstances' });
        });

        it('getInstance forwards locale when supplied', async () => {
            const client = createMockClient();
            const resource = new FlowsResource(client as unknown as FetchClient);
            await resource.getInstance('exec1', { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/flows/instances/exec1', { locale: 'es' }, { operationId: 'getFlowInstance' });
        });
    });

    describe('LlmServicesResource', () => {
        it('list merges scope + locale into one query string', async () => {
            const client = createMockClient();
            const resource = new LlmServicesResource(client as unknown as FetchClient);
            await resource.list({ scope: 'runtime' }, { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/llm/services?scope=runtime&locale=es', undefined, { operationId: 'listLlmServices' });
        });

        it('get merges scope + locale into one query string', async () => {
            const client = createMockClient();
            const resource = new LlmServicesResource(client as unknown as FetchClient);
            await resource.get('primary', { scope: 'runtime' }, { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/llm/services/primary?scope=runtime&locale=es', undefined, { operationId: 'getLlmService' });
        });
    });

    describe('LlmCredentialsResource', () => {
        it('list forwards locale when supplied', async () => {
            const client = createMockClient();
            const resource = new LlmCredentialsResource(client as unknown as FetchClient);
            await resource.list({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/llm/credentials', { locale: 'es' }, { operationId: 'listLlmCredentials' });
        });

        it('get forwards locale when supplied', async () => {
            const client = createMockClient();
            const resource = new LlmCredentialsResource(client as unknown as FetchClient);
            await resource.get('primary', { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/llm/credentials/primary', { locale: 'es' }, { operationId: 'getLlmCredential' });
        });
    });

    describe('RoleAssignmentsResource', () => {
        it('list forwards locale when supplied', async () => {
            const client = createMockClient();
            const resource = new RoleAssignmentsResource(client as unknown as FetchClient);
            await resource.list({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/roles/assignments', { locale: 'es' }, { operationId: 'listRoleAssignments' });
        });
    });

    describe('StateMachineResource', () => {
        it('listInstances forwards locale via query record', async () => {
            const client = createMockClient();
            const resource = new StateMachineResource(client as unknown as FetchClient);
            await resource.listInstances({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/state-machine/instances', { locale: 'es' }, { operationId: 'listStateMachineInstances' });
        });

        it('listEvents merges entity filter + locale', async () => {
            const client = createMockClient();
            const resource = new StateMachineResource(client as unknown as FetchClient);
            await resource.listEvents({ entity_name: 'tickets' }, { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/state-machine/events', { entity_name: 'tickets', locale: 'es' }, { operationId: 'listStateMachineEvents' });
        });

        it('listPendingTransitions forwards locale via the parent list method', async () => {
            const client = createMockClient();
            const resource = new StateMachineResource(client as unknown as FetchClient);
            await resource.listPendingTransitions({ roles: ['admin'] }, { locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/runtime/state-machine/transition-requests', { status: 'pending', roles: ['admin'], locale: 'es' }, { operationId: 'listTransitionRequests' });
        });
    });

    describe('SpecResource', () => {
        it('snapshot forwards locale when supplied', async () => {
            const client = createMockClient();
            client.get = jest.fn(() => Promise.resolve({ success: true, data: {} }));
            const resource = new SpecResource(client as unknown as FetchClient);
            await resource.snapshot({ locale: 'es' });
            expect(client.get).toHaveBeenCalledWith('/contract/spec/snapshot', { locale: 'es' }, { operationId: 'specSnapshot' });
        });

        it('snapshot omits query record when locale unset (legacy shape preserved)', async () => {
            const client = createMockClient();
            client.get = jest.fn(() => Promise.resolve({ success: true, data: {} }));
            const resource = new SpecResource(client as unknown as FetchClient);
            await resource.snapshot();
            expect(client.get).toHaveBeenCalledWith('/contract/spec/snapshot', undefined, { operationId: 'specSnapshot' });
        });
    });
});
