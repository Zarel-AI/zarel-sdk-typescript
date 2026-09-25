// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// contract.batch.execute()
//
// Top-level infrastructure endpoint. The body is the batch envelope the server
// validates; the SDK forwards it and returns what the server produces.
//
// EVERY TYPE HERE IS DERIVED from the published schema:
//
//   - the request is `{operations: [{id, method, path, …}]}` — the validator answers
//     `batch_operations_missing` to a body without `operations`;
//   - each operation names a `path`, not a `url` — anything else is `batch_path_invalid`;
//   - BOTH the 200 and the 207 answer `{responses: [{id, status, headers, body}]}`, which is
//     not a {success,data} envelope, so the result is returned whole.

import type { FetchClient } from '../_internal/fetch-client';
import type {
    BatchOperationPayload,
    BatchRequestPayload,
    BatchResponseItemPayload,
    BatchResponsePayload,
} from '../generated';

/** One operation in a batch. `path`, not `url`; must begin with `/`. */
export type BatchOperation = BatchOperationPayload;

/** The batch body. The key is `operations`, and at most 50. */
export type BatchRequest = BatchRequestPayload;

/** One settled operation. `status` is a number, or the literal `'skipped'`. */
export type BatchResponseItem = BatchResponseItemPayload;

/** The batch result, returned WHOLE — this operation is not envelope-wrapped. */
export type BatchResponse = BatchResponsePayload;

export class BatchResource {
    constructor(private readonly client: FetchClient) {}

    async execute(request: BatchRequest): Promise<BatchResponse> {
        return await this.client.post<BatchResponse>('/contract/batch', request, { operationId: 'batchMutate' });
    }
}
