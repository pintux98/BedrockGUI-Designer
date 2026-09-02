/**
 * Limits the plugin actually enforces. Every entry must point at Java that
 * rejects, truncates or warns — a designer-only rule of thumb does not belong here.
 *
 * Deliberately absent: a minimum button count for SIMPLE and a minimum component
 * count for CUSTOM. Neither exists in the plugin. `ConfigValidator.validateButtons`
 * (ConfigValidator.java:97-104) warns about an empty button list only when the form
 * type is `modal`, and `validateFormTypeSpecific` (ConfigValidator.java:352-366)
 * has nothing at all for CUSTOM — its branch is literally `case "custom": break;`.
 * An empty SIMPLE or CUSTOM form loads and opens.
 */
export const LIMITS = {
  /**
   * MessageActionHandler.java:151 — `trimmed.length() > 0 && trimmed.length() <= 2048`
   * in the handler's validity check.
   */
  messageMaxChars: 2048,
  /**
   * DelayActionHandler.java:18 — `private static final long MAX_DELAY_MS = 30000;`
   * enforced at DelayActionHandler.java:152-153, which fails the action outright.
   */
  delayMaxMs: 30000,
  /**
   * ConfigValidator.java:357-360 — a modal whose button list is not exactly 2
   * raises a validation *error*, not a warning.
   */
  modalButtonCount: 2
} as const;
