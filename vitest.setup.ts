import "@testing-library/jest-dom";
import { vi } from "vitest";

// Make @testing-library/dom's jestFakeTimersAreEnabled() work with vitest.
// The helper checks `typeof jest !== 'undefined'` and then calls
// `jest.advanceTimersByTime()` inside waitFor's polling loop.
// Vitest does not inject a `jest` global, so we alias vi → jest here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).jest = vi;
