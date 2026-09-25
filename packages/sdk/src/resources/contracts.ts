// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
import { type FetchClient, localeQueryOrUndefined } from '../_internal/fetch-client';
import type {
    SpecDiff,
    SpecPublishRequest,
    SpecPublishResponse,
    SpecDiffRequest,
    SpecApplyRequest,
    SpecApplyResponse,
    SpecSnapshotV1Response,
    SpecDryRunSubmitRequest,
    SpecDryRunSubmitResponse,
    SpecDryRunJob,
} from '../types/spec';
import type { LocaleOptions } from '../types/locale';

/**
 * Spec resource: publish, diff, apply, snapshot and dry-run a tenant's contract.
 *
 * Operations (paths are relative to the contract API base URL):
 *   - publish(req)    → POST /contract/spec/publish
 *   - diff(req)       → POST /contract/spec/diff
 *   - apply(req)      → POST /contract/spec/apply
 *   - snapshot()      → GET  /contract/spec/snapshot
 *   - dryRun(req)     → POST /contract/spec/dry-run
 *   - dryRunReport()  → GET  /contract/spec/dry-run/:id
 *   - dryRunCancel()  → DELETE /contract/spec/dry-run/:id
 */
export class SpecResource {
    public constructor(private readonly client: FetchClient) {}

    public async publish(request: SpecPublishRequest): Promise<SpecPublishResponse> {
        return await this.client.post<SpecPublishResponse>('/contract/spec/publish', request, { operationId: 'specPublish' });
    }

    public async diff(request: SpecDiffRequest): Promise<SpecDiff> {
        return await this.client.post<SpecDiff>('/contract/spec/diff', request, { operationId: 'specDiff' });
    }

    public async apply(request: SpecApplyRequest): Promise<SpecApplyResponse> {
        return await this.client.post<SpecApplyResponse>('/contract/spec/apply', request, { operationId: 'specApply' });
    }

    public async snapshot(options?: LocaleOptions): Promise<SpecSnapshotV1Response> {
        const q = localeQueryOrUndefined(options);
        // GET /contract/spec/snapshot returns the flat TenantContract body
        // directly, with no {success,data} envelope. The response IS the
        // snapshot — opt out of the transport envelope-unwrap so the bare
        // body is returned unchanged (unwrapping would erase entities/roles).
        const data = await this.client.get<Record<string, unknown>>(
            '/contract/spec/snapshot',
            q,
            { operationId: 'specSnapshot' },
        );
        const contractVersion = Number(data.contract_version ?? 0);
        return {
            tenant_name: String((data.metadata as { name?: string } | undefined)?.name ?? ''),
            spec_version: String((data.spec_version as string | undefined) ?? `v${contractVersion}`),
            contract_version: contractVersion,
            hash: `v${contractVersion}`,
            contract: data,
        };
    }

    /** GET /contract/spec/snapshot/locale-coverage — i18n coverage report for the published snapshot. */
    public async snapshotLocaleCoverage(options?: LocaleOptions): Promise<Record<string, unknown>> {
        return await this.client.get<Record<string, unknown>>(
            '/contract/spec/snapshot/locale-coverage',
            localeQueryOrUndefined(options),
            { operationId: 'specSnapshotLocaleCoverage' },
        );
    }

    /**
     * GET /contract/spec/snapshot/semantic-diff — semantic diff between two published
     * contract versions. `from`/`to` are REQUIRED (contract versions, ≥ 1).
     */
    public async snapshotSemanticDiff(input: { from: number; to: number } & LocaleOptions): Promise<Record<string, unknown>> {
        const query: Record<string, string> = { from: String(input.from), to: String(input.to) };
        if (input.locale) query.locale = input.locale;
        return await this.client.get<Record<string, unknown>>(
            '/contract/spec/snapshot/semantic-diff',
            query,
            { operationId: 'specSnapshotSemanticDiff' },
        );
    }

    /**
     * Submit an async dry-run.
     */
    public async dryRun(request: SpecDryRunSubmitRequest): Promise<SpecDryRunSubmitResponse> {
        return await this.client.post<SpecDryRunSubmitResponse>('/contract/spec/dry-run', request, { operationId: 'specDryRunSubmit' });
    }

    /**
     * Poll the dry-run job for status / report.
     */
    public async dryRunReport(reportId: string, options?: LocaleOptions): Promise<SpecDryRunJob> {
        const path = `/contract/spec/dry-run/${encodeURIComponent(reportId)}`;
        const q = localeQueryOrUndefined(options);
        return q
            ? await this.client.get<SpecDryRunJob>(path, q, { operationId: 'specDryRunGet' })
            : await this.client.get<SpecDryRunJob>(path, undefined, { operationId: 'specDryRunGet' });
    }

    /**
     * Cancel a queued / running dry-run job.
     */
    public async dryRunCancel(reportId: string): Promise<void> {
        await this.client.del<void>(`/contract/spec/dry-run/${encodeURIComponent(reportId)}`, { operationId: 'specDryRunCancel' });
    }
}
