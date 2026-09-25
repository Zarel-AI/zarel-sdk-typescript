// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.treatment.vocabulary — the tenant's term list.
// CRUD on /contract/treatment/vocabulary (+ /{term}).
//
// THIS COLLECTION IS THE ONLY AUTHORITY for the vocabulary. `contract.treatment.get()`
// answers the terms written here, and `contract.treatment.put()`/`patch()` refuse a
// `vocabulary` key.
//
// Every shape is derived from the published schema; see `types/treatment-contract.ts`.

import { type FetchClient, localeQuery } from '../../_internal/fetch-client';
import type { LocaleOptions } from '../../types/locale';
import type {
    ContractDeletedAck,
    ContractVocabularyCreate,
    ContractVocabularyEntry,
    ContractVocabularyWrite,
} from '../../types/treatment-contract';

export type { ContractVocabularyEntry };

export class VocabularyResource {
    constructor(private readonly client: FetchClient) {}

    private base(): string {
        return '/contract/treatment/vocabulary';
    }

    async list(options?: LocaleOptions): Promise<ContractVocabularyEntry[]> {
        return await this.client.get<ContractVocabularyEntry[]>(this.base(), localeQuery(options), { operationId: 'listVocabulary' });
    }

    async get(term: string, options?: LocaleOptions): Promise<ContractVocabularyEntry> {
        return await this.client.get<ContractVocabularyEntry>(`${this.base()}/${encodeURIComponent(term)}`, localeQuery(options), { operationId: 'getVocabularyEntry' });
    }

    /** Creates, or RESURRECTS a term that was previously deleted. A live term is a 409. */
    async create(input: ContractVocabularyCreate): Promise<ContractVocabularyEntry> {
        return await this.client.post<ContractVocabularyEntry>(this.base(), input, { operationId: 'createVocabularyEntry' });
    }

    /**
     * A TOTAL write: `means` is the entry's only mutable field and the body must state it.
     * The intersection is what makes that a compile error rather than a 400 — the published
     * body has `means` optional because PATCH shares the shape, and only PUT requires it.
     */
    async put(term: string, input: ContractVocabularyWrite & { means: string }): Promise<ContractVocabularyEntry> {
        return await this.client.put<ContractVocabularyEntry>(`${this.base()}/${encodeURIComponent(term)}`, input, { operationId: 'replaceVocabularyEntry' });
    }

    async patch(term: string, patch: ContractVocabularyWrite): Promise<ContractVocabularyEntry> {
        return await this.client.patch<ContractVocabularyEntry>(`${this.base()}/${encodeURIComponent(term)}`, patch, { operationId: 'patchVocabularyEntry' });
    }

    /** Answers `{message}`, not an empty body — and the term can be created again after. */
    async delete(term: string): Promise<ContractDeletedAck> {
        return await this.client.del<ContractDeletedAck>(`${this.base()}/${encodeURIComponent(term)}`, { operationId: 'deleteVocabularyEntry' });
    }
}
