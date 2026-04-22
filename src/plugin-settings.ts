/**
 * @file
 *
 * Plugin settings data class with default values.
 */

/**
 * Settings for the Backlink Full Path plugin.
 */
export class PluginSettings {
  /**
   * The depth of the path to include in backlinks (0 for unlimited).
   */
  public pathDepth = 0;

  /**
   * The paths to be treated as root paths.
   */
  public rootPaths: string[] = [];

  /**
   * Whether to display the parent path on a separate line.
   */
  public shouldDisplayParentPathOnSeparateLine = false;

  /**
   * Whether to highlight the file name.
   */
  public shouldHighlightFileName = true;

  /**
   * Whether to include the file extension in backlinks.
   */
  public shouldIncludeExtension = true;

  /**
   * Whether to reverse the path parts.
   */
  public shouldReversePathParts = false;

  /**
   * Whether to show ellipsis for skipped path parts.
   */
  public shouldShowEllipsisForSkippedPathParts = true;
}
