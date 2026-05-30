/**
 * Effect service for command execution inside compute sandboxes.
 *
 * @packageDocumentation
 */

import { Context, Effect, Layer } from 'effect'

import {
  didSandboxCommandFail,
  runSandboxCommand,
  sandboxCommandErrorText,
  type ComputeCommandSandbox,
  type SandboxCommandOptions,
  type SandboxCommandOutput,
} from '../lib/sandbox-command'
import { SandboxCommandError } from './errors'

/** Injectable command runner for sandbox operations. */
export interface SandboxCommandsService {
  /** Run a command and return its raw output shape. */
  readonly run: (
    sandbox: ComputeCommandSandbox,
    command: string,
    options?: SandboxCommandOptions,
  ) => Effect.Effect<SandboxCommandOutput, SandboxCommandError>
  /** Run a command and fail when the command result indicates non-zero/error. */
  readonly runSuccessful: (
    sandbox: ComputeCommandSandbox,
    command: string,
    options?: SandboxCommandOptions,
  ) => Effect.Effect<SandboxCommandOutput, SandboxCommandError>
}

/** Injectable {@link SandboxCommandsService}. */
export class SandboxCommands extends Context.Tag('SandboxCommands')<
  SandboxCommands,
  SandboxCommandsService
>() {}

const service: SandboxCommandsService = {
  run: (sandbox, command, options = {}) =>
    Effect.tryPromise({
      try: () => runSandboxCommand(sandbox, command, options),
      catch: (cause) =>
        new SandboxCommandError({
          command,
          reason: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }),

  runSuccessful: (sandbox, command, options = {}) =>
    service.run(sandbox, command, options).pipe(
      Effect.flatMap((output) =>
        didSandboxCommandFail(output)
          ? Effect.fail(
              new SandboxCommandError({
                command,
                reason: sandboxCommandErrorText(output),
              }),
            )
          : Effect.succeed(output),
      ),
    ),
}

/** Live command runner backed by Ship's sandbox command compatibility helper. */
export const SandboxCommandsLive = Layer.succeed(SandboxCommands, service)
