/**
 * The shared Effect runtime for the API Worker.
 *
 * Effects are constructed throughout the codebase but only ever *executed* at a
 * boundary (an HTTP handler, a Durable Object method). `runPromise` /
 * `runPromiseExit` are those boundary executors. Per-request resources (the D1
 * binding, OAuth config) are provided as services at the call site rather than
 * baked into a global layer, because they originate from the Worker `env`.
 *
 * @packageDocumentation
 */

import { Layer, ManagedRuntime } from 'effect'

/**
 * Base layer for runtime-wide services. Per-request bindings are layered on at
 * the boundary; this stays empty so the runtime is safe to share across the
 * Worker's lifetime.
 */
export const AppLayer = Layer.empty

/** The process-wide managed runtime built from {@link AppLayer}. */
export const appRuntime = ManagedRuntime.make(AppLayer)

/** Execute an Effect at a boundary, rejecting on failure. */
export const runPromise = appRuntime.runPromise

/** Execute an Effect at a boundary, returning an `Exit` instead of rejecting. */
export const runPromiseExit = appRuntime.runPromiseExit
