/** Genesis failures retain machine-readable handling codes and contained causes. @module */
/** Failure that prevents trusted Genesis operations until corrected or reloaded. */
export class GenesisError extends Error {
  /**
   * @param code - Stable failure category.
   * @param message - Affected operation and safe recovery action.
   * @param options - Contained implementation failure, never model-visible.
   */
  constructor(
    readonly code: 'closed' | 'storage' | 'invalid-source' | 'capacity' | 'locked' | 'invalid-state',
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'GenesisError'
  }
}
