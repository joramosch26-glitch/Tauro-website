import type { HomeownerGuideDocumentData } from "../presentation/types.js";
import { exchangeHomeownerToken, fetchHomeownerDocument } from "./client.js";
import { captureHomeownerFragment } from "./fragment.js";
import type { HomeownerFragmentCapture } from "./fragment.js";

export type HomeownerBootstrapState = { kind: "ready"; document: HomeownerGuideDocumentData } | { kind: "unavailable" };
type HomeownerBootstrapDependencies = { exchangeToken: (token: string) => Promise<boolean>; fetchDocument: () => Promise<HomeownerGuideDocumentData | null> };
export type HomeownerNavigationSnapshot = { generation: number; state: HomeownerBootstrapState | null };
type HashChangeEventSource = Pick<Window, "addEventListener" | "removeEventListener">;

export async function runHomeownerBootstrap(token: string | null, dependencies: HomeownerBootstrapDependencies): Promise<HomeownerBootstrapState> {
  try {
    let exchangeToken = token;
    if (exchangeToken !== null) {
      const exchanged = await dependencies.exchangeToken(exchangeToken);
      exchangeToken = null;
      if (!exchanged) return { kind: "unavailable" };
    }
    const document = await dependencies.fetchDocument();
    return document ? { kind: "ready", document } : { kind: "unavailable" };
  } catch { return { kind: "unavailable" }; }
}

export function createHomeownerNavigationController(dependencies: HomeownerBootstrapDependencies) {
  let generation = 0;
  let snapshot: HomeownerNavigationSnapshot = { generation, state: null };
  let tail: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();

  function publish(state: HomeownerBootstrapState | null, nextGeneration = generation) {
    snapshot = { generation: nextGeneration, state };
    listeners.forEach((listener) => listener());
  }

  function start(token: string | null) {
    const operationGeneration = ++generation;
    let queuedToken = token;
    token = null;
    publish(null, operationGeneration);

    const operation = tail.then(async () => {
      const operationToken = queuedToken;
      queuedToken = null;
      const result = await runHomeownerBootstrap(operationToken, dependencies);
      if (operationGeneration === generation) publish(result, operationGeneration);
      return result;
    });
    tail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start,
    whenIdle: () => tail,
  };
}

export function installHomeownerHashNavigation(
  eventSource: HashChangeEventSource,
  captureCurrentFragment: () => HomeownerFragmentCapture,
  startNavigation: (token: string | null) => void,
) {
  const onHashChange = () => {
    const capture = captureCurrentFragment();
    if (capture.captured) startNavigation(capture.token);
  };
  eventSource.addEventListener("hashchange", onHashChange);
  return () => eventSource.removeEventListener("hashchange", onHashChange);
}

let browserController: ReturnType<typeof createHomeownerNavigationController> | null = null;

export function initializeHomeownerNavigationController() {
  if (browserController) return browserController;

  const initialCapture = captureHomeownerFragment(window.location, window.history);
  const controller = createHomeownerNavigationController({
    exchangeToken: exchangeHomeownerToken,
    fetchDocument: fetchHomeownerDocument,
  });
  installHomeownerHashNavigation(
    window,
    () => captureHomeownerFragment(window.location, window.history),
    controller.start,
  );
  controller.start(initialCapture.token);
  browserController = controller;
  return controller;
}

export function getHomeownerNavigationController() {
  if (!browserController) throw new Error("Homeowner navigation has not been initialized.");
  return browserController;
}
