import {
  RENDERER_SERVER_ORIGIN_ARGUMENT,
  type RendererRuntimeConfig,
  rendererRuntimeConfigSchema,
} from '../../shared/protocols/electron/runtime.ts';

export type RuntimeConfig = Readonly<RendererRuntimeConfig>;

export function createRuntimeConfig(argv: readonly string[]): RuntimeConfig {
  const argument = argv.find((value) => value.startsWith(RENDERER_SERVER_ORIGIN_ARGUMENT));
  const serverOrigin = argument?.slice(RENDERER_SERVER_ORIGIN_ARGUMENT.length);
  return Object.freeze(rendererRuntimeConfigSchema.parse({ serverOrigin }));
}
