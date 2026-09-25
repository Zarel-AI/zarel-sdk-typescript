// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.treatment — the conversation-treatment document (`get`/`put`/`patch` on
// /contract/treatment) PLUS the children the HTTP hierarchy declares: `vocabulary`,
// `profiles` (the overrides) and `rails` (the non-overridable half).
//
// `profiles` and `rails` are nested HERE, not hoisted onto `contract`, because the
// SDK's TS access path must be a PREFIX of the HTTP path it targets.
// `contract.rails` -> /contract/treatment/rails invents a level and is a structural
// violation; `contract.treatment.rails` is not. A structural test walks every accessor
// and checks it against this rule.
//
// Distinct from the top-level contract.assistant authoring surface
// (/contract/assistant) — a different feature at a different HTTP level.

// THE READ AND THE WRITE ARE DIFFERENT TYPES, and that is the point of the pair.
// `get()` answers a `vocabulary` composed from the child collection; `put()`/`patch()`
// REFUSE it, along with `profiles` and `rails` — each is stored apart from the treatment
// document, so each has its own accessor below.

import type { FetchClient } from '../../_internal/fetch-client';
import type {
    ContractTreatment,
    ContractTreatmentPatch,
    ContractTreatmentRails,
    ContractTreatmentRailsPatch,
    ContractTreatmentWrite,
} from '../../types/treatment-contract';
import { SingletonAccessor } from '../_singleton';
import { VocabularyResource } from './vocabulary';
import { ProfilesResource } from './profiles';

export class TreatmentResource extends SingletonAccessor<
    ContractTreatment, ContractTreatmentWrite, ContractTreatmentPatch
> {
    readonly vocabulary: VocabularyResource;
    readonly profiles: ProfilesResource;
    readonly rails: SingletonAccessor<ContractTreatmentRails, ContractTreatmentRails, ContractTreatmentRailsPatch>;
    constructor(client: FetchClient) {
        super(client, '/contract/treatment', {
            get: 'getTreatment',
            put: 'putTreatment',
            patch: 'patchTreatment',
        });
        this.vocabulary = new VocabularyResource(client);
        this.profiles = new ProfilesResource(client);
        this.rails = new SingletonAccessor<ContractTreatmentRails, ContractTreatmentRails, ContractTreatmentRailsPatch>(
            client,
            '/contract/treatment/rails',
            { get: 'getTreatmentRails', put: 'putTreatmentRails', patch: 'patchTreatmentRails' },
        );
    }
}
