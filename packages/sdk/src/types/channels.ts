// SPDX-License-Identifier: MIT
// Copyright 2026 Nicolas Moreno
// The four channel-ops DTOs (SDK-local, zero-dependency mirror of the
// runtime API's channel schemas). The server validates requests; these
// are the typed client view.

export interface MintPartyTokenRequest {
    /** The recipient's keyed party pseudonym (64-hex). Channel is implied by the credential. */
    readonly party_ref: string;
}

export interface PartyToken {
    readonly token: string;
    readonly expires_at: string;
}

/** The fetch(=claim) response: the directive metadata PLUS the resolved body. */
export interface ChannelDirectiveContent {
    readonly id: string;
    readonly channel_name: string;
    readonly recipient_ref: string;
    readonly content_ref: string;
    readonly delivery_mode: 'freeform' | 'template' | 'deferred';
    readonly template?: { readonly id: string; readonly version: number };
    readonly correlation: { readonly session_key: string; readonly turn_seq: number };
    readonly deadline_at?: string;
    /** The reply body to deliver. Audit records keep only the metadata; the body is returned only by this fetch. */
    readonly content: string;
}

export interface ChannelSendResult {
    readonly status: 'accepted' | 'failed' | 'deferred';
    readonly provider_message_id?: string;
    readonly attested_by: 'runtime' | 'channel_provider';
}

/** A `channel.directive_created` event off the subscribe stream. */
export interface ChannelDirectiveStreamEvent {
    readonly directive_id: string;
}
