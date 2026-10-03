/** Vitest setup (`setupFiles` in vitest.config.mts): fail tests on unexpected console output. */
import { afterEach } from 'vitest';
import { installConsoleGuard } from './consoleGuard';

installConsoleGuard(afterEach);
