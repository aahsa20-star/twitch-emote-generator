/**
 * GIF encoder entry point.
 * Animation logic has been split into src/lib/animations/ for maintainability.
 * This file re-exports generateGif to preserve existing import paths.
 */
export { generateGif } from "./animations";
